/**
 * Health Check Scheduler
 * 定时检查所有 API 配置的健康状态
 *
 * Features:
 * - 每5分钟自动检查 /v1/health 端点
 * - 直接向各服务商发送请求（不通过代理）
 * - 记录检查结果到数据库
 * - 支持启动/停止/配置检查间隔
 * - 根据检查结果自动更新配置可用状态
 * - 服务商恢复可用时自动切换到最高权重服务商
 */

use crate::db::DbPool;
use crate::models::api_config::UpdateApiConfigInput;
use crate::models::error::{AppError, AppResult};
use crate::models::health_check::{CreateHealthCheckRecordInput, HealthCheckStatus};
use crate::services::api_config::ApiConfigService;
use crate::services::health_check_service::HealthCheckService;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time::{interval, Duration as TokioDuration};

/// 默认健康检查间隔（秒）- 5分钟
const DEFAULT_HEALTH_CHECK_INTERVAL_SECS: u64 = 300;

/// 健康检查调度器状态
#[derive(Debug, Clone, PartialEq)]
pub enum HealthCheckSchedulerStatus {
    /// 未运行
    Stopped,
    /// 运行中
    Running,
}

/// 切换完成回调类型
pub type SwitchCallback = Arc<dyn Fn(i64) + Send + Sync>;

/// 健康检查调度器
pub struct HealthCheckScheduler {
    db_pool: Arc<DbPool>,
    status: Arc<RwLock<HealthCheckSchedulerStatus>>,
    task_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
    interval_secs: Arc<RwLock<u64>>,
    /// 代理服务器地址（用于旧的代理检查模式，保留以备将来使用）
    #[allow(dead_code)]
    proxy_host: Arc<RwLock<String>>,
    /// 代理服务器端口
    #[allow(dead_code)]
    proxy_port: Arc<RwLock<u16>>,
    /// 切换完成回调（用于通知 ProxyServer 更新内存配置）
    on_switch_callback: Arc<RwLock<Option<SwitchCallback>>>,
}

impl HealthCheckScheduler {
    /// 创建新的健康检查调度器
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        Self {
            db_pool,
            status: Arc::new(RwLock::new(HealthCheckSchedulerStatus::Stopped)),
            task_handle: Arc::new(RwLock::new(None)),
            interval_secs: Arc::new(RwLock::new(DEFAULT_HEALTH_CHECK_INTERVAL_SECS)),
            proxy_host: Arc::new(RwLock::new("127.0.0.1".to_string())),
            proxy_port: Arc::new(RwLock::new(25341)),
            on_switch_callback: Arc::new(RwLock::new(None)),
        }
    }

    /// 设置切换完成回调
    ///
    /// # Arguments
    /// - `callback`: 切换完成时调用的回调函数，参数为新配置 ID
    pub async fn set_switch_callback<F>(&self, callback: F)
    where
        F: Fn(i64) + Send + Sync + 'static,
    {
        let mut cb = self.on_switch_callback.write().await;
        *cb = Some(Arc::new(callback));
        log::debug!("HealthCheckScheduler switch callback registered");
    }

    /// 获取调度器状态
    pub async fn status(&self) -> HealthCheckSchedulerStatus {
        self.status.read().await.clone()
    }

    /// 设置检查间隔（秒）
    pub async fn set_interval(&self, secs: u64) {
        let mut interval = self.interval_secs.write().await;
        *interval = secs;
        log::info!("健康检查间隔已设置为 {} 秒", secs);
    }

    /// 获取当前检查间隔（秒）
    pub async fn get_interval(&self) -> u64 {
        *self.interval_secs.read().await
    }

    /// 设置代理服务器地址（兼容旧接口，保留以备将来使用）
    #[allow(dead_code)]
    pub async fn set_proxy_address(&self, host: String, port: u16) {
        let mut h = self.proxy_host.write().await;
        *h = host.clone();
        let mut p = self.proxy_port.write().await;
        *p = port;
        log::info!("健康检查代理地址已设置为 {}:{}", host, port);
    }

    /// 启动调度器
    pub async fn start(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == HealthCheckSchedulerStatus::Running {
            log::warn!("健康检查调度器已在运行");
            return Ok(());
        }

        let interval_secs = *self.interval_secs.read().await;

        log::info!(
            "正在启动健康检查调度器... 间隔: {}秒",
            interval_secs
        );

        let db_pool = self.db_pool.clone();
        let switch_callback = self.on_switch_callback.clone();

        // 启动后台任务
        let handle = tokio::spawn(async move {
            log::info!(
                "健康检查调度器后台任务已启动，检查间隔: {}秒",
                interval_secs
            );

            let mut ticker = interval(TokioDuration::from_secs(interval_secs));

            loop {
                ticker.tick().await;

                log::info!("开始执行健康检查...");

                // 执行健康检查
                let callback_clone = switch_callback.clone();
                if let Err(e) = Self::perform_all_health_checks(&db_pool, callback_clone).await {
                    log::error!("健康检查执行失败: {}", e);
                }

                log::info!("健康检查完成");
            }
        });

        // 保存任务句柄
        let mut task_handle = self.task_handle.write().await;
        *task_handle = Some(handle);

        *status = HealthCheckSchedulerStatus::Running;

        log::info!("健康检查调度器已启动");
        Ok(())
    }

    /// 停止调度器
    pub async fn stop(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == HealthCheckSchedulerStatus::Stopped {
            log::warn!("健康检查调度器未运行");
            return Ok(());
        }

        log::info!("正在停止健康检查调度器...");

        // 取消后台任务
        let mut task_handle = self.task_handle.write().await;
        if let Some(handle) = task_handle.take() {
            handle.abort();
            log::debug!("健康检查调度器后台任务已取消");
        }

        *status = HealthCheckSchedulerStatus::Stopped;

        log::info!("健康检查调度器已停止");
        Ok(())
    }

    /// 对所有配置执行健康检查
    /// 根据检查结果更新配置可用状态，并在需要时切换到最高优先级的可用服务商
    /// 只检查启用了健康检查的分组中的配置
    async fn perform_all_health_checks(
        db_pool: &Arc<DbPool>,
        switch_callback: Arc<RwLock<Option<SwitchCallback>>>,
    ) -> AppResult<()> {
        use rusqlite::params;

        log::info!("╔══════════════════════════════════════════════════════════════╗");
        log::info!("║           🏥 批量健康检查开始                                  ║");
        log::info!("╚══════════════════════════════════════════════════════════════╝");

        // 获取所有启用了健康检查的分组
        let enabled_groups = db_pool.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, health_check_interval_sec FROM ConfigGroup
                 WHERE health_check_enabled = 1"
            ).map_err(|e| AppError::DatabaseError {
                message: format!("查询启用健康检查的分组失败: {}", e),
            })?;

            let groups: Vec<(i64, String, i32)> = stmt
                .query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("读取分组数据失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("解析分组数据失败: {}", e),
                })?;

            Ok(groups)
        })?;

        if enabled_groups.is_empty() {
            log::info!("📋 没有启用健康检查的分组，跳过检查");
            return Ok(());
        }

        log::info!("📋 共有 {} 个分组启用了健康检查", enabled_groups.len());

        // 收集所有需要检查的配置
        let mut all_configs = Vec::new();
        for (group_id, group_name, _interval) in &enabled_groups {
            let group_configs = db_pool.with_connection(|conn| {
                ApiConfigService::list_configs(conn, Some(*group_id))
            })?;

            log::info!("📦 分组 \"{}\" (ID: {}) 有 {} 个配置", group_name, group_id, group_configs.len());
            all_configs.extend(group_configs);
        }

        log::info!("📋 共有 {} 个配置需要检查", all_configs.len());

        // 记录状态变化的配置
        let mut recovered_configs: Vec<(i64, i64)> = Vec::new(); // (config_id, group_id)
        let mut success_count = 0;
        let mut failed_count = 0;

        for (index, config) in all_configs.iter().enumerate() {
            log::info!("────────────────────────────────────────────────────────────────");
            log::info!("📌 正在检查配置 [{}/{}]: {} (ID: {})", index + 1, all_configs.len(), config.name, config.id);

            // 对每个配置执行健康检查
            let result = Self::check_single_config(&config.server_url, &config.api_key).await;
            let was_available = config.is_available;

            // 判断是否成功
            let is_success = result.is_ok();
            if is_success {
                success_count += 1;
            } else {
                failed_count += 1;
            }

            // 保存检查结果
            let input = match &result {
                Ok((latency_ms, http_status)) => CreateHealthCheckRecordInput {
                    config_id: config.id,
                    status: HealthCheckStatus::Success,
                    latency_ms: Some(*latency_ms),
                    error_message: None,
                    http_status_code: Some(*http_status),
                },
                Err((status, error_msg, http_status)) => CreateHealthCheckRecordInput {
                    config_id: config.id,
                    status: status.clone(),
                    latency_ms: None,
                    error_message: Some(error_msg.clone()),
                    http_status_code: *http_status,
                },
            };

            if let Err(e) = db_pool.with_connection(|conn| {
                HealthCheckService::create_record(conn, input)
            }) {
                log::error!("保存健康检查记录失败 (config_id={}): {}", config.id, e);
            } else {
                log::debug!("💾 健康检查记录已保存 (config_id={})", config.id);
            }

            // 更新配置的可用状态
            let new_is_available = is_success;
            if new_is_available != was_available {
                let update_input = UpdateApiConfigInput {
                    id: config.id,
                    is_available: Some(new_is_available),
                    ..Default::default()
                };

                if let Err(e) = db_pool.with_connection(|conn| {
                    ApiConfigService::update_config(conn, &update_input)
                }) {
                    log::error!("更新配置可用状态失败 (config_id={}): {}", config.id, e);
                } else {
                    if new_is_available {
                        log::info!(
                            "🔄 配置 {} (ID: {}) 状态变更: 不可用 → 可用",
                            config.name,
                            config.id
                        );
                        // 记录恢复的配置
                        if let Some(group_id) = config.group_id {
                            recovered_configs.push((config.id, group_id));
                        }
                    } else {
                        log::warn!(
                            "🔄 配置 {} (ID: {}) 状态变更: 可用 → 不可用",
                            config.name,
                            config.id
                        );
                    }
                }
            }
        }

        // 输出统计信息
        log::info!("════════════════════════════════════════════════════════════════");
        log::info!("📊 健康检查统计: 成功 {} 个, 失败 {} 个, 共 {} 个", success_count, failed_count, all_configs.len());

        // 更新所有配置的权重分数
        log::info!("⚖️ 更新配置权重分数...");
        if let Ok(updated_configs) = db_pool.with_connection(|conn| {
            ApiConfigService::list_configs(conn, None)
        }) {
            let weight_calculator = crate::services::weight_calculator::WeightCalculator::new();
            if let Err(e) = db_pool.with_connection(|conn| {
                weight_calculator.update_weights(conn, &updated_configs)
            }) {
                log::error!("更新权重分数失败: {}", e);
            } else {
                log::info!("⚖️ 权重分数已更新");
            }
        }

        // 如果有配置恢复可用，检查是否需要切换到更高优先级的服务商
        if !recovered_configs.is_empty() {
            log::info!("🔄 检测到 {} 个配置恢复可用，检查是否需要切换...", recovered_configs.len());

            // 获取当前活动的配置和分组
            let active_info = db_pool.with_connection(|conn| {
                conn.query_row(
                    "SELECT current_config_id, current_group_id FROM ProxyService WHERE id = 1",
                    params![],
                    |row| Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, Option<i64>>(1)?)),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询 ProxyService 失败: {}", e),
                })
            });

            if let Ok((current_config_id, current_group_id)) = active_info {
                if let (Some(current_id), Some(group_id)) = (current_config_id, current_group_id) {
                    // 检查当前分组是否有恢复的配置
                    let group_recovered: Vec<i64> = recovered_configs
                        .iter()
                        .filter(|(_, gid)| *gid == group_id)
                        .map(|(cid, _)| *cid)
                        .collect();

                    if !group_recovered.is_empty() {
                        // 获取当前分组所有启用且可用的配置（按权重分数降序排序）
                        let available_configs = db_pool.with_connection(|conn| {
                            let mut stmt = conn.prepare(
                                "SELECT id, name, weight_score FROM ApiConfig
                                 WHERE group_id = ?1 AND is_enabled = 1 AND is_available = 1
                                 ORDER BY weight_score DESC, sort_order ASC"
                            ).map_err(|e| AppError::DatabaseError {
                                message: format!("准备查询失败: {}", e),
                            })?;

                            let configs: Vec<(i64, String, f64)> = stmt
                                .query_map(params![group_id], |row| {
                                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                                })
                                .map_err(|e| AppError::DatabaseError {
                                    message: format!("查询配置失败: {}", e),
                                })?
                                .collect::<Result<Vec<_>, _>>()
                                .map_err(|e| AppError::DatabaseError {
                                    message: format!("解析配置失败: {}", e),
                                })?;

                            Ok(configs)
                        });

                        if let Ok(available) = available_configs {
                            if !available.is_empty() {
                                // 找到权重最高的可用配置
                                let highest_weight = &available[0];
                                let highest_weight_id = highest_weight.0;

                                // 检查当前配置是否是权重最高的
                                if highest_weight_id != current_id {
                                    // 获取当前配置的权重分数
                                    let current_weight = available
                                        .iter()
                                        .find(|(id, _, _)| *id == current_id)
                                        .map(|(_, _, weight)| *weight);

                                    // 只有当最高权重配置权重更高时才切换
                                    let should_switch = current_weight
                                        .map(|current_w| highest_weight.2 > current_w)
                                        .unwrap_or(true); // 如果当前配置不在可用列表中，应该切换

                                    if should_switch {
                                        log::info!(
                                            "🔄 发现更高权重的可用配置 {} (ID: {}, 权重: {:.4})，正在切换...",
                                            highest_weight.1,
                                            highest_weight_id,
                                            highest_weight.2
                                        );

                                        // 更新 ProxyService 的当前配置
                                        if let Err(e) = db_pool.with_connection(|conn| {
                                            conn.execute(
                                                "UPDATE ProxyService SET current_config_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                                                params![highest_weight_id],
                                            )
                                            .map_err(|e| AppError::DatabaseError {
                                                message: format!("更新 ProxyService 失败: {}", e),
                                            })
                                        }) {
                                            log::error!("切换到高权重配置失败: {}", e);
                                        } else {
                                            log::info!(
                                                "✅ 已自动切换到高权重配置: {} (ID: {}, 权重: {:.4})",
                                                highest_weight.1,
                                                highest_weight_id,
                                                highest_weight.2
                                            );

                                            // 🔧 关键修复：调用回调通知 ProxyServer 更新内存配置
                                            let callback = switch_callback.read().await;
                                            if let Some(cb) = callback.as_ref() {
                                                log::info!(
                                                    "📡 调用切换回调，通知 ProxyServer 更新内存配置: {}",
                                                    highest_weight_id
                                                );
                                                cb(highest_weight_id);
                                            } else {
                                                log::warn!(
                                                    "⚠️ 健康检查切换回调未设置，ProxyServer 内存配置可能未更新"
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        log::info!("╚══════════════════════════════════════════════════════════════╝");
        log::info!("🏁 批量健康检查完成");
        Ok(())
    }

    /// 健康检查超时时间（秒）- 比 API 测试短，用于快速检测服务可用性
    const HEALTH_CHECK_TIMEOUT_SECS: u64 = 10;

    /// 检查单个配置的健康状态
    /// 使用 /v1/health 端点进行轻量级健康检查
    async fn check_single_config(
        server_url: &str,
        api_key: &str,
    ) -> Result<(i64, i32), (HealthCheckStatus, String, Option<i32>)> {
        log::info!("┌──────────────────────────────────────────────────────────────┐");
        log::info!("│           🏥 健康检查开始                                      │");
        log::info!("└──────────────────────────────────────────────────────────────┘");
        log::info!("🔗 服务器地址: {}", server_url);
        log::info!("🔑 API Key: {}...{}", &api_key[..8.min(api_key.len())], &api_key[api_key.len().saturating_sub(4)..]);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(Self::HEALTH_CHECK_TIMEOUT_SECS))
            .build()
            .map_err(|e| {
                log::error!("❌ 创建 HTTP 客户端失败: {}", e);
                (
                    HealthCheckStatus::Failed,
                    format!("创建HTTP客户端失败: {}", e),
                    None,
                )
            })?;

        // 使用 /v1/health 端点进行轻量级健康检查
        let url = format!("{}/v1/health", server_url.trim_end_matches('/'));

        log::info!("📤 健康检查端点: {}", url);
        log::info!("⏱️  超时配置: {}s", Self::HEALTH_CHECK_TIMEOUT_SECS);
        log::info!("🚀 正在发送健康检查请求...");

        let start_time = std::time::Instant::now();

        // 发送 GET 请求到 /v1/health 端点，携带 API Key 用于认证
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("x-api-key", api_key)
            .send()
            .await;

        let latency_ms = start_time.elapsed().as_millis() as i64;

        match response {
            Ok(resp) => {
                let status_code = resp.status().as_u16() as i32;
                log::info!("📥 收到响应 (耗时 {:.2}s)", latency_ms as f64 / 1000.0);
                log::info!("📥 HTTP 状态码: {}", status_code);

                // 2xx 状态码表示服务健康
                if resp.status().is_success() {
                    let body = resp.text().await.unwrap_or_default();
                    log::info!("📥 响应体大小: {} 字节", body.len());
                    log::debug!("响应体内容: {}", if body.len() > 200 { format!("{}...(截断)", &body[..200]) } else { body.clone() });

                    log::info!(
                        "✅ 健康检查成功 - 状态码: {}, 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Ok((latency_ms, status_code))
                } else if status_code == 404 {
                    // 404 表示端点不存在，但服务可达，视为健康
                    log::info!(
                        "✅ 服务可达（/v1/health 端点不存在，但服务响应正常）- 延迟: {}ms",
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Ok((latency_ms, status_code))
                } else if status_code == 401 || status_code == 403 {
                    // 认证失败，但服务可达，视为健康（健康检查不关心认证）
                    log::info!(
                        "✅ 服务可达（认证未通过，但服务响应正常）- 延迟: {}ms",
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Ok((latency_ms, status_code))
                } else if status_code == 429 {
                    // 限流，但服务可达
                    log::info!(
                        "✅ 服务可达（被限流，但服务响应正常）- 延迟: {}ms",
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Ok((latency_ms, status_code))
                } else if status_code >= 500 {
                    // 5xx 服务器错误，视为不健康
                    let error_body = resp.text().await.unwrap_or_default();
                    log::error!(
                        "❌ 服务器错误 - 状态码: {}, 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                    log::warn!("响应体: {}", error_body);
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Failed,
                        format!("服务器错误: HTTP {}", status_code),
                        Some(status_code),
                    ))
                } else {
                    // 其他状态码（如 400），服务可达
                    log::info!(
                        "✅ 服务可达（HTTP {}）- 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Ok((latency_ms, status_code))
                }
            }
            Err(e) => {
                if e.is_timeout() {
                    log::error!("⏰ 健康检查超时 ({}ms)", latency_ms);
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Timeout,
                        format!("请求超时: {}", e),
                        None,
                    ))
                } else if e.is_connect() {
                    log::error!("❌ 连接失败: {}", e);
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Failed,
                        format!("连接失败: {}", e),
                        None,
                    ))
                } else {
                    log::error!("❌ 健康检查失败: {}", e);
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Failed,
                        format!("请求失败: {}", e),
                        None,
                    ))
                }
            }
        }
    }

    /// 手动执行一次健康检查
    pub async fn check_now(&self) -> AppResult<()> {
        Self::perform_all_health_checks(&self.db_pool, self.on_switch_callback.clone()).await
    }
}

impl Drop for HealthCheckScheduler {
    fn drop(&mut self) {
        log::debug!("健康检查调度器正在被销毁");
    }
}
