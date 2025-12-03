/**
 * API Test Service
 * 测试 Claude API 配置的连接性和性能
 *
 * Features:
 * - 单个配置测试
 * - 批量分组测试
 * - 延迟测量
 * - 结果记录
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::test_result::{TestResult, TestStatus};
use crate::services::api_config::ApiConfigService;
use crate::services::claude_test_request::{add_claude_code_headers, build_test_request_body, TEST_REQUEST_TIMEOUT_SECS};
use chrono::Utc;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tokio::sync::RwLock;
use tokio::time::timeout;

/// API 测试超时时间(秒)
const TEST_TIMEOUT_SECS: u64 = TEST_REQUEST_TIMEOUT_SECS;

/// API 测试响应结构
struct ApiTestResponse {
    response_text: String,
    model: String,
}

/// 详细错误分类
fn classify_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        "请求超时（>30秒）".to_string()
    } else if error.is_connect() {
        "连接失败：无法连接到服务器".to_string()
    } else if let Some(status) = error.status() {
        match status.as_u16() {
            401 => "认证失败：API Key 无效".to_string(),
            403 => "访问被拒绝：可能IP受限或Key权限不足".to_string(),
            429 => "配额耗尽：请求过多或余额不足".to_string(),
            500..=599 => format!("服务器错误：{}", status),
            _ => format!("HTTP错误：{}", status),
        }
    } else if error.to_string().contains("dns") || error.to_string().contains("resolve") {
        "DNS 解析失败：域名无法解析".to_string()
    } else {
        format!("请求失败：{}", error)
    }
}

/// 解析 API 错误响应，提取错误信息
fn parse_api_error(response_text: &str, status_code: u16) -> String {
    // 尝试解析 JSON 错误响应
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(response_text) {
        if let Some(error) = json.get("error") {
            if let Some(message) = error.get("message").and_then(|m| m.as_str()) {
                // 检查是否有嵌套的错误代码
                if let Some(code) = error.get("code").and_then(|c| c.as_i64()) {
                    return format!("HTTP {} (内部错误 {}): {}", status_code, code, message);
                }
                return format!("HTTP {}: {}", status_code, message);
            }
        }
    }
    // 如果无法解析，返回原始响应
    if response_text.len() > 200 {
        format!("HTTP {}: {}...", status_code, &response_text[..200])
    } else if response_text.is_empty() {
        format!("HTTP {} 错误", status_code)
    } else {
        format!("HTTP {}: {}", status_code, response_text)
    }
}

/// 检查错误是否不应该重试
/// 认证错误、配额错误等不会因为换模型而解决，不应重试
fn is_non_retryable_error(error: &str) -> bool {
    let error_lower = error.to_lowercase();

    // 认证相关错误
    if error_lower.contains("authentication")
        || error_lower.contains("auth")
        || error_lower.contains("api key")
        || error_lower.contains("apikey")
        || error_lower.contains("api_key")
        || error_lower.contains("认证")
        || error_lower.contains("密钥")
        || error_lower.contains("401")
        || error_lower.contains("403")
        || error_lower.contains("invalid_api_key")
        || error_lower.contains("unauthorized")
    {
        return true;
    }

    // 配额/账户相关错误
    if error_lower.contains("quota")
        || error_lower.contains("余额")
        || error_lower.contains("balance")
        || error_lower.contains("credit")
        || error_lower.contains("billing")
        || error_lower.contains("payment")
        || error_lower.contains("账户")
    {
        return true;
    }

    // 账户被禁用
    if error_lower.contains("disabled")
        || error_lower.contains("suspended")
        || error_lower.contains("banned")
        || error_lower.contains("blocked")
        || error_lower.contains("禁用")
        || error_lower.contains("停用")
    {
        return true;
    }

    false
}

/// 检查响应体是否包含错误信息（即使 HTTP 状态码是 200）
/// 一些代理服务商会返回 HTTP 200 但在响应体中包含错误
fn check_response_body_error(response_text: &str) -> Option<String> {
    // 尝试解析 JSON 错误响应
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(response_text) {
        // 检查 error 字段
        if let Some(error) = json.get("error") {
            // 提取错误信息
            let mut error_msg = String::new();

            // 提取错误代码
            if let Some(code) = error.get("code") {
                if let Some(code_num) = code.as_i64() {
                    error_msg.push_str(&format!("错误代码 {}", code_num));
                } else if let Some(code_str) = code.as_str() {
                    error_msg.push_str(&format!("错误代码 {}", code_str));
                }
            }

            // 提取错误类型
            if let Some(error_type) = error.get("type").and_then(|t| t.as_str()) {
                if !error_msg.is_empty() {
                    error_msg.push_str(" - ");
                }
                error_msg.push_str(error_type);
            }

            // 提取错误消息
            if let Some(message) = error.get("message").and_then(|m| m.as_str()) {
                if !error_msg.is_empty() {
                    error_msg.push_str(": ");
                }
                error_msg.push_str(message);
            }

            if !error_msg.is_empty() {
                return Some(error_msg);
            }

            // 如果有 error 字段但无法提取详细信息，返回通用错误
            return Some("服务商返回错误响应".to_string());
        }

        // 检查顶级 type 字段是否为 "error"
        if let Some(type_field) = json.get("type").and_then(|t| t.as_str()) {
            if type_field == "error" {
                return Some("服务商返回错误类型响应".to_string());
            }
        }
    }

    // 检查响应是否包含明显的错误关键词（非 JSON 情况）
    let response_lower = response_text.to_lowercase();
    if response_lower.contains("\"error\"") && response_lower.contains("\"message\"") {
        return Some("响应包含错误信息".to_string());
    }

    None
}

/// 提取 URL 的基础部分（scheme://host:port），移除路径
#[allow(dead_code)]
fn extract_base_url(url: &str) -> String {
    // 查找 :// 分隔符
    if let Some(scheme_pos) = url.find("://") {
        let scheme_end = scheme_pos + 3;
        let after_scheme = &url[scheme_end..];

        // 在主机部分查找第一个 / (路径开始)
        if let Some(path_pos) = after_scheme.find('/') {
            // 截取 scheme + host:port
            String::from(&url[..scheme_end + path_pos])
        } else {
            // 没有路径，返回整个 URL
            String::from(url)
        }
    } else {
        // 没有协议前缀，返回原始字符串
        String::from(url)
    }
}

/// API 测试服务
pub struct ApiTestService {
    db_pool: Arc<DbPool>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl ApiTestService {
    /// 创建新的 API 测试服务
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        Self {
            db_pool,
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// 设置 Tauri app handle 用于事件推送
    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app_handle = self.app_handle.write().await;
        *app_handle = Some(handle);
        log::debug!("Tauri app handle set for API test service");
    }

    /// 推送 test-completed 事件
    async fn emit_test_completed(&self, result: &TestResult) {
        use tauri::Emitter;
        let app_handle = self.app_handle.read().await;
        if let Some(handle) = app_handle.as_ref() {
            if let Err(e) = handle.emit("test-completed", result) {
                log::error!("Failed to emit test-completed event: {}", e);
            } else {
                log::debug!("Emitted test-completed event for config {}", result.config_id);
            }
        }
    }

    /// 测试单个 API 配置（支持智能重试）
    ///
    /// # Arguments
    /// - `config_id`: API 配置 ID
    ///
    /// # Returns
    /// - TestResult: 测试结果(包含延迟、响应内容、测试模型等信息)
    pub async fn test_single_config(&self, config_id: i64) -> AppResult<TestResult> {
        log::info!("Testing API config: {}", config_id);

        // 获取配置信息
        let config = self.db_pool.with_connection(|conn| {
            ApiConfigService::get_config_by_id(conn, config_id)
        })?;

        log::info!("📋 配置详情 - 名称: {}, 服务器: {}", config.name, config.server_url);

        // 从配置中获取 API 密钥和用户指定的模型
        let api_key = &config.api_key;
        let user_model = config.default_model.as_deref();

        // 检查 API Key 是否为空
        if api_key.is_empty() {
            log::error!("❌ 配置 {} 的 API Key 为空!", config.name);
            return Ok(self.create_failed_result(
                config_id,
                0,
                "API Key 为空，请检查配置",
                None,
                1,
            ));
        }

        log::debug!("🔑 API Key 长度: {} 字符", api_key.len());

        // 第一次尝试：使用 haiku（最快最便宜）
        let start_time = Instant::now();
        let first_result = timeout(
            Duration::from_secs(TEST_TIMEOUT_SECS),
            self.perform_api_test(&config.server_url, &api_key, Some("claude-haiku-4-5-20251001")),
        )
        .await;

        let test_result = match first_result {
            // 第一次成功
            Ok(Ok(response)) => {
                let latency_ms = start_time.elapsed().as_millis() as i64;
                log::info!(
                    "Config {} test passed (attempt 1), latency: {}ms",
                    config_id,
                    latency_ms
                );
                self.create_success_result(
                    config_id,
                    latency_ms,
                    Some(response.response_text),
                    response.model,
                    1,
                )
            }
            // 第一次失败，且用户指定了不同的模型，且错误不是认证/配额等不可重试错误，进行重试
            Ok(Err(e))
                if user_model.is_some()
                    && user_model != Some("claude-haiku-4-5-20251001")
                    && !is_non_retryable_error(&e) =>
            {
                log::info!(
                    "Config {} haiku test failed: {}, trying user model: {:?}",
                    config_id,
                    e,
                    user_model
                );

                let retry_start = Instant::now();
                let retry_result = timeout(
                    Duration::from_secs(TEST_TIMEOUT_SECS),
                    self.perform_api_test(&config.server_url, &api_key, user_model),
                )
                .await;

                match retry_result {
                    // 重试成功
                    Ok(Ok(response)) => {
                        let latency_ms = retry_start.elapsed().as_millis() as i64;
                        log::info!(
                            "Config {} test passed (attempt 2), latency: {}ms",
                            config_id,
                            latency_ms
                        );
                        self.create_success_result(
                            config_id,
                            latency_ms,
                            Some(response.response_text),
                            response.model,
                            2,
                        )
                    }
                    // 重试失败
                    Ok(Err(retry_err)) => {
                        let latency_ms = retry_start.elapsed().as_millis() as i64;
                        log::warn!(
                            "Config {} test failed (attempt 2): {}, latency: {}ms",
                            config_id,
                            retry_err,
                            latency_ms
                        );
                        self.create_failed_result(
                            config_id,
                            latency_ms,
                            &retry_err,
                            user_model.map(|m| m.to_string()),
                            2,
                        )
                    }
                    // 重试超时
                    Err(_) => {
                        log::warn!(
                            "Config {} test timeout (attempt 2) after {}s",
                            config_id,
                            TEST_TIMEOUT_SECS
                        );
                        self.create_timeout_result(
                            config_id,
                            user_model.map(|m| m.to_string()),
                            2,
                        )
                    }
                }
            }
            // 第一次失败，不进行重试（用户未指定模型、模型相同、或错误不可重试）
            Ok(Err(e)) => {
                let latency_ms = start_time.elapsed().as_millis() as i64;

                // 记录跳过重试的原因
                if is_non_retryable_error(&e) {
                    log::warn!(
                        "Config {} test failed (non-retryable error): {}, latency: {}ms",
                        config_id,
                        e,
                        latency_ms
                    );
                } else {
                    log::warn!(
                        "Config {} test failed: {}, latency: {}ms",
                        config_id,
                        e,
                        latency_ms
                    );
                }

                self.create_failed_result(
                    config_id,
                    latency_ms,
                    &e,
                    Some("claude-haiku-4-5-20251001".to_string()),
                    1,
                )
            }
            // 第一次超时
            Err(_) => {
                log::warn!(
                    "Config {} test timeout after {}s",
                    config_id,
                    TEST_TIMEOUT_SECS
                );
                self.create_timeout_result(
                    config_id,
                    Some("claude-haiku-4-5-20251001".to_string()),
                    1,
                )
            }
        };

        // 更新配置的测试结果
        self.update_config_test_result(config_id, &test_result)?;

        // 保存测试结果到数据库
        self.save_test_result(&test_result)?;

        // 推送事件
        self.emit_test_completed(&test_result).await;

        Ok(test_result)
    }

    /// 测试分组内所有配置
    ///
    /// # Arguments
    /// - `group_id`: 分组 ID
    ///
    /// # Returns
    /// - Vec<TestResult>: 所有配置的测试结果
    pub async fn test_group_configs(&self, group_id: i64) -> AppResult<Vec<TestResult>> {
        log::info!("Testing all configs in group: {}", group_id);

        // 获取分组内所有配置
        let configs = self.db_pool.with_connection(|conn| {
            ApiConfigService::list_configs(conn, Some(group_id))
        })?;

        if configs.is_empty() {
            return Err(AppError::EmptyGroup { group_id });
        }

        // 并行测试所有配置
        let mut test_tasks = Vec::new();
        for config in configs {
            let service = ApiTestService::new(self.db_pool.clone());
            let task = tokio::spawn(async move {
                service.test_single_config(config.id).await
            });
            test_tasks.push(task);
        }

        // 收集测试结果
        let mut results = Vec::new();
        for task in test_tasks {
            match task.await {
                Ok(Ok(result)) => results.push(result),
                Ok(Err(e)) => {
                    log::error!("Test task failed: {}", e);
                }
                Err(e) => {
                    log::error!("Test task panicked: {}", e);
                }
            }
        }

        log::info!("Group {} test completed: {}/{} passed",
            group_id,
            results.iter().filter(|r| r.is_success()).count(),
            results.len()
        );

        Ok(results)
    }

    /// 执行真实的 Claude Code API 测试
    ///
    /// 使用与真实 Claude Code 完全相同的请求格式，包含：
    /// - system prompt（包含 Claude Code 标识）
    /// - tools 定义
    /// - 正确格式的 metadata.user_id
    /// - 所有必要的 Claude Code 请求头
    async fn perform_api_test(
        &self,
        server_url: &str,
        api_key: &str,
        _model: Option<&str>,
    ) -> Result<ApiTestResponse, String> {
        log::info!("╔══════════════════════════════════════════════════════════════╗");
        log::info!("║             📋 配置连通性测试开始                              ║");
        log::info!("╚══════════════════════════════════════════════════════════════╝");
        log::info!("🔗 服务器地址: {}", server_url);
        log::info!("🔑 API Key: {}...{}", &api_key[..8.min(api_key.len())], &api_key[api_key.len().saturating_sub(4)..]);

        // 构建 API 端点 URL
        let url = format!("{}/v1/messages", server_url.trim_end_matches('/'));
        log::info!("📤 测试 API 端点: {}", url);

        // 创建 HTTP 客户端
        log::info!("⏱️  超时配置: 请求超时 {}s, 连接超时 10s", TEST_TIMEOUT_SECS);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(TEST_TIMEOUT_SECS))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| {
                log::error!("❌ 创建 HTTP 客户端失败: {}", e);
                format!("创建HTTP客户端失败: {}", e)
            })?;

        // 构建与真实 Claude Code 相同的请求体
        let request_body = build_test_request_body();
        log::info!("📦 请求体已构建 (Claude Code 标准格式)");
        log::debug!("请求体内容: {}", serde_json::to_string_pretty(&request_body).unwrap_or_default());

        // 发送请求（添加所有 Claude Code 特有的请求头）
        log::info!("🚀 正在发送请求...");
        let request_start = std::time::Instant::now();
        let request_builder = client.post(&url);
        let request_builder = add_claude_code_headers(request_builder, api_key);

        let response = request_builder
            .json(&request_body)
            .send()
            .await
            .map_err(|e| {
                let elapsed = request_start.elapsed();
                let err_msg = classify_error(&e);
                log::error!("❌ 请求失败 (耗时 {:.2}s): {}", elapsed.as_secs_f64(), err_msg);
                err_msg
            })?;

        let elapsed = request_start.elapsed();
        let status = response.status();
        let status_code = status.as_u16();

        log::info!("📥 收到响应 (耗时 {:.2}s)", elapsed.as_secs_f64());
        log::info!("📥 HTTP 状态码: {}", status_code);

        // 读取响应体
        let response_text = response.text().await.unwrap_or_default();
        log::info!("📥 响应体大小: {} 字节", response_text.len());
        log::debug!("响应体内容: {}", if response_text.len() > 500 { format!("{}...(截断)", &response_text[..500]) } else { response_text.clone() });

        // 首先检查响应体是否包含错误信息（即使 HTTP 状态码是 200）
        // 一些代理服务商会返回 HTTP 200/500 但在响应体中包含实际的错误
        if let Some(body_error) = check_response_body_error(&response_text) {
            log::error!("❌ 响应体包含错误: {}", body_error);
            log::info!("╚══════════════════════════════════════════════════════════════╝");
            return Err(format!("服务商错误: {}", body_error));
        }

        if status.is_success() {
            log::info!("📊 解析响应内容...");
            // 解析流式响应，提取实际内容
            let mut content = String::new();
            let mut has_valid_content = false;
            let mut chunk_count = 0;

            for line in response_text.lines() {
                if line.starts_with("data: ") {
                    chunk_count += 1;
                    let data = &line[6..];
                    // 跳过 [DONE] 标记
                    if data.trim() == "[DONE]" {
                        continue;
                    }
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        // 检查流式响应中是否包含错误
                        if let Some(error) = json.get("error") {
                            let error_msg = if let Some(msg) = error.get("message").and_then(|m| m.as_str()) {
                                msg.to_string()
                            } else {
                                "流式响应包含错误".to_string()
                            };
                            log::error!("❌ 流式响应错误: {}", error_msg);
                            log::info!("╚══════════════════════════════════════════════════════════════╝");
                            return Err(format!("服务商错误: {}", error_msg));
                        }

                        // 提取 content_block_delta 中的文本
                        if let Some(delta) = json.get("delta") {
                            if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                content.push_str(text);
                                has_valid_content = true;
                            }
                        }

                        // 检查是否有有效的消息类型
                        if json.get("type").is_some() {
                            has_valid_content = true;
                        }
                    }
                }
            }

            if chunk_count > 0 {
                log::info!("📊 流式响应: 共 {} 个数据块", chunk_count);
            }

            // 如果响应没有有效内容且不是流式响应格式，再次检查是否为错误
            if !has_valid_content && !response_text.contains("data: ") {
                log::info!("📊 非流式响应格式，检查 JSON 内容...");
                // 可能是非流式 JSON 响应
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                    if json.get("error").is_some() {
                        let error_msg = check_response_body_error(&response_text)
                            .unwrap_or_else(|| "未知错误".to_string());
                        log::error!("❌ 非流式响应包含错误: {}", error_msg);
                        log::info!("╚══════════════════════════════════════════════════════════════╝");
                        return Err(format!("服务商错误: {}", error_msg));
                    }
                }
            }

            let result_text = if content.is_empty() {
                "API 响应成功".to_string()
            } else {
                format!("API 响应: {}", content.chars().take(100).collect::<String>())
            };

            log::info!("✅ 测试成功: {}", result_text);
            log::info!("╚══════════════════════════════════════════════════════════════╝");
            Ok(ApiTestResponse {
                response_text: result_text,
                model: "claude-sonnet-4-5-20250929".to_string(),
            })
        } else if status_code == 401 || status_code == 403 {
            // 认证问题
            let error_msg = parse_api_error(&response_text, status_code);
            log::error!("❌ 认证失败: {}", error_msg);
            log::info!("╚══════════════════════════════════════════════════════════════╝");
            Err(error_msg)
        } else if status_code == 429 {
            // 限流
            log::warn!("⚠️ API 限流: HTTP {}", status_code);
            log::info!("╚══════════════════════════════════════════════════════════════╝");
            Err(format!("API 限流 (HTTP {})", status_code))
        } else if status_code >= 500 && status_code < 600 {
            // 服务器错误
            let error_msg = parse_api_error(&response_text, status_code);
            log::error!("❌ 服务器错误: {}", error_msg);
            log::info!("╚══════════════════════════════════════════════════════════════╝");
            Err(error_msg)
        } else {
            // 其他错误
            let error_msg = parse_api_error(&response_text, status_code);
            log::error!("❌ API 错误: {}", error_msg);
            log::info!("╚══════════════════════════════════════════════════════════════╝");
            Err(error_msg)
        }
    }

    /// 创建成功的测试结果
    fn create_success_result(
        &self,
        config_id: i64,
        latency_ms: i64,
        response_text: Option<String>,
        test_model: String,
        attempt: i32,
    ) -> TestResult {
        TestResult {
            id: 0, // 将由数据库生成
            config_id,
            group_id: None,
            test_at: Utc::now().to_rfc3339(),
            status: TestStatus::Success,
            latency_ms: Some(latency_ms as i32),
            error_message: None,
            is_valid_key: Some(true),
            response_text,
            test_model: Some(test_model),
            attempt: Some(attempt),
        }
    }

    /// 创建失败的测试结果
    fn create_failed_result(
        &self,
        config_id: i64,
        latency_ms: i64,
        error_message: &str,
        test_model: Option<String>,
        attempt: i32,
    ) -> TestResult {
        TestResult {
            id: 0,
            config_id,
            group_id: None,
            test_at: Utc::now().to_rfc3339(),
            status: TestStatus::Failed,
            latency_ms: Some(latency_ms as i32),
            error_message: Some(error_message.to_string()),
            is_valid_key: Some(false),
            response_text: None,
            test_model,
            attempt: Some(attempt),
        }
    }

    /// 创建超时的测试结果
    fn create_timeout_result(
        &self,
        config_id: i64,
        test_model: Option<String>,
        attempt: i32,
    ) -> TestResult {
        TestResult {
            id: 0,
            config_id,
            group_id: None,
            test_at: Utc::now().to_rfc3339(),
            status: TestStatus::Timeout,
            latency_ms: None,
            error_message: Some(format!("测试超时(>{}秒)", TEST_TIMEOUT_SECS)),
            is_valid_key: None,
            response_text: None,
            test_model,
            attempt: Some(attempt),
        }
    }

    /// 更新配置的测试结果
    fn update_config_test_result(&self, config_id: i64, result: &TestResult) -> AppResult<()> {
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            let now = chrono::Utc::now().to_rfc3339();

            // 使用 is_available() 判断服务是否可用
            // 注意：is_available() 与 is_success() 不同
            // - is_available()：服务器可连接且能正常处理请求
            // - is_success()：API调用完全成功（200-299）
            let is_available = if result.is_available() { 1 } else { 0 };

            // 详细日志：显示判断结果和依据
            log::info!(
                "📊 配置 {} 测试结果更新: status={:?}, is_available={}, error_message={:?}",
                config_id,
                result.status,
                is_available,
                result.error_message.as_ref().map(|s| if s.len() > 100 { format!("{}...", &s[..100]) } else { s.clone() })
            );

            conn.execute(
                "UPDATE ApiConfig SET last_test_at = ?1, last_latency_ms = ?2, is_available = ?3, updated_at = ?4 WHERE id = ?5",
                params![now, result.latency_ms, is_available, now, config_id],
            ).map_err(|e| AppError::DatabaseError {
                message: format!("更新配置测试结果失败: {}", e),
            })?;

            Ok(())
        })
    }

    /// 保存测试结果到数据库
    fn save_test_result(&self, result: &TestResult) -> AppResult<i64> {
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            conn.execute(
                "INSERT INTO TestResult (config_id, group_id, test_at, status, latency_ms, error_message, is_valid_key, response_text, test_model, attempt)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    result.config_id,
                    result.group_id,
                    result.test_at,
                    result.status.as_str(),
                    result.latency_ms,
                    result.error_message,
                    result.is_valid_key,
                    result.response_text,
                    result.test_model,
                    result.attempt,
                ],
            ).map_err(|e| AppError::DatabaseError {
                message: format!("保存测试结果失败: {}", e),
            })?;

            Ok(conn.last_insert_rowid())
        })
    }

    /// 获取配置的最近测试结果
    pub fn get_recent_test_results(&self, config_id: i64, limit: i32) -> AppResult<Vec<TestResult>> {
        self.db_pool.with_connection(|conn| {
            use rusqlite::params;

            let mut stmt = conn
                .prepare(
                    "SELECT id, config_id, group_id, test_at, status, latency_ms, error_message, is_valid_key, response_text, test_model, attempt
                     FROM TestResult
                     WHERE config_id = ?1
                     ORDER BY test_at DESC
                     LIMIT ?2",
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询测试结果失败: {}", e),
                })?;

            let results = stmt
                .query_map(params![config_id, limit], |row| {
                    let status_str: String = row.get(4)?;
                    let status = crate::models::test_result::TestStatus::from_str(&status_str)
                        .unwrap_or(crate::models::test_result::TestStatus::Failed);

                    Ok(TestResult {
                        id: row.get(0)?,
                        config_id: row.get(1)?,
                        group_id: row.get(2)?,
                        test_at: row.get(3)?,
                        status,
                        latency_ms: row.get(5)?,
                        error_message: row.get(6)?,
                        is_valid_key: row.get(7)?,
                        response_text: row.get(8)?,
                        test_model: row.get(9)?,
                        attempt: row.get(10)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询测试结果失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("解析测试结果失败: {}", e),
                })?;

            Ok(results)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;

    #[tokio::test]
    async fn test_create_test_results() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));
        let service = ApiTestService::new(db_pool);

        let success_result = service.create_success_result(
            1,
            150,
            Some("Success".to_string()),
            "claude-haiku-4-5-20251001".to_string(),
            1,
        );
        assert!(success_result.is_success());
        assert_eq!(success_result.latency_ms, Some(150));
        assert!(success_result.error_message.is_none());
        assert_eq!(success_result.response_text, Some("Success".to_string()));
        assert_eq!(
            success_result.test_model,
            Some("claude-haiku-4-5-20251001".to_string())
        );
        assert_eq!(success_result.attempt, Some(1));

        let failed_result = service.create_failed_result(
            1,
            250,
            "Connection refused",
            Some("claude-haiku-4-5-20251001".to_string()),
            1,
        );
        assert!(!failed_result.is_success());
        assert_eq!(failed_result.latency_ms, Some(250));
        assert!(failed_result.error_message.is_some());
        assert_eq!(failed_result.attempt, Some(1));

        let timeout_result = service.create_timeout_result(
            1,
            Some("claude-haiku-4-5-20251001".to_string()),
            2,
        );
        assert!(!timeout_result.is_success());
        assert!(timeout_result.error_message.is_some());
        assert_eq!(timeout_result.attempt, Some(2));
    }
}
