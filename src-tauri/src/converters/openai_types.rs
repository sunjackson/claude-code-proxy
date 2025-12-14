/**
 * OpenAI API 类型定义
 * 基于 OpenAI Chat Completions API
 *
 * 支持:
 * - OpenAI 官方 API
 * - Azure OpenAI API
 * - 第三方 OpenAI 兼容服务
 */

use serde::{Deserialize, Serialize};

// ════════════════════════════════════════════════════════════════════════════
// 请求类型
// ════════════════════════════════════════════════════════════════════════════

/// OpenAI Chat Completions API 请求
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIRequest {
    /// 模型名称 (例: "gpt-4", "gpt-3.5-turbo")
    pub model: String,

    /// 消息列表
    pub messages: Vec<OpenAIMessage>,

    /// 生成温度 (0.0 - 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    /// 最大生成 token 数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i32>,

    /// 是否启用流式响应
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,

    /// 核采样参数 (0.0 - 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    /// 停止序列
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,

    /// 频率惩罚 (-2.0 - 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,

    /// 存在惩罚 (-2.0 - 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,

    /// 生成候选数量
    #[serde(skip_serializing_if = "Option::is_none")]
    pub n: Option<i32>,

    /// 用户标识符
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,

    /// 流式选项 (OpenAI API 扩展)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<OpenAIStreamOptions>,
}

/// OpenAI 流式选项
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIStreamOptions {
    /// 是否包含 usage 信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_usage: Option<bool>,
}

/// OpenAI 消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIMessage {
    /// 角色: "system", "user", "assistant"
    pub role: String,

    /// 消息内容
    pub content: OpenAIMessageContent,

    /// 函数调用名称 (用于 function calling)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// OpenAI 消息内容 (支持文本和多模态)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAIMessageContent {
    /// 简单文本
    Text(String),
    /// 多部分内容 (用于图片等)
    Parts(Vec<OpenAIContentPart>),
}

impl OpenAIMessageContent {
    /// 获取文本内容
    pub fn as_text(&self) -> String {
        match self {
            OpenAIMessageContent::Text(text) => text.clone(),
            OpenAIMessageContent::Parts(parts) => {
                parts
                    .iter()
                    .filter_map(|part| {
                        if let OpenAIContentPart::Text { text } = part {
                            Some(text.clone())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("")
            }
        }
    }

    /// 检查内容是否为空
    pub fn is_empty(&self) -> bool {
        match self {
            OpenAIMessageContent::Text(text) => text.is_empty(),
            OpenAIMessageContent::Parts(parts) => parts.is_empty(),
        }
    }
}

/// OpenAI 内容部分 (多模态支持)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum OpenAIContentPart {
    /// 文本内容
    #[serde(rename = "text")]
    Text { text: String },
    /// 图片 URL
    #[serde(rename = "image_url")]
    ImageUrl { image_url: OpenAIImageUrl },
}

/// OpenAI 图片 URL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIImageUrl {
    /// 图片 URL 或 base64 数据
    pub url: String,
    /// 图片细节级别
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

// ════════════════════════════════════════════════════════════════════════════
// 响应类型
// ════════════════════════════════════════════════════════════════════════════

/// OpenAI Chat Completions API 响应 (非流式)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIResponse {
    /// 响应 ID (格式: "chatcmpl-xxx")
    pub id: String,

    /// 对象类型 (固定: "chat.completion")
    pub object: String,

    /// 创建时间戳
    pub created: i64,

    /// 模型名称
    pub model: String,

    /// 生成的选择列表
    pub choices: Vec<OpenAIChoice>,

    /// 使用统计
    pub usage: OpenAIUsage,

    /// 系统指纹 (可选)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_fingerprint: Option<String>,
}

/// OpenAI 选择项 (非流式)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIChoice {
    /// 索引
    pub index: i32,

    /// 消息内容
    pub message: OpenAIMessage,

    /// 结束原因: "stop", "length", "content_filter", "tool_calls"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,

    /// 日志概率 (可选)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<serde_json::Value>,
}

/// OpenAI 使用统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIUsage {
    /// 输入 token 数
    pub prompt_tokens: i32,

    /// 输出 token 数
    pub completion_tokens: i32,

    /// 总 token 数
    pub total_tokens: i32,
}

// ════════════════════════════════════════════════════════════════════════════
// 流式响应类型
// ════════════════════════════════════════════════════════════════════════════

/// OpenAI 流式响应块
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIStreamChunk {
    /// 响应 ID
    pub id: String,

    /// 对象类型 (固定: "chat.completion.chunk")
    pub object: String,

    /// 创建时间戳
    pub created: i64,

    /// 模型名称
    pub model: String,

    /// 流式选择列表
    pub choices: Vec<OpenAIStreamChoice>,

    /// 使用统计 (仅在 stream_options.include_usage 为 true 时出现)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<OpenAIUsage>,

    /// 系统指纹
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_fingerprint: Option<String>,
}

/// OpenAI 流式选择项
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIStreamChoice {
    /// 索引
    pub index: i32,

    /// 增量内容
    pub delta: OpenAIDelta,

    /// 结束原因
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,

    /// 日志概率
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<serde_json::Value>,
}

/// OpenAI 增量内容
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAIDelta {
    /// 角色 (仅在首个块中出现)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,

    /// 内容增量
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

// ════════════════════════════════════════════════════════════════════════════
// 错误响应类型
// ════════════════════════════════════════════════════════════════════════════

/// OpenAI 错误响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIErrorResponse {
    pub error: OpenAIError,
}

/// OpenAI 错误详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIError {
    /// 错误消息
    pub message: String,

    /// 错误类型
    #[serde(rename = "type")]
    pub error_type: String,

    /// 错误参数 (可选)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub param: Option<String>,

    /// 错误代码 (可选)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

impl OpenAIErrorResponse {
    /// 创建一个新的错误响应
    pub fn new(message: &str, error_type: &str) -> Self {
        Self {
            error: OpenAIError {
                message: message.to_string(),
                error_type: error_type.to_string(),
                param: None,
                code: None,
            },
        }
    }

    /// 创建认证错误
    pub fn authentication_error(message: &str) -> Self {
        Self::new(message, "invalid_api_key")
    }

    /// 创建请求错误
    pub fn invalid_request(message: &str) -> Self {
        Self::new(message, "invalid_request_error")
    }

    /// 创建速率限制错误
    pub fn rate_limit_error(message: &str) -> Self {
        Self::new(message, "rate_limit_exceeded")
    }

    /// 创建服务器错误
    pub fn server_error(message: &str) -> Self {
        Self::new(message, "server_error")
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 辅助函数
// ════════════════════════════════════════════════════════════════════════════

impl OpenAIRequest {
    /// 创建一个基本的请求
    pub fn new(model: &str, messages: Vec<OpenAIMessage>) -> Self {
        Self {
            model: model.to_string(),
            messages,
            ..Default::default()
        }
    }

    /// 检查是否是流式请求
    pub fn is_streaming(&self) -> bool {
        self.stream.unwrap_or(false)
    }

    /// 获取有效的 max_tokens 值
    pub fn effective_max_tokens(&self) -> i32 {
        self.max_tokens.unwrap_or(4096)
    }
}

impl OpenAIMessage {
    /// 创建一个系统消息
    pub fn system(content: &str) -> Self {
        Self {
            role: "system".to_string(),
            content: OpenAIMessageContent::Text(content.to_string()),
            name: None,
        }
    }

    /// 创建一个用户消息
    pub fn user(content: &str) -> Self {
        Self {
            role: "user".to_string(),
            content: OpenAIMessageContent::Text(content.to_string()),
            name: None,
        }
    }

    /// 创建一个助手消息
    pub fn assistant(content: &str) -> Self {
        Self {
            role: "assistant".to_string(),
            content: OpenAIMessageContent::Text(content.to_string()),
            name: None,
        }
    }

    /// 检查是否为系统消息
    pub fn is_system(&self) -> bool {
        self.role == "system"
    }

    /// 检查是否为用户消息
    pub fn is_user(&self) -> bool {
        self.role == "user"
    }

    /// 检查是否为助手消息
    pub fn is_assistant(&self) -> bool {
        self.role == "assistant"
    }
}

impl OpenAIResponse {
    /// 获取第一个选择的内容
    pub fn first_content(&self) -> Option<String> {
        self.choices
            .first()
            .map(|choice| choice.message.content.as_text())
    }

    /// 获取结束原因
    pub fn finish_reason(&self) -> Option<&str> {
        self.choices
            .first()
            .and_then(|choice| choice.finish_reason.as_deref())
    }
}

impl OpenAIStreamChunk {
    /// 获取第一个增量的内容
    pub fn first_content(&self) -> Option<String> {
        self.choices
            .first()
            .and_then(|choice| choice.delta.content.clone())
    }

    /// 检查是否是流的最后一个块
    pub fn is_done(&self) -> bool {
        self.choices
            .first()
            .map(|choice| choice.finish_reason.is_some())
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openai_message_creation() {
        let system = OpenAIMessage::system("You are helpful.");
        assert!(system.is_system());
        assert_eq!(system.content.as_text(), "You are helpful.");

        let user = OpenAIMessage::user("Hello");
        assert!(user.is_user());
        assert_eq!(user.content.as_text(), "Hello");

        let assistant = OpenAIMessage::assistant("Hi there!");
        assert!(assistant.is_assistant());
        assert_eq!(assistant.content.as_text(), "Hi there!");
    }

    #[test]
    fn test_openai_request_streaming() {
        let req = OpenAIRequest {
            stream: Some(true),
            ..Default::default()
        };
        assert!(req.is_streaming());

        let req_non_stream = OpenAIRequest::default();
        assert!(!req_non_stream.is_streaming());
    }

    #[test]
    fn test_openai_message_content_as_text() {
        let text_content = OpenAIMessageContent::Text("Hello".to_string());
        assert_eq!(text_content.as_text(), "Hello");

        let parts_content = OpenAIMessageContent::Parts(vec![
            OpenAIContentPart::Text {
                text: "Part 1".to_string(),
            },
            OpenAIContentPart::Text {
                text: "Part 2".to_string(),
            },
        ]);
        assert_eq!(parts_content.as_text(), "Part 1Part 2");
    }

    #[test]
    fn test_openai_error_response() {
        let error = OpenAIErrorResponse::authentication_error("Invalid API key");
        assert_eq!(error.error.error_type, "invalid_api_key");
        assert_eq!(error.error.message, "Invalid API key");

        let rate_limit = OpenAIErrorResponse::rate_limit_error("Rate limit exceeded");
        assert_eq!(rate_limit.error.error_type, "rate_limit_exceeded");
    }

    #[test]
    fn test_serialize_openai_request() {
        let req = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![
                OpenAIMessage::system("You are helpful."),
                OpenAIMessage::user("Hello"),
            ],
            temperature: Some(0.7),
            max_tokens: Some(1000),
            stream: Some(false),
            ..Default::default()
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("gpt-4"));
        assert!(json.contains("system"));
        assert!(json.contains("user"));
    }

    #[test]
    fn test_deserialize_openai_response() {
        let json = r#"{
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "gpt-4",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello!"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15
            }
        }"#;

        let resp: OpenAIResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.id, "chatcmpl-123");
        assert_eq!(resp.model, "gpt-4");
        assert_eq!(resp.first_content(), Some("Hello!".to_string()));
        assert_eq!(resp.finish_reason(), Some("stop"));
        assert_eq!(resp.usage.total_tokens, 15);
    }

    #[test]
    fn test_deserialize_openai_stream_chunk() {
        let json = r#"{
            "id": "chatcmpl-123",
            "object": "chat.completion.chunk",
            "created": 1234567890,
            "model": "gpt-4",
            "choices": [{
                "index": 0,
                "delta": {
                    "content": "Hello"
                },
                "finish_reason": null
            }]
        }"#;

        let chunk: OpenAIStreamChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.first_content(), Some("Hello".to_string()));
        assert!(!chunk.is_done());
    }
}
