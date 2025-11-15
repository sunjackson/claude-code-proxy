/**
 * Latency Test Service
 * 统一的延迟测试服务，参考 claude-codex-api/src/utils/latency-tester.js
 *
 * 功能特点：
 * - 轻量级 HTTP HEAD/GET 请求测试延迟
 * - 详细的错误分类和提示
 * - 支持批量测试
 * - 支持热身请求（避免首包惩罚）
 * - 统一的测试接口供所有模块使用
 */

use std::time::{Duration, Instant};

/// 延迟测试结果
#[derive(Debug, Clone)]
pub struct LatencyTestResult {
    /// 测试的 URL
    pub url: String,
    /// 是否成功
    pub success: bool,
    /// 延迟（毫秒）
    pub latency_ms: Option<i32>,
    /// 错误信息
    pub error_message: Option<String>,
}

/// 延迟测试服务
pub struct LatencyTestService;

impl LatencyTestService {
    /// 测试单个 URL 的延迟
    ///
    /// # 参数
    /// - `url`: 要测试的 URL
    /// - `timeout_ms`: 超时时间（毫秒），默认 8000ms
    /// - `use_warmup`: 是否使用热身请求
    ///
    /// # 返回
    /// 返回延迟测试结果
    pub async fn test_url(
        url: &str,
        timeout_ms: Option<u64>,
        use_warmup: bool,
    ) -> LatencyTestResult {
        let timeout = timeout_ms.unwrap_or(8000);

        log::debug!("========================================");
        log::debug!("延迟测试开始");
        log::debug!("URL: {}", url);
        log::debug!("超时: {}ms", timeout);
        log::debug!("热身请求: {}", if use_warmup { "是" } else { "否" });
        log::debug!("========================================");

        // 创建 HTTP 客户端
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(timeout))
            .redirect(reqwest::redirect::Policy::limited(5))
            .user_agent("claude-code-proxy-latency/1.0")
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                log::error!("❌ 创建HTTP客户端失败: {}", e);
                return LatencyTestResult {
                    url: url.to_string(),
                    success: false,
                    latency_ms: None,
                    error_message: Some(format!("创建HTTP客户端失败: {}", e)),
                };
            }
        };

        // 热身请求（可选，用于复用连接/绕过首包惩罚）
        if use_warmup {
            log::debug!("🔥 执行热身请求: {}", url);
            log::debug!("请求头:");
            log::debug!("  User-Agent: claude-code-proxy-latency/1.0");
            log::debug!("  Accept: */*");

            let warmup_start = Instant::now();
            match client.get(url).send().await {
                Ok(resp) => {
                    let warmup_time = warmup_start.elapsed().as_millis();
                    log::debug!("✅ 热身请求完成: {}ms, 状态: {}", warmup_time, resp.status());
                }
                Err(e) => {
                    log::debug!("⚠️ 热身请求失败: {}", e);
                }
            }
            // 等待一小段时间确保连接复用
            tokio::time::sleep(Duration::from_millis(50)).await;
        }

        // 正式测试开始计时
        log::info!("📤 发送延迟测试请求: {}", url);
        log::debug!("请求方法: GET");
        log::debug!("请求头:");
        log::debug!("  User-Agent: claude-code-proxy-latency/1.0");
        log::debug!("  Accept: */*");
        log::debug!("  Connection: keep-alive");

        let start = Instant::now();

        match client.get(url).send().await {
            Ok(response) => {
                let latency = start.elapsed().as_millis() as i32;
                let status = response.status();

                log::info!("📥 响应状态: {} (延迟: {}ms)", status, latency);

                // 记录响应头（摘要）
                log::debug!("响应头:");
                for (name, value) in response.headers() {
                    if let Ok(val_str) = value.to_str() {
                        // 只记录关键响应头
                        if name == "content-type"
                            || name == "content-length"
                            || name == "server"
                            || name == "x-request-id"
                            || name == "cf-ray" {
                            log::debug!("  {}: {}", name, val_str);
                        }
                    }
                }

                log::info!("✅ 延迟测试成功: {} - {}ms", url, latency);

                // 只要能收到HTTP响应就算测试成功，不判断状态码
                // 这与 latency-tester.js 的行为一致
                LatencyTestResult {
                    url: url.to_string(),
                    success: true,
                    latency_ms: Some(latency),
                    error_message: None,
                }
            }
            Err(e) => {
                let latency = start.elapsed().as_millis() as i32;
                let error_message = Self::classify_error(&e);

                log::error!("❌ 延迟测试失败: {} (耗时: {}ms)", url, latency);
                log::error!("错误类型: {}", error_message);
                log::error!("错误详情: {}", e);

                LatencyTestResult {
                    url: url.to_string(),
                    success: false,
                    latency_ms: Some(latency),
                    error_message: Some(error_message),
                }
            }
        }
    }

    /// 批量测试多个 URL 的延迟
    ///
    /// # 参数
    /// - `urls`: URL 列表
    /// - `timeout_ms`: 超时时间（毫秒）
    /// - `use_warmup`: 是否使用热身请求
    ///
    /// # 返回
    /// 返回所有 URL 的测试结果
    pub async fn test_multiple_urls(
        urls: &[String],
        timeout_ms: Option<u64>,
        use_warmup: bool,
    ) -> Vec<LatencyTestResult> {
        log::info!("批量测试 {} 个URL延迟", urls.len());

        // 并发测试所有 URL
        let tasks: Vec<_> = urls
            .iter()
            .map(|url| {
                let url_clone = url.clone();
                tokio::spawn(async move {
                    Self::test_url(&url_clone, timeout_ms, use_warmup).await
                })
            })
            .collect();

        // 等待所有测试完成
        let mut results = Vec::new();
        for task in tasks {
            match task.await {
                Ok(result) => results.push(result),
                Err(e) => {
                    log::error!("延迟测试任务失败: {}", e);
                }
            }
        }

        log::info!(
            "批量测试完成: {}/{} 成功",
            results.iter().filter(|r| r.success).count(),
            results.len()
        );

        results
    }

    /// 错误分类（参考 latency-tester.js）
    ///
    /// 提供详细的错误分类和提示信息
    fn classify_error(error: &reqwest::Error) -> String {
        if error.is_timeout() {
            "连接超时".to_string()
        } else if error.is_connect() {
            "连接失败：无法连接到服务器".to_string()
        } else if let Some(status) = error.status() {
            format!("HTTP错误：{}", status)
        } else if error.to_string().contains("dns") || error.to_string().contains("resolve") {
            "DNS解析失败：域名无法解析".to_string()
        } else if error.to_string().contains("ECONNREFUSED") {
            "连接被拒绝：服务器拒绝连接".to_string()
        } else if error.to_string().contains("ECONNRESET") {
            "连接重置：连接被服务器重置".to_string()
        } else {
            format!("测试失败：{}", error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_latency_test_service() {
        // 测试本地服务（假设存在）
        let result = LatencyTestService::test_url("http://localhost:5173", Some(3000), false).await;

        // 验证返回结构
        assert_eq!(result.url, "http://localhost:5173");
        assert!(result.latency_ms.is_some());
    }

    #[tokio::test]
    async fn test_classify_error() {
        // 测试连接失败的URL（使用不可路由的测试IP地址 192.0.2.1）
        // 设置短超时确保测试快速完成
        let result = LatencyTestService::test_url("http://192.0.2.1:1", Some(500), false).await;
        assert!(!result.success);
        assert!(result.error_message.is_some());
    }

    #[tokio::test]
    async fn test_multiple_urls() {
        let urls = vec![
            "http://localhost:5173".to_string(),
            "http://invalid.invalid".to_string(),
        ];

        let results = LatencyTestService::test_multiple_urls(&urls, Some(3000), false).await;
        assert_eq!(results.len(), 2);
    }
}
