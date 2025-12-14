/**
 * Smart Router Module
 * 智能路由模块 - 基于客户端检测和后端提供商类型决定协议转换方向
 *
 * 功能:
 * - 检测客户端类型 (Claude Code, Codex, Cursor 等)
 * - 根据客户端期望格式和后端提供商类型决定转换方向
 * - 集成模型映射查询
 */

use super::client_detector::{ClientDetector, ClientType};
use super::protocol_detector::RequestFormat;
use crate::models::api_config::ProviderType;
use hyper::header::HeaderMap;

/// 转换方向
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConversionDirection {
    /// 无需转换 - 客户端格式与后端格式匹配
    NoConversion,
    /// Claude → OpenAI
    ClaudeToOpenAI,
    /// OpenAI → Claude
    OpenAIToClaude,
    /// Claude → Gemini
    ClaudeToGemini,
    /// Gemini → Claude
    GeminiToClaude,
    /// OpenAI → Gemini
    OpenAIToGemini,
    /// Gemini → OpenAI
    GeminiToOpenAI,
}

impl std::fmt::Display for ConversionDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConversionDirection::NoConversion => write!(f, "none"),
            ConversionDirection::ClaudeToOpenAI => write!(f, "claude_to_openai"),
            ConversionDirection::OpenAIToClaude => write!(f, "openai_to_claude"),
            ConversionDirection::ClaudeToGemini => write!(f, "claude_to_gemini"),
            ConversionDirection::GeminiToClaude => write!(f, "gemini_to_claude"),
            ConversionDirection::OpenAIToGemini => write!(f, "openai_to_gemini"),
            ConversionDirection::GeminiToOpenAI => write!(f, "gemini_to_openai"),
        }
    }
}

/// 路由决策上下文
#[derive(Debug, Clone)]
pub struct RoutingContext {
    /// 检测到的客户端类型
    pub client_type: ClientType,
    /// 客户端期望的请求格式
    pub client_format: RequestFormat,
    /// 后端提供商类型
    pub provider_type: ProviderType,
    /// 请求转换方向
    pub request_conversion: ConversionDirection,
    /// 响应转换方向 (与请求方向相反)
    pub response_conversion: ConversionDirection,
    /// 原始模型名称
    pub source_model: Option<String>,
    /// 目标模型名称 (经过映射)
    pub target_model: Option<String>,
}

impl RoutingContext {
    /// 创建路由上下文
    ///
    /// # Arguments
    /// - `headers`: 请求头
    /// - `path`: 请求路径
    /// - `provider_type`: 后端提供商类型
    pub fn new(headers: &HeaderMap, path: &str, provider_type: ProviderType) -> Self {
        // 1. 检测客户端类型
        let client_type = ClientDetector::detect_with_path(headers, path);

        // 2. 确定客户端期望格式
        let client_format = Self::determine_client_format(&client_type, path);

        // 3. 确定后端格式
        let backend_format = Self::provider_to_format(provider_type);

        // 4. 决定转换方向
        let (request_conversion, response_conversion) =
            Self::determine_conversion(client_format, backend_format);

        log::info!(
            "RoutingContext: client={}, client_format={:?}, backend={:?}, request_conv={}, response_conv={}",
            client_type, client_format, provider_type, request_conversion, response_conversion
        );

        Self {
            client_type,
            client_format,
            provider_type,
            request_conversion,
            response_conversion,
            source_model: None,
            target_model: None,
        }
    }

    /// 设置模型信息
    pub fn with_model(mut self, source_model: String, target_model: Option<String>) -> Self {
        self.source_model = Some(source_model.clone());
        self.target_model = target_model.or(Some(source_model));
        self
    }

    /// 确定客户端期望的格式
    fn determine_client_format(client_type: &ClientType, path: &str) -> RequestFormat {
        // 首先根据客户端类型判断
        match client_type {
            ClientType::ClaudeCode | ClientType::Cline | ClientType::GenericClaude => {
                RequestFormat::Claude
            }
            ClientType::Codex | ClientType::Cursor | ClientType::GenericOpenAI => {
                RequestFormat::OpenAI
            }
            ClientType::Continue | ClientType::Unknown => {
                // 对于未知客户端，使用路径判断
                use super::protocol_detector::ProtocolDetector;
                ProtocolDetector::detect_from_path(path)
            }
        }
    }

    /// 将 ProviderType 转换为 RequestFormat
    fn provider_to_format(provider_type: ProviderType) -> RequestFormat {
        match provider_type {
            ProviderType::Claude => RequestFormat::Claude,
            ProviderType::OpenAI => RequestFormat::OpenAI,
            ProviderType::Gemini => RequestFormat::Gemini,
        }
    }

    /// 确定转换方向
    fn determine_conversion(
        client_format: RequestFormat,
        backend_format: RequestFormat,
    ) -> (ConversionDirection, ConversionDirection) {
        // 请求转换: 客户端格式 → 后端格式
        let request_conversion = match (client_format, backend_format) {
            (a, b) if a == b => ConversionDirection::NoConversion,
            (RequestFormat::Claude, RequestFormat::OpenAI) => ConversionDirection::ClaudeToOpenAI,
            (RequestFormat::OpenAI, RequestFormat::Claude) => ConversionDirection::OpenAIToClaude,
            (RequestFormat::Claude, RequestFormat::Gemini) => ConversionDirection::ClaudeToGemini,
            (RequestFormat::Gemini, RequestFormat::Claude) => ConversionDirection::GeminiToClaude,
            (RequestFormat::OpenAI, RequestFormat::Gemini) => ConversionDirection::OpenAIToGemini,
            (RequestFormat::Gemini, RequestFormat::OpenAI) => ConversionDirection::GeminiToOpenAI,
            _ => ConversionDirection::NoConversion,
        };

        // 响应转换: 后端格式 → 客户端格式 (与请求方向相反)
        let response_conversion = match request_conversion {
            ConversionDirection::NoConversion => ConversionDirection::NoConversion,
            ConversionDirection::ClaudeToOpenAI => ConversionDirection::OpenAIToClaude,
            ConversionDirection::OpenAIToClaude => ConversionDirection::ClaudeToOpenAI,
            ConversionDirection::ClaudeToGemini => ConversionDirection::GeminiToClaude,
            ConversionDirection::GeminiToClaude => ConversionDirection::ClaudeToGemini,
            ConversionDirection::OpenAIToGemini => ConversionDirection::GeminiToOpenAI,
            ConversionDirection::GeminiToOpenAI => ConversionDirection::OpenAIToGemini,
        };

        (request_conversion, response_conversion)
    }

    /// 检查是否需要请求转换
    pub fn needs_request_conversion(&self) -> bool {
        self.request_conversion != ConversionDirection::NoConversion
    }

    /// 检查是否需要响应转换
    pub fn needs_response_conversion(&self) -> bool {
        self.response_conversion != ConversionDirection::NoConversion
    }

    /// 获取有效的目标模型
    pub fn effective_model(&self) -> Option<&str> {
        self.target_model.as_deref().or(self.source_model.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hyper::header::{HeaderMap, HeaderValue, USER_AGENT};

    #[test]
    fn test_claude_client_to_openai_backend() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("claude-code/1.0.0"));

        let ctx = RoutingContext::new(&headers, "/v1/messages", ProviderType::OpenAI);

        assert_eq!(ctx.client_type, ClientType::ClaudeCode);
        assert_eq!(ctx.client_format, RequestFormat::Claude);
        assert_eq!(ctx.request_conversion, ConversionDirection::ClaudeToOpenAI);
        assert_eq!(ctx.response_conversion, ConversionDirection::OpenAIToClaude);
    }

    #[test]
    fn test_openai_client_to_claude_backend() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("openai-codex/1.0"));

        let ctx = RoutingContext::new(&headers, "/v1/chat/completions", ProviderType::Claude);

        assert_eq!(ctx.client_type, ClientType::Codex);
        assert_eq!(ctx.client_format, RequestFormat::OpenAI);
        assert_eq!(ctx.request_conversion, ConversionDirection::OpenAIToClaude);
        assert_eq!(ctx.response_conversion, ConversionDirection::ClaudeToOpenAI);
    }

    #[test]
    fn test_claude_client_to_claude_backend_no_conversion() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("claude-code/1.0.0"));

        let ctx = RoutingContext::new(&headers, "/v1/messages", ProviderType::Claude);

        assert_eq!(ctx.client_type, ClientType::ClaudeCode);
        assert_eq!(ctx.request_conversion, ConversionDirection::NoConversion);
        assert_eq!(ctx.response_conversion, ConversionDirection::NoConversion);
    }

    #[test]
    fn test_cursor_to_gemini() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("Cursor/0.40.0"));

        let ctx = RoutingContext::new(&headers, "/v1/chat/completions", ProviderType::Gemini);

        assert_eq!(ctx.client_type, ClientType::Cursor);
        assert_eq!(ctx.client_format, RequestFormat::OpenAI);
        assert_eq!(ctx.request_conversion, ConversionDirection::OpenAIToGemini);
        assert_eq!(ctx.response_conversion, ConversionDirection::GeminiToOpenAI);
    }

    #[test]
    fn test_unknown_client_infer_from_path() {
        let headers = HeaderMap::new();

        // Claude path
        let ctx1 = RoutingContext::new(&headers, "/v1/messages", ProviderType::OpenAI);
        assert_eq!(ctx1.client_format, RequestFormat::Claude);

        // OpenAI path
        let ctx2 = RoutingContext::new(&headers, "/v1/chat/completions", ProviderType::Claude);
        assert_eq!(ctx2.client_format, RequestFormat::OpenAI);
    }
}
