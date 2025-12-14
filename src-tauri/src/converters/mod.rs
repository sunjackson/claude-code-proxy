/**
 * API 转换模块
 *
 * 负责在不同 LLM API 格式之间进行转换
 * 支持:
 * - Claude API ↔ Gemini API 互转
 * - Claude API ↔ OpenAI API 互转 (v1.3.0+)
 * - 请求/响应验证 (v1.3.0+)
 */

pub mod claude_types;
pub mod gemini_types;
pub mod openai_types;
pub mod claude_to_gemini;
pub mod gemini_to_claude;
pub mod openai_claude;
pub mod validator;
pub mod model_mapper;

// 注意：这些导出在 router.rs 中通过完整路径使用
// 保留它们以供将来可能的直接使用
#[allow(unused_imports)]
pub use claude_types::{ClaudeRequest, ClaudeResponse, ClaudeMessage, ClaudeMessageRole};
#[allow(unused_imports)]
pub use gemini_types::{GeminiRequest, GeminiResponse, GeminiContent, GeminiPart};
#[allow(unused_imports)]
pub use claude_to_gemini::convert_claude_request_to_gemini;
#[allow(unused_imports)]
pub use gemini_to_claude::convert_gemini_response_to_claude;

// OpenAI 类型和转换器导出 (v1.3.0+)
#[allow(unused_imports)]
pub use openai_types::{
    OpenAIRequest, OpenAIResponse, OpenAIMessage, OpenAIMessageContent,
    OpenAIStreamChunk, OpenAIErrorResponse,
};
#[allow(unused_imports)]
pub use openai_claude::{
    convert_openai_request_to_claude, convert_claude_response_to_openai,
    convert_claude_request_to_openai, convert_openai_response_to_claude,
    convert_openai_stream_to_claude, convert_claude_stream_to_openai,
};

// 验证器导出 (v1.3.0+)
#[allow(unused_imports)]
pub use validator::{
    ClaudeRequestValidator, OpenAIRequestValidator, ValidationError,
    ValidationErrorCode, ValidationResult, ValidationUtils,
};

// 模型映射器导出 (v1.3.0+)
#[allow(unused_imports)]
pub use model_mapper::{
    ModelMapper, ModelInfo, ModelProvider, ModelCapability,
    claude_to_openai, openai_to_claude, MODEL_MAPPER,
};

/// API 提供商类型 (converters 模块内部使用)
/// 注意: 与 models::api_config::ProviderType 保持同步
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiProvider {
    Claude,
    Gemini,
    OpenAI,
}

#[allow(dead_code)]
impl std::fmt::Display for ApiProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiProvider::Claude => write!(f, "claude"),
            ApiProvider::Gemini => write!(f, "gemini"),
            ApiProvider::OpenAI => write!(f, "openai"),
        }
    }
}
