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
    ClaudeContent, ClaudeContentBlock, ClaudeImageSource, ClaudeMessage, ClaudeMessageRole,
    ClaudeRequest, ClaudeResponse, ClaudeStreamEvent, ClaudeToolResultContent, ClaudeUsage,
};
use super::openai_types::{
    OpenAIChoice, OpenAIContentPart, OpenAIDelta, OpenAIImageUrl, OpenAIMessage,
    OpenAIMessageContent, OpenAIRequest, OpenAIResponse, OpenAIStreamChunk, OpenAIStreamChoice,
    OpenAIToolCall, OpenAIUsage,
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
                let text = msg.content.as_ref().map(|c| c.as_text()).unwrap_or_default();
                if let Some(existing) = &system_prompt {
                    // 合并多个 system 消息
                    system_prompt = Some(format!("{}\n\n{}", existing, text));
                } else {
                    system_prompt = Some(text);
                }
            }
            "user" => {
                if let Some(content) = &msg.content {
                    claude_messages.push(ClaudeMessage {
                        role: ClaudeMessageRole::User,
                        content: convert_openai_content_to_claude(content),
                    });
                }
            }
            "assistant" => {
                // 处理 assistant 消息，可能包含 tool_calls
                if let Some(tool_calls) = &msg.tool_calls {
                    // 有工具调用，转换为 Claude tool_use 格式
                    let mut blocks: Vec<ClaudeContentBlock> = Vec::new();

                    // 如果有文本内容，先添加文本
                    if let Some(content) = &msg.content {
                        let text = content.as_text();
                        if !text.is_empty() {
                            blocks.push(ClaudeContentBlock::Text { text });
                        }
                    }

                    // 添加工具调用
                    for tool_call in tool_calls {
                        blocks.push(ClaudeContentBlock::ToolUse {
                            id: tool_call.id.clone(),
                            name: tool_call.function.name.clone(),
                            input: serde_json::from_str(&tool_call.function.arguments)
                                .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
                        });
                    }

                    claude_messages.push(ClaudeMessage {
                        role: ClaudeMessageRole::Assistant,
                        content: ClaudeContent::Blocks(blocks),
                    });
                } else if let Some(content) = &msg.content {
                    // 普通 assistant 消息
                    claude_messages.push(ClaudeMessage {
                        role: ClaudeMessageRole::Assistant,
                        content: convert_openai_content_to_claude(content),
                    });
                }
            }
            "tool" => {
                // 工具结果消息，转换为 Claude tool_result 格式
                if let Some(tool_call_id) = &msg.tool_call_id {
                    let content_text = msg.content.as_ref().map(|c| c.as_text()).unwrap_or_default();
                    claude_messages.push(ClaudeMessage {
                        role: ClaudeMessageRole::User, // tool_result 属于 user 消息
                        content: ClaudeContent::Blocks(vec![ClaudeContentBlock::ToolResult {
                            tool_use_id: tool_call_id.clone(),
                            content: Some(ClaudeToolResultContent::Text(content_text)),
                            is_error: None,
                        }]),
                    });
                }
            }
            _ => {
                // 未知角色作为用户消息处理
                log::warn!("Unknown OpenAI role '{}', treating as user", msg.role);
                if let Some(content) = &msg.content {
                    claude_messages.push(ClaudeMessage {
                        role: ClaudeMessageRole::User,
                        content: convert_openai_content_to_claude(content),
                    });
                }
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
                .filter_map(|part| match part {
                    OpenAIContentPart::Text { text } => {
                        Some(ClaudeContentBlock::Text { text: text.clone() })
                    }
                    OpenAIContentPart::ImageUrl { image_url } => {
                        // 将 OpenAI 图片 URL 转换为 Claude 图片格式
                        Some(convert_openai_image_to_claude(image_url))
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

/// 将 OpenAI 图片 URL 转换为 Claude 图片格式
fn convert_openai_image_to_claude(image_url: &OpenAIImageUrl) -> ClaudeContentBlock {
    let url = &image_url.url;

    // 检查是否为 data URL (base64 编码)
    if url.starts_with("data:") {
        // 格式: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...
        if let Some(comma_pos) = url.find(',') {
            let header = &url[5..comma_pos]; // 跳过 "data:"
            let data = &url[comma_pos + 1..];

            // 解析媒体类型
            let media_type = if let Some(semi_pos) = header.find(';') {
                &header[..semi_pos]
            } else {
                header
            };

            ClaudeContentBlock::Image {
                source: ClaudeImageSource::base64(media_type, data),
            }
        } else {
            // 无法解析的 data URL，作为普通 URL 处理
            log::warn!("Invalid data URL format, treating as regular URL");
            ClaudeContentBlock::Image {
                source: ClaudeImageSource::url("image/jpeg", url),
            }
        }
    } else {
        // 普通 URL
        // 尝试从 URL 推断媒体类型
        let media_type = infer_media_type_from_url(url);
        ClaudeContentBlock::Image {
            source: ClaudeImageSource::url(media_type, url),
        }
    }
}

/// 从 URL 推断媒体类型
fn infer_media_type_from_url(url: &str) -> &'static str {
    let url_lower = url.to_lowercase();
    if url_lower.contains(".png") {
        "image/png"
    } else if url_lower.contains(".gif") {
        "image/gif"
    } else if url_lower.contains(".webp") {
        "image/webp"
    } else {
        // 默认为 JPEG
        "image/jpeg"
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
    // 提取文本内容和工具调用
    let mut content_texts: Vec<String> = Vec::new();
    let mut tool_calls: Vec<OpenAIToolCall> = Vec::new();

    for block in &claude_resp.content {
        match block {
            ClaudeContentBlock::Text { text } => {
                content_texts.push(text.clone());
            }
            ClaudeContentBlock::ToolUse { id, name, input } => {
                tool_calls.push(OpenAIToolCall::new(
                    id,
                    name,
                    &serde_json::to_string(input).unwrap_or_default(),
                ));
            }
            _ => {}
        }
    }

    let content_text = content_texts.join("");

    // 转换停止原因
    let finish_reason = match claude_resp.stop_reason.as_deref() {
        Some("end_turn") => Some("stop".to_string()),
        Some("max_tokens") => Some("length".to_string()),
        Some("stop_sequence") => Some("stop".to_string()),
        Some("tool_use") => Some("tool_calls".to_string()),
        Some(other) => Some(other.to_string()),
        None => None,
    };

    // 构建消息
    let message = if tool_calls.is_empty() {
        OpenAIMessage {
            role: "assistant".to_string(),
            content: Some(OpenAIMessageContent::Text(content_text)),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }
    } else {
        OpenAIMessage {
            role: "assistant".to_string(),
            content: if content_text.is_empty() {
                None
            } else {
                Some(OpenAIMessageContent::Text(content_text))
            },
            name: None,
            tool_calls: Some(tool_calls),
            tool_call_id: None,
        }
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
            message,
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
            content: Some(OpenAIMessageContent::Text(system.clone())),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        });
    }

    // 转换消息
    for msg in &claude_req.messages {
        // 检查消息内容中是否有工具调用或工具结果
        match &msg.content {
            ClaudeContent::Blocks(blocks) => {
                // 分析块内容
                let mut text_blocks: Vec<String> = Vec::new();
                let mut tool_use_blocks: Vec<&ClaudeContentBlock> = Vec::new();
                let mut tool_result_blocks: Vec<&ClaudeContentBlock> = Vec::new();

                for block in blocks {
                    match block {
                        ClaudeContentBlock::Text { text } => text_blocks.push(text.clone()),
                        ClaudeContentBlock::ToolUse { .. } => tool_use_blocks.push(block),
                        ClaudeContentBlock::ToolResult { .. } => tool_result_blocks.push(block),
                        ClaudeContentBlock::Image { .. } => {} // 图片在其他地方处理
                    }
                }

                // 如果有工具调用（来自 assistant）
                if !tool_use_blocks.is_empty() && msg.role == ClaudeMessageRole::Assistant {
                    let tool_calls: Vec<OpenAIToolCall> = tool_use_blocks
                        .iter()
                        .filter_map(|block| {
                            if let ClaudeContentBlock::ToolUse { id, name, input } = block {
                                Some(OpenAIToolCall::new(
                                    id,
                                    name,
                                    &serde_json::to_string(input).unwrap_or_default(),
                                ))
                            } else {
                                None
                            }
                        })
                        .collect();

                    let content = if text_blocks.is_empty() {
                        None
                    } else {
                        Some(OpenAIMessageContent::Text(text_blocks.join("")))
                    };

                    openai_messages.push(OpenAIMessage {
                        role: "assistant".to_string(),
                        content,
                        name: None,
                        tool_calls: Some(tool_calls),
                        tool_call_id: None,
                    });
                }
                // 如果有工具结果（来自 user）
                else if !tool_result_blocks.is_empty() {
                    for block in tool_result_blocks {
                        if let ClaudeContentBlock::ToolResult {
                            tool_use_id,
                            content,
                            ..
                        } = block
                        {
                            let result_text = match content {
                                Some(ClaudeToolResultContent::Text(text)) => text.clone(),
                                Some(ClaudeToolResultContent::Blocks(blocks)) => {
                                    // 提取嵌套块中的文本
                                    blocks
                                        .iter()
                                        .filter_map(|b| {
                                            if let ClaudeContentBlock::Text { text } = b {
                                                Some(text.clone())
                                            } else {
                                                None
                                            }
                                        })
                                        .collect::<Vec<_>>()
                                        .join("")
                                }
                                None => String::new(),
                            };

                            openai_messages.push(OpenAIMessage {
                                role: "tool".to_string(),
                                content: Some(OpenAIMessageContent::Text(result_text)),
                                name: None,
                                tool_calls: None,
                                tool_call_id: Some(tool_use_id.clone()),
                            });
                        }
                    }
                }
                // 普通消息
                else {
                    let role = match msg.role {
                        ClaudeMessageRole::User => "user".to_string(),
                        ClaudeMessageRole::Assistant => "assistant".to_string(),
                    };

                    openai_messages.push(OpenAIMessage {
                        role,
                        content: Some(convert_claude_content_to_openai(&msg.content)),
                        name: None,
                        tool_calls: None,
                        tool_call_id: None,
                    });
                }
            }
            ClaudeContent::Text(_) => {
                // 简单文本消息
                let role = match msg.role {
                    ClaudeMessageRole::User => "user".to_string(),
                    ClaudeMessageRole::Assistant => "assistant".to_string(),
                };

                openai_messages.push(OpenAIMessage {
                    role,
                    content: Some(convert_claude_content_to_openai(&msg.content)),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                });
            }
        }
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
            // 检查是否有图片内容
            let has_image = blocks.iter().any(|block| {
                matches!(block, ClaudeContentBlock::Image { .. })
            });

            if has_image {
                // 有图片内容，转换为 Parts 格式
                let parts: Vec<OpenAIContentPart> = blocks
                    .iter()
                    .filter_map(|block| match block {
                        ClaudeContentBlock::Text { text } => {
                            Some(OpenAIContentPart::Text { text: text.clone() })
                        }
                        ClaudeContentBlock::Image { source } => {
                            Some(convert_claude_image_to_openai(source))
                        }
                        // 工具块在消息级别处理，这里跳过
                        ClaudeContentBlock::ToolUse { .. } => None,
                        ClaudeContentBlock::ToolResult { .. } => None,
                    })
                    .collect();
                OpenAIMessageContent::Parts(parts)
            } else {
                // 只有文本内容（忽略工具块），合并为单个文本
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
}

/// 将 Claude 图片转换为 OpenAI 图片格式
fn convert_claude_image_to_openai(source: &ClaudeImageSource) -> OpenAIContentPart {
    let url = if source.is_base64() {
        // 转换为 data URL 格式
        format!("data:{};base64,{}", source.media_type, source.data)
    } else {
        // 直接使用 URL
        source.data.clone()
    };

    OpenAIContentPart::ImageUrl {
        image_url: OpenAIImageUrl {
            url,
            detail: Some("auto".to_string()),
        },
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
    let mut content_blocks: Vec<ClaudeContentBlock> = Vec::new();

    if let Some(choice) = first_choice {
        // 提取文本内容
        let content_text = choice.message.content_text();
        if !content_text.is_empty() {
            content_blocks.push(ClaudeContentBlock::Text { text: content_text });
        }

        // 提取工具调用
        if let Some(tool_calls) = &choice.message.tool_calls {
            for tool_call in tool_calls {
                content_blocks.push(ClaudeContentBlock::ToolUse {
                    id: tool_call.id.clone(),
                    name: tool_call.function.name.clone(),
                    input: serde_json::from_str(&tool_call.function.arguments)
                        .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
                });
            }
        }
    }

    // 确保至少有一个内容块
    if content_blocks.is_empty() {
        content_blocks.push(ClaudeContentBlock::Text {
            text: String::new(),
        });
    }

    // 转换停止原因
    let stop_reason = first_choice.and_then(|c| {
        c.finish_reason.as_ref().map(|r| match r.as_str() {
            "stop" => "end_turn".to_string(),
            "length" => "max_tokens".to_string(),
            "tool_calls" => "tool_use".to_string(),
            other => other.to_string(),
        })
    });

    ClaudeResponse {
        id: openai_resp.id.replace("chatcmpl-", "msg_"),
        response_type: "message".to_string(),
        role: ClaudeMessageRole::Assistant,
        content: content_blocks,
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
                    content: Some(OpenAIMessageContent::Text("You are helpful.".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                },
                OpenAIMessage {
                    role: "user".to_string(),
                    content: Some(OpenAIMessageContent::Text("Hello".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
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
            openai_resp.choices[0].message.content_text(),
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
                    content: Some(OpenAIMessageContent::Text("Hello!".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
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
                    content: Some(OpenAIMessageContent::Text("Rule 1".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                },
                OpenAIMessage {
                    role: "system".to_string(),
                    content: Some(OpenAIMessageContent::Text("Rule 2".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                },
                OpenAIMessage {
                    role: "user".to_string(),
                    content: Some(OpenAIMessageContent::Text("Hello".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
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

    #[test]
    fn test_openai_tool_calls_to_claude_tool_use() {
        let openai_req = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![
                OpenAIMessage {
                    role: "user".to_string(),
                    content: Some(OpenAIMessageContent::Text("What's the weather?".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                },
                OpenAIMessage {
                    role: "assistant".to_string(),
                    content: None,
                    name: None,
                    tool_calls: Some(vec![OpenAIToolCall::new(
                        "call_123",
                        "get_weather",
                        r#"{"location": "Tokyo"}"#,
                    )]),
                    tool_call_id: None,
                },
                OpenAIMessage {
                    role: "tool".to_string(),
                    content: Some(OpenAIMessageContent::Text("Sunny, 25°C".to_string())),
                    name: None,
                    tool_calls: None,
                    tool_call_id: Some("call_123".to_string()),
                },
            ],
            ..Default::default()
        };

        let claude_req = convert_openai_request_to_claude(&openai_req);

        // 应有 3 条消息：user, assistant (with tool_use), user (with tool_result)
        assert_eq!(claude_req.messages.len(), 3);

        // 第一条是用户消息
        assert_eq!(claude_req.messages[0].role, ClaudeMessageRole::User);

        // 第二条是助手消息带工具调用
        assert_eq!(claude_req.messages[1].role, ClaudeMessageRole::Assistant);
        if let ClaudeContent::Blocks(blocks) = &claude_req.messages[1].content {
            assert!(blocks.iter().any(|b| matches!(b, ClaudeContentBlock::ToolUse { name, .. } if name == "get_weather")));
        } else {
            panic!("Expected blocks content for assistant message with tool use");
        }

        // 第三条是用户消息带工具结果
        assert_eq!(claude_req.messages[2].role, ClaudeMessageRole::User);
        if let ClaudeContent::Blocks(blocks) = &claude_req.messages[2].content {
            assert!(blocks.iter().any(|b| matches!(b, ClaudeContentBlock::ToolResult { tool_use_id, .. } if tool_use_id == "call_123")));
        } else {
            panic!("Expected blocks content for user message with tool result");
        }
    }

    #[test]
    fn test_claude_tool_use_to_openai_tool_calls() {
        let claude_req = ClaudeRequest {
            model: "claude-3-opus-20240229".to_string(),
            messages: vec![
                ClaudeMessage {
                    role: ClaudeMessageRole::User,
                    content: ClaudeContent::Text("What's the weather?".to_string()),
                },
                ClaudeMessage {
                    role: ClaudeMessageRole::Assistant,
                    content: ClaudeContent::Blocks(vec![ClaudeContentBlock::ToolUse {
                        id: "toolu_123".to_string(),
                        name: "get_weather".to_string(),
                        input: serde_json::json!({"location": "Tokyo"}),
                    }]),
                },
                ClaudeMessage {
                    role: ClaudeMessageRole::User,
                    content: ClaudeContent::Blocks(vec![ClaudeContentBlock::ToolResult {
                        tool_use_id: "toolu_123".to_string(),
                        content: Some(ClaudeToolResultContent::Text("Sunny, 25°C".to_string())),
                        is_error: None,
                    }]),
                },
            ],
            max_tokens: Some(1000),
            temperature: None,
            top_p: None,
            top_k: None,
            stream: None,
            system: None,
            stop_sequences: None,
        };

        let openai_req = convert_claude_request_to_openai(&claude_req);

        // 应有 3 条消息：user, assistant (with tool_calls), tool
        assert_eq!(openai_req.messages.len(), 3);

        // 第一条是用户消息
        assert_eq!(openai_req.messages[0].role, "user");

        // 第二条是助手消息带工具调用
        assert_eq!(openai_req.messages[1].role, "assistant");
        assert!(openai_req.messages[1].tool_calls.is_some());
        let tool_calls = openai_req.messages[1].tool_calls.as_ref().unwrap();
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].function.name, "get_weather");

        // 第三条是工具结果
        assert_eq!(openai_req.messages[2].role, "tool");
        assert_eq!(openai_req.messages[2].tool_call_id, Some("toolu_123".to_string()));
    }
}
