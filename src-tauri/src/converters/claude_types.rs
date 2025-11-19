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

/// Claude 内容块
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    // 可扩展其他类型如图片等
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
