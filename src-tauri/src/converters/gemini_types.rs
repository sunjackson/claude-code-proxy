/**
 * Gemini API 类型定义
 * 基于 Google Gemini API
 */

use serde::{Deserialize, Serialize};

/// Gemini 内联数据（用于图片等二进制内容）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiInlineData {
    /// MIME 类型: "image/jpeg", "image/png", "image/gif", "image/webp"
    pub mime_type: String,
    /// Base64 编码的数据
    pub data: String,
}

impl GeminiInlineData {
    /// 创建新的内联数据
    pub fn new(mime_type: &str, data: &str) -> Self {
        Self {
            mime_type: mime_type.to_string(),
            data: data.to_string(),
        }
    }

    /// 获取支持的 MIME 类型列表
    pub fn supported_mime_types() -> &'static [&'static str] {
        &["image/jpeg", "image/png", "image/gif", "image/webp"]
    }

    /// 验证 MIME 类型是否支持
    pub fn is_valid_mime_type(&self) -> bool {
        Self::supported_mime_types().contains(&self.mime_type.as_str())
    }
}

/// Gemini 内容部分（支持文本和图片）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiPart {
    /// 文本内容
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// 内联数据（图片等）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline_data: Option<GeminiInlineData>,
}

impl GeminiPart {
    /// 创建文本内容部分
    pub fn text(text: &str) -> Self {
        Self {
            text: Some(text.to_string()),
            inline_data: None,
        }
    }

    /// 创建图片内容部分
    pub fn image(mime_type: &str, data: &str) -> Self {
        Self {
            text: None,
            inline_data: Some(GeminiInlineData::new(mime_type, data)),
        }
    }

    /// 检查是否为文本部分
    pub fn is_text(&self) -> bool {
        self.text.is_some() && self.inline_data.is_none()
    }

    /// 检查是否为图片部分
    pub fn is_image(&self) -> bool {
        self.inline_data.is_some()
    }
}

/// Gemini 内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    pub parts: Vec<GeminiPart>,
}

/// Gemini 生成配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
}

/// Gemini API 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiRequest {
    pub contents: Vec<GeminiContent>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_config: Option<GeminiGenerationConfig>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<GeminiContent>,
}

/// Gemini 候选响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCandidate {
    pub content: GeminiContent,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub safety_ratings: Option<Vec<GeminiSafetyRating>>,
}

/// Gemini 安全评级
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiSafetyRating {
    pub category: String,
    pub probability: String,
}

/// Gemini 使用元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiUsageMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_token_count: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub candidates_token_count: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_token_count: Option<i32>,
}

/// Gemini API 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiResponse {
    pub candidates: Vec<GeminiCandidate>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_metadata: Option<GeminiUsageMetadata>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_version: Option<String>,
}
