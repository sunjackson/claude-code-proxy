use crate::db::pool::DbPool;
use crate::models::config_group::ConfigGroup;
use crate::models::error::AppResult;
use crate::services::ConfigManager;
use std::sync::Arc;
use tauri::State;

/// 创建配置分组
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `name`: 分组名称
/// - `description`: 分组描述
/// - `auto_switch_enabled`: 是否启用自动切换
/// - `latency_threshold_ms`: 延迟阈值(毫秒)
#[tauri::command]
pub fn create_config_group(
    name: String,
    description: Option<String>,
    auto_switch_enabled: bool,
    latency_threshold_ms: i32,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<ConfigGroup> {
    log::info!("创建配置分组: {}", name);

    let group = ConfigGroup {
        id: 0, // 自动生成
        name,
        description,
        auto_switch_enabled,
        latency_threshold_ms,
        retry_count: 3,
        retry_base_delay_ms: 2000,
        retry_max_delay_ms: 8000,
        rate_limit_delay_ms: 30000,
        created_at: chrono::Local::now().naive_local().to_string(),
        updated_at: chrono::Local::now().naive_local().to_string(),
    };

    pool.with_connection(|conn| ConfigManager::create_group(conn, &group))
}

/// 列出所有配置分组
#[tauri::command]
pub fn list_config_groups(pool: State<'_, Arc<DbPool>>) -> AppResult<Vec<ConfigGroup>> {
    log::debug!("列出所有配置分组");

    pool.with_connection(|conn| ConfigManager::list_groups(conn))
}

/// 更新配置分组
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 分组ID
/// - `name`: 分组名称
/// - `description`: 分组描述
/// - `auto_switch_enabled`: 是否启用自动切换
/// - `latency_threshold_ms`: 延迟阈值(毫秒)
#[tauri::command]
pub fn update_config_group(
    id: i64,
    name: String,
    description: Option<String>,
    auto_switch_enabled: bool,
    latency_threshold_ms: i32,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<ConfigGroup> {
    log::info!("更新配置分组: ID {}", id);

    let group = ConfigGroup {
        id,
        name,
        description,
        auto_switch_enabled,
        latency_threshold_ms,
        retry_count: 3,
        retry_base_delay_ms: 2000,
        retry_max_delay_ms: 8000,
        rate_limit_delay_ms: 30000,
        created_at: chrono::Local::now().naive_local().to_string(), // 实际值会从数据库获取
        updated_at: chrono::Local::now().naive_local().to_string(),
    };

    pool.with_connection(|conn| ConfigManager::update_group(conn, &group))
}

/// 删除配置分组
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 分组ID
/// - `move_to_default`: 是否将分组下的配置移到"未分组"(true: 移动, false: 删除配置)
#[tauri::command]
pub fn delete_config_group(
    id: i64,
    move_to_default: bool,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<()> {
    log::info!("删除配置分组: ID {} (移动配置: {})", id, move_to_default);

    pool.with_connection(|conn| ConfigManager::delete_group(conn, id, move_to_default))
}

/// 获取分组详情
#[tauri::command]
pub fn get_config_group(id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<ConfigGroup> {
    log::debug!("获取配置分组详情: ID {}", id);

    pool.with_connection(|conn| ConfigManager::get_group_by_id(conn, id))
}

/// 统计分组下的配置数量
#[tauri::command]
pub fn count_configs_in_group(group_id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<i64> {
    log::debug!("统计分组下的配置数量: group_id {}", group_id);

    pool.with_connection(|conn| ConfigManager::count_configs_in_group(conn, group_id))
}
