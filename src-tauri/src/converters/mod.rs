/**
 * API 转换模块
 *
 * 负责在不同 LLM API 格式之间进行转换
 * 支持 Claude API 和 Gemini API 之间的互转
 */

pub mod claude_types;
pub mod gemini_types;
pub mod claude_to_gemini;
pub mod gemini_to_claude;

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

/// API 提供商类型
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiProvider {
    Claude,
    Gemini,
}

#[allow(dead_code)]
impl std::fmt::Display for ApiProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiProvider::Claude => write!(f, "claude"),
            ApiProvider::Gemini => write!(f, "gemini"),
        }
    }
}
