/**
 * 自动切换服务
 * 处理 API 配置的自动故障转移和智能切换
 *
 * Features:
 * - 自动故障检测和切换
 * - 分组内配置轮询
 * - 延迟优化切换
 * - 切换日志记录
 * - 事件推送
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::switch_log::{CreateSwitchLogInput, SwitchLogDetail, SwitchReason};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

/// 自动切换服务
pub struct AutoSwitchService {
    db_pool: Arc<DbPool>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl AutoSwitchService {
    /// 创建新的自动切换服务
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        Self {
            db_pool,
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// 设置 Tauri app handle 用于事件推送
    #[allow(dead_code)]
    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app_handle = self.app_handle.write().await;
        *app_handle = Some(handle);
        log::debug!("Tauri app handle set for auto switch service");
    }

    /// 处理故障并执行自动切换
    ///
    /// # Arguments
    /// - `current_config_id`: 当前配置 ID
    /// - `group_id`: 当前分组 ID
    /// - `reason`: 切换原因
    /// - `error_message`: 错误信息(可选)
    /// - `latency_before_ms`: 切换前延迟(可选)
    ///
    /// # Returns
    /// - Option<i64>: 切换到的新配置 ID,如果没有可用配置则返回 None
    pub async fn handle_failure(
        &self,
        current_config_id: i64,
        group_id: i64,
        reason: SwitchReason,
        error_message: Option<String>,
        latency_before_ms: Option<i32>,
    ) -> AppResult<Option<i64>> {
        log::info!(
            "处理故障切换: config_id={}, group_id={}, reason={:?}",
            current_config_id,
            group_id,
            reason
        );

        // 检查分组是否启用自动切换
        let group = self.db_pool.with_connection(|conn| {
            use rusqlite::params;
            conn.query_row(
                "SELECT id, auto_switch_enabled FROM ConfigGroup WHERE id = ?1",
                params![group_id],
                |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, bool>(1)?))
                },
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询分组失败: {}", e),
            })
        })?;

        if !group.1 {
            log::warn!("分组 {} 未启用自动切换", group_id);
            return Ok(None);
        }

        // 查找下一个可用配置
        match self.find_next_config(current_config_id, group_id).await? {
            Some(next_config_id) => {
                // 测试新配置延迟(可选)
                let latency_after_ms = self.measure_latency(next_config_id).await?;

                // 记录切换日志
                let log_id = self
                    .log_switch(CreateSwitchLogInput {
                        reason: reason.clone(),
                        source_config_id: Some(current_config_id),
                        target_config_id: next_config_id,
                        group_id,
                        latency_before_ms,
                        latency_after_ms,
                        error_message: error_message.clone(),
                    })
                    .await?;

                log::info!(
                    "自动切换成功: {} → {}, log_id={}",
                    current_config_id,
                    next_config_id,
                    log_id
                );

                // 推送切换事件
                self.emit_switch_triggered(log_id).await;

                Ok(Some(next_config_id))
            }
            None => {
                log::warn!("分组 {} 中没有可用的配置", group_id);
                Ok(None)
            }
        }
    }

    /// 查找下一个可用配置
    ///
    /// 策略:
    /// 1. 获取分组内所有可用配置(is_available = true)
    /// 2. 按 sort_order 排序
    /// 3. 找到当前配置的位置
    /// 4. 返回下一个配置(循环到第一个)
    ///
    /// # Returns
    /// - Option<i64>: 下一个配置 ID,如果没有则返回 None
    pub async fn find_next_config(
        &self,
        current_config_id: i64,
        group_id: i64,
    ) -> AppResult<Option<i64>> {
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            // 获取所有可用配置(按优先级排序)
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM ApiConfig
                     WHERE group_id = ?1 AND is_available = 1
                     ORDER BY sort_order ASC",
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询失败: {}", e),
                })?;

            let config_ids: Vec<i64> = stmt
                .query_map(params![group_id], |row| row.get(0))
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询配置失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("解析配置失败: {}", e),
                })?;

            if config_ids.is_empty() {
                return Ok(None);
            }

            // 如果只有一个配置,无法切换
            if config_ids.len() == 1 {
                log::warn!("分组 {} 只有一个可用配置,无法切换", group_id);
                return Ok(None);
            }

            // 查找当前配置的索引
            let current_index = config_ids
                .iter()
                .position(|&id| id == current_config_id);

            // 返回下一个配置(循环)
            let next_index = match current_index {
                Some(idx) => (idx + 1) % config_ids.len(),
                None => 0, // 如果当前配置不在列表中,返回第一个
            };

            Ok(Some(config_ids[next_index]))
        })
    }

    /// 记录切换日志
    ///
    /// # Arguments
    /// - `input`: 切换日志输入
    ///
    /// # Returns
    /// - i64: 日志 ID
    pub async fn log_switch(&self, input: CreateSwitchLogInput) -> AppResult<i64> {
        // 验证输入
        input.validate().map_err(|e| AppError::ValidationError {
            field: "switch_log".to_string(),
            message: e,
        })?;

        // 验证不跨分组切换 (FR-017)
        if let Some(source_id) = input.source_config_id {
            self.validate_same_group(source_id, input.target_config_id, input.group_id)?;
        }

        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            let now = chrono::Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO SwitchLog (
                    switch_at, reason, source_config_id, target_config_id,
                    group_id, is_cross_group, latency_before_ms, latency_after_ms, error_message
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    now,
                    input.reason.as_str(),
                    input.source_config_id,
                    input.target_config_id,
                    input.group_id,
                    0, // is_cross_group 始终为 false (FR-017)
                    input.latency_before_ms,
                    input.latency_after_ms,
                    input.error_message,
                ],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("插入切换日志失败: {}", e),
            })?;

            Ok(conn.last_insert_rowid())
        })
    }

    /// 验证源和目标配置属于同一分组
    fn validate_same_group(
        &self,
        source_config_id: i64,
        target_config_id: i64,
        group_id: i64,
    ) -> AppResult<()> {
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            // 检查源配置
            let source_group: i64 = conn
                .query_row(
                    "SELECT group_id FROM ApiConfig WHERE id = ?1",
                    params![source_config_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询源配置分组失败: {}", e),
                })?;

            // 检查目标配置
            let target_group: i64 = conn
                .query_row(
                    "SELECT group_id FROM ApiConfig WHERE id = ?1",
                    params![target_config_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询目标配置分组失败: {}", e),
                })?;

            if source_group != group_id || target_group != group_id {
                return Err(AppError::ValidationError {
                    field: "group_id".to_string(),
                    message: "不允许跨分组切换".to_string(),
                });
            }

            Ok(())
        })
    }

    /// 测量配置的延迟
    ///
    /// # Arguments
    /// - `config_id`: 配置 ID
    ///
    /// # Returns
    /// - Option<i32>: 延迟(毫秒),测试失败则返回 None
    async fn measure_latency(&self, config_id: i64) -> AppResult<Option<i32>> {
        // 获取配置最近的测试延迟
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            conn.query_row(
                "SELECT last_latency_ms FROM ApiConfig WHERE id = ?1",
                params![config_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询配置延迟失败: {}", e),
            })
        })
    }

    /// 推送 auto-switch-triggered 事件
    async fn emit_switch_triggered(&self, log_id: i64) {
        use tauri::Emitter;
        let app_handle = self.app_handle.read().await;
        if let Some(handle) = app_handle.as_ref() {
            // 获取完整的日志详情
            match self.get_switch_log_detail(log_id) {
                Ok(detail) => {
                    if let Err(e) = handle.emit("auto-switch-triggered", detail) {
                        log::error!("Failed to emit auto-switch-triggered event: {}", e);
                    } else {
                        log::debug!("Emitted auto-switch-triggered event for log {}", log_id);
                    }
                }
                Err(e) => {
                    log::error!("Failed to get switch log detail: {}", e);
                }
            }
        }
    }

    /// 获取切换日志详情
    ///
    /// # Arguments
    /// - `log_id`: 日志 ID
    ///
    /// # Returns
    /// - SwitchLogDetail: 日志详情
    pub fn get_switch_log_detail(&self, log_id: i64) -> AppResult<SwitchLogDetail> {
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            conn.query_row(
                "SELECT
                    sl.id, sl.switch_at, sl.reason,
                    sc.name as source_name,
                    tc.name as target_name,
                    g.name as group_name,
                    sl.latency_before_ms, sl.latency_after_ms,
                    sl.error_message
                FROM SwitchLog sl
                LEFT JOIN ApiConfig sc ON sl.source_config_id = sc.id
                JOIN ApiConfig tc ON sl.target_config_id = tc.id
                JOIN ConfigGroup g ON sl.group_id = g.id
                WHERE sl.id = ?1",
                params![log_id],
                |row| {
                    let latency_before: Option<i32> = row.get(6)?;
                    let latency_after: Option<i32> = row.get(7)?;
                    let latency_improvement = match (latency_before, latency_after) {
                        (Some(before), Some(after)) => Some(before - after),
                        _ => None,
                    };

                    let reason_str: String = row.get(2)?;
                    let reason = SwitchReason::from_str(&reason_str)
                        .unwrap_or(SwitchReason::Manual);

                    Ok(SwitchLogDetail {
                        id: row.get(0)?,
                        switch_at: row.get(1)?,
                        reason,
                        source_config_name: row.get(3)?,
                        target_config_name: row.get(4)?,
                        group_name: row.get(5)?,
                        latency_before_ms: latency_before,
                        latency_after_ms: latency_after,
                        latency_improvement_ms: latency_improvement,
                        error_message: row.get(8)?,
                    })
                },
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询切换日志详情失败: {}", e),
            })
        })
    }

    /// 获取切换日志列表
    ///
    /// # Arguments
    /// - `group_id`: 分组 ID(可选,用于筛选)
    /// - `limit`: 返回数量限制
    /// - `offset`: 偏移量
    ///
    /// # Returns
    /// - Vec<SwitchLogDetail>: 日志详情列表
    pub fn get_switch_logs(
        &self,
        group_id: Option<i64>,
        limit: i32,
        offset: i32,
    ) -> AppResult<Vec<SwitchLogDetail>> {
        self.db_pool.with_connection(|conn| {
            let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(gid) = group_id {
                (
                    "SELECT
                        sl.id, sl.switch_at, sl.reason,
                        sc.name as source_name,
                        tc.name as target_name,
                        g.name as group_name,
                        sl.latency_before_ms, sl.latency_after_ms,
                        sl.error_message
                    FROM SwitchLog sl
                    LEFT JOIN ApiConfig sc ON sl.source_config_id = sc.id
                    JOIN ApiConfig tc ON sl.target_config_id = tc.id
                    JOIN ConfigGroup g ON sl.group_id = g.id
                    WHERE sl.group_id = ?1
                    ORDER BY sl.switch_at DESC
                    LIMIT ?2 OFFSET ?3".to_string(),
                    vec![Box::new(gid), Box::new(limit), Box::new(offset)],
                )
            } else {
                (
                    "SELECT
                        sl.id, sl.switch_at, sl.reason,
                        sc.name as source_name,
                        tc.name as target_name,
                        g.name as group_name,
                        sl.latency_before_ms, sl.latency_after_ms,
                        sl.error_message
                    FROM SwitchLog sl
                    LEFT JOIN ApiConfig sc ON sl.source_config_id = sc.id
                    JOIN ApiConfig tc ON sl.target_config_id = tc.id
                    JOIN ConfigGroup g ON sl.group_id = g.id
                    ORDER BY sl.switch_at DESC
                    LIMIT ?1 OFFSET ?2".to_string(),
                    vec![Box::new(limit), Box::new(offset)],
                )
            };

            let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

            let params_ref: Vec<&dyn rusqlite::ToSql> =
                params.iter().map(|p| p.as_ref()).collect();

            let logs = stmt
                .query_map(&params_ref[..], |row| {
                    let latency_before: Option<i32> = row.get(6)?;
                    let latency_after: Option<i32> = row.get(7)?;
                    let latency_improvement = match (latency_before, latency_after) {
                        (Some(before), Some(after)) => Some(before - after),
                        _ => None,
                    };

                    let reason_str: String = row.get(2)?;
                    let reason = SwitchReason::from_str(&reason_str)
                        .unwrap_or(SwitchReason::Manual);

                    Ok(SwitchLogDetail {
                        id: row.get(0)?,
                        switch_at: row.get(1)?,
                        reason,
                        source_config_name: row.get(3)?,
                        target_config_name: row.get(4)?,
                        group_name: row.get(5)?,
                        latency_before_ms: latency_before,
                        latency_after_ms: latency_after,
                        latency_improvement_ms: latency_improvement,
                        error_message: row.get(8)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询切换日志失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("解析切换日志失败: {}", e),
                })?;

            Ok(logs)
        })
    }

    /// 清空切换日志
    ///
    /// # Arguments
    /// - `group_id`: 分组 ID(可选,用于筛选)。如果提供，只清空该分组的日志；否则清空所有日志
    ///
    /// # Returns
    /// - i32: 删除的日志数量
    pub fn clear_switch_logs(&self, group_id: Option<i64>) -> AppResult<i32> {
        self.db_pool.with_connection(|conn| {
            let deleted = if let Some(gid) = group_id {
                conn.execute("DELETE FROM SwitchLog WHERE group_id = ?1", [gid])
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("清空分组切换日志失败: {}", e),
                    })?
            } else {
                conn.execute("DELETE FROM SwitchLog", [])
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("清空所有切换日志失败: {}", e),
                    })?
            };

            log::info!("已清空 {} 条切换日志", deleted);
            Ok(deleted as i32)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;

    #[tokio::test]
    async fn test_find_next_config() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));
        let service = AutoSwitchService::new(db_pool);

        // 测试空分组
        let result = service.find_next_config(1, 999).await.unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_switch_reason() {
        assert!(SwitchReason::ConnectionFailed.is_automatic());
        assert!(!SwitchReason::Manual.is_automatic());
        assert_eq!(SwitchReason::ConnectionFailed.as_str(), "connection_failed");
    }
}
