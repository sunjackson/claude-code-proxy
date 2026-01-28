/**
 * Claude API 请求转换为 Gemini API 请求
 */

use super::claude_types::{ClaudeContent, ClaudeContentBlock, ClaudeImageSource, ClaudeMessageRole, ClaudeRequest};
#[cfg(test)]
use super::claude_types::ClaudeMessage;
use super::gemini_types::{GeminiContent, GeminiGenerationConfig, GeminiInlineData, GeminiPart, GeminiRequest};
use crate::models::error::AppResult;

/// 将 Claude API 请求转换为 Gemini API 请求
///
/// # 参数
/// - `claude_req`: Claude API 请求
/// - `gemini_model`: Gemini 模型名称（如 "gemini-pro"）
///
/// # 返回
/// - `Ok((GeminiRequest, String))`: Gemini 请求和 API 路径
/// - `Err(AppError)`: 转换失败
pub fn convert_claude_request_to_gemini(
    claude_req: &ClaudeRequest,
    gemini_model: &str,
) -> AppResult<(GeminiRequest, String)> {
    log::debug!("转换 Claude 请求到 Gemini 格式");

    // 转换消息列表
    let mut contents = Vec::new();

    for msg in &claude_req.messages {
        let role = match msg.role {
            ClaudeMessageRole::User => "user",
            ClaudeMessageRole::Assistant => "model",
        };

        let parts = convert_content_to_gemini_parts(&msg.content)?;

        contents.push(GeminiContent {
            role: Some(role.to_string()),
            parts,
        });
    }

    // 构建生成配置
    let mut generation_config = GeminiGenerationConfig::default();

    if let Some(max_tokens) = claude_req.max_tokens {
        generation_config.max_output_tokens = Some(max_tokens);
    }

    if let Some(temperature) = claude_req.temperature {
        generation_config.temperature = Some(temperature);
    }

    if let Some(top_p) = claude_req.top_p {
        generation_config.top_p = Some(top_p);
    }

    if let Some(top_k) = claude_req.top_k {
        generation_config.top_k = Some(top_k);
    }

    if let Some(ref stop_sequences) = claude_req.stop_sequences {
        generation_config.stop_sequences = Some(stop_sequences.clone());
    }

    // 处理 system 指令
    let system_instruction = if let Some(ref system_text) = claude_req.system {
        Some(GeminiContent {
            role: None,
            parts: vec![GeminiPart::text(system_text)],
        })
    } else {
        None
    };

    let gemini_req = GeminiRequest {
        contents,
        generation_config: if is_generation_config_empty(&generation_config) {
            None
        } else {
            Some(generation_config)
        },
        system_instruction,
    };

    // 构建 API 路径
    // Gemini API 格式: /v1beta/models/{model}:generateContent 或 :streamGenerateContent
    let is_stream = claude_req.stream.unwrap_or(false);
    let api_path = if is_stream {
        format!("/v1beta/models/{}:streamGenerateContent", gemini_model)
    } else {
        format!("/v1beta/models/{}:generateContent", gemini_model)
    };

    log::debug!(
        "Claude 请求已转换为 Gemini 格式: path={}, contents_count={}",
        api_path,
        gemini_req.contents.len()
    );

    Ok((gemini_req, api_path))
}

/// 将 Claude 内容转换为 Gemini Parts 列表
fn convert_content_to_gemini_parts(content: &ClaudeContent) -> AppResult<Vec<GeminiPart>> {
    match content {
        ClaudeContent::Text(text) => Ok(vec![GeminiPart::text(text)]),
        ClaudeContent::Blocks(blocks) => {
            let mut parts = Vec::new();
            for block in blocks {
                match block {
                    ClaudeContentBlock::Text { text } => {
                        parts.push(GeminiPart::text(text));
                    }
                    ClaudeContentBlock::Image { source } => {
                        parts.push(convert_claude_image_to_gemini(source)?);
                    }
                    // Gemini 暂不支持工具调用，跳过
                    ClaudeContentBlock::ToolUse { .. } => {}
                    ClaudeContentBlock::ToolResult { .. } => {}
                }
            }
            Ok(parts)
        }
    }
}

/// 将 Claude 图片转换为 Gemini Part
fn convert_claude_image_to_gemini(source: &ClaudeImageSource) -> AppResult<GeminiPart> {
    if source.is_base64() {
        // Base64 格式直接使用
        Ok(GeminiPart::image(&source.media_type, &source.data))
    } else {
        // URL 格式：Gemini 不直接支持 URL，需要记录警告
        // 注意：实际生产中应该下载 URL 并转为 base64
        log::warn!(
            "Gemini API 不支持 URL 图片，需要先下载转换为 base64: {}",
            source.data
        );
        // 返回一个占位文本
        Ok(GeminiPart::text(&format!(
            "[Image URL: {}]",
            source.data
        )))
    }
}

/// 从 Claude 内容中提取纯文本（用于向后兼容）
#[allow(dead_code)]
fn extract_text_from_content(content: &ClaudeContent) -> AppResult<String> {
    match content {
        ClaudeContent::Text(text) => Ok(text.clone()),
        ClaudeContent::Blocks(blocks) => {
            let mut texts = Vec::new();
            for block in blocks {
                match block {
                    ClaudeContentBlock::Text { text } => {
                        texts.push(text.clone());
                    }
                    ClaudeContentBlock::Image { .. } => {
                        // 图片内容跳过
                    }
                    // 工具调用块跳过
                    ClaudeContentBlock::ToolUse { .. } => {}
                    ClaudeContentBlock::ToolResult { .. } => {}
                }
            }
            Ok(texts.join("\n"))
        }
    }
}

/// 检查生成配置是否为空
fn is_generation_config_empty(config: &GeminiGenerationConfig) -> bool {
    config.temperature.is_none()
        && config.top_p.is_none()
        && config.top_k.is_none()
        && config.max_output_tokens.is_none()
        && config.stop_sequences.is_none()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_simple_request() {
        let claude_req = ClaudeRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: Some(1024),
            temperature: None,
            top_p: None,
            top_k: None,
            stream: None,
            system: None,
            stop_sequences: None,
        };

        let result = convert_claude_request_to_gemini(&claude_req, "gemini-pro");
        assert!(result.is_ok());

        let (gemini_req, path) = result.unwrap();
        assert_eq!(path, "/v1beta/models/gemini-pro:generateContent");
        assert_eq!(gemini_req.contents.len(), 1);
        assert_eq!(gemini_req.contents[0].role, Some("user".to_string()));
        assert!(gemini_req.contents[0].parts[0].is_text());
        assert_eq!(
            gemini_req.contents[0].parts[0].text.as_deref(),
            Some("Hello")
        );
    }

    #[test]
    fn test_convert_with_system_instruction() {
        let claude_req = ClaudeRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: Some(1024),
            temperature: None,
            top_p: None,
            top_k: None,
            stream: None,
            system: Some("You are a helpful assistant".to_string()),
            stop_sequences: None,
        };

        let result = convert_claude_request_to_gemini(&claude_req, "gemini-pro");
        assert!(result.is_ok());

        let (gemini_req, _) = result.unwrap();
        assert!(gemini_req.system_instruction.is_some());
        let system = gemini_req.system_instruction.unwrap();
        assert!(system.parts[0].is_text());
        assert_eq!(
            system.parts[0].text.as_deref(),
            Some("You are a helpful assistant")
        );
    }

    #[test]
    fn test_convert_stream_request() {
        let claude_req = ClaudeRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: Some(1024),
            temperature: None,
            top_p: None,
            top_k: None,
            stream: Some(true),
            system: None,
            stop_sequences: None,
        };

        let result = convert_claude_request_to_gemini(&claude_req, "gemini-pro");
        assert!(result.is_ok());

        let (_, path) = result.unwrap();
        assert_eq!(path, "/v1beta/models/gemini-pro:streamGenerateContent");
    }
}
