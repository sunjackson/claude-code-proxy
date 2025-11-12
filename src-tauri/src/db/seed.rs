#![allow(dead_code)]

use crate::models::error::{AppError, AppResult};
use rusqlite::Connection;

/// 插入默认数据
/// 在数据库初始化后调用,插入必要的默认数据
pub fn seed_database(conn: &Connection) -> AppResult<()> {
    log::info!("开始插入默认数据...");

    seed_app_settings(conn)?;
    seed_config_groups(conn)?;
    seed_proxy_service(conn)?;

    log::info!("默认数据插入完成");
    Ok(())
}

/// 插入默认应用设置
/// AppSettings 表只有一条记录 (id=1, 单例)
fn seed_app_settings(conn: &Connection) -> AppResult<()> {
    let exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM AppSettings WHERE id = 1)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 AppSettings 失败: {}", e),
        })?;

    if !exists {
        conn.execute(
            r#"
            INSERT INTO AppSettings (
                id,
                language,
                default_latency_threshold_ms,
                default_proxy_port,
                recommendation_cache_ttl_sec
            ) VALUES (1, 'zh-CN', 3000, 25341, 3600)
            "#,
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入默认 AppSettings 失败: {}", e),
        })?;

        log::info!("已插入默认应用设置: language=zh-CN, proxy_port=25341");
    }

    Ok(())
}

/// 插入默认配置分组
/// 包括特殊分组 "未分组" 和 "默认分组"
fn seed_config_groups(conn: &Connection) -> AppResult<()> {
    // 插入 "未分组" 特殊分组
    let ungrouped_exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id = 0)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 ConfigGroup 失败: {}", e),
        })?;

    if !ungrouped_exists {
        conn.execute(
            r#"
            INSERT INTO ConfigGroup (id, name, description, auto_switch_enabled)
            VALUES (0, '未分组', '用于未分类的 API 配置', 0)
            "#,
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入 '未分组' 失败: {}", e),
        })?;

        log::info!("已插入特殊分组: 未分组 (ID=0)");
    }

    // 插入 "默认分组"
    let default_group_exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id = 1)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 ConfigGroup 失败: {}", e),
        })?;

    if !default_group_exists {
        conn.execute(
            r#"
            INSERT INTO ConfigGroup (id, name, description, auto_switch_enabled, latency_threshold_ms)
            VALUES (1, '默认分组', '系统默认分组，新建配置的初始分组', 1, 3000)
            "#,
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入 '默认分组' 失败: {}", e),
        })?;

        log::info!("已插入默认分组 (ID=1)");
    }

    Ok(())
}

/// 插入默认代理服务实例
/// ProxyService 表只有一条记录 (id=1, 单例)
fn seed_proxy_service(conn: &Connection) -> AppResult<()> {
    let exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM ProxyService WHERE id = 1)", [], |row| {
            row.get(0)
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询 ProxyService 失败: {}", e),
        })?;

    if !exists {
        conn.execute(
            r#"
            INSERT INTO ProxyService (
                id,
                listen_port,
                status
            ) VALUES (1, 25341, 'stopped')
            "#,
            [],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入默认 ProxyService 失败: {}", e),
        })?;

        log::info!("已插入代理服务实例: id=1, port=25341, status=stopped");
    }

    Ok(())
}

/// 插入示例配置数据 (仅用于开发/测试)
/// 警告: 不应在生产环境调用此函数
#[allow(dead_code)]
pub fn seed_sample_data(conn: &Connection) -> AppResult<()> {
    log::info!("开始插入示例数据...");

    // 插入示例配置分组
    conn.execute(
        r#"
        INSERT OR IGNORE INTO ConfigGroup (name, description, auto_switch_enabled, latency_threshold_ms)
        VALUES ('工作', '工作环境使用的 API 配置', 1, 3000)
        "#,
        [],
    )
    .map_err(|e| AppError::DatabaseError {
        message: format!("插入示例分组失败: {}", e),
    })?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO ConfigGroup (name, description, auto_switch_enabled, latency_threshold_ms)
        VALUES ('个人', '个人使用的 API 配置', 0, 5000)
        "#,
        [],
    )
    .map_err(|e| AppError::DatabaseError {
        message: format!("插入示例分组失败: {}", e),
    })?;

    // 插入示例 API 配置
    // 注意: api_key 字段存储 "[ENCRYPTED]" 占位符
    let group_id: i64 = conn
        .query_row("SELECT id FROM ConfigGroup WHERE name = '工作'", [], |row| row.get(0))
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询分组 ID 失败: {}", e),
        })?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO ApiConfig (
            name, api_key, server_url, server_port, group_id, sort_order, is_available
        ) VALUES ('示例配置 1', '[ENCRYPTED]', 'https://api.example.com', 443, ?, 0, 1)
        "#,
        [group_id],
    )
    .map_err(|e| AppError::DatabaseError {
        message: format!("插入示例配置失败: {}", e),
    })?;

    conn.execute(
        r#"
        INSERT OR IGNORE INTO ApiConfig (
            name, api_key, server_url, server_port, group_id, sort_order, is_available
        ) VALUES ('示例配置 2', '[ENCRYPTED]', 'https://api2.example.com', 443, ?, 1, 1)
        "#,
        [group_id],
    )
    .map_err(|e| AppError::DatabaseError {
        message: format!("插入示例配置失败: {}", e),
    })?;

    log::info!("示例数据插入完成");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seed_database() {
        let conn = Connection::open_in_memory().unwrap();

        // 创建表结构
        let schema_sql = include_str!("schema.sql");
        conn.execute_batch(schema_sql).unwrap();

        // 插入默认数据
        let result = seed_database(&conn);
        assert!(result.is_ok());

        // 验证 AppSettings
        let settings_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM AppSettings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(settings_count, 1);

        // 验证 ConfigGroup
        let group_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ConfigGroup WHERE name = '未分组'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(group_count, 1);

        // 验证 ProxyService
        let proxy_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ProxyService", [], |row| row.get(0))
            .unwrap();
        assert_eq!(proxy_count, 1);
    }

    #[test]
    fn test_seed_idempotent() {
        let conn = Connection::open_in_memory().unwrap();

        // 创建表结构
        let schema_sql = include_str!("schema.sql");
        conn.execute_batch(schema_sql).unwrap();

        // 第一次插入
        seed_database(&conn).unwrap();

        // 第二次插入 (应该不会重复插入)
        seed_database(&conn).unwrap();

        // 验证只有一条记录
        let settings_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM AppSettings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(settings_count, 1);
    }

    #[test]
    fn test_seed_sample_data() {
        let conn = Connection::open_in_memory().unwrap();

        // 创建表结构
        let schema_sql = include_str!("schema.sql");
        conn.execute_batch(schema_sql).unwrap();

        // 插入默认数据
        seed_database(&conn).unwrap();

        // 插入示例数据
        let result = seed_sample_data(&conn);
        assert!(result.is_ok());

        // 验证示例分组
        let group_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ConfigGroup", [], |row| row.get(0))
            .unwrap();
        assert!(group_count >= 3); // 未分组 + 工作 + 个人

        // 验证示例配置
        let config_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ApiConfig", [], |row| row.get(0))
            .unwrap();
        assert!(config_count >= 2);
    }
}
