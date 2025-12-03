/**
 * 代理请求日志服务
 * 负责存储和查询代理请求日志
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::proxy::logger::RequestLogEntry;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// 代理请求日志记录（简要版本，用于列表展示）
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
    // 新增简要字段
    pub is_streaming: bool,
    pub model: Option<String>,
    pub request_body_size: i64,
    pub response_body_size: i64,
}

/// 代理请求日志详情（完整版本，用于详情展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyRequestLogDetail {
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
    // 详细字段
    pub request_headers: Option<String>,
    pub request_body: Option<String>,
    pub response_headers: Option<String>,
    pub response_body: Option<String>,
    pub response_start_at: Option<String>,
    pub response_end_at: Option<String>,
    pub request_body_size: i64,
    pub response_body_size: i64,
    pub is_streaming: bool,
    pub stream_chunk_count: i32,
    pub time_to_first_byte_ms: Option<i64>,
    pub content_type: Option<String>,
    pub user_agent: Option<String>,
    pub model: Option<String>,
}

/// 代理请求日志服务
pub struct ProxyRequestLogService;

impl ProxyRequestLogService {
    /// 保存请求日志到数据库（包含所有详细信息）
    /// 自动清理：当日志数量超过120条时，只保留最近100条
    pub fn save_log(pool: &DbPool, entry: &RequestLogEntry) -> AppResult<i64> {
        let id = pool.with_connection(|conn| {
            conn.execute(
                r#"
                INSERT INTO ProxyRequestLog (
                    request_at, method, uri, target_url, config_id, config_name,
                    latency_ms, status_code, is_success, error_message, remote_addr,
                    request_headers, request_body, response_headers, response_body,
                    response_start_at, response_end_at, request_body_size, response_body_size,
                    is_streaming, stream_chunk_count, time_to_first_byte_ms,
                    content_type, user_agent, model
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    entry.request_headers,
                    entry.request_body,
                    entry.response_headers,
                    entry.response_body,
                    entry.response_start_at.map(|t| t.to_rfc3339()),
                    entry.response_end_at.map(|t| t.to_rfc3339()),
                    entry.request_body_size as i64,
                    entry.response_body_size as i64,
                    entry.is_streaming,
                    entry.stream_chunk_count as i32,
                    entry.time_to_first_byte_ms.map(|v| v as i64),
                    entry.content_type,
                    entry.user_agent,
                    entry.model,
                ],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("保存代理请求日志失败: {}", e),
            })?;

            let id = conn.last_insert_rowid();
            Ok(id)
        })?;

        // 自动清理：每次保存后检查总数，如果超过120条就清理到100条
        // 使用单独的连接避免阻塞主事务
        pool.with_connection(|conn| {
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM ProxyRequestLog", [], |row| row.get(0))
                .unwrap_or(0);

            if count > 120 {
                let _ = conn.execute(
                    r#"
                    DELETE FROM ProxyRequestLog
                    WHERE id NOT IN (
                        SELECT id FROM ProxyRequestLog
                        ORDER BY request_at DESC
                        LIMIT 100
                    )
                    "#,
                    [],
                );
                log::info!("自动清理代理请求日志: 保留最近100条，删除了 {} 条旧记录", count - 100);
            }
            Ok(())
        })?;

        Ok(id)
    }

    /// 获取指定配置的请求日志（简要版本）
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
                           latency_ms, status_code, is_success, error_message, remote_addr,
                           is_streaming, model, request_body_size, response_body_size
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
                        is_streaming: row.get::<_, Option<bool>>(12)?.unwrap_or(false),
                        model: row.get(13)?,
                        request_body_size: row.get::<_, Option<i64>>(14)?.unwrap_or(0),
                        response_body_size: row.get::<_, Option<i64>>(15)?.unwrap_or(0),
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

    /// 获取所有请求日志（带分页，简要版本）
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
                           latency_ms, status_code, is_success, error_message, remote_addr,
                           is_streaming, model, request_body_size, response_body_size
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
                        is_streaming: row.get::<_, Option<bool>>(12)?.unwrap_or(false),
                        model: row.get(13)?,
                        request_body_size: row.get::<_, Option<i64>>(14)?.unwrap_or(0),
                        response_body_size: row.get::<_, Option<i64>>(15)?.unwrap_or(0),
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

    /// 获取单条日志详情
    pub fn get_log_detail(pool: &DbPool, log_id: i64) -> AppResult<Option<ProxyRequestLogDetail>> {
        pool.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, request_at, method, uri, target_url, config_id, config_name,
                           latency_ms, status_code, is_success, error_message, remote_addr,
                           request_headers, request_body, response_headers, response_body,
                           response_start_at, response_end_at, request_body_size, response_body_size,
                           is_streaming, stream_chunk_count, time_to_first_byte_ms,
                           content_type, user_agent, model
                    FROM ProxyRequestLog
                    WHERE id = ?
                    "#,
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询语句失败: {}", e),
                })?;

            let log = stmt
                .query_row(params![log_id], |row| {
                    Ok(ProxyRequestLogDetail {
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
                        request_headers: row.get(12)?,
                        request_body: row.get(13)?,
                        response_headers: row.get(14)?,
                        response_body: row.get(15)?,
                        response_start_at: row.get(16)?,
                        response_end_at: row.get(17)?,
                        request_body_size: row.get::<_, Option<i64>>(18)?.unwrap_or(0),
                        response_body_size: row.get::<_, Option<i64>>(19)?.unwrap_or(0),
                        is_streaming: row.get::<_, Option<bool>>(20)?.unwrap_or(false),
                        stream_chunk_count: row.get::<_, Option<i32>>(21)?.unwrap_or(0),
                        time_to_first_byte_ms: row.get(22)?,
                        content_type: row.get(23)?,
                        user_agent: row.get(24)?,
                        model: row.get(25)?,
                    })
                })
                .ok();

            Ok(log)
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

    /// 按时间范围获取日志统计
    pub fn get_logs_stats(
        pool: &DbPool,
        hours: i64,
    ) -> AppResult<LogStats> {
        pool.with_connection(|conn| {
            let row = conn
                .query_row(
                    r#"
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) as success_count,
                        SUM(CASE WHEN is_success = 0 THEN 1 ELSE 0 END) as error_count,
                        AVG(latency_ms) as avg_latency,
                        MAX(latency_ms) as max_latency,
                        MIN(latency_ms) as min_latency,
                        SUM(request_body_size) as total_request_size,
                        SUM(response_body_size) as total_response_size
                    FROM ProxyRequestLog
                    WHERE request_at >= datetime('now', ? || ' hours')
                    "#,
                    params![format!("-{}", hours)],
                    |row| {
                        Ok(LogStats {
                            total_count: row.get(0)?,
                            success_count: row.get(1)?,
                            error_count: row.get(2)?,
                            avg_latency_ms: row.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
                            max_latency_ms: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                            min_latency_ms: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
                            total_request_size: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
                            total_response_size: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
                        })
                    },
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("获取日志统计失败: {}", e),
                })?;

            Ok(row)
        })
    }

    /// 更新流式响应日志（在流结束后调用）
    pub fn update_streaming_log(
        pool: &DbPool,
        log_id: i64,
        response_headers: Option<String>,
        response_body: Option<String>,
        response_body_size: i64,
        stream_chunk_count: i32,
    ) -> AppResult<()> {
        pool.with_connection(|conn| {
            // 截断响应体（如果太大）
            let truncated_body = response_body.map(|body| {
                if body.len() > 8192 {
                    format!("{}...(truncated)", &body[..8192])
                } else {
                    body
                }
            });

            conn.execute(
                r#"
                UPDATE ProxyRequestLog
                SET response_headers = COALESCE(?, response_headers),
                    response_body = ?,
                    response_body_size = ?,
                    stream_chunk_count = ?,
                    response_end_at = datetime('now')
                WHERE id = ?
                "#,
                params![
                    response_headers,
                    truncated_body,
                    response_body_size,
                    stream_chunk_count,
                    log_id,
                ],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("更新流式日志失败: {}", e),
            })?;

            log::info!("Updated streaming log {}: {} bytes, {} chunks", log_id, response_body_size, stream_chunk_count);
            Ok(())
        })
    }
}

/// 日志统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogStats {
    pub total_count: i64,
    pub success_count: i64,
    pub error_count: i64,
    pub avg_latency_ms: f64,
    pub max_latency_ms: i64,
    pub min_latency_ms: i64,
    pub total_request_size: i64,
    pub total_response_size: i64,
}
