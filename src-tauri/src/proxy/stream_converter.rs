/**
 * 生产级流式转换器
 *
 * 提供健壮的流式响应转换功能:
 * - OpenAI SSE → Claude SSE
 * - Claude SSE → OpenAI SSE
 * - 错误恢复和重试逻辑
 * - 超时处理
 * - 流完整性验证
 */

use hyper::body::Bytes;
use serde::{Deserialize, Serialize};
use std::time::Instant;

use crate::converters::claude_types::{
    ClaudeContentBlock, ClaudeContentDelta, ClaudeMessageDeltaContent, ClaudeMessageRole,
    ClaudeResponseMessage, ClaudeStreamEvent, ClaudeUsage,
};
use crate::converters::openai_types::{
    OpenAIDelta, OpenAIStreamChunk, OpenAIStreamChoice, OpenAIUsage,
};

// ════════════════════════════════════════════════════════════════════════════
// 流状态跟踪
// ════════════════════════════════════════════════════════════════════════════

/// 流转换状态
#[derive(Debug, Clone)]
pub struct StreamState {
    /// 流 ID
    pub stream_id: String,
    /// 是否已发送首个事件
    pub first_event_sent: bool,
    /// 当前内容块索引
    pub content_block_index: i32,
    /// 累计输入 tokens
    pub input_tokens: i32,
    /// 累计输出 tokens
    pub output_tokens: i32,
    /// 流开始时间
    pub start_time: Instant,
    /// 最后活动时间
    pub last_activity: Instant,
    /// 累计内容长度
    pub content_length: usize,
    /// 是否已完成
    pub completed: bool,
    /// 停止原因
    pub stop_reason: Option<String>,
}

impl StreamState {
    /// 创建新的流状态
    pub fn new(stream_id: &str) -> Self {
        let now = Instant::now();
        Self {
            stream_id: stream_id.to_string(),
            first_event_sent: false,
            content_block_index: 0,
            input_tokens: 0,
            output_tokens: 0,
            start_time: now,
            last_activity: now,
            content_length: 0,
            completed: false,
            stop_reason: None,
        }
    }

    /// 更新活动时间
    pub fn touch(&mut self) {
        self.last_activity = Instant::now();
    }

    /// 检查是否超时
    pub fn is_timed_out(&self, timeout_secs: u64) -> bool {
        self.last_activity.elapsed().as_secs() > timeout_secs
    }

    /// 获取流持续时间（毫秒）
    pub fn duration_ms(&self) -> u64 {
        self.start_time.elapsed().as_millis() as u64
    }

    /// 标记完成
    pub fn mark_completed(&mut self, reason: Option<String>) {
        self.completed = true;
        self.stop_reason = reason;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// OpenAI → Claude 流转换
// ════════════════════════════════════════════════════════════════════════════

/// OpenAI 到 Claude 的流转换器
pub struct OpenAIToClaudeStreamConverter {
    state: StreamState,
    model: String,
}

impl OpenAIToClaudeStreamConverter {
    /// 创建新的转换器
    pub fn new(model: &str) -> Self {
        Self {
            state: StreamState::new(&format!("msg_{}", uuid::Uuid::new_v4())),
            model: model.to_string(),
        }
    }

    /// 解析 OpenAI SSE 行
    pub fn parse_sse_line(line: &str) -> Option<OpenAIStreamChunk> {
        let line = line.trim();

        // 跳过空行和注释
        if line.is_empty() || line.starts_with(':') {
            return None;
        }

        // 检查 [DONE] 标记
        if line == "data: [DONE]" {
            return None;
        }

        // 解析 data: 前缀
        if let Some(json_str) = line.strip_prefix("data: ") {
            serde_json::from_str(json_str).ok()
        } else {
            None
        }
    }

    /// 转换单个 OpenAI 流块为 Claude SSE 事件
    pub fn convert_chunk(&mut self, chunk: &OpenAIStreamChunk) -> Vec<String> {
        let mut events = Vec::new();
        self.state.touch();

        // 首个块：发送 message_start 和 content_block_start
        if !self.state.first_event_sent {
            self.state.first_event_sent = true;

            // message_start 事件
            let message_start = serde_json::json!({
                "type": "message_start",
                "message": {
                    "id": self.state.stream_id,
                    "type": "message",
                    "role": "assistant",
                    "content": [],
                    "model": self.model,
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
            events.push(format!("event: content_block_start\ndata: {}\n\n", block_start));
        }

        // 处理选择项
        if let Some(choice) = chunk.choices.first() {
            // 处理增量内容
            if let Some(content) = &choice.delta.content {
                if !content.is_empty() {
                    self.state.content_length += content.len();
                    self.state.output_tokens += 1; // 简单估算

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
            if let Some(finish_reason) = &choice.finish_reason {
                let claude_reason = match finish_reason.as_str() {
                    "stop" => "end_turn",
                    "length" => "max_tokens",
                    "content_filter" => "end_turn",
                    _ => "end_turn",
                };

                self.state.mark_completed(Some(claude_reason.to_string()));

                // content_block_stop 事件
                let block_stop = serde_json::json!({
                    "type": "content_block_stop",
                    "index": 0
                });
                events.push(format!("event: content_block_stop\ndata: {}\n\n", block_stop));

                // message_delta 事件
                let output_tokens = chunk
                    .usage
                    .as_ref()
                    .map(|u| u.completion_tokens)
                    .unwrap_or(self.state.output_tokens);

                let message_delta = serde_json::json!({
                    "type": "message_delta",
                    "delta": {
                        "stop_reason": claude_reason,
                        "stop_sequence": null
                    },
                    "usage": {
                        "output_tokens": output_tokens
                    }
                });
                events.push(format!("event: message_delta\ndata: {}\n\n", message_delta));

                // message_stop 事件
                let message_stop = serde_json::json!({
                    "type": "message_stop"
                });
                events.push(format!("event: message_stop\ndata: {}\n\n", message_stop));
            }
        }

        events
    }

    /// 获取流状态
    pub fn state(&self) -> &StreamState {
        &self.state
    }

    /// 生成流结束事件（用于异常结束）
    pub fn generate_end_events(&mut self, error: Option<&str>) -> Vec<String> {
        let mut events = Vec::new();

        if !self.state.completed {
            self.state.mark_completed(Some("end_turn".to_string()));

            // 如果有错误，发送错误事件
            if let Some(err_msg) = error {
                let error_event = serde_json::json!({
                    "type": "error",
                    "error": {
                        "type": "api_error",
                        "message": err_msg
                    }
                });
                events.push(format!("event: error\ndata: {}\n\n", error_event));
            }

            // content_block_stop
            let block_stop = serde_json::json!({
                "type": "content_block_stop",
                "index": 0
            });
            events.push(format!("event: content_block_stop\ndata: {}\n\n", block_stop));

            // message_delta
            let message_delta = serde_json::json!({
                "type": "message_delta",
                "delta": {
                    "stop_reason": "end_turn",
                    "stop_sequence": null
                },
                "usage": {
                    "output_tokens": self.state.output_tokens
                }
            });
            events.push(format!("event: message_delta\ndata: {}\n\n", message_delta));

            // message_stop
            let message_stop = serde_json::json!({"type": "message_stop"});
            events.push(format!("event: message_stop\ndata: {}\n\n", message_stop));
        }

        events
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Claude → OpenAI 流转换
// ════════════════════════════════════════════════════════════════════════════

/// Claude 到 OpenAI 的流转换器
pub struct ClaudeToOpenAIStreamConverter {
    state: StreamState,
    model: String,
}

impl ClaudeToOpenAIStreamConverter {
    /// 创建新的转换器
    pub fn new(model: &str) -> Self {
        Self {
            state: StreamState::new(&format!("chatcmpl-{}", uuid::Uuid::new_v4())),
            model: model.to_string(),
        }
    }

    /// 解析 Claude SSE 行
    pub fn parse_sse_line(line: &str) -> Option<ClaudeStreamEvent> {
        let line = line.trim();

        // 跳过空行
        if line.is_empty() {
            return None;
        }

        // 解析 data: 前缀
        if let Some(json_str) = line.strip_prefix("data: ") {
            serde_json::from_str(json_str).ok()
        } else {
            None
        }
    }

    /// 转换 Claude 流事件为 OpenAI SSE 数据
    pub fn convert_event(&mut self, event: &ClaudeStreamEvent) -> Option<String> {
        self.state.touch();

        let created = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        match event {
            ClaudeStreamEvent::MessageStart { message } => {
                self.state.first_event_sent = true;

                // 发送角色信息
                let chunk = OpenAIStreamChunk {
                    id: self.state.stream_id.clone(),
                    object: "chat.completion.chunk".to_string(),
                    created,
                    model: self.model.clone(),
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
                    self.state.content_length += text.len();
                    self.state.output_tokens += 1;

                    let chunk = OpenAIStreamChunk {
                        id: self.state.stream_id.clone(),
                        object: "chat.completion.chunk".to_string(),
                        created,
                        model: self.model.clone(),
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
                    "stop_sequence" => "stop".to_string(),
                    other => other.to_string(),
                });

                if finish_reason.is_some() {
                    self.state.mark_completed(delta.stop_reason.clone());
                }

                let chunk = OpenAIStreamChunk {
                    id: self.state.stream_id.clone(),
                    object: "chat.completion.chunk".to_string(),
                    created,
                    model: self.model.clone(),
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

            ClaudeStreamEvent::MessageStop => {
                self.state.mark_completed(Some("end_turn".to_string()));
                Some("data: [DONE]\n\n".to_string())
            }

            // 其他事件不需要转换
            _ => None,
        }
    }

    /// 获取流状态
    pub fn state(&self) -> &StreamState {
        &self.state
    }

    /// 生成流结束事件
    pub fn generate_done(&mut self) -> String {
        self.state.mark_completed(Some("stop".to_string()));
        "data: [DONE]\n\n".to_string()
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 流完整性验证
// ════════════════════════════════════════════════════════════════════════════

/// 流完整性检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamIntegrityReport {
    /// 是否完整
    pub is_complete: bool,
    /// 流 ID
    pub stream_id: String,
    /// 持续时间（毫秒）
    pub duration_ms: u64,
    /// 内容长度
    pub content_length: usize,
    /// 输出 tokens 估算
    pub output_tokens: i32,
    /// 停止原因
    pub stop_reason: Option<String>,
    /// 错误消息（如果有）
    pub error: Option<String>,
}

impl StreamIntegrityReport {
    /// 从流状态生成报告
    pub fn from_state(state: &StreamState, error: Option<&str>) -> Self {
        Self {
            is_complete: state.completed && error.is_none(),
            stream_id: state.stream_id.clone(),
            duration_ms: state.duration_ms(),
            content_length: state.content_length,
            output_tokens: state.output_tokens,
            stop_reason: state.stop_reason.clone(),
            error: error.map(String::from),
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openai_to_claude_first_chunk() {
        let mut converter = OpenAIToClaudeStreamConverter::new("claude-3-opus");

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

        let events = converter.convert_chunk(&chunk);

        assert!(events.len() >= 2);
        assert!(events[0].contains("message_start"));
        assert!(events[1].contains("content_block_start"));
        assert!(converter.state().first_event_sent);
    }

    #[test]
    fn test_openai_to_claude_content_delta() {
        let mut converter = OpenAIToClaudeStreamConverter::new("claude-3-opus");

        // First chunk to initialize
        let init_chunk = OpenAIStreamChunk {
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
        converter.convert_chunk(&init_chunk);

        // Content chunk
        let content_chunk = OpenAIStreamChunk {
            id: "chatcmpl-123".to_string(),
            object: "chat.completion.chunk".to_string(),
            created: 1234567890,
            model: "gpt-4".to_string(),
            choices: vec![OpenAIStreamChoice {
                index: 0,
                delta: OpenAIDelta {
                    role: None,
                    content: Some("Hello".to_string()),
                },
                finish_reason: None,
                logprobs: None,
            }],
            usage: None,
            system_fingerprint: None,
        };

        let events = converter.convert_chunk(&content_chunk);

        assert_eq!(events.len(), 1);
        assert!(events[0].contains("content_block_delta"));
        assert!(events[0].contains("Hello"));
        assert_eq!(converter.state().content_length, 5);
    }

    #[test]
    fn test_claude_to_openai_content_delta() {
        let mut converter = ClaudeToOpenAIStreamConverter::new("gpt-4");

        let event = ClaudeStreamEvent::ContentBlockDelta {
            index: 0,
            delta: ClaudeContentDelta {
                delta_type: "text_delta".to_string(),
                text: Some("Hello".to_string()),
            },
        };

        let result = converter.convert_event(&event);

        assert!(result.is_some());
        let data = result.unwrap();
        assert!(data.contains("Hello"));
        assert!(data.starts_with("data: "));
    }

    #[test]
    fn test_stream_state_timeout() {
        let mut state = StreamState::new("test");

        assert!(!state.is_timed_out(60));

        // Simulate passage of time by checking immediately
        // In real tests, we'd use time manipulation
        state.touch();
        assert!(!state.is_timed_out(60));
    }

    #[test]
    fn test_stream_integrity_report() {
        let mut state = StreamState::new("test-stream");
        state.content_length = 1000;
        state.output_tokens = 50;
        state.mark_completed(Some("end_turn".to_string()));

        let report = StreamIntegrityReport::from_state(&state, None);

        assert!(report.is_complete);
        assert_eq!(report.stream_id, "test-stream");
        assert_eq!(report.content_length, 1000);
        assert_eq!(report.output_tokens, 50);
        assert_eq!(report.stop_reason, Some("end_turn".to_string()));
        assert!(report.error.is_none());
    }
}
