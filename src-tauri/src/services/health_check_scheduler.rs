/**
 * Health Check Scheduler
 * 定时检查所有 API 配置的健康状态
 *
 * Features:
 * - 每5分钟自动发送模拟 Claude Code 的请求
 * - 直接向各服务商发送请求（不通过代理）
 * - 记录检查结果到数据库
 * - 支持启动/停止/配置检查间隔
 * - 根据检查结果自动更新配置可用状态
 * - 服务商恢复可用时自动切换到最高优先级服务商
 */

use crate::db::DbPool;
use crate::models::api_config::UpdateApiConfigInput;
use crate::models::error::{AppError, AppResult};
use crate::models::health_check::{CreateHealthCheckRecordInput, HealthCheckStatus};
use crate::services::api_config::ApiConfigService;
use crate::services::claude_test_request::{add_claude_code_headers, build_test_request_body, TEST_REQUEST_TIMEOUT_SECS};
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
        }
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
                if let Err(e) = Self::perform_all_health_checks(&db_pool).await {
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
    async fn perform_all_health_checks(db_pool: &Arc<DbPool>) -> AppResult<()> {
        use rusqlite::params;

        log::info!("╔══════════════════════════════════════════════════════════════╗");
        log::info!("║           🏥 批量健康检查开始                                  ║");
        log::info!("╚══════════════════════════════════════════════════════════════╝");

        // 获取所有配置 (group_id=None 表示所有分组)
        let configs = db_pool.with_connection(|conn| {
            ApiConfigService::list_configs(conn, None)
        })?;

        log::info!("📋 共有 {} 个配置需要检查", configs.len());

        // 记录状态变化的配置
        let mut recovered_configs: Vec<(i64, i64)> = Vec::new(); // (config_id, group_id)
        let mut success_count = 0;
        let mut failed_count = 0;

        for (index, config) in configs.iter().enumerate() {
            log::info!("────────────────────────────────────────────────────────────────");
            log::info!("📌 正在检查配置 [{}/{}]: {} (ID: {})", index + 1, configs.len(), config.name, config.id);

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
        log::info!("📊 健康检查统计: 成功 {} 个, 失败 {} 个, 共 {} 个", success_count, failed_count, configs.len());

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
                        // 获取当前分组所有可用配置（按 sort_order 排序）
                        let available_configs = db_pool.with_connection(|conn| {
                            let mut stmt = conn.prepare(
                                "SELECT id, name, sort_order FROM ApiConfig
                                 WHERE group_id = ?1 AND is_available = 1
                                 ORDER BY sort_order ASC"
                            ).map_err(|e| AppError::DatabaseError {
                                message: format!("准备查询失败: {}", e),
                            })?;

                            let configs: Vec<(i64, String, i32)> = stmt
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
                                // 找到最高优先级的可用配置
                                let highest_priority = &available[0];
                                let highest_priority_id = highest_priority.0;

                                // 检查当前配置是否是最高优先级
                                if highest_priority_id != current_id {
                                    // 获取当前配置的 sort_order
                                    let current_sort_order = available
                                        .iter()
                                        .find(|(id, _, _)| *id == current_id)
                                        .map(|(_, _, order)| *order);

                                    // 只有当最高优先级配置排序更靠前时才切换
                                    let should_switch = current_sort_order
                                        .map(|current_order| highest_priority.2 < current_order)
                                        .unwrap_or(true); // 如果当前配置不在可用列表中，应该切换

                                    if should_switch {
                                        log::info!(
                                            "🔄 发现更高优先级的可用配置 {} (ID: {})，正在切换...",
                                            highest_priority.1,
                                            highest_priority_id
                                        );

                                        // 更新 ProxyService 的当前配置
                                        if let Err(e) = db_pool.with_connection(|conn| {
                                            conn.execute(
                                                "UPDATE ProxyService SET current_config_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                                                params![highest_priority_id],
                                            )
                                            .map_err(|e| AppError::DatabaseError {
                                                message: format!("更新 ProxyService 失败: {}", e),
                                            })
                                        }) {
                                            log::error!("切换到高优先级配置失败: {}", e);
                                        } else {
                                            log::info!(
                                                "✅ 已自动切换到高优先级配置: {} (ID: {})",
                                                highest_priority.1,
                                                highest_priority_id
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

        log::info!("╚══════════════════════════════════════════════════════════════╝");
        log::info!("🏁 批量健康检查完成");
        Ok(())
    }

    /// 检查单个配置的健康状态
    /// 使用与真实 Claude Code 完全相同的请求格式
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
            .timeout(std::time::Duration::from_secs(TEST_REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| {
                log::error!("❌ 创建 HTTP 客户端失败: {}", e);
                (
                    HealthCheckStatus::Failed,
                    format!("创建HTTP客户端失败: {}", e),
                    None,
                )
            })?;

        // 使用共享的测试请求构建器
        let url = format!("{}/v1/messages", server_url.trim_end_matches('/'));
        let request_body = build_test_request_body();

        log::info!("📤 测试 API 端点: {}", url);
        log::info!("⏱️  超时配置: {}s", TEST_REQUEST_TIMEOUT_SECS);
        log::info!("🚀 正在发送健康检查请求...");

        let start_time = std::time::Instant::now();

        // 使用共享的请求头构建器
        let request_builder = client.post(&url);
        let request_builder = add_claude_code_headers(request_builder, api_key);
        let response = request_builder
            .json(&request_body)
            .send()
            .await;

        let latency_ms = start_time.elapsed().as_millis() as i64;

        match response {
            Ok(resp) => {
                let status_code = resp.status().as_u16() as i32;
                log::info!("📥 收到响应 (耗时 {:.2}s)", latency_ms as f64 / 1000.0);
                log::info!("📥 HTTP 状态码: {}", status_code);

                if resp.status().is_success() {
                    // 读取响应体
                    let body = resp.text().await.unwrap_or_default();
                    log::info!("📥 响应体大小: {} 字节", body.len());
                    log::debug!("响应体内容: {}", if body.len() > 500 { format!("{}...(截断)", &body[..500]) } else { body.clone() });

                    log::info!(
                        "✅ 健康检查成功 - 状态码: {}, 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Ok((latency_ms, status_code))
                } else if status_code == 401 || status_code == 403 {
                    // 认证问题，但服务可达
                    let body = resp.text().await.unwrap_or_default();
                    log::info!("📥 响应体大小: {} 字节", body.len());
                    log::warn!("响应体内容: {}", body);

                    log::warn!(
                        "⚠️ 健康检查认证失败 - 状态码: {}, 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Failed,
                        format!("认证失败: HTTP {}", status_code),
                        Some(status_code),
                    ))
                } else if status_code == 429 {
                    // 限流，但服务可达
                    log::warn!(
                        "⚠️ 健康检查被限流 - 状态码: {}, 延迟: {}ms (服务可达)",
                        status_code,
                        latency_ms
                    );
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    // 限流也算成功，因为服务是可达的
                    Ok((latency_ms, status_code))
                } else {
                    // 其他错误，读取响应体以获取详细错误信息
                    let error_body = resp.text().await.unwrap_or_else(|_| "无法读取响应体".to_string());
                    log::info!("📥 响应体大小: {} 字节", error_body.len());
                    log::warn!("响应体内容: {}", error_body);

                    // 检查是否是"服务可达但请求被拒绝"的场景
                    // 这些情况说明服务本身是正常的，只是健康检查请求不被接受
                    let lower_body = error_body.to_lowercase();

                    // 场景1: Claude Code 专用限制
                    let is_claude_code_only = lower_body.contains("only authorized for use with claude code")
                        || lower_body.contains("暂不支持非 claude code")
                        || lower_body.contains("only for claude code")
                        || lower_body.contains("claude code only")
                        || lower_body.contains("仅支持 claude code")
                        || lower_body.contains("仅限 claude code");

                    // 场景2: 请求格式/参数问题（服务可达，只是请求不符合要求）
                    let is_request_format_issue =
                        // 模型不存在/不支持
                        (lower_body.contains("model") && (
                            lower_body.contains("not found")
                            || lower_body.contains("does not exist")
                            || lower_body.contains("not supported")
                            || lower_body.contains("不存在")
                            || lower_body.contains("不支持")
                        ))
                        // 参数验证失败
                        || lower_body.contains("invalid_request_error")
                        || lower_body.contains("validation error")
                        || lower_body.contains("参数错误")
                        || lower_body.contains("参数无效");

                    // 场景3: 配额/余额问题（服务可达，账户问题）
                    let is_quota_issue = lower_body.contains("quota")
                        || lower_body.contains("credit")
                        || lower_body.contains("balance")
                        || lower_body.contains("余额")
                        || lower_body.contains("配额")
                        || lower_body.contains("额度");

                    // 场景4: 需要特定权限/功能未开通
                    let is_permission_issue = lower_body.contains("permission")
                        || lower_body.contains("not enabled")
                        || lower_body.contains("not activated")
                        || lower_body.contains("未开通")
                        || lower_body.contains("未启用")
                        || lower_body.contains("无权限");

                    // 场景5: 请求内容被拒绝（内容审核等）
                    let is_content_rejected = lower_body.contains("content policy")
                        || lower_body.contains("content filter")
                        || lower_body.contains("safety")
                        || lower_body.contains("内容违规")
                        || lower_body.contains("内容审核");

                    // 400 错误且符合以上任一场景，视为服务可达
                    if status_code == 400 && (is_claude_code_only || is_request_format_issue || is_quota_issue || is_permission_issue || is_content_rejected) {
                        let reason = if is_claude_code_only {
                            "Claude Code 专用限制"
                        } else if is_request_format_issue {
                            "请求格式限制"
                        } else if is_quota_issue {
                            "配额/余额限制"
                        } else if is_permission_issue {
                            "权限限制"
                        } else {
                            "内容审核限制"
                        };

                        log::info!(
                            "✅ 服务可达（{}）- 延迟: {}ms",
                            reason,
                            latency_ms
                        );
                        log::info!("└──────────────────────────────────────────────────────────────┘");
                        return Ok((latency_ms, status_code));
                    }

                    // 解析错误信息
                    let error_msg = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&error_body) {
                        if let Some(err) = json.get("error") {
                            if let Some(msg) = err.get("message").and_then(|m| m.as_str()) {
                                format!("HTTP {}: {}", status_code, msg)
                            } else {
                                format!("HTTP {}: {}", status_code, err)
                            }
                        } else if let Some(msg) = json.get("message").and_then(|m| m.as_str()) {
                            format!("HTTP {}: {}", status_code, msg)
                        } else {
                            format!("HTTP {}", status_code)
                        }
                    } else {
                        format!("HTTP {}", status_code)
                    };

                    log::error!("❌ 健康检查失败: {}", error_msg);
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Failed,
                        error_msg,
                        Some(status_code),
                    ))
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
                } else {
                    log::error!("❌ 健康检查失败: {}", e);
                    log::info!("└──────────────────────────────────────────────────────────────┘");
                    Err((
                        HealthCheckStatus::Failed,
                        format!("连接失败: {}", e),
                        None,
                    ))
                }
            }
        }
    }

    /// 手动执行一次健康检查
    pub async fn check_now(&self) -> AppResult<()> {
        Self::perform_all_health_checks(&self.db_pool).await
    }
}

impl Drop for HealthCheckScheduler {
    fn drop(&mut self) {
        log::debug!("健康检查调度器正在被销毁");
    }
}
