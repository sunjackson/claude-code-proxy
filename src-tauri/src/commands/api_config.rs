use crate::db::pool::DbPool;
use crate::models::api_config::{ApiConfig, CreateApiConfigInput, UpdateApiConfigInput};
use crate::models::error::AppResult;
use crate::services::ApiConfigService;
use crate::commands::proxy_service::ProxyServiceState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

/// 创建 API 配置
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `input`: 创建输入参数
#[tauri::command]
pub fn create_api_config(
    input: CreateApiConfigInput,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<ApiConfig> {
    log::info!("创建 API 配置: {}", input.name);

    pool.with_connection(|conn| ApiConfigService::create_config(conn, &input))
}

/// 列出所有 API 配置
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `group_id`: 可选的分组ID筛选
#[tauri::command]
pub fn list_api_configs(
    group_id: Option<i64>,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<Vec<ApiConfig>> {
    log::debug!("列出 API 配置 (group_id: {:?})", group_id);

    pool.with_connection(|conn| ApiConfigService::list_configs(conn, group_id))
}

/// 获取 API 配置详情
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 配置ID
#[tauri::command]
pub fn get_api_config(id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<ApiConfig> {
    log::debug!("获取 API 配置详情: ID {}", id);

    pool.with_connection(|conn| ApiConfigService::get_config_by_id(conn, id))
}

/// 更新 API 配置
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `proxy_state`: 代理服务状态
/// - `input`: 更新输入参数
///
/// # 说明
/// 如果更新的是当前激活的配置，并且将其标记为不可用，
/// 会触发代理状态刷新以通知UI显示错误状态
#[tauri::command]
pub async fn update_api_config(
    input: UpdateApiConfigInput,
    pool: State<'_, Arc<DbPool>>,
    proxy_state: State<'_, ProxyServiceState>,
) -> AppResult<ApiConfig> {
    log::info!("更新 API 配置: ID {}", input.id);

    // 执行更新
    let updated_config = pool.with_connection(|conn| ApiConfigService::update_config(conn, &input))?;

    // 检查是否需要触发代理状态刷新
    // 如果更新的是 is_available 字段，并且这个配置是当前激活的配置
    if input.is_available.is_some() {
        let proxy_service = proxy_state.service();
        let current_status = proxy_service.get_status().await?;

        // 如果这个配置是当前激活的配置
        if current_status.active_config_id == Some(input.id) {
            log::info!(
                "已更新当前激活配置的可用性: {} -> is_available={}",
                updated_config.name,
                updated_config.is_available
            );

            // 触发状态刷新以通知UI更新
            let proxy_service = proxy_state.service();
            let _ = proxy_service.refresh_status().await;
        }
    }

    Ok(updated_config)
}

/// 删除 API 配置
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 配置ID
#[tauri::command]
pub fn delete_api_config(id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<()> {
    log::info!("删除 API 配置: ID {}", id);

    pool.with_connection(|conn| ApiConfigService::delete_config(conn, id))
}

/// 重新排序 API 配置
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `config_id`: 配置ID
/// - `new_sort_order`: 新的排序顺序
#[tauri::command]
pub fn reorder_api_config(
    config_id: i64,
    new_sort_order: i32,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<()> {
    log::info!(
        "重新排序 API 配置: ID {} -> order {}",
        config_id,
        new_sort_order
    );

    pool.with_connection(|conn| ApiConfigService::reorder_config(conn, config_id, new_sort_order))
}

/// 获取 API 密钥(明文)
///
/// # 参数
/// - `config_id`: 配置ID
/// - `pool`: 数据库连接池
///
/// # 安全提示
/// 此命令返回明文 API 密钥,请谨慎使用
#[tauri::command]
pub fn get_api_key(config_id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<String> {
    log::debug!("获取 API 密钥: config_id {}", config_id);

    pool.with_connection(|conn| ApiConfigService::get_api_key(conn, config_id))
}

/// 端点测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointTestResult {
    /// 端点 URL
    pub url: String,
    /// 是否成功
    pub success: bool,
    /// 延迟（毫秒）
    pub latency_ms: Option<i32>,
    /// 错误信息
    pub error: Option<String>,
}

/// 测试多个端点的延迟
///
/// 使用统一的延迟测试服务（参考 claude-codex-api/src/utils/latency-tester.js）
///
/// # 参数
/// - `endpoints`: 端点 URL 列表
/// - `timeout_ms`: 超时时间（毫秒），默认 8000ms
///
/// # 返回
/// 返回每个端点的测试结果
#[tauri::command]
pub async fn test_api_endpoints(
    endpoints: Vec<String>,
    timeout_ms: Option<u64>,
) -> AppResult<Vec<EndpointTestResult>> {
    use crate::services::LatencyTestService;

    let timeout = timeout_ms.unwrap_or(8000);
    log::info!("测试 {} 个端点，超时时间: {}ms", endpoints.len(), timeout);

    // 使用统一的延迟测试服务，启用热身请求
    let results = LatencyTestService::test_multiple_urls(&endpoints, Some(timeout), true).await;

    // 转换为 EndpointTestResult 格式
    let endpoint_results: Vec<EndpointTestResult> = results
        .into_iter()
        .map(|r| EndpointTestResult {
            url: r.url,
            success: r.success,
            latency_ms: r.latency_ms,
            error: r.error_message,
        })
        .collect();

    Ok(endpoint_results)
}

/// 快速测试单个配置 URL（用于新建配置时的即时反馈）
///
/// 使用统一的延迟测试服务，超时时间较短（5秒）
///
/// # 参数
/// - `url`: 要测试的 URL
///
/// # 返回
/// 返回测试结果
#[tauri::command]
pub async fn quick_test_config_url(url: String) -> AppResult<EndpointTestResult> {
    use crate::services::LatencyTestService;

    log::info!("快速测试配置URL: {}", url);

    // 使用快速测试模式（5秒超时，无热身请求）
    let result = LatencyTestService::test_url(&url, Some(5000), false).await;

    Ok(EndpointTestResult {
        url: result.url,
        success: result.success,
        latency_ms: result.latency_ms,
        error: result.error_message,
    })
}

/// 设置配置的启用状态
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `proxy_state`: 代理服务状态
/// - `config_id`: 配置ID
/// - `enabled`: 是否启用
///
/// # 说明
/// 如果停用的是当前激活的配置，会尝试自动切换到下一个可用配置
#[tauri::command]
pub async fn set_config_enabled(
    config_id: i64,
    enabled: bool,
    pool: State<'_, Arc<DbPool>>,
    proxy_state: State<'_, ProxyServiceState>,
) -> AppResult<ApiConfig> {
    log::info!("设置配置启用状态: ID {} -> {}", config_id, enabled);

    // 执行更新
    let updated_config = pool.with_connection(|conn| {
        ApiConfigService::set_config_enabled(conn, config_id, enabled)
    })?;

    // 如果是停用操作，检查是否需要触发自动切换
    if !enabled {
        let proxy_service = proxy_state.service();
        let current_status = proxy_service.get_status().await?;

        // 如果停用的是当前激活的配置
        if current_status.active_config_id == Some(config_id) {
            log::warn!(
                "正在停用当前激活的配置: {} (ID: {})，尝试切换到下一个可用配置",
                updated_config.name,
                config_id
            );

            // 触发自动切换
            if let Some(group_id) = current_status.active_group_id {
                // 获取下一个可用配置
                if let Ok(next_config) = pool.with_connection(|conn| {
                    ApiConfigService::list_enabled_available_configs(conn, group_id)
                }) {
                    if let Some(next) = next_config.first() {
                        log::info!("自动切换到配置: {} (ID: {})", next.name, next.id);
                        // 更新代理服务使用新配置
                        let _ = proxy_service.switch_config(next.id).await;
                    } else {
                        log::warn!("没有可用的备用配置，代理服务可能无法正常工作");
                    }
                }
            }

            // 触发状态刷新以通知UI更新
            let _ = proxy_service.refresh_status().await;
        }
    }

    Ok(updated_config)
}
