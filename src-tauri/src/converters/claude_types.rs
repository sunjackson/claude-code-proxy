/**
 * Claude API 类型定义
 * 基于 Anthropic Messages API
 */

use serde::{Deserialize, Serialize};

/// Claude API 角色类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeMessageRole {
    User,
    Assistant,
}

/// Claude 消息内容
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ClaudeContent {
    /// 文本内容
    Text(String),
    /// 复杂内容块
    Blocks(Vec<ClaudeContentBlock>),
}

/// Claude 图片来源
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeImageSource {
    /// 来源类型: "base64" 或 "url"
    #[serde(rename = "type")]
    pub source_type: String,
    /// 媒体类型: "image/jpeg", "image/png", "image/gif", "image/webp"
    pub media_type: String,
    /// Base64 编码的图片数据或 URL
    pub data: String,
}

impl ClaudeImageSource {
    /// 创建 Base64 图片来源
    pub fn base64(media_type: &str, data: &str) -> Self {
        Self {
            source_type: "base64".to_string(),
            media_type: media_type.to_string(),
            data: data.to_string(),
        }
    }

    /// 创建 URL 图片来源
    pub fn url(media_type: &str, url: &str) -> Self {
        Self {
            source_type: "url".to_string(),
            media_type: media_type.to_string(),
            data: url.to_string(),
        }
    }

    /// 检查是否为 Base64 格式
    pub fn is_base64(&self) -> bool {
        self.source_type == "base64"
    }

    /// 检查是否为 URL 格式
    pub fn is_url(&self) -> bool {
        self.source_type == "url"
    }

    /// 获取支持的媒体类型列表
    pub fn supported_media_types() -> &'static [&'static str] {
        &["image/jpeg", "image/png", "image/gif", "image/webp"]
    }

    /// 验证媒体类型是否支持
    pub fn is_valid_media_type(&self) -> bool {
        Self::supported_media_types().contains(&self.media_type.as_str())
    }
}

/// Claude 工具使用内容 (Function Calling 请求)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeToolUse {
    /// 工具调用 ID
    pub id: String,
    /// 工具名称
    pub name: String,
    /// 工具输入参数 (JSON 对象)
    pub input: serde_json::Value,
}

/// Claude 工具结果内容
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ClaudeToolResultContent {
    /// 文本结果
    Text(String),
    /// 复杂内容块列表
    Blocks(Vec<ClaudeContentBlock>),
}

/// Claude 内容块
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeContentBlock {
    /// 文本内容
    #[serde(rename = "text")]
    Text { text: String },
    /// 图片内容
    #[serde(rename = "image")]
    Image { source: ClaudeImageSource },
    /// 工具使用 (Function Calling 请求)
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    /// 工具结果 (Function Calling 响应)
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<ClaudeToolResultContent>,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

/// Claude 消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMessage {
    pub role: ClaudeMessageRole,
    pub content: ClaudeContent,
}

/// Claude API 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeRequest {
    pub model: String,
    pub messages: Vec<ClaudeMessage>,
    pub max_tokens: Option<i32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub stream: Option<bool>,
    pub system: Option<String>,
    pub stop_sequences: Option<Vec<String>>,
}

/// Claude API 响应（流式）
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeStreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: ClaudeResponseMessage },

    #[serde(rename = "content_block_start")]
    ContentBlockStart {
        index: i32,
        content_block: ClaudeContentBlock
    },

    #[serde(rename = "content_block_delta")]
    ContentBlockDelta {
        index: i32,
        delta: ClaudeContentDelta
    },

    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: i32 },

    #[serde(rename = "message_delta")]
    MessageDelta {
        delta: ClaudeMessageDeltaContent,
        usage: Option<ClaudeUsage>
    },

    #[serde(rename = "message_stop")]
    MessageStop,

    #[serde(rename = "ping")]
    Ping,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeContentDelta {
    #[serde(rename = "type")]
    pub delta_type: String,
    pub text: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMessageDeltaContent {
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
}

/// Claude API 响应消息
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResponseMessage {
    pub id: Option<String>,
    pub role: ClaudeMessageRole,
    pub content: Vec<ClaudeContentBlock>,
    pub model: Option<String>,
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
    pub usage: Option<ClaudeUsage>,
}

/// Claude API 使用统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeUsage {
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
}

/// Claude API 完整响应（非流式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub response_type: String,
    pub role: ClaudeMessageRole,
    pub content: Vec<ClaudeContentBlock>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
    pub usage: ClaudeUsage,
}
