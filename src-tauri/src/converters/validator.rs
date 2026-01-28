/**
 * 请求/响应验证模块
 *
 * 提供 API 请求和响应的验证功能:
 * - Claude Messages API 验证
 * - OpenAI Chat Completions API 验证
 * - 通用字段验证
 */

use serde::{Deserialize, Serialize};

use crate::converters::claude_types::{ClaudeMessage, ClaudeMessageRole, ClaudeRequest};
use crate::converters::openai_types::{OpenAIMessage, OpenAIRequest};

// ════════════════════════════════════════════════════════════════════════════
// 验证结果
// ════════════════════════════════════════════════════════════════════════════

/// 验证错误
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    /// 字段路径
    pub field: String,
    /// 错误消息
    pub message: String,
    /// 错误代码
    pub code: ValidationErrorCode,
}

/// 验证错误代码
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ValidationErrorCode {
    /// 必填字段缺失
    Required,
    /// 值超出范围
    OutOfRange,
    /// 格式无效
    InvalidFormat,
    /// 类型错误
    TypeError,
    /// 长度错误
    LengthError,
    /// 约束违反
    ConstraintViolation,
}

impl ValidationError {
    pub fn required(field: &str) -> Self {
        Self {
            field: field.to_string(),
            message: format!("Field '{}' is required", field),
            code: ValidationErrorCode::Required,
        }
    }

    pub fn out_of_range(field: &str, min: Option<i64>, max: Option<i64>) -> Self {
        let message = match (min, max) {
            (Some(min), Some(max)) => format!("Field '{}' must be between {} and {}", field, min, max),
            (Some(min), None) => format!("Field '{}' must be at least {}", field, min),
            (None, Some(max)) => format!("Field '{}' must be at most {}", field, max),
            (None, None) => format!("Field '{}' is out of range", field),
        };
        Self {
            field: field.to_string(),
            message,
            code: ValidationErrorCode::OutOfRange,
        }
    }

    pub fn invalid_format(field: &str, expected: &str) -> Self {
        Self {
            field: field.to_string(),
            message: format!("Field '{}' has invalid format, expected: {}", field, expected),
            code: ValidationErrorCode::InvalidFormat,
        }
    }

    pub fn type_error(field: &str, expected_type: &str) -> Self {
        Self {
            field: field.to_string(),
            message: format!("Field '{}' must be of type {}", field, expected_type),
            code: ValidationErrorCode::TypeError,
        }
    }

    pub fn length_error(field: &str, min: Option<usize>, max: Option<usize>) -> Self {
        let message = match (min, max) {
            (Some(min), Some(max)) => {
                format!("Field '{}' length must be between {} and {}", field, min, max)
            }
            (Some(min), None) => format!("Field '{}' length must be at least {}", field, min),
            (None, Some(max)) => format!("Field '{}' length must be at most {}", field, max),
            (None, None) => format!("Field '{}' has invalid length", field),
        };
        Self {
            field: field.to_string(),
            message,
            code: ValidationErrorCode::LengthError,
        }
    }

    pub fn constraint_violation(field: &str, constraint: &str) -> Self {
        Self {
            field: field.to_string(),
            message: format!("Field '{}' violates constraint: {}", field, constraint),
            code: ValidationErrorCode::ConstraintViolation,
        }
    }
}

/// 验证结果
pub type ValidationResult = Result<(), Vec<ValidationError>>;

// ════════════════════════════════════════════════════════════════════════════
// Claude API 验证
// ════════════════════════════════════════════════════════════════════════════

/// Claude 请求验证器
pub struct ClaudeRequestValidator;

impl ClaudeRequestValidator {
    /// 验证 Claude 请求
    pub fn validate(request: &ClaudeRequest) -> ValidationResult {
        let mut errors = Vec::new();

        // 验证模型
        if request.model.is_empty() {
            errors.push(ValidationError::required("model"));
        }

        // 验证消息列表
        if request.messages.is_empty() {
            errors.push(ValidationError::required("messages"));
        } else {
            // 验证消息必须以 user 开头
            if let Some(first_msg) = request.messages.first() {
                if first_msg.role != ClaudeMessageRole::User {
                    errors.push(ValidationError::constraint_violation(
                        "messages[0].role",
                        "First message must be from user",
                    ));
                }
            }

            // 验证消息交替
            for (i, window) in request.messages.windows(2).enumerate() {
                if window[0].role == window[1].role {
                    errors.push(ValidationError::constraint_violation(
                        &format!("messages[{}].role", i + 1),
                        "Messages must alternate between user and assistant",
                    ));
                }
            }
        }

        // 验证 max_tokens
        if let Some(max_tokens) = request.max_tokens {
            if max_tokens <= 0 {
                errors.push(ValidationError::out_of_range("max_tokens", Some(1), None));
            }
            if max_tokens > 8192 {
                errors.push(ValidationError::out_of_range(
                    "max_tokens",
                    None,
                    Some(8192),
                ));
            }
        }

        // 验证 temperature
        if let Some(temp) = request.temperature {
            if temp < 0.0 || temp > 1.0 {
                errors.push(ValidationError::out_of_range("temperature", Some(0), Some(1)));
            }
        }

        // 验证 top_p
        if let Some(top_p) = request.top_p {
            if top_p < 0.0 || top_p > 1.0 {
                errors.push(ValidationError::out_of_range("top_p", Some(0), Some(1)));
            }
        }

        // 验证 top_k
        if let Some(top_k) = request.top_k {
            if top_k < 0 {
                errors.push(ValidationError::out_of_range("top_k", Some(0), None));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// 快速验证（仅检查必填字段）
    pub fn validate_quick(request: &ClaudeRequest) -> ValidationResult {
        let mut errors = Vec::new();

        if request.model.is_empty() {
            errors.push(ValidationError::required("model"));
        }

        if request.messages.is_empty() {
            errors.push(ValidationError::required("messages"));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// OpenAI API 验证
// ════════════════════════════════════════════════════════════════════════════

/// OpenAI 请求验证器
pub struct OpenAIRequestValidator;

impl OpenAIRequestValidator {
    /// 验证 OpenAI 请求
    pub fn validate(request: &OpenAIRequest) -> ValidationResult {
        let mut errors = Vec::new();

        // 验证模型
        if request.model.is_empty() {
            errors.push(ValidationError::required("model"));
        }

        // 验证消息列表
        if request.messages.is_empty() {
            errors.push(ValidationError::required("messages"));
        } else {
            // 验证每个消息
            for (i, msg) in request.messages.iter().enumerate() {
                // 验证角色
                let valid_roles = ["system", "user", "assistant", "function", "tool"];
                if !valid_roles.contains(&msg.role.as_str()) {
                    errors.push(ValidationError::invalid_format(
                        &format!("messages[{}].role", i),
                        "system|user|assistant|function|tool",
                    ));
                }

                // 验证内容不为空（除非是 function/tool 角色）
                if msg.role != "function" && msg.role != "tool" && msg.content_text().is_empty()
                {
                    errors.push(ValidationError::required(&format!(
                        "messages[{}].content",
                        i
                    )));
                }
            }
        }

        // 验证 max_tokens
        if let Some(max_tokens) = request.max_tokens {
            if max_tokens <= 0 {
                errors.push(ValidationError::out_of_range("max_tokens", Some(1), None));
            }
        }

        // 验证 temperature
        if let Some(temp) = request.temperature {
            if temp < 0.0 || temp > 2.0 {
                errors.push(ValidationError::out_of_range("temperature", Some(0), Some(2)));
            }
        }

        // 验证 top_p
        if let Some(top_p) = request.top_p {
            if top_p < 0.0 || top_p > 1.0 {
                errors.push(ValidationError::out_of_range("top_p", Some(0), Some(1)));
            }
        }

        // 验证 n
        if let Some(n) = request.n {
            if n < 1 || n > 128 {
                errors.push(ValidationError::out_of_range("n", Some(1), Some(128)));
            }
        }

        // 验证 frequency_penalty
        if let Some(fp) = request.frequency_penalty {
            if fp < -2.0 || fp > 2.0 {
                errors.push(ValidationError::out_of_range(
                    "frequency_penalty",
                    Some(-2),
                    Some(2),
                ));
            }
        }

        // 验证 presence_penalty
        if let Some(pp) = request.presence_penalty {
            if pp < -2.0 || pp > 2.0 {
                errors.push(ValidationError::out_of_range(
                    "presence_penalty",
                    Some(-2),
                    Some(2),
                ));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// 快速验证（仅检查必填字段）
    pub fn validate_quick(request: &OpenAIRequest) -> ValidationResult {
        let mut errors = Vec::new();

        if request.model.is_empty() {
            errors.push(ValidationError::required("model"));
        }

        if request.messages.is_empty() {
            errors.push(ValidationError::required("messages"));
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 通用验证工具
// ════════════════════════════════════════════════════════════════════════════

/// 验证工具函数
pub struct ValidationUtils;

impl ValidationUtils {
    /// 验证模型名称格式
    pub fn validate_model_name(model: &str) -> bool {
        !model.is_empty() && model.len() <= 256 && model.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '/')
    }

    /// 验证 API Key 格式
    pub fn validate_api_key(key: &str) -> bool {
        // OpenAI: sk-xxxx
        // Claude: sk-ant-xxxx
        !key.is_empty() && key.len() >= 20 && key.len() <= 256
    }

    /// 验证 URL 格式
    pub fn validate_url(url: &str) -> bool {
        url.starts_with("http://") || url.starts_with("https://")
    }

    /// 验证 JSON 结构
    pub fn validate_json(json_str: &str) -> bool {
        serde_json::from_str::<serde_json::Value>(json_str).is_ok()
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use crate::converters::claude_types::ClaudeContent;
    use crate::converters::openai_types::OpenAIMessageContent;

    #[test]
    fn test_claude_request_valid() {
        let request = ClaudeRequest {
            model: "claude-3-opus-20240229".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: Some(1000),
            temperature: Some(0.7),
            top_p: None,
            top_k: None,
            stream: None,
            system: None,
            stop_sequences: None,
        };

        assert!(ClaudeRequestValidator::validate(&request).is_ok());
    }

    #[test]
    fn test_claude_request_empty_model() {
        let request = ClaudeRequest {
            model: "".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stream: None,
            system: None,
            stop_sequences: None,
        };

        let result = ClaudeRequestValidator::validate(&request);
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.field == "model"));
    }

    #[test]
    fn test_claude_request_wrong_first_role() {
        let request = ClaudeRequest {
            model: "claude-3-opus-20240229".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::Assistant,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stream: None,
            system: None,
            stop_sequences: None,
        };

        let result = ClaudeRequestValidator::validate(&request);
        assert!(result.is_err());
    }

    #[test]
    fn test_openai_request_valid() {
        let request = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![OpenAIMessage {
                role: "user".to_string(),
                content: Some(OpenAIMessageContent::Text("Hello".to_string())),
                name: None,
                tool_calls: None,
                tool_call_id: None,
            }],
            temperature: Some(0.7),
            max_tokens: Some(1000),
            stream: None,
            top_p: None,
            stop: None,
            frequency_penalty: None,
            presence_penalty: None,
            n: None,
            user: None,
            stream_options: None,
        };

        assert!(OpenAIRequestValidator::validate(&request).is_ok());
    }

    #[test]
    fn test_openai_request_invalid_role() {
        let request = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![OpenAIMessage {
                role: "invalid_role".to_string(),
                content: Some(OpenAIMessageContent::Text("Hello".to_string())),
                name: None,
                tool_calls: None,
                tool_call_id: None,
            }],
            temperature: None,
            max_tokens: None,
            stream: None,
            top_p: None,
            stop: None,
            frequency_penalty: None,
            presence_penalty: None,
            n: None,
            user: None,
            stream_options: None,
        };

        let result = OpenAIRequestValidator::validate(&request);
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_utils_model_name() {
        assert!(ValidationUtils::validate_model_name("gpt-4"));
        assert!(ValidationUtils::validate_model_name("claude-3-opus-20240229"));
        assert!(!ValidationUtils::validate_model_name(""));
    }

    #[test]
    fn test_validation_utils_url() {
        assert!(ValidationUtils::validate_url("https://api.openai.com"));
        assert!(ValidationUtils::validate_url("http://localhost:8080"));
        assert!(!ValidationUtils::validate_url("api.openai.com"));
    }
}
