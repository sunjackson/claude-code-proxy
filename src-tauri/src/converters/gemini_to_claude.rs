/**
 * Gemini API 响应转换为 Claude API 响应
 */

use super::claude_types::{ClaudeResponse, ClaudeContentBlock, ClaudeMessageRole, ClaudeUsage};
use super::gemini_types::GeminiResponse;
use crate::models::error::{AppError, AppResult};

/// 将 Gemini API 响应转换为 Claude API 响应
///
/// # 参数
/// - `gemini_resp`: Gemini API 响应
/// - `claude_model`: Claude 模型名称（用于填充响应）
///
/// # 返回
/// - `Ok(ClaudeResponse)`: Claude 响应
/// - `Err(AppError)`: 转换失败
pub fn convert_gemini_response_to_claude(
    gemini_resp: &GeminiResponse,
    claude_model: &str,
) -> AppResult<ClaudeResponse> {
    log::debug!("转换 Gemini 响应到 Claude 格式");

    // 获取第一个候选响应
    let candidate = gemini_resp.candidates.first().ok_or_else(|| {
        AppError::ConversionError {
            message: "Gemini 响应中没有候选结果".to_string(),
        }
    })?;

    // 提取文本内容
    let mut content_blocks = Vec::new();
    for part in &candidate.content.parts {
        if let Some(ref text) = part.text {
            content_blocks.push(ClaudeContentBlock::Text {
                text: text.clone(),
            });
        }
    }

    if content_blocks.is_empty() {
        return Err(AppError::ConversionError {
            message: "Gemini 响应中没有文本内容".to_string(),
        });
    }

    // 转换 finish_reason
    let stop_reason = candidate.finish_reason.as_ref().map(|reason| {
        match reason.as_str() {
            "STOP" => "end_turn",
            "MAX_TOKENS" => "max_tokens",
            "SAFETY" => "safety",
            "RECITATION" => "safety",
            "OTHER" => "stop_sequence",
            _ => "end_turn",
        }
        .to_string()
    });

    // 转换使用统计
    let usage = gemini_resp
        .usage_metadata
        .as_ref()
        .map(|meta| ClaudeUsage {
            input_tokens: meta.prompt_token_count,
            output_tokens: meta.candidates_token_count,
        })
        .unwrap_or(ClaudeUsage {
            input_tokens: Some(0),
            output_tokens: Some(0),
        });

    // 生成响应 ID（Gemini 不提供，需要生成）
    let id = format!("msg_gemini_{}", uuid::Uuid::new_v4());

    let claude_resp = ClaudeResponse {
        id,
        response_type: "message".to_string(),
        role: ClaudeMessageRole::Assistant,
        content: content_blocks,
        model: claude_model.to_string(),
        stop_reason,
        stop_sequence: None,
        usage,
    };

    log::debug!(
        "Gemini 响应已转换为 Claude 格式: id={}, content_blocks={}",
        claude_resp.id,
        claude_resp.content.len()
    );

    Ok(claude_resp)
}

/// 将 Gemini 流式响应块转换为 Claude SSE 格式事件
///
/// Gemini 流式响应是 JSON 流(每行一个 JSON 对象)
/// Claude 流式响应是 Server-Sent Events (SSE) 格式
///
/// # 参数
/// - `gemini_chunk`: Gemini 流式响应块 (JSON 字符串)
/// - `claude_model`: Claude 模型名称
/// - `is_first_chunk`: 是否为第一个块 (需要发送 message_start 事件)
///
/// # 返回
/// - `Ok(Vec<String>)`: Claude SSE 格式的事件列表
/// - `Err(AppError)`: 转换失败
pub fn convert_gemini_stream_chunk_to_claude_events(
    gemini_chunk: &str,
    claude_model: &str,
    is_first_chunk: bool,
) -> AppResult<Vec<String>> {
    // 解析 Gemini 流式响应
    let gemini_resp: GeminiResponse = serde_json::from_str(gemini_chunk).map_err(|e| {
        AppError::ConversionError {
            message: format!("解析 Gemini 流式响应失败: {}", e),
        }
    })?;

    let mut events = Vec::new();

    // 获取候选响应
    let candidate = gemini_resp.candidates.first().ok_or_else(|| {
        AppError::ConversionError {
            message: "Gemini 流式响应中没有候选结果".to_string(),
        }
    })?;

    // 提取文本内容
    let text_parts: Vec<String> = candidate
        .content
        .parts
        .iter()
        .filter_map(|p| p.text.as_ref())
        .cloned()
        .collect();

    // 第一个块: 发送 message_start 事件
    if is_first_chunk {
        let message_start = serde_json::json!({
            "type": "message_start",
            "message": {
                "id": format!("msg_gemini_{}", uuid::Uuid::new_v4()),
                "type": "message",
                "role": "assistant",
                "content": [],
                "model": claude_model,
                "stop_reason": null,
                "stop_sequence": null,
                "usage": {
                    "input_tokens": gemini_resp.usage_metadata.as_ref()
                        .and_then(|u| u.prompt_token_count)
                        .unwrap_or(0),
                    "output_tokens": 0
                }
            }
        });
        events.push(format!("event: message_start\ndata: {}\n\n", message_start));

        // 发送 content_block_start 事件
        let content_block_start = serde_json::json!({
            "type": "content_block_start",
            "index": 0,
            "content_block": {
                "type": "text",
                "text": ""
            }
        });
        events.push(format!("event: content_block_start\ndata: {}\n\n", content_block_start));
    }

    // 发送 content_block_delta 事件 (文本增量)
    for text in text_parts {
        let content_delta = serde_json::json!({
            "type": "content_block_delta",
            "index": 0,
            "delta": {
                "type": "text_delta",
                "text": text
            }
        });
        events.push(format!("event: content_block_delta\ndata: {}\n\n", content_delta));
    }

    // 检查是否是最后一个块 (有 finish_reason)
    if let Some(ref finish_reason) = candidate.finish_reason {
        // 发送 content_block_stop 事件
        let content_block_stop = serde_json::json!({
            "type": "content_block_stop",
            "index": 0
        });
        events.push(format!("event: content_block_stop\ndata: {}\n\n", content_block_stop));

        // 转换 finish_reason
        let claude_stop_reason = match finish_reason.as_str() {
            "STOP" => "end_turn",
            "MAX_TOKENS" => "max_tokens",
            "SAFETY" => "safety",
            "RECITATION" => "safety",
            "OTHER" => "stop_sequence",
            _ => "end_turn",
        };

        // 发送 message_delta 事件
        let message_delta = serde_json::json!({
            "type": "message_delta",
            "delta": {
                "stop_reason": claude_stop_reason,
                "stop_sequence": null
            },
            "usage": {
                "output_tokens": gemini_resp.usage_metadata.as_ref()
                    .and_then(|u| u.candidates_token_count)
                    .unwrap_or(0)
            }
        });
        events.push(format!("event: message_delta\ndata: {}\n\n", message_delta));

        // 发送 message_stop 事件
        let message_stop = serde_json::json!({
            "type": "message_stop"
        });
        events.push(format!("event: message_stop\ndata: {}\n\n", message_stop));
    }

    Ok(events)
}

/// 将 Gemini 流式响应块转换为 Claude 流式事件 (旧版本，保留兼容性)
///
/// Gemini 流式响应格式与 Claude 类似,但需要转换字段名称和格式
/// 注意: 推荐使用 convert_gemini_stream_chunk_to_claude_events
#[allow(dead_code)]
pub fn convert_gemini_stream_chunk_to_claude(
    gemini_chunk: &str,
    claude_model: &str,
) -> AppResult<String> {
    // 解析 Gemini 流式响应
    let gemini_resp: GeminiResponse = serde_json::from_str(gemini_chunk).map_err(|e| {
        AppError::ConversionError {
            message: format!("解析 Gemini 流式响应失败: {}", e),
        }
    })?;

    // 转换为 Claude 格式
    let claude_resp = convert_gemini_response_to_claude(&gemini_resp, claude_model)?;

    // 序列化为 JSON
    let claude_json = serde_json::to_string(&claude_resp).map_err(|e| {
        AppError::ConversionError {
            message: format!("序列化 Claude 响应失败: {}", e),
        }
    })?;

    Ok(claude_json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::converters::gemini_types::{GeminiCandidate, GeminiContent, GeminiPart, GeminiUsageMetadata};

    #[test]
    fn test_convert_simple_response() {
        let gemini_resp = GeminiResponse {
            candidates: vec![GeminiCandidate {
                content: GeminiContent {
                    role: Some("model".to_string()),
                    parts: vec![GeminiPart {
                        text: Some("Hello! How can I help you?".to_string()),
                    }],
                },
                finish_reason: Some("STOP".to_string()),
                index: Some(0),
                safety_ratings: None,
            }],
            usage_metadata: Some(GeminiUsageMetadata {
                prompt_token_count: Some(10),
                candidates_token_count: Some(15),
                total_token_count: Some(25),
            }),
            model_version: Some("gemini-pro".to_string()),
        };

        let result = convert_gemini_response_to_claude(&gemini_resp, "claude-sonnet-4-5-20250929");
        assert!(result.is_ok());

        let claude_resp = result.unwrap();
        assert_eq!(claude_resp.model, "claude-sonnet-4-5-20250929");
        assert_eq!(claude_resp.role, ClaudeMessageRole::Assistant);
        assert_eq!(claude_resp.content.len(), 1);

        match &claude_resp.content[0] {
            ClaudeContentBlock::Text { text } => {
                assert_eq!(text, "Hello! How can I help you?");
            }
        }

        assert_eq!(claude_resp.stop_reason, Some("end_turn".to_string()));
        assert_eq!(claude_resp.usage.input_tokens, Some(10));
        assert_eq!(claude_resp.usage.output_tokens, Some(15));
    }

    #[test]
    fn test_convert_max_tokens_finish_reason() {
        let gemini_resp = GeminiResponse {
            candidates: vec![GeminiCandidate {
                content: GeminiContent {
                    role: Some("model".to_string()),
                    parts: vec![GeminiPart {
                        text: Some("Response text".to_string()),
                    }],
                },
                finish_reason: Some("MAX_TOKENS".to_string()),
                index: Some(0),
                safety_ratings: None,
            }],
            usage_metadata: None,
            model_version: None,
        };

        let result = convert_gemini_response_to_claude(&gemini_resp, "claude-sonnet-4-5-20250929");
        assert!(result.is_ok());

        let claude_resp = result.unwrap();
        assert_eq!(claude_resp.stop_reason, Some("max_tokens".to_string()));
    }
}
