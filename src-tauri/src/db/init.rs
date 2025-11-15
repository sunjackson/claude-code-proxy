#![allow(dead_code)]

use crate::models::error::{AppError, AppResult};
use crate::utils::paths;
use rusqlite::Connection;
use std::path::PathBuf;

/// 获取数据库文件路径
/// 数据库存储在应用数据目录: {app_data_dir}/database.db
pub fn get_db_path() -> AppResult<PathBuf> {
    let app_data_dir = paths::get_app_data_dir()?;

    // 确保目录存在
    paths::ensure_dir_exists(&app_data_dir)?;

    let db_path = app_data_dir.join("database.db");
    Ok(db_path)
}

/// 初始化数据库
/// 创建所有表结构并插入默认数据
pub fn initialize_database() -> AppResult<Connection> {
    let db_path = get_db_path()?;

    log::info!("正在初始化数据库: {:?}", db_path);

    // 打开数据库连接
    let conn = Connection::open(&db_path)
        .map_err(|e| AppError::DatabaseError {
            message: format!("打开数据库失败: {}", e),
        })?;

    // 启用外键约束
    conn.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|e| AppError::DatabaseError {
            message: format!("启用外键约束失败: {}", e),
        })?;

    // 执行 schema.sql 创建表结构
    let schema_sql = include_str!("schema.sql");
    conn.execute_batch(schema_sql)
        .map_err(|e| AppError::DatabaseError {
            message: format!("创建表结构失败: {}", e),
        })?;

    log::info!("数据库表结构创建完成");

    // 执行数据库迁移
    crate::db::migrations::migrate_database(&conn)?;

    // 插入默认数据
    insert_default_data(&conn)?;

    log::info!("数据库初始化完成");

    Ok(conn)
}

/// 插入默认数据
/// 包括: AppSettings, ConfigGroup("未分组"), ProxyService
fn insert_default_data(conn: &Connection) -> AppResult<()> {
    // 1. 插入默认应用设置 (id=1, 单例)
    let settings_exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM AppSettings WHERE id = 1)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 AppSettings 失败: {}", e),
        })?;

    if !settings_exists {
        conn.execute(
            "INSERT INTO AppSettings (id, language, default_proxy_port) VALUES (1, 'zh-CN', 25341)",
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入默认设置失败: {}", e),
        })?;

        log::info!("已插入默认应用设置");
    }

    // 2. 只在没有任何分组时才创建默认的"未分组" (id=0)
    // 检查是否有任何分组存在
    let any_group_exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM ConfigGroup)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 ConfigGroup 失败: {}", e),
        })?;

    if !any_group_exists {
        // 完全没有分组，创建默认的"未分组"
        log::info!("数据库中没有分组，创建默认分组");

        conn.execute(
            "INSERT INTO ConfigGroup (id, name, description, auto_switch_enabled) VALUES (0, '未分组', '默认分组,用于未分类的配置', 0)",
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入未分组失败: {}", e),
        })?;

        log::info!("已插入默认分组: 未分组 (ID=0)");
    } else {
        // 已有分组，检查是否存在 id=0 的特殊分组
        let id_zero_exists: bool = conn
            .query_row("SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id = 0)", [], |row| {
                row.get(0)
            })
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询 ConfigGroup id=0 失败: {}", e),
            })?;

        if !id_zero_exists {
            // 有其他分组但没有 id=0，检查是否有旧的"未分组"记录需要清理
            let old_ungrouped_ids: Vec<i64> = {
                let mut stmt = conn
                    .prepare("SELECT id FROM ConfigGroup WHERE name = '未分组' AND id != 0")
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("准备查询旧的未分组记录失败: {}", e),
                    })?;

                let ids = stmt
                    .query_map([], |row| row.get(0))
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("查询旧的未分组记录失败: {}", e),
                    })?
                    .collect::<Result<Vec<i64>, _>>()
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("读取旧的未分组记录ID失败: {}", e),
                    })?;

                ids
            };

            if !old_ungrouped_ids.is_empty() {
                // 如果存在旧的"未分组"记录，需要清理
                log::info!("发现 {} 个旧的未分组记录，正在清理", old_ungrouped_ids.len());

                // 删除所有旧的"未分组"记录（外键约束会自动将相关配置的group_id设为NULL）
                conn.execute(
                    "DELETE FROM ConfigGroup WHERE name = '未分组' AND id != 0",
                    [],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("删除旧的未分组记录失败: {}", e),
                })?;

                log::info!("已删除旧的未分组记录");

                // 插入新的 id=0 的"未分组"记录
                conn.execute(
                    "INSERT INTO ConfigGroup (id, name, description, auto_switch_enabled) VALUES (0, '未分组', '默认分组,用于未分类的配置', 0)",
                    [],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("插入未分组失败: {}", e),
                })?;

                log::info!("已插入特殊分组: 未分组 (ID=0)");

                // 将原本关联到旧"未分组"的配置指向新的 id=0
                let updated = conn.execute(
                    "UPDATE ApiConfig SET group_id = 0 WHERE group_id IS NULL",
                    [],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("恢复配置分组引用失败: {}", e),
                })?;

                if updated > 0 {
                    log::info!("已将 {} 个配置迁移到新的未分组 (ID=0)", updated);
                }
            } else {
                log::info!("已有自定义分组，跳过创建默认分组");
            }
        } else {
            log::debug!("特殊分组 '未分组' (ID=0) 已存在");
        }
    }

    // 3. 插入代理服务实例 (id=1, 单例)
    let proxy_exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM ProxyService WHERE id = 1)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 ProxyService 失败: {}", e),
        })?;

    if !proxy_exists {
        conn.execute(
            "INSERT INTO ProxyService (id, listen_port, status) VALUES (1, 25341, 'stopped')",
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入代理服务实例失败: {}", e),
        })?;

        log::info!("已插入代理服务实例");
    }

    Ok(())
}

/// 检查数据库连接是否有效
pub fn verify_connection(conn: &Connection) -> AppResult<()> {
    // 使用 query_row 执行简单查询验证连接
    conn.query_row("SELECT 1", [], |_| Ok(()))
        .map_err(|e| AppError::DatabaseError {
            message: format!("数据库连接验证失败: {}", e),
        })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_get_db_path() {
        let path = get_db_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.to_string_lossy().contains("database.db"));
    }

    #[test]
    fn test_initialize_database() {
        // 创建临时数据库进行测试
        let temp_dir = std::env::temp_dir().join("claude_code_proxy_test");
        fs::create_dir_all(&temp_dir).unwrap();
        let db_path = temp_dir.join("test_database.db");

        // 删除已存在的测试数据库
        if db_path.exists() {
            fs::remove_file(&db_path).unwrap();
        }

        // 初始化数据库
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();

        let schema_sql = include_str!("schema.sql");
        conn.execute_batch(schema_sql).unwrap();

        insert_default_data(&conn).unwrap();

        // 验证默认数据
        let settings_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM AppSettings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(settings_count, 1);

        let ungrouped_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ConfigGroup WHERE id = 0", [], |row| row.get(0))
            .unwrap();
        assert_eq!(ungrouped_count, 1);

        let proxy_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ProxyService", [], |row| row.get(0))
            .unwrap();
        assert_eq!(proxy_count, 1);

        // 清理
        drop(conn);
        fs::remove_file(&db_path).unwrap();
    }

    #[test]
    fn test_verify_connection() {
        let conn = Connection::open_in_memory().unwrap();
        let result = verify_connection(&conn);
        if let Err(e) = &result {
            eprintln!("验证连接失败: {:?}", e);
        }
        assert!(result.is_ok(), "验证连接失败: {:?}", result.err());
    }
}
