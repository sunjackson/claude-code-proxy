/**
 * 统一错误转换器
 *
 * 根据请求格式和目标提供商，将错误转换为对应的 API 格式
 * 支持:
 * - Claude API 错误格式
 * - OpenAI API 错误格式
 * - 通用 Proxy 错误格式
 */

use hyper::{Response, StatusCode};
use http_body_util::Full;
use hyper::body::Bytes;
use serde::{Deserialize, Serialize};

use super::protocol_detector::RequestFormat;
use super::error_handler::ProxyErrorType;
use crate::converters::openai_types::OpenAIErrorResponse;

// ════════════════════════════════════════════════════════════════════════════
// Claude 错误格式
// ════════════════════════════════════════════════════════════════════════════

/// Claude API 错误响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeErrorResponse {
    #[serde(rename = "type")]
    pub response_type: String,
    pub error: ClaudeError,
}

/// Claude 错误详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeError {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
}

impl ClaudeErrorResponse {
    /// 创建一个新的 Claude 错误响应
    pub fn new(error_type: &str, message: &str) -> Self {
        Self {
            response_type: "error".to_string(),
            error: ClaudeError {
                error_type: error_type.to_string(),
                message: message.to_string(),
            },
        }
    }

    /// 创建认证错误
    pub fn authentication_error(message: &str) -> Self {
        Self::new("authentication_error", message)
    }

    /// 创建无效请求错误
    pub fn invalid_request_error(message: &str) -> Self {
        Self::new("invalid_request_error", message)
    }

    /// 创建速率限制错误
    pub fn rate_limit_error(message: &str) -> Self {
        Self::new("rate_limit_error", message)
    }

    /// 创建 API 错误
    pub fn api_error(message: &str) -> Self {
        Self::new("api_error", message)
    }

    /// 创建过载错误
    pub fn overloaded_error(message: &str) -> Self {
        Self::new("overloaded_error", message)
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 统一错误转换器
// ════════════════════════════════════════════════════════════════════════════

/// 统一错误转换器
pub struct UnifiedErrorConverter;

impl UnifiedErrorConverter {
    /// 根据请求格式创建错误响应
    ///
    /// # Arguments
    /// - `request_format`: 客户端请求使用的 API 格式
    /// - `status_code`: HTTP 状态码
    /// - `error_type`: 代理错误类型
    /// - `message`: 错误消息
    ///
    /// # Returns
    /// - HTTP 响应，body 为对应格式的 JSON 错误
    pub fn create_error_response(
        request_format: RequestFormat,
        status_code: StatusCode,
        error_type: &ProxyErrorType,
        message: &str,
    ) -> Response<Full<Bytes>> {
        match request_format {
            RequestFormat::OpenAI => Self::create_openai_error(status_code, error_type, message),
            RequestFormat::Claude | RequestFormat::Unknown => {
                Self::create_claude_error(status_code, error_type, message)
            }
            RequestFormat::Gemini => {
                // Gemini 格式暂时返回 Claude 格式
                Self::create_claude_error(status_code, error_type, message)
            }
        }
    }

    /// 创建 OpenAI 格式的错误响应
    fn create_openai_error(
        status_code: StatusCode,
        error_type: &ProxyErrorType,
        message: &str,
    ) -> Response<Full<Bytes>> {
        let error_response = match error_type {
            ProxyErrorType::ConnectionFailed => {
                OpenAIErrorResponse::server_error(&format!("Connection failed: {}", message))
            }
            ProxyErrorType::Timeout => {
                OpenAIErrorResponse::server_error(&format!("Request timeout: {}", message))
            }
            ProxyErrorType::QuotaExceeded => {
                OpenAIErrorResponse::rate_limit_error(message)
            }
            ProxyErrorType::InvalidResponse => {
                OpenAIErrorResponse::server_error(&format!("Invalid response: {}", message))
            }
            ProxyErrorType::NetworkError => {
                OpenAIErrorResponse::server_error(&format!("Network error: {}", message))
            }
            ProxyErrorType::Unknown => {
                OpenAIErrorResponse::server_error(message)
            }
        };

        let body = serde_json::to_string(&error_response).unwrap_or_else(|_| {
            r#"{"error":{"message":"Internal error","type":"server_error"}}"#.to_string()
        });

        Response::builder()
            .status(status_code)
            .header("Content-Type", "application/json")
            .header("X-Proxy-Error-Type", format!("{:?}", error_type))
            .body(Full::new(Bytes::from(body)))
            .unwrap()
    }

    /// 创建 Claude 格式的错误响应
    fn create_claude_error(
        status_code: StatusCode,
        error_type: &ProxyErrorType,
        message: &str,
    ) -> Response<Full<Bytes>> {
        let error_response = match error_type {
            ProxyErrorType::ConnectionFailed => {
                ClaudeErrorResponse::api_error(&format!("Connection failed: {}", message))
            }
            ProxyErrorType::Timeout => {
                ClaudeErrorResponse::api_error(&format!("Request timeout: {}", message))
            }
            ProxyErrorType::QuotaExceeded => {
                ClaudeErrorResponse::rate_limit_error(message)
            }
            ProxyErrorType::InvalidResponse => {
                ClaudeErrorResponse::api_error(&format!("Invalid response: {}", message))
            }
            ProxyErrorType::NetworkError => {
                ClaudeErrorResponse::api_error(&format!("Network error: {}", message))
            }
            ProxyErrorType::Unknown => {
                ClaudeErrorResponse::api_error(message)
            }
        };

        let body = serde_json::to_string(&error_response).unwrap_or_else(|_| {
            r#"{"type":"error","error":{"type":"api_error","message":"Internal error"}}"#
                .to_string()
        });

        Response::builder()
            .status(status_code)
            .header("Content-Type", "application/json")
            .header("X-Proxy-Error-Type", format!("{:?}", error_type))
            .body(Full::new(Bytes::from(body)))
            .unwrap()
    }

    /// 从状态码推断错误类型
    pub fn error_type_from_status(status: StatusCode) -> ProxyErrorType {
        match status.as_u16() {
            401 | 403 => ProxyErrorType::ConnectionFailed, // Auth errors
            408 | 504 => ProxyErrorType::Timeout,
            429 => ProxyErrorType::QuotaExceeded,
            400 | 422 => ProxyErrorType::InvalidResponse,
            502 | 503 => ProxyErrorType::NetworkError,
            _ => ProxyErrorType::Unknown,
        }
    }

    /// 从 Claude 错误响应转换为 OpenAI 格式
    pub fn claude_error_to_openai(claude_error: &ClaudeErrorResponse) -> OpenAIErrorResponse {
        let openai_type = match claude_error.error.error_type.as_str() {
            "authentication_error" => "invalid_api_key",
            "invalid_request_error" => "invalid_request_error",
            "rate_limit_error" => "rate_limit_exceeded",
            "overloaded_error" => "server_error",
            "api_error" => "server_error",
            _ => "server_error",
        };

        OpenAIErrorResponse::new(&claude_error.error.message, openai_type)
    }

    /// 从 OpenAI 错误响应转换为 Claude 格式
    pub fn openai_error_to_claude(openai_error: &OpenAIErrorResponse) -> ClaudeErrorResponse {
        let claude_type = match openai_error.error.error_type.as_str() {
            "invalid_api_key" => "authentication_error",
            "invalid_request_error" => "invalid_request_error",
            "rate_limit_exceeded" => "rate_limit_error",
            "server_error" => "api_error",
            _ => "api_error",
        };

        ClaudeErrorResponse::new(claude_type, &openai_error.error.message)
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_openai_error() {
        let response = UnifiedErrorConverter::create_error_response(
            RequestFormat::OpenAI,
            StatusCode::TOO_MANY_REQUESTS,
            &ProxyErrorType::QuotaExceeded,
            "Rate limit exceeded",
        );

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response.headers().get("Content-Type").unwrap(),
            "application/json"
        );
    }

    #[test]
    fn test_create_claude_error() {
        let response = UnifiedErrorConverter::create_error_response(
            RequestFormat::Claude,
            StatusCode::BAD_GATEWAY,
            &ProxyErrorType::ConnectionFailed,
            "Connection refused",
        );

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        assert_eq!(
            response.headers().get("Content-Type").unwrap(),
            "application/json"
        );
    }

    #[test]
    fn test_claude_to_openai_error_conversion() {
        let claude_error = ClaudeErrorResponse::rate_limit_error("Too many requests");
        let openai_error = UnifiedErrorConverter::claude_error_to_openai(&claude_error);

        assert_eq!(openai_error.error.error_type, "rate_limit_exceeded");
        assert!(openai_error.error.message.contains("Too many requests"));
    }

    #[test]
    fn test_openai_to_claude_error_conversion() {
        let openai_error = OpenAIErrorResponse::authentication_error("Invalid API key");
        let claude_error = UnifiedErrorConverter::openai_error_to_claude(&openai_error);

        assert_eq!(claude_error.error.error_type, "authentication_error");
        assert!(claude_error.error.message.contains("Invalid API key"));
    }

    #[test]
    fn test_error_type_from_status() {
        assert_eq!(
            UnifiedErrorConverter::error_type_from_status(StatusCode::TOO_MANY_REQUESTS),
            ProxyErrorType::QuotaExceeded
        );
        assert_eq!(
            UnifiedErrorConverter::error_type_from_status(StatusCode::GATEWAY_TIMEOUT),
            ProxyErrorType::Timeout
        );
        assert_eq!(
            UnifiedErrorConverter::error_type_from_status(StatusCode::BAD_GATEWAY),
            ProxyErrorType::NetworkError
        );
    }
}
