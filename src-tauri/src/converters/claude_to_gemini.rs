/**
 * Claude API 请求转换为 Gemini API 请求
 */

use super::claude_types::{ClaudeRequest, ClaudeContent, ClaudeContentBlock, ClaudeMessageRole};
use super::gemini_types::{GeminiRequest, GeminiContent, GeminiPart, GeminiGenerationConfig};
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

        let text = extract_text_from_content(&msg.content)?;

        contents.push(GeminiContent {
            role: Some(role.to_string()),
            parts: vec![GeminiPart {
                text: Some(text),
            }],
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
            parts: vec![GeminiPart {
                text: Some(system_text.clone()),
            }],
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

/// 从 Claude 内容中提取文本
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
        assert_eq!(
            gemini_req.contents[0].parts[0].text,
            Some("Hello".to_string())
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
        assert_eq!(
            system.parts[0].text,
            Some("You are a helpful assistant".to_string())
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
