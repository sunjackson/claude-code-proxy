/**
 * Balance Query Service
 * 查询 API 供应商的账户余额
 *
 * Features:
 * - 单个配置余额查询
 * - 批量余额查询
 * - 多种响应格式支持
 * - 自动更新数据库记录
 */

use crate::db::DbPool;
use crate::models::balance::{BalanceInfo, BalanceQueryStatus, BalanceResponse};
use crate::models::error::{AppError, AppResult};
use crate::services::api_config::ApiConfigService;
use chrono::Utc;
use std::sync::Arc;
use std::time::Duration;
use reqwest::Client;

/// HTTP 请求超时时间(秒)
const REQUEST_TIMEOUT_SECS: u64 = 10;

/// 余额查询服务
pub struct BalanceService {
    db_pool: Arc<DbPool>,
    http_client: Client,
}

impl BalanceService {
    /// 创建新的余额查询服务
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            db_pool,
            http_client,
        }
    }

    /// 查询单个配置的余额
    ///
    /// # Arguments
    /// - `config_id`: API 配置 ID
    ///
    /// # Returns
    /// - BalanceInfo: 余额查询结果
    pub async fn query_balance(&self, config_id: i64) -> AppResult<BalanceInfo> {
        log::info!("Querying balance for config: {}", config_id);

        // 获取配置信息
        let config = self.db_pool.with_connection(|conn| {
            ApiConfigService::get_config_by_id(conn, config_id)
        })?;

        // 检查是否配置了余额查询 URL
        let balance_url = match &config.balance_query_url {
            Some(url) if !url.is_empty() => url,
            _ => {
                log::warn!("Config {} has no balance_query_url", config_id);
                return Err(AppError::ValidationError {
                    field: "balance_query_url".to_string(),
                    message: "未配置余额查询接口".to_string(),
                });
            }
        };

        // 发起 HTTP 请求查询余额
        let result = match self.fetch_balance(balance_url, &config.api_key).await {
            Ok(response) => {
                let balance = response.extract_balance();
                let currency = response.extract_currency();

                // 更新数据库
                if let Some(bal) = balance {
                    let now = Utc::now().to_rfc3339();
                    self.db_pool.with_connection(|conn| {
                        Self::update_balance_in_db(
                            conn,
                            config_id,
                            bal,
                            &currency,
                            &now,
                            "success",
                            None,
                        )
                    })?;

                    log::info!(
                        "Balance query success: config={}, balance={} {}",
                        config_id,
                        bal,
                        currency
                    );

                    BalanceInfo {
                        config_id,
                        config_name: config.name.clone(),
                        balance: Some(bal),
                        currency: Some(currency),
                        status: BalanceQueryStatus::Success,
                        checked_at: now,
                        error_message: None,
                    }
                } else {
                    let error_msg = "无法从响应中提取余额信息".to_string();
                    let now = Utc::now().to_rfc3339();
                    self.db_pool.with_connection(|conn| {
                        Self::update_balance_in_db(
                            conn,
                            config_id,
                            0.0,
                            "CNY",  // 使用默认货币，避免违反 CHECK 约束
                            &now,
                            "failed",
                            Some(&error_msg),
                        )?;
                        // 余额查询失败，自动禁用余额查询功能
                        Self::disable_auto_balance_check(conn, config_id)
                    })?;

                    log::warn!("余额查询失败，已自动禁用配置 {} 的自动余额查询功能", config_id);

                    BalanceInfo {
                        config_id,
                        config_name: config.name.clone(),
                        balance: None,
                        currency: None,
                        status: BalanceQueryStatus::Failed,
                        checked_at: now,
                        error_message: Some(error_msg),
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("余额查询失败: {}", e);
                let now = Utc::now().to_rfc3339();
                self.db_pool.with_connection(|conn| {
                    Self::update_balance_in_db(
                        conn,
                        config_id,
                        0.0,
                        "CNY",  // 使用默认货币，避免违反 CHECK 约束
                        &now,
                        "failed",
                        Some(&error_msg),
                    )?;
                    // 余额查询失败，自动禁用余额查询功能
                    Self::disable_auto_balance_check(conn, config_id)
                })?;

                log::warn!("Balance query failed: config={}, error={}", config_id, e);
                log::warn!("余额查询失败，已自动禁用配置 {} 的自动余额查询功能", config_id);

                BalanceInfo {
                    config_id,
                    config_name: config.name.clone(),
                    balance: None,
                    currency: None,
                    status: BalanceQueryStatus::Failed,
                    checked_at: now,
                    error_message: Some(error_msg),
                }
            }
        };

        Ok(result)
    }

    /// 批量查询余额（查询所有启用了自动余额查询的配置）
    ///
    /// # Returns
    /// - Vec<BalanceInfo>: 余额查询结果列表
    pub async fn query_all_balances(&self) -> AppResult<Vec<BalanceInfo>> {
        log::info!("Querying balances for all auto-enabled configs");

        // 获取所有启用了自动余额查询的配置
        let configs = self.db_pool.with_connection(|conn| {
            ApiConfigService::list_configs(conn, None)
        })?;

        let auto_check_configs: Vec<_> = configs
            .into_iter()
            .filter(|c| c.auto_balance_check)
            .collect();

        log::info!(
            "Found {} configs with auto_balance_check enabled",
            auto_check_configs.len()
        );

        // 并发查询所有配置的余额
        let mut results = Vec::new();
        for config in auto_check_configs {
            match self.query_balance(config.id).await {
                Ok(info) => results.push(info),
                Err(e) => {
                    log::error!("Failed to query balance for config {}: {}", config.id, e);
                    // 继续查询其他配置
                }
            }
        }

        Ok(results)
    }

    /// 获取所有配置的余额信息（从数据库读取）
    ///
    /// # Returns
    /// - Vec<BalanceInfo>: 余额信息列表
    pub fn get_all_balance_info(&self) -> AppResult<Vec<BalanceInfo>> {
        let configs = self.db_pool.with_connection(|conn| {
            ApiConfigService::list_configs(conn, None)
        })?;

        let balance_infos: Vec<BalanceInfo> = configs
            .into_iter()
            .map(|config| {
                let status = match config.balance_query_status.as_deref() {
                    Some("success") => BalanceQueryStatus::Success,
                    Some("failed") => BalanceQueryStatus::Failed,
                    _ => BalanceQueryStatus::Pending,
                };

                BalanceInfo {
                    config_id: config.id,
                    config_name: config.name,
                    balance: config.last_balance,
                    currency: config.balance_currency,
                    status,
                    checked_at: config
                        .last_balance_check_at
                        .unwrap_or_else(|| "未查询".to_string()),
                    error_message: config.balance_query_error,
                }
            })
            .collect();

        Ok(balance_infos)
    }

    /// 发起 HTTP 请求获取余额
    async fn fetch_balance(
        &self,
        url: &str,
        api_key: &str,
    ) -> AppResult<BalanceResponse> {
        // 88code 特殊处理：使用 /api/subscription 端点
        let actual_url = if url.contains("88code.org") {
            // 提取基础 URL（协议 + 域名）并追加 /api/subscription
            if let Ok(parsed_url) = reqwest::Url::parse(url) {
                let base = format!(
                    "{}://{}{}",
                    parsed_url.scheme(),
                    parsed_url.host_str().unwrap_or(""),
                    if let Some(port) = parsed_url.port() {
                        format!(":{}", port)
                    } else {
                        String::new()
                    }
                );
                let modified_url = format!("{}/api/subscription", base);
                log::info!("🔧 88code detected, using subscription endpoint: {}", modified_url);
                log::debug!("  Original URL: {}", url);
                modified_url
            } else {
                log::warn!("Failed to parse 88code URL, using original: {}", url);
                url.to_string()
            }
        } else {
            url.to_string()
        };

        // 隐藏敏感信息的API密钥（用于日志）
        let masked_key = if api_key.len() > 8 {
            format!("{}...{}", &api_key[..4], &api_key[api_key.len()-4..])
        } else {
            "***".to_string()
        };

        // 判断是否是88code，使用不同的HTTP方法
        let is_88code = url.contains("88code.org");

        log::info!("📤 Fetching balance from: {}", actual_url);
        log::debug!("  Using API Key: {}", masked_key);
        log::debug!("  HTTP Method: {}", if is_88code { "POST" } else { "GET" });
        log::debug!("  Request Headers:");
        log::debug!("    Authorization: Bearer {}", masked_key);
        log::debug!("    x-api-key: {}", masked_key);
        log::debug!("    User-Agent: claude-cli/1.0.113 (external, cli)");
        log::debug!("    anthropic-version: 2023-06-01");

        // 88code 使用 POST 请求，其他供应商使用 GET 请求
        let request_builder = if is_88code {
            log::debug!("  Using POST method for 88code");
            self.http_client
                .post(&actual_url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
        } else {
            // 完全模拟 Claude Code 客户端请求头，避免被 403 禁止
            self.http_client
                .get(&actual_url)
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
                // 内容类型
                .header("content-type", "application/json")
                .header("Accept", "application/json")
                .header("accept-language", "*")
        };

        let response = request_builder
            .send()
            .await
            .map_err(|e| {
                log::error!("❌ HTTP request failed: {}", e);
                AppError::ServiceError {
                    message: format!("余额查询 HTTP 请求失败: {}", e),
                }
            })?;

        let status = response.status();
        log::info!("📥 Response status: {}", status);

        // 记录响应头（仅在debug模式）
        log::debug!("  Response Headers:");
        for (name, value) in response.headers() {
            if let Ok(val_str) = value.to_str() {
                log::debug!("    {}: {}", name, val_str);
            }
        }

        if !response.status().is_success() {
            // 尝试读取响应体以获取更多错误信息
            let error_body = response.text().await.unwrap_or_else(|_| "无法读取响应体".to_string());
            log::error!("❌ Balance query failed:");
            log::error!("  Status: {}", status);
            log::error!("  Response body: {}", error_body);

            return Err(AppError::ServiceError {
                message: format!("余额查询失败，HTTP 状态码: {}，响应: {}", status, error_body),
            });
        }

        // 先读取响应体文本用于日志
        let response_text = response.text().await.map_err(|e| {
            log::error!("❌ Failed to read response body: {}", e);
            AppError::ServiceError {
                message: format!("无法读取响应体: {}", e),
            }
        })?;

        log::debug!("📄 Response body: {}", response_text);

        // 解析JSON
        let balance_response: BalanceResponse = serde_json::from_str(&response_text).map_err(|e| {
            log::error!("❌ Failed to parse JSON response:");
            log::error!("  Error: {}", e);
            log::error!("  Response text: {}", response_text);
            AppError::ParseError {
                message: format!("解析余额查询响应失败: {}", e),
            }
        })?;

        log::info!("✅ Successfully parsed balance response");
        log::debug!("  Balance: {:?}", balance_response.extract_balance());
        log::debug!("  Currency: {}", balance_response.extract_currency());

        Ok(balance_response)
    }

    /// 更新数据库中的余额信息
    fn update_balance_in_db(
        conn: &rusqlite::Connection,
        config_id: i64,
        balance: f64,
        currency: &str,
        checked_at: &str,
        status: &str,
        error_message: Option<&str>,
    ) -> AppResult<()> {
        conn.execute(
            "UPDATE ApiConfig SET
                last_balance = ?1,
                balance_currency = ?2,
                last_balance_check_at = ?3,
                balance_query_status = ?4,
                balance_query_error = ?5,
                updated_at = ?6
             WHERE id = ?7",
            rusqlite::params![
                balance,
                currency,
                checked_at,
                status,
                error_message,
                checked_at,
                config_id
            ],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("Failed to update balance in database: {}", e),
        })?;

        Ok(())
    }

    /// 禁用自动余额查询功能
    fn disable_auto_balance_check(
        conn: &rusqlite::Connection,
        config_id: i64,
    ) -> AppResult<()> {
        conn.execute(
            "UPDATE ApiConfig SET auto_balance_check = 0 WHERE id = ?1",
            rusqlite::params![config_id],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("Failed to disable auto balance check: {}", e),
        })?;

        log::info!("已禁用配置 {} 的自动余额查询功能", config_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_balance_response_parsing() {
        // 测试标准格式
        let json = r#"{"balance": 100.50, "currency": "CNY"}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.extract_balance(), Some(100.50));
        assert_eq!(response.extract_currency(), "CNY");

        // 测试嵌套格式
        let json = r#"{"data": {"balance": 50.25, "currency": "USD"}}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.extract_balance(), Some(50.25));
        assert_eq!(response.extract_currency(), "USD");

        // 测试自定义格式
        let json = r#"{"amount": 75.00}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.extract_balance(), Some(75.00));
    }
}
