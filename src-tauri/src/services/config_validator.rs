/**
 * 配置验证服务
 *
 * 提供 API 配置的验证功能:
 * - Claude API 端点验证
 * - OpenAI API 端点验证
 * - Gemini API 端点验证
 * - API 密钥格式验证
 * - 连通性测试
 */

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

use crate::models::api_config::{ApiConfig, ProviderType};

// ════════════════════════════════════════════════════════════════════════════
// 验证结果类型
// ════════════════════════════════════════════════════════════════════════════

/// 配置验证结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigValidationResult {
    /// 是否验证通过
    pub is_valid: bool,
    /// 验证详情
    pub details: Vec<ValidationDetail>,
    /// 总体状态消息
    pub message: String,
    /// 验证耗时 (毫秒)
    pub duration_ms: u64,
}

/// 验证详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationDetail {
    /// 验证项名称
    pub field: String,
    /// 是否通过
    pub passed: bool,
    /// 验证消息
    pub message: String,
    /// 严重级别
    pub severity: ValidationSeverity,
}

/// 验证严重级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValidationSeverity {
    /// 错误 - 必须修复
    Error,
    /// 警告 - 建议修复
    Warning,
    /// 信息 - 仅供参考
    Info,
}

/// 端点测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointTestResult {
    /// 是否可达
    pub reachable: bool,
    /// HTTP 状态码
    pub status_code: Option<u16>,
    /// 响应延迟 (毫秒)
    pub latency_ms: Option<u64>,
    /// 错误信息
    pub error: Option<String>,
    /// 服务器信息
    pub server_info: Option<ServerInfo>,
}

/// 服务器信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    /// API 版本
    pub api_version: Option<String>,
    /// 服务器标识
    pub server_id: Option<String>,
    /// 支持的模型列表
    pub supported_models: Vec<String>,
}

// ════════════════════════════════════════════════════════════════════════════
// 配置验证器
// ════════════════════════════════════════════════════════════════════════════

/// 配置验证服务
pub struct ConfigValidator;

impl ConfigValidator {
    /// 验证 API 配置
    pub fn validate(config: &ApiConfig) -> ConfigValidationResult {
        let start = Instant::now();
        let mut details = Vec::new();
        let mut has_errors = false;

        // 1. 验证名称
        let name_result = Self::validate_name(&config.name);
        if !name_result.passed {
            has_errors = true;
        }
        details.push(name_result);

        // 2. 验证 API 密钥
        let key_result = Self::validate_api_key(&config.api_key, &config.provider_type);
        if !key_result.passed && key_result.severity == ValidationSeverity::Error {
            has_errors = true;
        }
        details.push(key_result);

        // 3. 验证服务器 URL
        let url_result = Self::validate_server_url(&config.server_url, &config.provider_type);
        if !url_result.passed {
            has_errors = true;
        }
        details.push(url_result);

        // 4. 验证提供商特定配置
        match config.provider_type {
            ProviderType::OpenAI => {
                details.extend(Self::validate_openai_config(config));
            }
            ProviderType::Claude => {
                details.extend(Self::validate_claude_config(config));
            }
            ProviderType::Gemini => {
                details.extend(Self::validate_gemini_config(config));
            }
        }

        // 检查是否有错误
        for detail in &details {
            if !detail.passed && detail.severity == ValidationSeverity::Error {
                has_errors = true;
            }
        }

        let message = if has_errors {
            "配置验证失败，请修复错误后重试".to_string()
        } else {
            "配置验证通过".to_string()
        };

        ConfigValidationResult {
            is_valid: !has_errors,
            details,
            message,
            duration_ms: start.elapsed().as_millis() as u64,
        }
    }

    /// 验证名称
    fn validate_name(name: &str) -> ValidationDetail {
        if name.is_empty() {
            ValidationDetail {
                field: "name".to_string(),
                passed: false,
                message: "配置名称不能为空".to_string(),
                severity: ValidationSeverity::Error,
            }
        } else if name.len() > 100 {
            ValidationDetail {
                field: "name".to_string(),
                passed: false,
                message: "配置名称不能超过 100 个字符".to_string(),
                severity: ValidationSeverity::Error,
            }
        } else {
            ValidationDetail {
                field: "name".to_string(),
                passed: true,
                message: format!("名称有效: {}", name),
                severity: ValidationSeverity::Info,
            }
        }
    }

    /// 验证 API 密钥格式
    fn validate_api_key(api_key: &str, provider: &ProviderType) -> ValidationDetail {
        if api_key.is_empty() {
            return ValidationDetail {
                field: "api_key".to_string(),
                passed: false,
                message: "API 密钥不能为空".to_string(),
                severity: ValidationSeverity::Error,
            };
        }

        // 加密的密钥跳过格式检查
        if api_key == "[ENCRYPTED]" {
            return ValidationDetail {
                field: "api_key".to_string(),
                passed: true,
                message: "API 密钥已加密存储".to_string(),
                severity: ValidationSeverity::Info,
            };
        }

        // 根据提供商检查密钥格式
        match provider {
            ProviderType::OpenAI => {
                if api_key.starts_with("sk-") && api_key.len() >= 20 {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: true,
                        message: "OpenAI API 密钥格式正确".to_string(),
                        severity: ValidationSeverity::Info,
                    }
                } else if api_key.starts_with("sk-proj-") && api_key.len() >= 20 {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: true,
                        message: "OpenAI Project API 密钥格式正确".to_string(),
                        severity: ValidationSeverity::Info,
                    }
                } else {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: false,
                        message: "OpenAI API 密钥格式不正确，应以 'sk-' 开头".to_string(),
                        severity: ValidationSeverity::Warning,
                    }
                }
            }
            ProviderType::Claude => {
                if api_key.starts_with("sk-ant-") && api_key.len() >= 20 {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: true,
                        message: "Claude API 密钥格式正确".to_string(),
                        severity: ValidationSeverity::Info,
                    }
                } else {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: false,
                        message: "Claude API 密钥格式可能不正确，官方密钥通常以 'sk-ant-' 开头"
                            .to_string(),
                        severity: ValidationSeverity::Warning,
                    }
                }
            }
            ProviderType::Gemini => {
                if api_key.len() >= 20 {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: true,
                        message: "Gemini API 密钥格式正确".to_string(),
                        severity: ValidationSeverity::Info,
                    }
                } else {
                    ValidationDetail {
                        field: "api_key".to_string(),
                        passed: false,
                        message: "API 密钥长度不足".to_string(),
                        severity: ValidationSeverity::Warning,
                    }
                }
            }
        }
    }

    /// 验证服务器 URL
    fn validate_server_url(url: &str, provider: &ProviderType) -> ValidationDetail {
        if url.is_empty() {
            return ValidationDetail {
                field: "server_url".to_string(),
                passed: false,
                message: "服务器地址不能为空".to_string(),
                severity: ValidationSeverity::Error,
            };
        }

        if !url.starts_with("http://") && !url.starts_with("https://") {
            return ValidationDetail {
                field: "server_url".to_string(),
                passed: false,
                message: "服务器地址必须以 http:// 或 https:// 开头".to_string(),
                severity: ValidationSeverity::Error,
            };
        }

        // 检查是否使用 HTTPS
        if url.starts_with("http://") && !url.contains("localhost") && !url.contains("127.0.0.1") {
            return ValidationDetail {
                field: "server_url".to_string(),
                passed: true,
                message: "建议使用 HTTPS 以确保通信安全".to_string(),
                severity: ValidationSeverity::Warning,
            };
        }

        // 检查官方端点
        let expected_domains = match provider {
            ProviderType::OpenAI => vec!["api.openai.com", "api.azure.com"],
            ProviderType::Claude => vec!["api.anthropic.com"],
            ProviderType::Gemini => vec!["generativelanguage.googleapis.com"],
        };

        let is_official = expected_domains.iter().any(|domain| url.contains(domain));

        if is_official {
            ValidationDetail {
                field: "server_url".to_string(),
                passed: true,
                message: "使用官方 API 端点".to_string(),
                severity: ValidationSeverity::Info,
            }
        } else {
            ValidationDetail {
                field: "server_url".to_string(),
                passed: true,
                message: "使用第三方 API 端点".to_string(),
                severity: ValidationSeverity::Info,
            }
        }
    }

    /// 验证 OpenAI 特定配置
    fn validate_openai_config(config: &ApiConfig) -> Vec<ValidationDetail> {
        let mut details = Vec::new();

        // 验证 Organization ID（如果设置）
        if let Some(ref org_id) = config.organization_id {
            if !org_id.is_empty() && !org_id.starts_with("org-") {
                details.push(ValidationDetail {
                    field: "organization_id".to_string(),
                    passed: false,
                    message: "OpenAI Organization ID 格式不正确，应以 'org-' 开头".to_string(),
                    severity: ValidationSeverity::Warning,
                });
            } else if !org_id.is_empty() {
                details.push(ValidationDetail {
                    field: "organization_id".to_string(),
                    passed: true,
                    message: "Organization ID 格式正确".to_string(),
                    severity: ValidationSeverity::Info,
                });
            }
        }

        // 验证模型配置
        if let Some(ref model) = config.default_model {
            if !model.is_empty() && !Self::is_valid_openai_model(model) {
                details.push(ValidationDetail {
                    field: "default_model".to_string(),
                    passed: true,
                    message: format!("自定义模型: {}", model),
                    severity: ValidationSeverity::Info,
                });
            }
        }

        details
    }

    /// 验证 Claude 特定配置
    fn validate_claude_config(config: &ApiConfig) -> Vec<ValidationDetail> {
        let mut details = Vec::new();

        // 验证模型配置
        let models = [
            ("default_model", &config.default_model),
            ("haiku_model", &config.haiku_model),
            ("sonnet_model", &config.sonnet_model),
            ("opus_model", &config.opus_model),
        ];

        for (field, model_opt) in models {
            if let Some(ref model) = model_opt {
                if !model.is_empty() && !Self::is_valid_claude_model(model) {
                    details.push(ValidationDetail {
                        field: field.to_string(),
                        passed: true,
                        message: format!("自定义模型: {}", model),
                        severity: ValidationSeverity::Info,
                    });
                }
            }
        }

        details
    }

    /// 验证 Gemini 特定配置
    fn validate_gemini_config(_config: &ApiConfig) -> Vec<ValidationDetail> {
        // Gemini 暂无特殊配置需要验证
        Vec::new()
    }

    /// 检查是否为有效的 OpenAI 模型名称
    fn is_valid_openai_model(model: &str) -> bool {
        let known_models = [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
            "o1-preview",
            "o1-mini",
        ];
        known_models.iter().any(|m| model.starts_with(m))
    }

    /// 检查是否为有效的 Claude 模型名称
    fn is_valid_claude_model(model: &str) -> bool {
        model.starts_with("claude-")
    }

    /// 测试端点连通性
    pub async fn test_endpoint(
        server_url: &str,
        api_key: &str,
        provider: &ProviderType,
        timeout: Duration,
    ) -> EndpointTestResult {
        let start = Instant::now();

        // 构建测试 URL
        let test_url = match provider {
            ProviderType::OpenAI => format!("{}/v1/models", server_url.trim_end_matches('/')),
            ProviderType::Claude => format!(
                "{}/v1/messages",
                server_url.trim_end_matches('/')
            ),
            ProviderType::Gemini => format!("{}/v1/models", server_url.trim_end_matches('/')),
        };

        // 创建 HTTP 客户端
        let client = match reqwest::Client::builder()
            .timeout(timeout)
            .danger_accept_invalid_certs(false)
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                return EndpointTestResult {
                    reachable: false,
                    status_code: None,
                    latency_ms: None,
                    error: Some(format!("创建 HTTP 客户端失败: {}", e)),
                    server_info: None,
                }
            }
        };

        // 构建请求
        let mut request = client.get(&test_url);

        // 添加认证头
        match provider {
            ProviderType::OpenAI => {
                request = request.header("Authorization", format!("Bearer {}", api_key));
            }
            ProviderType::Claude => {
                request = request
                    .header("x-api-key", api_key)
                    .header("anthropic-version", "2023-06-01");
            }
            ProviderType::Gemini => {
                // Gemini 使用查询参数
                request = request.query(&[("key", api_key)]);
            }
        }

        // 发送请求
        match request.send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let latency = start.elapsed().as_millis() as u64;

                // 尝试解析服务器信息
                let server_info = if status == 200 {
                    match response.json::<serde_json::Value>().await {
                        Ok(json) => Self::extract_server_info(&json, provider),
                        Err(_) => None,
                    }
                } else {
                    None
                };

                EndpointTestResult {
                    reachable: status < 500,
                    status_code: Some(status),
                    latency_ms: Some(latency),
                    error: if status >= 400 {
                        Some(format!("HTTP {}", status))
                    } else {
                        None
                    },
                    server_info,
                }
            }
            Err(e) => {
                let latency = start.elapsed().as_millis() as u64;
                let error_msg = if e.is_timeout() {
                    "请求超时".to_string()
                } else if e.is_connect() {
                    "连接失败".to_string()
                } else {
                    format!("请求失败: {}", e)
                };

                EndpointTestResult {
                    reachable: false,
                    status_code: None,
                    latency_ms: Some(latency),
                    error: Some(error_msg),
                    server_info: None,
                }
            }
        }
    }

    /// 从响应中提取服务器信息
    fn extract_server_info(json: &serde_json::Value, provider: &ProviderType) -> Option<ServerInfo> {
        match provider {
            ProviderType::OpenAI => {
                let models: Vec<String> = json
                    .get("data")
                    .and_then(|d| d.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("id").and_then(|id| id.as_str()))
                            .map(String::from)
                            .take(10)
                            .collect()
                    })
                    .unwrap_or_default();

                Some(ServerInfo {
                    api_version: None,
                    server_id: None,
                    supported_models: models,
                })
            }
            ProviderType::Claude => {
                // Claude /v1/messages 不返回模型列表
                None
            }
            ProviderType::Gemini => {
                let models: Vec<String> = json
                    .get("models")
                    .and_then(|d| d.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("name").and_then(|n| n.as_str()))
                            .map(String::from)
                            .take(10)
                            .collect()
                    })
                    .unwrap_or_default();

                Some(ServerInfo {
                    api_version: None,
                    server_id: None,
                    supported_models: models,
                })
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config(provider: ProviderType) -> ApiConfig {
        ApiConfig {
            id: 1,
            name: "Test Config".to_string(),
            api_key: match provider {
                ProviderType::OpenAI => "sk-1234567890abcdef".to_string(),
                ProviderType::Claude => "sk-ant-1234567890abcdef".to_string(),
                ProviderType::Gemini => "AIzaSyABCDEFGHIJKLMNOP".to_string(),
            },
            server_url: match provider {
                ProviderType::OpenAI => "https://api.openai.com".to_string(),
                ProviderType::Claude => "https://api.anthropic.com".to_string(),
                ProviderType::Gemini => "https://generativelanguage.googleapis.com".to_string(),
            },
            server_port: 443,
            group_id: None,
            sort_order: 0,
            is_available: true,
            is_enabled: true,
            weight_score: 1.0,
            last_success_time: None,
            consecutive_failures: 0,
            last_test_at: None,
            last_latency_ms: None,
            provider_type: provider,
            organization_id: None,
            category: crate::models::api_config::VendorCategory::Custom,
            is_partner: false,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: "{}".to_string(),
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            last_balance: None,
            balance_currency: None,
            last_balance_check_at: None,
            balance_query_status: None,
            balance_query_error: None,
            auto_balance_check: false,
            balance_check_interval_sec: None,
            created_at: "2025-01-01".to_string(),
            updated_at: "2025-01-01".to_string(),
        }
    }

    #[test]
    fn test_validate_openai_config() {
        let config = create_test_config(ProviderType::OpenAI);
        let result = ConfigValidator::validate(&config);

        assert!(result.is_valid);
        assert!(!result.details.is_empty());
    }

    #[test]
    fn test_validate_claude_config() {
        let config = create_test_config(ProviderType::Claude);
        let result = ConfigValidator::validate(&config);

        assert!(result.is_valid);
    }

    #[test]
    fn test_validate_empty_name() {
        let mut config = create_test_config(ProviderType::OpenAI);
        config.name = "".to_string();

        let result = ConfigValidator::validate(&config);
        assert!(!result.is_valid);
        assert!(result.details.iter().any(|d| d.field == "name" && !d.passed));
    }

    #[test]
    fn test_validate_empty_api_key() {
        let mut config = create_test_config(ProviderType::OpenAI);
        config.api_key = "".to_string();

        let result = ConfigValidator::validate(&config);
        assert!(!result.is_valid);
        assert!(result
            .details
            .iter()
            .any(|d| d.field == "api_key" && !d.passed));
    }

    #[test]
    fn test_validate_invalid_url() {
        let mut config = create_test_config(ProviderType::OpenAI);
        config.server_url = "invalid-url".to_string();

        let result = ConfigValidator::validate(&config);
        assert!(!result.is_valid);
    }

    #[test]
    fn test_validate_openai_key_format() {
        let result = ConfigValidator::validate_api_key("sk-1234567890abcdef1234", &ProviderType::OpenAI);
        assert!(result.passed);

        let result = ConfigValidator::validate_api_key("invalid-key", &ProviderType::OpenAI);
        assert!(!result.passed);
        assert_eq!(result.severity, ValidationSeverity::Warning);
    }

    #[test]
    fn test_validate_claude_key_format() {
        let result =
            ConfigValidator::validate_api_key("sk-ant-1234567890abcdef", &ProviderType::Claude);
        assert!(result.passed);

        let result = ConfigValidator::validate_api_key("sk-1234567890", &ProviderType::Claude);
        assert!(!result.passed);
        assert_eq!(result.severity, ValidationSeverity::Warning);
    }

    #[test]
    fn test_validate_encrypted_key() {
        let result = ConfigValidator::validate_api_key("[ENCRYPTED]", &ProviderType::OpenAI);
        assert!(result.passed);
    }

    #[test]
    fn test_validate_official_endpoints() {
        let result =
            ConfigValidator::validate_server_url("https://api.openai.com", &ProviderType::OpenAI);
        assert!(result.passed);
        assert!(result.message.contains("官方"));

        let result = ConfigValidator::validate_server_url(
            "https://api.anthropic.com",
            &ProviderType::Claude,
        );
        assert!(result.passed);
        assert!(result.message.contains("官方"));
    }

    #[test]
    fn test_validate_third_party_endpoints() {
        let result = ConfigValidator::validate_server_url(
            "https://api.custom-provider.com",
            &ProviderType::OpenAI,
        );
        assert!(result.passed);
        assert!(result.message.contains("第三方"));
    }

    #[test]
    fn test_is_valid_openai_model() {
        assert!(ConfigValidator::is_valid_openai_model("gpt-4o"));
        assert!(ConfigValidator::is_valid_openai_model("gpt-4o-mini"));
        assert!(ConfigValidator::is_valid_openai_model("gpt-4-turbo-2024-04-09"));
        assert!(!ConfigValidator::is_valid_openai_model("custom-model"));
    }

    #[test]
    fn test_is_valid_claude_model() {
        assert!(ConfigValidator::is_valid_claude_model("claude-3-5-sonnet-20241022"));
        assert!(ConfigValidator::is_valid_claude_model("claude-3-opus-20240229"));
        assert!(!ConfigValidator::is_valid_claude_model("gpt-4o"));
    }
}
