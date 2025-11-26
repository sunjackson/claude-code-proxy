/**
 * 代理请求日志命令
 * 提供查询代理请求日志的 Tauri 命令
 */

use crate::db::DbPool;
use crate::services::proxy_log::{ProxyRequestLog, ProxyRequestLogService};
use std::sync::Arc;
use tauri::State;

/// 获取指定配置的代理请求日志
#[tauri::command]
pub async fn get_proxy_request_logs(
    pool: State<'_, Arc<DbPool>>,
    config_id: i64,
    limit: Option<i64>,
) -> Result<Vec<ProxyRequestLog>, String> {
    let limit = limit.unwrap_or(100);

    ProxyRequestLogService::get_logs_by_config(&pool, config_id, limit)
        .map_err(|e| e.to_string())
}

/// 获取所有代理请求日志（带分页）
#[tauri::command]
pub async fn get_all_proxy_request_logs(
    pool: State<'_, Arc<DbPool>>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ProxyRequestLog>, String> {
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    ProxyRequestLogService::get_all_logs(&pool, limit, offset)
        .map_err(|e| e.to_string())
}

/// 清理旧的代理请求日志
#[tauri::command]
pub async fn cleanup_proxy_request_logs(
    pool: State<'_, Arc<DbPool>>,
    keep_count: Option<i64>,
) -> Result<i64, String> {
    let keep_count = keep_count.unwrap_or(10000);

    ProxyRequestLogService::cleanup_old_logs(&pool, keep_count)
        .map_err(|e| e.to_string())
}

/// 获取代理请求日志总数
#[tauri::command]
pub async fn get_proxy_request_log_count(
    pool: State<'_, Arc<DbPool>>,
) -> Result<i64, String> {
    ProxyRequestLogService::get_log_count(&pool)
        .map_err(|e| e.to_string())
}
