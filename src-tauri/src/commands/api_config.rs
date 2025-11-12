use crate::db::pool::DbPool;
use crate::models::api_config::{ApiConfig, CreateApiConfigInput, UpdateApiConfigInput};
use crate::models::error::AppResult;
use crate::services::ApiConfigService;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
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
/// - `input`: 更新输入参数
#[tauri::command]
pub fn update_api_config(
    input: UpdateApiConfigInput,
    pool: State<'_, Arc<DbPool>>,
) -> AppResult<ApiConfig> {
    log::info!("更新 API 配置: ID {}", input.id);

    pool.with_connection(|conn| ApiConfigService::update_config(conn, &input))
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
    let timeout = timeout_ms.unwrap_or(8000);
    log::info!("测试 {} 个端点，超时时间: {}ms", endpoints.len(), timeout);

    // 并发测试所有端点
    let tasks: Vec<_> = endpoints
        .into_iter()
        .map(|url| {
            tokio::spawn(async move {
                test_single_endpoint(url, timeout).await
            })
        })
        .collect();

    // 等待所有测试完成
    let mut results = Vec::new();
    for task in tasks {
        match task.await {
            Ok(result) => results.push(result),
            Err(e) => {
                log::error!("端点测试任务失败: {}", e);
            }
        }
    }

    Ok(results)
}

/// 测试单个端点
async fn test_single_endpoint(url: String, timeout_ms: u64) -> EndpointTestResult {
    log::debug!("测试端点: {}", url);

    // 构建HTTP客户端，添加User-Agent和重定向策略
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent("claude-code-router-speedtest/1.0")
        .build()
        .unwrap();

    // 先进行一次热身请求，忽略结果，用于复用连接/绕过首包惩罚
    let _ = client.get(&url).send().await;

    // 第二次请求开始计时，作为真实结果返回
    let start = Instant::now();

    match client.get(&url).send().await {
        Ok(response) => {
            let latency = start.elapsed().as_millis() as i32;
            let status = response.status();

            log::debug!("端点 {} 测试完成: {}ms, 状态码: {}", url, latency, status);

            // 只要能收到HTTP响应就算测试成功，不判断状态码
            // 这与cc-switch的行为一致：404、403等状态码也算请求成功
            EndpointTestResult {
                url,
                success: true,
                latency_ms: Some(latency),
                error: None,
            }
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as i32;
            let error_message = if e.is_timeout() {
                "请求超时".to_string()
            } else if e.is_connect() {
                "连接失败".to_string()
            } else {
                format!("{}", e)
            };

            log::warn!("端点 {} 测试失败: {}", url, error_message);

            EndpointTestResult {
                url,
                success: false,
                latency_ms: Some(latency),
                error: Some(error_message),
            }
        }
    }
}
