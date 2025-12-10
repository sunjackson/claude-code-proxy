/**
 * Health Check Service
 * 提供健康检查记录的增删改查操作
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::health_check::{
    ConfigHealthSummary, CreateHealthCheckRecordInput, HealthCheckHourlyStats, HealthCheckRecord,
    HealthCheckStatus,
};
use rusqlite::Connection;
use std::sync::Arc;

/// 健康检查服务
pub struct HealthCheckService;

impl HealthCheckService {
    /// 创建健康检查记录
    /// 自动清理：只保留每个配置24小时内的记录
    pub fn create_record(
        conn: &Connection,
        input: CreateHealthCheckRecordInput,
    ) -> AppResult<HealthCheckRecord> {
        conn.execute(
            r#"
            INSERT INTO HealthCheckRecord (
                config_id, status, latency_ms, error_message, http_status_code
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            rusqlite::params![
                input.config_id,
                input.status.as_str(),
                input.latency_ms,
                input.error_message,
                input.http_status_code,
            ],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("创建健康检查记录失败: {}", e),
        })?;

        let id = conn.last_insert_rowid();

        // 自动清理：删除该配置24小时前的记录
        let deleted = conn
            .execute(
                r#"
                DELETE FROM HealthCheckRecord
                WHERE config_id = ?1
                  AND check_at < datetime('now', '-24 hours')
                "#,
                rusqlite::params![input.config_id],
            )
            .unwrap_or(0);

        if deleted > 0 {
            log::info!(
                "自动清理健康检查记录: config_id={}, 删除了 {} 条24小时前的记录",
                input.config_id, deleted
            );
        }

        Self::get_record_by_id(conn, id)
    }

    /// 根据 ID 获取健康检查记录
    pub fn get_record_by_id(conn: &Connection, id: i64) -> AppResult<HealthCheckRecord> {
        conn.query_row(
            r#"
            SELECT id, config_id, check_at, status, latency_ms, error_message, http_status_code
            FROM HealthCheckRecord
            WHERE id = ?1
            "#,
            [id],
            |row| {
                Ok(HealthCheckRecord {
                    id: row.get(0)?,
                    config_id: row.get(1)?,
                    check_at: row.get(2)?,
                    status: HealthCheckStatus::from_str(&row.get::<_, String>(3)?)
                        .unwrap_or(HealthCheckStatus::Failed),
                    latency_ms: row.get(4)?,
                    error_message: row.get(5)?,
                    http_status_code: row.get(6)?,
                })
            },
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("获取健康检查记录失败: {}", e),
        })
    }

    /// 获取配置的最近健康检查记录
    pub fn get_latest_records(
        conn: &Connection,
        config_id: i64,
        limit: i64,
    ) -> AppResult<Vec<HealthCheckRecord>> {
        let mut stmt = conn
            .prepare(
                r#"
            SELECT id, config_id, check_at, status, latency_ms, error_message, http_status_code
            FROM HealthCheckRecord
            WHERE config_id = ?1
            ORDER BY check_at DESC
            LIMIT ?2
            "#,
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

        let records = stmt
            .query_map([config_id, limit], |row| {
                Ok(HealthCheckRecord {
                    id: row.get(0)?,
                    config_id: row.get(1)?,
                    check_at: row.get(2)?,
                    status: HealthCheckStatus::from_str(&row.get::<_, String>(3)?)
                        .unwrap_or(HealthCheckStatus::Failed),
                    latency_ms: row.get(4)?,
                    error_message: row.get(5)?,
                    http_status_code: row.get(6)?,
                })
            })
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询健康检查记录失败: {}", e),
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::DatabaseError {
                message: format!("读取健康检查记录失败: {}", e),
            })?;

        Ok(records)
    }

    /// 获取小时级别统计数据
    pub fn get_hourly_stats(
        conn: &Connection,
        config_id: i64,
        hours: i64,
    ) -> AppResult<Vec<HealthCheckHourlyStats>> {
        let mut stmt = conn
            .prepare(
                r#"
            SELECT
                config_id,
                strftime('%Y-%m-%d %H:00:00', check_at) as hour,
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_count,
                AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as avg_latency_ms,
                MIN(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as min_latency_ms,
                MAX(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as max_latency_ms
            FROM HealthCheckRecord
            WHERE config_id = ?1
              AND check_at >= datetime('now', '-' || ?2 || ' hours')
            GROUP BY config_id, strftime('%Y-%m-%d %H:00:00', check_at)
            ORDER BY hour DESC
            "#,
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

        let stats = stmt
            .query_map([config_id, hours], |row| {
                Ok(HealthCheckHourlyStats {
                    config_id: row.get(0)?,
                    hour: row.get(1)?,
                    total_checks: row.get(2)?,
                    success_count: row.get(3)?,
                    failed_count: row.get(4)?,
                    timeout_count: row.get(5)?,
                    avg_latency_ms: row.get(6)?,
                    min_latency_ms: row.get(7)?,
                    max_latency_ms: row.get(8)?,
                })
            })
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询小时统计失败: {}", e),
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::DatabaseError {
                message: format!("读取小时统计失败: {}", e),
            })?;

        Ok(stats)
    }

    /// 获取所有配置的健康检查摘要
    pub fn get_all_summaries(
        pool: &Arc<DbPool>,
        hours: i64,
    ) -> AppResult<Vec<ConfigHealthSummary>> {
        pool.with_connection(|conn| {
            // 获取所有配置
            let mut stmt = conn
                .prepare("SELECT id, name FROM ApiConfig ORDER BY sort_order")
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询失败: {}", e),
                })?;

            let configs: Vec<(i64, String)> = stmt
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询配置失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("读取配置失败: {}", e),
                })?;

            let mut summaries = Vec::new();

            for (config_id, config_name) in configs {
                // 获取小时统计
                let hourly_stats = Self::get_hourly_stats(conn, config_id, hours)?;

                // 获取最后一次检查
                let last_check = Self::get_latest_records(conn, config_id, 1)?
                    .into_iter()
                    .next();

                // 计算24小时可用率
                let (availability_24h, avg_latency_24h) =
                    Self::calculate_availability(conn, config_id, hours)?;

                summaries.push(ConfigHealthSummary {
                    config_id,
                    config_name,
                    hourly_stats,
                    last_check,
                    availability_24h,
                    avg_latency_24h,
                });
            }

            Ok(summaries)
        })
    }

    /// 计算可用率和平均延迟
    fn calculate_availability(
        conn: &Connection,
        config_id: i64,
        hours: i64,
    ) -> AppResult<(f64, Option<f64>)> {
        let result: (i64, i64, Option<f64>) = conn
            .query_row(
                r#"
            SELECT
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) as success,
                AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as avg_latency
            FROM HealthCheckRecord
            WHERE config_id = ?1
              AND check_at >= datetime('now', '-' || ?2 || ' hours')
            "#,
                [config_id, hours],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("计算可用率失败: {}", e),
            })?;

        let availability = if result.0 > 0 {
            (result.1 as f64 / result.0 as f64) * 100.0
        } else {
            0.0
        };

        Ok((availability, result.2))
    }

    /// 清理旧的健康检查记录(保留指定天数)
    #[allow(dead_code)]
    pub fn cleanup_old_records(conn: &Connection, retain_days: i64) -> AppResult<i64> {
        let deleted = conn
            .execute(
                r#"
            DELETE FROM HealthCheckRecord
            WHERE check_at < datetime('now', '-' || ?1 || ' days')
            "#,
                [retain_days],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("清理旧记录失败: {}", e),
            })?;

        log::info!("已清理 {} 条过期的健康检查记录", deleted);
        Ok(deleted as i64)
    }
}
