#![allow(dead_code)]

use crate::models::error::{AppError, AppResult};
use rusqlite::{Connection, OptionalExtension};

/// 数据库版本
const CURRENT_DB_VERSION: i32 = 7;

/// 获取当前数据库版本
pub fn get_db_version(conn: &Connection) -> AppResult<i32> {
    // 使用 SQLite 的 user_version pragma 来存储版本号
    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| AppError::DatabaseError {
            message: format!("获取数据库版本失败: {}", e),
        })?;

    Ok(version)
}

/// 设置数据库版本
fn set_db_version(conn: &Connection, version: i32) -> AppResult<()> {
    conn.execute(&format!("PRAGMA user_version = {}", version), [])
        .map_err(|e| AppError::DatabaseError {
            message: format!("设置数据库版本失败: {}", e),
        })?;

    log::info!("数据库版本已更新至: v{}", version);
    Ok(())
}

/// 执行数据库迁移
/// 根据当前版本号执行必要的迁移脚本
pub fn migrate_database(conn: &Connection) -> AppResult<()> {
    let current_version = get_db_version(conn)?;

    log::info!("当前数据库版本: v{}", current_version);
    log::info!("目标数据库版本: v{}", CURRENT_DB_VERSION);

    if current_version == CURRENT_DB_VERSION {
        log::info!("数据库版本已是最新,无需迁移");
        return Ok(());
    }

    if current_version > CURRENT_DB_VERSION {
        return Err(AppError::DatabaseError {
            message: format!(
                "数据库版本 v{} 高于应用支持的版本 v{},请升级应用",
                current_version, CURRENT_DB_VERSION
            ),
        });
    }

    log::info!("开始数据库迁移...");

    // 执行版本升级迁移
    let mut version = current_version;
    while version < CURRENT_DB_VERSION {
        version += 1;
        log::info!("���行迁移: v{} -> v{}", version - 1, version);

        match version {
            1 => {
                // v0 -> v1: 初始版本,无需迁移
                // (因为 schema.sql 已经创建了所有表)
                log::info!("迁移至 v1: 初始版本");
            }
            2 => {
                // 预留: v1 -> v2 的迁移脚本
                migrate_v1_to_v2(conn)?;
            }
            3 => {
                // 预留: v2 -> v3 的迁移脚本
                migrate_v2_to_v3(conn)?;
            }
            4 => {
                // v3 -> v4: 添加余额查询功能
                migrate_v3_to_v4(conn)?;
            }
            5 => {
                // v4 -> v5: 添加重试策略支持
                migrate_v4_to_v5(conn)?;
            }
            6 => {
                // v5 -> v6: 添加 TestResult 缺失字段
                migrate_v5_to_v6(conn)?;
            }
            7 => {
                // v6 -> v7: 添加 provider_type 字段以支持不同的 API 提供商
                migrate_v6_to_v7(conn)?;
            }
            _ => {
                return Err(AppError::DatabaseError {
                    message: format!("未知的迁移版本: v{}", version),
                });
            }
        }

        set_db_version(conn, version)?;
    }

    log::info!("数据库迁移完成");
    Ok(())
}

/// 迁移: v1 -> v2 - 供应商配置系统
/// 添加供应商分类、视觉主题、元数据等字段
fn migrate_v1_to_v2(conn: &Connection) -> AppResult<()> {
    log::info!("执行 v1 -> v2 迁移: 供应商配置系统");

    // 检查 category 列是否已存在（如果 schema.sql 已经包含了这些字段）
    let column_exists: bool = conn
        .prepare("PRAGMA table_info(ApiConfig)")
        .and_then(|mut stmt| {
            let columns: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .filter_map(Result::ok)
                .collect();
            Ok(columns.contains(&"category".to_string()))
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("检查列是否存在失败: {}", e),
        })?;

    if column_exists {
        log::info!("v1 -> v2 迁移: category 列已存在，schema.sql 已包含 v2 变更，跳过迁移");
        return Ok(());
    }

    // 加载迁移 SQL 文件
    let migration_sql = include_str!("migrations/migration_v2_vendor_config.sql");

    // 执行迁移 SQL
    conn.execute_batch(migration_sql)
        .map_err(|e| AppError::DatabaseError {
            message: format!("v1->v2 迁移失败: {}", e),
        })?;

    log::info!("v1 -> v2 迁移完成: 已添加供应商配置相关字段");
    Ok(())
}

/// 迁移: v2 -> v3 - 修复"未分组"ID为0
fn migrate_v2_to_v3(conn: &Connection) -> AppResult<()> {
    log::info!("执行 v2 -> v3 迁移: 修复未分组 ID");

    // 检查是否已经存在 ID=0 的分组
    let id_0_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id = 0)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("检查分组 ID=0 失败: {}", e),
        })?;

    if id_0_exists {
        log::info!("ID=0 的分组已存在,无需迁移");
        return Ok(());
    }

    // 查找"未分组"的当前 ID
    let ungrouped_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM ConfigGroup WHERE name = '未分组'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询未分组失败: {}", e),
        })?;

    if let Some(old_id) = ungrouped_id {
        log::info!("找到未分组,当前 ID={},准备迁移到 ID=0", old_id);

        // 开始事务
        conn.execute("BEGIN TRANSACTION", [])
            .map_err(|e| AppError::DatabaseError {
                message: format!("开始事务失败: {}", e),
            })?;

        // 1. 将所有引用旧ID的配置临时移到一个不存在的ID (-1)
        conn.execute(
            "UPDATE ApiConfig SET group_id = -1 WHERE group_id = ?",
            [old_id],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("临时更新配置分组失败: {}", e),
        })?;

        // 2. 删除旧的"未分组"记录
        conn.execute("DELETE FROM ConfigGroup WHERE id = ?", [old_id])
            .map_err(|e| AppError::DatabaseError {
                message: format!("删除旧的未分组失败: {}", e),
            })?;

        // 3. 插入新的"未分组"记录,ID=0
        conn.execute(
            r#"
            INSERT INTO ConfigGroup (id, name, description, auto_switch_enabled)
            VALUES (0, '未分组', '默认分组,用于未分类的 API 配置', 0)
            "#,
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入新的未分组失败: {}", e),
        })?;

        // 4. 将配置的分组ID从-1更新到0
        conn.execute("UPDATE ApiConfig SET group_id = 0 WHERE group_id = -1", [])
            .map_err(|e| AppError::DatabaseError {
                message: format!("更新配置分组到 ID=0 失败: {}", e),
            })?;

        // 提交事务
        conn.execute("COMMIT", [])
            .map_err(|e| AppError::DatabaseError {
                message: format!("提交事务失败: {}", e),
            })?;

        log::info!("v2 -> v3 迁移完成: 未分组 ID 已从 {} 更新为 0", old_id);
    } else {
        log::info!("未找到未分组,将在初始化数据中创建");
    }

    log::info!("v2 -> v3 迁移完成");
    Ok(())
}

/// 迁移: v3 -> v4 - 余额查询功能
/// 添加余额查询URL、余额记录、查询状态等字段
fn migrate_v3_to_v4(conn: &Connection) -> AppResult<()> {
    log::info!("执行 v3 -> v4 迁移: 余额查询功能");

    // 加载迁移 SQL 文件
    let migration_sql = include_str!("migrations/migration_v4_balance_query.sql");

    // 执行迁移 SQL
    conn.execute_batch(migration_sql)
        .map_err(|e| AppError::DatabaseError {
            message: format!("v3->v4 迁移失败: {}", e),
        })?;

    log::info!("v3 -> v4 迁移完成: 已添加余额查询相关字段");
    Ok(())
}

/// 迁移: v4 -> v5 - 重试策略支持
/// 添加重试参数、失败计数、错误类型等字段
fn migrate_v4_to_v5(conn: &Connection) -> AppResult<()> {
    log::info!("执行 v4 -> v5 迁移: 重试策略支持");

    // 加载迁移 SQL 文件
    let migration_sql = include_str!("migrations/migration_v5_retry_strategy.sql");

    // 执行迁移 SQL
    conn.execute_batch(migration_sql)
        .map_err(|e| AppError::DatabaseError {
            message: format!("v4->v5 迁移失败: {}", e),
        })?;

    log::info!("v4 -> v5 迁移完成: 已添加重试策略相关字段");
    Ok(())
}

/// 迁移: v5 -> v6 - TestResult 表字段补充
/// 添加 response_text、test_model、attempt 字段
fn migrate_v5_to_v6(conn: &Connection) -> AppResult<()> {
    log::info!("执行 v5 -> v6 迁移: TestResult 表字段补充");

    // 检查 response_text 列是否已存在
    let column_exists: bool = conn
        .prepare("PRAGMA table_info(TestResult)")
        .and_then(|mut stmt| {
            let columns: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .filter_map(Result::ok)
                .collect();
            Ok(columns.contains(&"response_text".to_string()))
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("检查列是否存在失败: {}", e),
        })?;

    if column_exists {
        log::info!("v5 -> v6 迁移: response_text 列已存在，schema.sql 已包含 v6 变更，跳过迁移");
        return Ok(());
    }

    // 加载迁移 SQL 文件
    let migration_sql = include_str!("migrations/migration_v6_test_result_fields.sql");

    // 执行迁移 SQL
    conn.execute_batch(migration_sql)
        .map_err(|e| AppError::DatabaseError {
            message: format!("v5->v6 迁移失败: {}", e),
        })?;

    log::info!("v5 -> v6 迁移完成: 已添加 TestResult 缺失字段");
    Ok(())
}

/// 迁移: v6 -> v7 - 添加 provider_type 字段
/// 支持不同的 API 提供商 (Claude, Gemini)
fn migrate_v6_to_v7(conn: &Connection) -> AppResult<()> {
    log::info!("执行 v6 -> v7 迁移: 添加 provider_type 字段");

    // 检查 provider_type 列是否已存在
    let column_exists: bool = conn
        .prepare("PRAGMA table_info(ApiConfig)")
        .and_then(|mut stmt| {
            let columns: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .filter_map(Result::ok)
                .collect();
            Ok(columns.contains(&"provider_type".to_string()))
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("检查列是否存在失败: {}", e),
        })?;

    if column_exists {
        log::info!("v6 -> v7 迁移: provider_type 列已存在，跳过迁移");
        return Ok(());
    }

    // 加载迁移 SQL 文件
    let migration_sql = include_str!("migrations/migration_v7_add_provider_type.sql");

    // 执行迁移 SQL
    conn.execute_batch(migration_sql)
        .map_err(|e| AppError::DatabaseError {
            message: format!("v6->v7 迁移失败: {}", e),
        })?;

    log::info!("v6 -> v7 迁移完成: 已添加 provider_type 字段");
    Ok(())
}

/// 回滚迁移 (仅用于开发/测试)
/// 警告: 回滚可能导致数据丢失
#[allow(dead_code)]
pub fn rollback_migration(conn: &Connection, target_version: i32) -> AppResult<()> {
    let current_version = get_db_version(conn)?;

    if target_version >= current_version {
        return Err(AppError::ValidationError {
            field: "target_version".to_string(),
            message: format!(
                "目标版本 v{} 必须小于当前版本 v{}",
                target_version, current_version
            ),
        });
    }

    log::warn!("警告: 正在回滚数据库至 v{},可能导致数据丢失", target_version);

    // 这里应该实现具体的回滚逻辑
    // 为了简化,当前只是设置版本号
    set_db_version(conn, target_version)?;

    log::info!("数据库已回滚至 v{}", target_version);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_set_db_version() {
        let conn = Connection::open_in_memory().unwrap();

        // 初始版本应该是 0
        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, 0);

        // 设置版本为 1
        set_db_version(&conn, 1).unwrap();
        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, 1);

        // 设置版本为 5
        set_db_version(&conn, 5).unwrap();
        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn test_migrate_database() {
        let conn = Connection::open_in_memory().unwrap();

        // 执行 schema.sql 创建表结构
        let schema_sql = include_str!("schema.sql");
        conn.execute_batch(schema_sql).unwrap();

        // 执行迁移
        let result = migrate_database(&conn);
        if let Err(ref e) = result {
            eprintln!("迁移失败: {:?}", e);
        }
        assert!(result.is_ok());

        // 验证版本已更新
        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, CURRENT_DB_VERSION);
    }

    #[test]
    fn test_migrate_already_latest() {
        let conn = Connection::open_in_memory().unwrap();

        // 设置为最新版本
        set_db_version(&conn, CURRENT_DB_VERSION).unwrap();

        // 执行迁移应该不做任何操作
        let result = migrate_database(&conn);
        assert!(result.is_ok());

        let version = get_db_version(&conn).unwrap();
        assert_eq!(version, CURRENT_DB_VERSION);
    }

    #[test]
    fn test_migrate_future_version() {
        let conn = Connection::open_in_memory().unwrap();

        // 设置为未来版本
        set_db_version(&conn, CURRENT_DB_VERSION + 10).unwrap();

        // 执行迁移应该返回错误
        let result = migrate_database(&conn);
        assert!(result.is_err());
    }
}
