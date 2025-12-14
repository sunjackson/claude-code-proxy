/**
 * OpenAI ↔ Claude 双向转换器
 *
 * 支持:
 * - OpenAI → Claude 请求转换 (用于 Codex/Cursor 访问 Claude API)
 * - Claude → OpenAI 响应转换 (返回 OpenAI 格式给客户端)
 * - Claude → OpenAI 请求转换 (用于 Claude Code 访问 OpenAI API)
 * - OpenAI → Claude 响应转换 (返回 Claude 格式给客户端)
 */

use super::claude_types::{
    ClaudeContent, ClaudeContentBlock, ClaudeMessage, ClaudeMessageRole, ClaudeRequest,
    ClaudeResponse, ClaudeStreamEvent, ClaudeUsage,
};
use super::openai_types::{
    OpenAIChoice, OpenAIDelta, OpenAIMessage, OpenAIMessageContent, OpenAIRequest,
    OpenAIResponse, OpenAIStreamChunk, OpenAIStreamChoice, OpenAIUsage,
};

// ════════════════════════════════════════════════════════════════════════════
// OpenAI → Claude 转换 (Codex/Cursor 访问 Claude API)
// ════════════════════════════════════════════════════════════════════════════

/// 将 OpenAI 请求转换为 Claude 请求
///
/// # Arguments
/// - `openai_req`: OpenAI Chat Completions 请求
///
/// # Returns
/// - `ClaudeRequest`: 转换后的 Claude Messages 请求
pub fn convert_openai_request_to_claude(openai_req: &OpenAIRequest) -> ClaudeRequest {
    let mut system_prompt: Option<String> = None;
    let mut claude_messages: Vec<ClaudeMessage> = Vec::new();

    for msg in &openai_req.messages {
        match msg.role.as_str() {
            "system" => {
                // OpenAI system 消息转换为 Claude system 参数
                let text = msg.content.as_text();
                if let Some(existing) = &system_prompt {
                    // 合并多个 system 消息
                    system_prompt = Some(format!("{}\n\n{}", existing, text));
                } else {
                    system_prompt = Some(text);
                }
            }
            "user" => {
                claude_messages.push(ClaudeMessage {
                    role: ClaudeMessageRole::User,
                    content: convert_openai_content_to_claude(&msg.content),
                });
            }
            "assistant" => {
                claude_messages.push(ClaudeMessage {
                    role: ClaudeMessageRole::Assistant,
                    content: convert_openai_content_to_claude(&msg.content),
                });
            }
            _ => {
                // 未知角色作为用户消息处理
                log::warn!("Unknown OpenAI role '{}', treating as user", msg.role);
                claude_messages.push(ClaudeMessage {
                    role: ClaudeMessageRole::User,
                    content: convert_openai_content_to_claude(&msg.content),
                });
            }
        }
    }

    // 确保消息列表不为空且以 user 开头
    if claude_messages.is_empty() {
        claude_messages.push(ClaudeMessage {
            role: ClaudeMessageRole::User,
            content: ClaudeContent::Text("Hello".to_string()),
        });
    }

    // Claude 要求消息必须以 user 角色开始
    if claude_messages.first().map(|m| &m.role) != Some(&ClaudeMessageRole::User) {
        claude_messages.insert(
            0,
            ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Continue".to_string()),
            },
        );
    }

    ClaudeRequest {
        model: openai_req.model.clone(),
        messages: claude_messages,
        max_tokens: openai_req.max_tokens,
        temperature: openai_req.temperature,
        top_p: openai_req.top_p,
        top_k: None,
        stream: openai_req.stream,
        system: system_prompt,
        stop_sequences: openai_req.stop.clone(),
    }
}

/// 将 OpenAI 消息内容转换为 Claude 内容
fn convert_openai_content_to_claude(content: &OpenAIMessageContent) -> ClaudeContent {
    match content {
        OpenAIMessageContent::Text(text) => ClaudeContent::Text(text.clone()),
        OpenAIMessageContent::Parts(parts) => {
            let blocks: Vec<ClaudeContentBlock> = parts
                .iter()
                .filter_map(|part| {
                    use super::openai_types::OpenAIContentPart;
                    match part {
                        OpenAIContentPart::Text { text } => {
                            Some(ClaudeContentBlock::Text { text: text.clone() })
                        }
                        OpenAIContentPart::ImageUrl { .. } => {
                            // TODO: 支持图片转换
                            log::warn!("Image content not yet supported in conversion");
                            None
                        }
                    }
                })
                .collect();

            if blocks.is_empty() {
                ClaudeContent::Text(String::new())
            } else if blocks.len() == 1 {
                if let ClaudeContentBlock::Text { text } = &blocks[0] {
                    ClaudeContent::Text(text.clone())
                } else {
                    ClaudeContent::Blocks(blocks)
                }
            } else {
                ClaudeContent::Blocks(blocks)
            }
        }
    }
}

/// 将 Claude 响应转换为 OpenAI 响应
///
/// # Arguments
/// - `claude_resp`: Claude Messages API 响应
/// - `original_model`: 原始请求中的模型名称
///
/// # Returns
/// - `OpenAIResponse`: 转换后的 OpenAI Chat Completions 响应
pub fn convert_claude_response_to_openai(
    claude_resp: &ClaudeResponse,
    original_model: &str,
) -> OpenAIResponse {
    // 提取文本内容
    let content_text = claude_resp
        .content
        .iter()
        .filter_map(|block| {
            if let ClaudeContentBlock::Text { text } = block {
                Some(text.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("");

    // 转换停止原因
    let finish_reason = match claude_resp.stop_reason.as_deref() {
        Some("end_turn") => Some("stop".to_string()),
        Some("max_tokens") => Some("length".to_string()),
        Some("stop_sequence") => Some("stop".to_string()),
        Some(other) => Some(other.to_string()),
        None => None,
    };

    OpenAIResponse {
        id: format!("chatcmpl-{}", claude_resp.id),
        object: "chat.completion".to_string(),
        created: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        model: original_model.to_string(),
        choices: vec![OpenAIChoice {
            index: 0,
            message: OpenAIMessage {
                role: "assistant".to_string(),
                content: OpenAIMessageContent::Text(content_text),
                name: None,
            },
            finish_reason,
            logprobs: None,
        }],
        usage: OpenAIUsage {
            prompt_tokens: claude_resp.usage.input_tokens.unwrap_or(0),
            completion_tokens: claude_resp.usage.output_tokens.unwrap_or(0),
            total_tokens: claude_resp.usage.input_tokens.unwrap_or(0)
                + claude_resp.usage.output_tokens.unwrap_or(0),
        },
        system_fingerprint: None,
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Claude → OpenAI 转换 (Claude Code 访问 OpenAI API)
// ════════════════════════════════════════════════════════════════════════════

/// 将 Claude 请求转换为 OpenAI 请求
///
/// # Arguments
/// - `claude_req`: Claude Messages API 请求
///
/// # Returns
/// - `OpenAIRequest`: 转换后的 OpenAI Chat Completions 请求
pub fn convert_claude_request_to_openai(claude_req: &ClaudeRequest) -> OpenAIRequest {
    let mut openai_messages: Vec<OpenAIMessage> = Vec::new();

    // 如果有 system prompt，添加为 system 消息
    if let Some(system) = &claude_req.system {
        openai_messages.push(OpenAIMessage {
            role: "system".to_string(),
            content: OpenAIMessageContent::Text(system.clone()),
            name: None,
        });
    }

    // 转换消息
    for msg in &claude_req.messages {
        let role = match msg.role {
            ClaudeMessageRole::User => "user".to_string(),
            ClaudeMessageRole::Assistant => "assistant".to_string(),
        };

        let content = convert_claude_content_to_openai(&msg.content);

        openai_messages.push(OpenAIMessage {
            role,
            content,
            name: None,
        });
    }

    OpenAIRequest {
        model: claude_req.model.clone(),
        messages: openai_messages,
        temperature: claude_req.temperature,
        max_tokens: claude_req.max_tokens,
        stream: claude_req.stream,
        top_p: claude_req.top_p,
        stop: claude_req.stop_sequences.clone(),
        frequency_penalty: None,
        presence_penalty: None,
        n: None,
        user: None,
        stream_options: None,
    }
}

/// 将 Claude 内容转换为 OpenAI 内容
fn convert_claude_content_to_openai(content: &ClaudeContent) -> OpenAIMessageContent {
    match content {
        ClaudeContent::Text(text) => OpenAIMessageContent::Text(text.clone()),
        ClaudeContent::Blocks(blocks) => {
            let text = blocks
                .iter()
                .filter_map(|block| {
                    if let ClaudeContentBlock::Text { text } = block {
                        Some(text.clone())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("");
            OpenAIMessageContent::Text(text)
        }
    }
}

/// 将 OpenAI 响应转换为 Claude 响应
///
/// # Arguments
/// - `openai_resp`: OpenAI Chat Completions 响应
/// - `original_model`: 原始请求中的模型名称
///
/// # Returns
/// - `ClaudeResponse`: 转换后的 Claude Messages 响应
pub fn convert_openai_response_to_claude(
    openai_resp: &OpenAIResponse,
    original_model: &str,
) -> ClaudeResponse {
    let first_choice = openai_resp.choices.first();

    // 提取内容
    let content_text = first_choice
        .map(|c| c.message.content.as_text())
        .unwrap_or_default();

    // 转换停止原因
    let stop_reason = first_choice.and_then(|c| {
        c.finish_reason.as_ref().map(|r| match r.as_str() {
            "stop" => "end_turn".to_string(),
            "length" => "max_tokens".to_string(),
            other => other.to_string(),
        })
    });

    ClaudeResponse {
        id: openai_resp.id.replace("chatcmpl-", "msg_"),
        response_type: "message".to_string(),
        role: ClaudeMessageRole::Assistant,
        content: vec![ClaudeContentBlock::Text { text: content_text }],
        model: original_model.to_string(),
        stop_reason,
        stop_sequence: None,
        usage: ClaudeUsage {
            input_tokens: Some(openai_resp.usage.prompt_tokens),
            output_tokens: Some(openai_resp.usage.completion_tokens),
        },
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 流式转换
// ════════════════════════════════════════════════════════════════════════════

/// 将 OpenAI 流式块转换为 Claude 流式事件
///
/// # Arguments
/// - `chunk`: OpenAI 流式响应块
/// - `is_first`: 是否为第一个块
/// - `original_model`: 原始请求中的模型名称
///
/// # Returns
/// - `Vec<String>`: Claude SSE 事件字符串列表
pub fn convert_openai_stream_to_claude(
    chunk: &OpenAIStreamChunk,
    is_first: bool,
    original_model: &str,
) -> Vec<String> {
    let mut events = Vec::new();

    // 首个块：发送 message_start 和 content_block_start
    if is_first {
        // message_start 事件
        let message_start = serde_json::json!({
            "type": "message_start",
            "message": {
                "id": chunk.id.replace("chatcmpl-", "msg_"),
                "type": "message",
                "role": "assistant",
                "content": [],
                "model": original_model,
                "stop_reason": null,
                "stop_sequence": null,
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": 0
                }
            }
        });
        events.push(format!("event: message_start\ndata: {}\n\n", message_start));

        // content_block_start 事件
        let block_start = serde_json::json!({
            "type": "content_block_start",
            "index": 0,
            "content_block": {
                "type": "text",
                "text": ""
            }
        });
        events.push(format!(
            "event: content_block_start\ndata: {}\n\n",
            block_start
        ));
    }

    // 处理增量内容
    if let Some(choice) = chunk.choices.first() {
        if let Some(content) = &choice.delta.content {
            if !content.is_empty() {
                let delta = serde_json::json!({
                    "type": "content_block_delta",
                    "index": 0,
                    "delta": {
                        "type": "text_delta",
                        "text": content
                    }
                });
                events.push(format!("event: content_block_delta\ndata: {}\n\n", delta));
            }
        }

        // 处理结束
        if choice.finish_reason.is_some() {
            // content_block_stop 事件
            let block_stop = serde_json::json!({
                "type": "content_block_stop",
                "index": 0
            });
            events.push(format!(
                "event: content_block_stop\ndata: {}\n\n",
                block_stop
            ));

            // message_delta 事件
            let stop_reason = match choice.finish_reason.as_deref() {
                Some("stop") => "end_turn",
                Some("length") => "max_tokens",
                _ => "end_turn",
            };

            let message_delta = serde_json::json!({
                "type": "message_delta",
                "delta": {
                    "stop_reason": stop_reason,
                    "stop_sequence": null
                },
                "usage": {
                    "output_tokens": chunk.usage.as_ref().map(|u| u.completion_tokens).unwrap_or(0)
                }
            });
            events.push(format!(
                "event: message_delta\ndata: {}\n\n",
                message_delta
            ));

            // message_stop 事件
            let message_stop = serde_json::json!({
                "type": "message_stop"
            });
            events.push(format!(
                "event: message_stop\ndata: {}\n\n",
                message_stop
            ));
        }
    }

    events
}

/// 将 Claude 流式事件转换为 OpenAI 流式块
///
/// # Arguments
/// - `event`: Claude 流式事件
/// - `original_model`: 原始请求中的模型名称
/// - `chunk_id`: 块 ID
///
/// # Returns
/// - `Option<String>`: OpenAI SSE 数据字符串 (如果需要发送)
pub fn convert_claude_stream_to_openai(
    event: &ClaudeStreamEvent,
    original_model: &str,
    chunk_id: &str,
) -> Option<String> {
    let created = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    match event {
        ClaudeStreamEvent::MessageStart { message } => {
            // 发送角色信息
            let chunk = OpenAIStreamChunk {
                id: format!("chatcmpl-{}", chunk_id),
                object: "chat.completion.chunk".to_string(),
                created,
                model: original_model.to_string(),
                choices: vec![OpenAIStreamChoice {
                    index: 0,
                    delta: OpenAIDelta {
                        role: Some("assistant".to_string()),
                        content: None,
                    },
                    finish_reason: None,
                    logprobs: None,
                }],
                usage: None,
                system_fingerprint: message.model.clone(),
            };
            Some(format!("data: {}\n\n", serde_json::to_string(&chunk).ok()?))
        }

        ClaudeStreamEvent::ContentBlockDelta { delta, .. } => {
            if let Some(text) = &delta.text {
                let chunk = OpenAIStreamChunk {
                    id: format!("chatcmpl-{}", chunk_id),
                    object: "chat.completion.chunk".to_string(),
                    created,
                    model: original_model.to_string(),
                    choices: vec![OpenAIStreamChoice {
                        index: 0,
                        delta: OpenAIDelta {
                            role: None,
                            content: Some(text.clone()),
                        },
                        finish_reason: None,
                        logprobs: None,
                    }],
                    usage: None,
                    system_fingerprint: None,
                };
                Some(format!("data: {}\n\n", serde_json::to_string(&chunk).ok()?))
            } else {
                None
            }
        }

        ClaudeStreamEvent::MessageDelta { delta, usage } => {
            let finish_reason = delta.stop_reason.as_ref().map(|r| match r.as_str() {
                "end_turn" => "stop".to_string(),
                "max_tokens" => "length".to_string(),
                other => other.to_string(),
            });

            let chunk = OpenAIStreamChunk {
                id: format!("chatcmpl-{}", chunk_id),
                object: "chat.completion.chunk".to_string(),
                created,
                model: original_model.to_string(),
                choices: vec![OpenAIStreamChoice {
                    index: 0,
                    delta: OpenAIDelta {
                        role: None,
                        content: None,
                    },
                    finish_reason,
                    logprobs: None,
                }],
                usage: usage.as_ref().map(|u| OpenAIUsage {
                    prompt_tokens: u.input_tokens.unwrap_or(0),
                    completion_tokens: u.output_tokens.unwrap_or(0),
                    total_tokens: u.input_tokens.unwrap_or(0) + u.output_tokens.unwrap_or(0),
                }),
                system_fingerprint: None,
            };
            Some(format!("data: {}\n\n", serde_json::to_string(&chunk).ok()?))
        }

        ClaudeStreamEvent::MessageStop => Some("data: [DONE]\n\n".to_string()),

        // 其他事件不需要转换
        _ => None,
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_openai_request_to_claude() {
        let openai_req = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![
                OpenAIMessage {
                    role: "system".to_string(),
                    content: OpenAIMessageContent::Text("You are helpful.".to_string()),
                    name: None,
                },
                OpenAIMessage {
                    role: "user".to_string(),
                    content: OpenAIMessageContent::Text("Hello".to_string()),
                    name: None,
                },
            ],
            temperature: Some(0.7),
            max_tokens: Some(1000),
            stream: Some(false),
            ..Default::default()
        };

        let claude_req = convert_openai_request_to_claude(&openai_req);

        assert_eq!(claude_req.model, "gpt-4");
        assert_eq!(claude_req.system, Some("You are helpful.".to_string()));
        assert_eq!(claude_req.messages.len(), 1);
        assert_eq!(claude_req.messages[0].role, ClaudeMessageRole::User);
        assert_eq!(claude_req.temperature, Some(0.7));
        assert_eq!(claude_req.max_tokens, Some(1000));
    }

    #[test]
    fn test_convert_claude_request_to_openai() {
        let claude_req = ClaudeRequest {
            model: "claude-3-opus-20240229".to_string(),
            messages: vec![ClaudeMessage {
                role: ClaudeMessageRole::User,
                content: ClaudeContent::Text("Hello".to_string()),
            }],
            max_tokens: Some(1000),
            temperature: Some(0.7),
            top_p: None,
            top_k: None,
            stream: Some(false),
            system: Some("You are helpful.".to_string()),
            stop_sequences: None,
        };

        let openai_req = convert_claude_request_to_openai(&claude_req);

        assert_eq!(openai_req.model, "claude-3-opus-20240229");
        assert_eq!(openai_req.messages.len(), 2);
        assert_eq!(openai_req.messages[0].role, "system");
        assert_eq!(openai_req.messages[1].role, "user");
        assert_eq!(openai_req.temperature, Some(0.7));
        assert_eq!(openai_req.max_tokens, Some(1000));
    }

    #[test]
    fn test_convert_claude_response_to_openai() {
        let claude_resp = ClaudeResponse {
            id: "msg_123".to_string(),
            response_type: "message".to_string(),
            role: ClaudeMessageRole::Assistant,
            content: vec![ClaudeContentBlock::Text {
                text: "Hello!".to_string(),
            }],
            model: "claude-3-opus-20240229".to_string(),
            stop_reason: Some("end_turn".to_string()),
            stop_sequence: None,
            usage: ClaudeUsage {
                input_tokens: Some(10),
                output_tokens: Some(5),
            },
        };

        let openai_resp = convert_claude_response_to_openai(&claude_resp, "gpt-4");

        assert!(openai_resp.id.starts_with("chatcmpl-"));
        assert_eq!(openai_resp.object, "chat.completion");
        assert_eq!(openai_resp.model, "gpt-4");
        assert_eq!(openai_resp.choices.len(), 1);
        assert_eq!(
            openai_resp.choices[0].message.content.as_text(),
            "Hello!"
        );
        assert_eq!(
            openai_resp.choices[0].finish_reason,
            Some("stop".to_string())
        );
        assert_eq!(openai_resp.usage.prompt_tokens, 10);
        assert_eq!(openai_resp.usage.completion_tokens, 5);
        assert_eq!(openai_resp.usage.total_tokens, 15);
    }

    #[test]
    fn test_convert_openai_response_to_claude() {
        let openai_resp = OpenAIResponse {
            id: "chatcmpl-123".to_string(),
            object: "chat.completion".to_string(),
            created: 1234567890,
            model: "gpt-4".to_string(),
            choices: vec![OpenAIChoice {
                index: 0,
                message: OpenAIMessage {
                    role: "assistant".to_string(),
                    content: OpenAIMessageContent::Text("Hello!".to_string()),
                    name: None,
                },
                finish_reason: Some("stop".to_string()),
                logprobs: None,
            }],
            usage: OpenAIUsage {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
            system_fingerprint: None,
        };

        let claude_resp = convert_openai_response_to_claude(&openai_resp, "claude-3-opus-20240229");

        assert_eq!(claude_resp.id, "msg_123");
        assert_eq!(claude_resp.response_type, "message");
        assert_eq!(claude_resp.role, ClaudeMessageRole::Assistant);
        assert_eq!(claude_resp.model, "claude-3-opus-20240229");
        assert_eq!(claude_resp.stop_reason, Some("end_turn".to_string()));
        assert_eq!(claude_resp.usage.input_tokens, Some(10));
        assert_eq!(claude_resp.usage.output_tokens, Some(5));
    }

    #[test]
    fn test_openai_system_message_merge() {
        let openai_req = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![
                OpenAIMessage {
                    role: "system".to_string(),
                    content: OpenAIMessageContent::Text("Rule 1".to_string()),
                    name: None,
                },
                OpenAIMessage {
                    role: "system".to_string(),
                    content: OpenAIMessageContent::Text("Rule 2".to_string()),
                    name: None,
                },
                OpenAIMessage {
                    role: "user".to_string(),
                    content: OpenAIMessageContent::Text("Hello".to_string()),
                    name: None,
                },
            ],
            ..Default::default()
        };

        let claude_req = convert_openai_request_to_claude(&openai_req);

        assert_eq!(claude_req.system, Some("Rule 1\n\nRule 2".to_string()));
    }

    #[test]
    fn test_stream_conversion_first_chunk() {
        let chunk = OpenAIStreamChunk {
            id: "chatcmpl-123".to_string(),
            object: "chat.completion.chunk".to_string(),
            created: 1234567890,
            model: "gpt-4".to_string(),
            choices: vec![OpenAIStreamChoice {
                index: 0,
                delta: OpenAIDelta {
                    role: Some("assistant".to_string()),
                    content: None,
                },
                finish_reason: None,
                logprobs: None,
            }],
            usage: None,
            system_fingerprint: None,
        };

        let events = convert_openai_stream_to_claude(&chunk, true, "claude-3-opus");

        assert!(events.len() >= 2);
        assert!(events[0].contains("message_start"));
        assert!(events[1].contains("content_block_start"));
    }
}
