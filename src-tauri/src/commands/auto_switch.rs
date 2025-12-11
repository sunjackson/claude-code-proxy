/**
 * 自动切换命令
 * Tauri commands for auto-switching functionality
 *
 * Commands:
 * - toggle_auto_switch: 启用/禁用分组自动切换
 * - get_switch_logs: 获取切换日志列表
 */

use crate::db::DbPool;
use crate::models::error::AppResult;
use crate::models::switch_log::SwitchLogDetail;
use crate::services::auto_switch::AutoSwitchService;
use crate::utils::time::now_rfc3339;
use std::sync::Arc;
use tauri::State;

/// 启用/禁用分组的自动切换功能
///
/// # Arguments
/// - `group_id`: 分组 ID
/// - `enabled`: 是否启用
///
/// # Returns
/// - () 成功无返回值
#[tauri::command]
pub async fn toggle_auto_switch(
    group_id: i64,
    enabled: bool,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<()> {
    log::info!("Command: toggle_auto_switch (group_id: {}, enabled: {})", group_id, enabled);

    // 如果启用自动切换,检查分组至少有2个配置 (FR-014)
    if enabled {
        let config_count = db_pool.with_connection(|conn| {
            use rusqlite::params;
            conn.query_row(
                "SELECT COUNT(*) FROM ApiConfig WHERE group_id = ?1 AND is_available = 1",
                params![group_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| crate::models::error::AppError::DatabaseError {
                message: format!("查询配置数量失败: {}", e),
            })
        })?;

        if config_count < 2 {
            return Err(crate::models::error::AppError::ValidationError {
                field: "group_id".to_string(),
                message: format!("分组至少需要2个可用配置才能启用自动切换,当前只有 {} 个", config_count),
            });
        }
    }

    // 更新分组的自动切换设置
    db_pool.with_connection(|conn| {
        use rusqlite::params;
        let now = now_rfc3339();

        conn.execute(
            "UPDATE ConfigGroup SET auto_switch_enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![if enabled { 1 } else { 0 }, now, group_id],
        )
        .map_err(|e| crate::models::error::AppError::DatabaseError {
            message: format!("更新分组自动切换设置失败: {}", e),
        })?;

        log::info!("分组 {} 自动切换已{}", group_id, if enabled { "启用" } else { "禁用" });
        Ok(())
    })
}

/// 获取切换日志列表
///
/// # Arguments
/// - `group_id`: 分组 ID(可选,用于筛选)
/// - `limit`: 返回数量限制(可选,默认50)
/// - `offset`: 偏移量(可选,默认0)
///
/// # Returns
/// - Vec<SwitchLogDetail>: 日志详情列表
#[tauri::command]
pub fn get_switch_logs(
    group_id: Option<i64>,
    limit: Option<i32>,
    offset: Option<i32>,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<Vec<SwitchLogDetail>> {
    log::debug!(
        "Command: get_switch_logs (group_id: {:?}, limit: {:?}, offset: {:?})",
        group_id,
        limit,
        offset
    );

    let service = AutoSwitchService::new(db_pool.inner().clone());
    service.get_switch_logs(group_id, limit.unwrap_or(50), offset.unwrap_or(0))
}

/// 清空切换日志
///
/// # Arguments
/// - `group_id`: 分组 ID(可选,用于筛选)。如果提供，只清空该分组的日志；否则清空所有日志
///
/// # Returns
/// - i32: 删除的日志数量
#[tauri::command]
pub fn clear_switch_logs(
    group_id: Option<i64>,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<i32> {
    log::info!("Command: clear_switch_logs (group_id: {:?})", group_id);

    let service = AutoSwitchService::new(db_pool.inner().clone());
    service.clear_switch_logs(group_id)
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;
    use crate::db::initialize_database;

    #[tokio::test]
    async fn test_toggle_auto_switch() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        // 这里只测试命令的基本结构
        // 实际的自动切换需要真实的分组和配置
        assert!(db_pool.inner().is_some());
    }
}
