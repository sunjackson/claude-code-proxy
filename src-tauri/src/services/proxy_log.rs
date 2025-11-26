/**
 * 代理请求日志服务
 * 负责存储和查询代理请求日志
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::proxy::logger::RequestLogEntry;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// 代理请求日志记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyRequestLog {
    pub id: i64,
    pub request_at: String,
    pub method: String,
    pub uri: String,
    pub target_url: String,
    pub config_id: Option<i64>,
    pub config_name: Option<String>,
    pub latency_ms: i64,
    pub status_code: i32,
    pub is_success: bool,
    pub error_message: Option<String>,
    pub remote_addr: Option<String>,
}

/// 代理请求日志服务
pub struct ProxyRequestLogService;

impl ProxyRequestLogService {
    /// 保存请求日志到数据库
    pub fn save_log(pool: &DbPool, entry: &RequestLogEntry) -> AppResult<i64> {
        pool.with_connection(|conn| {
            conn.execute(
                r#"
                INSERT INTO ProxyRequestLog (
                    request_at, method, uri, target_url, config_id, config_name,
                    latency_ms, status_code, is_success, error_message, remote_addr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
                params![
                    entry.timestamp.to_rfc3339(),
                    entry.method.to_string(),
                    entry.uri.to_string(),
                    entry.target_url,
                    entry.config_id,
                    entry.config_name,
                    entry.latency_ms as i64,
                    entry.status_code.as_u16() as i32,
                    entry.is_success(),
                    entry.error,
                    entry.remote_addr,
                ],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("保存代理请求日志失败: {}", e),
            })?;

            let id = conn.last_insert_rowid();
            Ok(id)
        })
    }

    /// 获取指定配置的请求日志
    pub fn get_logs_by_config(
        pool: &DbPool,
        config_id: i64,
        limit: i64,
    ) -> AppResult<Vec<ProxyRequestLog>> {
        pool.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, request_at, method, uri, target_url, config_id, config_name,
                           latency_ms, status_code, is_success, error_message, remote_addr
                    FROM ProxyRequestLog
                    WHERE config_id = ?
                    ORDER BY request_at DESC
                    LIMIT ?
                    "#,
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询语句失败: {}", e),
                })?;

            let logs = stmt
                .query_map(params![config_id, limit], |row| {
                    Ok(ProxyRequestLog {
                        id: row.get(0)?,
                        request_at: row.get(1)?,
                        method: row.get(2)?,
                        uri: row.get(3)?,
                        target_url: row.get(4)?,
                        config_id: row.get(5)?,
                        config_name: row.get(6)?,
                        latency_ms: row.get(7)?,
                        status_code: row.get(8)?,
                        is_success: row.get(9)?,
                        error_message: row.get(10)?,
                        remote_addr: row.get(11)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询代理请求日志失败: {}", e),
                })?
                .filter_map(Result::ok)
                .collect();

            Ok(logs)
        })
    }

    /// 获取所有请求日志（带分页）
    pub fn get_all_logs(
        pool: &DbPool,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<ProxyRequestLog>> {
        pool.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, request_at, method, uri, target_url, config_id, config_name,
                           latency_ms, status_code, is_success, error_message, remote_addr
                    FROM ProxyRequestLog
                    ORDER BY request_at DESC
                    LIMIT ? OFFSET ?
                    "#,
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询语句失败: {}", e),
                })?;

            let logs = stmt
                .query_map(params![limit, offset], |row| {
                    Ok(ProxyRequestLog {
                        id: row.get(0)?,
                        request_at: row.get(1)?,
                        method: row.get(2)?,
                        uri: row.get(3)?,
                        target_url: row.get(4)?,
                        config_id: row.get(5)?,
                        config_name: row.get(6)?,
                        latency_ms: row.get(7)?,
                        status_code: row.get(8)?,
                        is_success: row.get(9)?,
                        error_message: row.get(10)?,
                        remote_addr: row.get(11)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询代理请求日志失败: {}", e),
                })?
                .filter_map(Result::ok)
                .collect();

            Ok(logs)
        })
    }

    /// 清理旧日志（保留最近N条）
    pub fn cleanup_old_logs(pool: &DbPool, keep_count: i64) -> AppResult<i64> {
        pool.with_connection(|conn| {
            let deleted = conn
                .execute(
                    r#"
                    DELETE FROM ProxyRequestLog
                    WHERE id NOT IN (
                        SELECT id FROM ProxyRequestLog
                        ORDER BY request_at DESC
                        LIMIT ?
                    )
                    "#,
                    params![keep_count],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("清理旧日志失败: {}", e),
                })?;

            Ok(deleted as i64)
        })
    }

    /// 获取日志总数
    pub fn get_log_count(pool: &DbPool) -> AppResult<i64> {
        pool.with_connection(|conn| {
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM ProxyRequestLog", [], |row| row.get(0))
                .map_err(|e| AppError::DatabaseError {
                    message: format!("获取日志总数失败: {}", e),
                })?;

            Ok(count)
        })
    }
}
