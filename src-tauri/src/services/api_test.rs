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
use chrono::Utc;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tokio::sync::RwLock;
use tokio::time::timeout;

/// API 测试超时时间(秒) - 增加到30秒以支持较慢的API
const TEST_TIMEOUT_SECS: u64 = 30;

/// API 响应内容最大长度
const MAX_RESPONSE_TEXT_LENGTH: usize = 100;

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

/// 解析 SSE 响应流
async fn parse_sse_response(response: reqwest::Response) -> Result<String, String> {
    use futures_util::StreamExt;

    let mut stream = response.bytes_stream();
    let mut response_text = String::new();
    let mut buffer = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("读取响应流失败: {}", e))?;
        buffer.extend_from_slice(&chunk);

        // 尝试将 buffer 转换为字符串并按行处理
        if let Ok(text) = String::from_utf8(buffer.clone()) {
            let lines: Vec<&str> = text.lines().collect();

            for line in &lines {
                if line.starts_with("data: ") {
                    let json_str = line.strip_prefix("data: ").unwrap();

                    if json_str == "[DONE]" {
                        buffer.clear();
                        break;
                    }

                    // 解析 JSON
                    if let Ok(event) = serde_json::from_str::<serde_json::Value>(json_str) {
                        // 提取 content_block_delta
                        if let Some(delta_text) = event["delta"]["text"].as_str() {
                            response_text.push_str(delta_text);
                        }

                        // 检查错误
                        if event["type"] == "error" {
                            return Err(event["error"]["message"]
                                .as_str()
                                .unwrap_or("API Error")
                                .to_string());
                        }
                    }
                }
            }

            buffer.clear();
        }
    }

    // 限制长度（避免过长）
    if response_text.len() > MAX_RESPONSE_TEXT_LENGTH {
        response_text.truncate(MAX_RESPONSE_TEXT_LENGTH);
        response_text.push_str("...");
    }

    if response_text.is_empty() {
        Ok("Success".to_string())
    } else {
        Ok(response_text)
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

        // 从配置中获取 API 密钥和用户指定的模型
        let api_key = &config.api_key;
        let user_model = config.default_model.as_deref();

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
            // 第一次失败，且用户指定了不同的模型，进行重试
            Ok(Err(e))
                if user_model.is_some()
                    && user_model != Some("claude-haiku-4-5-20251001") =>
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
            // 第一次失败，不进行重试
            Ok(Err(e)) => {
                let latency_ms = start_time.elapsed().as_millis() as i64;
                log::warn!(
                    "Config {} test failed: {}, latency: {}ms",
                    config_id,
                    e,
                    latency_ms
                );
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

    /// 执行实际的 API 测试（支持流式响应）
    ///
    /// 使用 Anthropic Messages API 发送一个简单的测试请求
    /// 完全模拟 Claude Code 客户端行为以兼容 88code 等服务商
    async fn perform_api_test(
        &self,
        server_url: &str,
        api_key: &str,
        model: Option<&str>,
    ) -> Result<ApiTestResponse, String> {
        use serde_json::json;

        // 确定测试模型
        let test_model = model.unwrap_or("claude-haiku-4-5-20251001");

        log::debug!("========================================");
        log::debug!("API 测试开始");
        log::debug!("服务器: {}", server_url);
        log::debug!("模型: {}", test_model);
        log::debug!("API Key: {}...{}", &api_key[..8.min(api_key.len())], if api_key.len() > 8 { &api_key[api_key.len()-4..] } else { "" });
        log::debug!("========================================");

        // 构建完整的 Claude Code 风格请求体
        // 参考 claude-codex-api 的实现，包含 system, tools, metadata
        let test_request_body = json!({
            "model": test_model,
            "max_tokens": 521,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "<system-reminder></system-reminder>"
                    },
                    {
                        "type": "text",
                        "text": "Please reply with only one word \"Success\", no thinking is allowed, and no use of any mcp services, tools or hooks is allowed."
                    }
                ]
            }],
            "temperature": 1.0,
            "stream": true,
            // 关键：Claude Code 系统提示
            "system": [
                {
                    "type": "text",
                    "text": "You are Claude Code, Anthropic's official CLI for Claude.",
                    "cache_control": {
                        "type": "ephemeral"
                    }
                },
                {
                    "type": "text",
                    "text": "\nYou are an interactive CLI tool that helps users with software engineering tasks."
                }
            ],
            // 关键：空 tools 数组
            "tools": [],
            // 关键：metadata 标识
            "metadata": {
                "user_id": "user__account__session_111"
            }
        });

        // 构建完整的 API URL (移除尾部斜杠)
        let base_url = server_url.trim_end_matches('/');
        let api_url = format!("{}/v1/messages?beta=true", base_url);

        log::info!("📤 请求 API: {} (模型: {})", api_url, test_model);

        // 记录请求体（隐藏敏感信息）
        let debug_body = serde_json::to_string_pretty(&test_request_body).unwrap_or_default();
        log::debug!("请求体:\n{}", debug_body);

        // 创建 HTTP 客户端
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(TEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

        // 记录请求头（隐藏敏感信息）
        log::debug!("请求头:");
        log::debug!("  x-api-key: {}...{}", &api_key[..8.min(api_key.len())], if api_key.len() > 8 { &api_key[api_key.len()-4..] } else { "" });
        log::debug!("  Authorization: Bearer {}...", &api_key[..8.min(api_key.len())]);
        log::debug!("  anthropic-version: 2023-06-01");
        log::debug!("  anthropic-beta: claude-code-20250219,fine-grained-tool-streaming-2025-05-14");
        log::debug!("  User-Agent: claude-cli/1.0.113 (external, cli)");
        log::debug!("  x-app: cli");
        log::debug!("  X-Stainless-Lang: js");
        log::debug!("  X-Stainless-Package-Version: 0.60.0");
        log::debug!("  content-type: application/json");

        // 发送流式请求，完全模拟 Claude Code 客户端
        let response = client
            .post(&api_url)
            // 认证头
            .header("x-api-key", api_key)
            .header("Authorization", format!("Bearer {}", api_key))
            // Anthropic API 版本和特性
            .header("anthropic-version", "2023-06-01")
            .header("anthropic-beta", "claude-code-20250219,fine-grained-tool-streaming-2025-05-14")
            .header("anthropic-dangerous-direct-browser-access", "true")
            // 关键：Claude Code 客户端标识
            .header("User-Agent", "claude-cli/1.0.113 (external, cli)")
            .header("x-app", "cli")
            // Stainless SDK 标识（Anthropic SDK 基于 Stainless）
            .header("X-Stainless-Lang", "js")
            .header("X-Stainless-Package-Version", "0.60.0")
            .header("X-Stainless-Runtime", "node")
            .header("X-Stainless-Runtime-Version", "v22.17.0")
            .header("X-Stainless-Retry-Count", "0")
            .header("x-stainless-helper-method", "stream")
            // 内容类型
            .header("content-type", "application/json")
            .header("Accept", "application/json")
            .header("accept-language", "*")
            .header("sec-fetch-mode", "cors")
            .json(&test_request_body)
            .send()
            .await
            .map_err(|e| {
                let err_msg = classify_error(&e);
                log::error!("❌ 请求失败: {}", err_msg);
                err_msg
            })?;

        let status = response.status();

        log::info!("📥 响应状态: {}", status);

        // 记录响应头
        log::debug!("响应头:");
        for (name, value) in response.headers() {
            if let Ok(val_str) = value.to_str() {
                log::debug!("  {}: {}", name, val_str);
            }
        }

        // 检查响应状态
        if status.is_success() {
            log::info!("✅ 请求成功，开始解析 SSE 响应");
            // 解析 SSE 响应
            let response_text = parse_sse_response(response).await?;
            log::info!("✅ 测试完成，响应: {}", if response_text.len() > 50 {
                format!("{}...", &response_text[..50])
            } else {
                response_text.clone()
            });
            Ok(ApiTestResponse {
                response_text,
                model: test_model.to_string(),
            })
        } else if status.as_u16() == 401 {
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ 401 认证失败");
            log::error!("响应体: {}", if error_text.len() > 500 { format!("{}...", &error_text[..500]) } else { error_text.clone() });
            Err("认证失败：API Key 无效".to_string())
        } else if status.as_u16() == 403 {
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ 403 访问被拒绝");
            log::error!("响应体: {}", if error_text.len() > 500 { format!("{}...", &error_text[..500]) } else { error_text.clone() });

            // 尝试解析 JSON 错误信息
            if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
                log::error!("错误详情: {}", serde_json::to_string_pretty(&error_json).unwrap_or_default());
            }

            Err(format!("访问被拒绝：{}", error_text))
        } else if status.as_u16() == 429 {
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ 429 配额耗尽");
            log::error!("响应体: {}", if error_text.len() > 500 { format!("{}...", &error_text[..500]) } else { error_text.clone() });
            Err("配额耗尽：请求过多或余额不足".to_string())
        } else if status.as_u16() == 400 {
            // 400 说明服务器有响应，服务可用但请求格式有问题
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ 400 请求格式错误");
            log::error!("响应体: {}", if error_text.len() > 500 { format!("{}...", &error_text[..500]) } else { error_text.clone() });

            // 尝试解析 JSON 错误信息
            if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
                log::error!("错误详情: {}", serde_json::to_string_pretty(&error_json).unwrap_or_default());
            }

            // 尝试从错误中提取有用信息
            if error_text.contains("invalid") || error_text.contains("model") {
                Err(format!("模型不支持：{}", error_text))
            } else {
                Err(format!("请求格式错误：{}", error_text))
            }
        } else if status.as_u16() >= 500 && status.as_u16() < 600 {
            // 5xx 服务器错误，表示服务不可用
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ HTTP {} 服务器错误", status);
            log::error!("响应体: {}", if error_text.len() > 500 { format!("{}...", &error_text[..500]) } else { error_text.clone() });

            // 尝试解析 JSON 错误信息
            if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
                log::error!("错误详情: {}", serde_json::to_string_pretty(&error_json).unwrap_or_default());
            }

            Err(format!("服务器错误：HTTP {} - {}", status, error_text))
        } else {
            // 其他状态码（如 3xx, 4xx 等），表示服务可用但有其他问题
            let error_text = response.text().await.unwrap_or_default();
            log::error!("❌ HTTP {} 错误", status);
            log::error!("响应体: {}", if error_text.len() > 500 { format!("{}...", &error_text[..500]) } else { error_text.clone() });

            // 尝试解析 JSON 错误信息
            if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
                log::error!("错误详情: {}", serde_json::to_string_pretty(&error_json).unwrap_or_default());
            }

            Err(format!("HTTP {}：{}", status, error_text))
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
            // - is_available()：服务器可连接（即使401、403、429等错误）
            // - is_success()：API调用完全成功（200-299）
            let is_available = if result.is_available() { 1 } else { 0 };

            log::debug!(
                "更新配置 {} 测试结果: is_available={}, is_success={}, status={:?}",
                config_id,
                is_available,
                result.is_success() as i32,
                result.status
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
