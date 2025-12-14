/**
 * 结构化日志模块
 *
 * 为 OpenAI ↔ Claude 双向转换提供详细的结构化日志记录:
 * - 协议检测日志
 * - 转换追踪日志
 * - 请求/响应生命周期日志
 * - 性能指标收集
 */

use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use super::protocol_detector::RequestFormat;

// ════════════════════════════════════════════════════════════════════════════
// 请求 ID 生成
// ════════════════════════════════════════════════════════════════════════════

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(0);

/// 生成唯一请求 ID
pub fn generate_request_id() -> String {
    let counter = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
    let timestamp = Local::now().format("%Y%m%d%H%M%S");
    format!("req-{}-{:06}", timestamp, counter % 1000000)
}

// ════════════════════════════════════════════════════════════════════════════
// 日志事件类型
// ════════════════════════════════════════════════════════════════════════════

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl From<LogLevel> for log::Level {
    fn from(level: LogLevel) -> Self {
        match level {
            LogLevel::Trace => log::Level::Trace,
            LogLevel::Debug => log::Level::Debug,
            LogLevel::Info => log::Level::Info,
            LogLevel::Warn => log::Level::Warn,
            LogLevel::Error => log::Level::Error,
        }
    }
}

/// 日志事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogEventType {
    /// 请求接收
    RequestReceived,
    /// 协议检测
    ProtocolDetected,
    /// 请求转换开始
    ConversionStarted,
    /// 请求转换完成
    ConversionCompleted,
    /// 上游请求发送
    UpstreamRequestSent,
    /// 上游响应接收
    UpstreamResponseReceived,
    /// 响应转换开始
    ResponseConversionStarted,
    /// 响应转换完成
    ResponseConversionCompleted,
    /// 流式块处理
    StreamChunkProcessed,
    /// 请求完成
    RequestCompleted,
    /// 错误发生
    ErrorOccurred,
    /// 性能指标
    PerformanceMetric,
}

// ════════════════════════════════════════════════════════════════════════════
// 结构化日志条目
// ════════════════════════════════════════════════════════════════════════════

/// 结构化日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredLogEntry {
    /// 时间戳
    pub timestamp: DateTime<Local>,
    /// 日志级别
    pub level: LogLevel,
    /// 事件类型
    pub event_type: LogEventType,
    /// 请求 ID
    pub request_id: String,
    /// 消息
    pub message: String,
    /// 额外字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<LogFields>,
    /// 耗时 (毫秒)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

/// 日志附加字段
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LogFields {
    /// 客户端请求格式
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_format: Option<String>,
    /// 目标提供商格式
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_format: Option<String>,
    /// 模型名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// 转换后的模型名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub converted_model: Option<String>,
    /// 是否流式
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_streaming: Option<bool>,
    /// HTTP 状态码
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
    /// 请求大小 (字节)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_size: Option<u64>,
    /// 响应大小 (字节)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_size: Option<u64>,
    /// 流式块数量
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunk_count: Option<u32>,
    /// 输入 token 数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i32>,
    /// 输出 token 数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i32>,
    /// 错误类型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_type: Option<String>,
    /// 错误消息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    /// 配置 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_id: Option<i64>,
    /// 配置名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_name: Option<String>,
    /// 远程地址
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_addr: Option<String>,
    /// 目标 URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_url: Option<String>,
}

impl StructuredLogEntry {
    /// 创建新的日志条目
    pub fn new(
        level: LogLevel,
        event_type: LogEventType,
        request_id: &str,
        message: &str,
    ) -> Self {
        Self {
            timestamp: Local::now(),
            level,
            event_type,
            request_id: request_id.to_string(),
            message: message.to_string(),
            fields: None,
            duration_ms: None,
        }
    }

    /// 添加字段
    pub fn with_fields(mut self, fields: LogFields) -> Self {
        self.fields = Some(fields);
        self
    }

    /// 添加耗时
    pub fn with_duration(mut self, duration: Duration) -> Self {
        self.duration_ms = Some(duration.as_millis() as u64);
        self
    }

    /// 格式化为 JSON
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| format!("{:?}", self))
    }

    /// 格式化为单行文本
    pub fn to_oneline(&self) -> String {
        let duration = self
            .duration_ms
            .map(|d| format!(" {}ms", d))
            .unwrap_or_default();

        let fields_str = self
            .fields
            .as_ref()
            .map(|f| {
                let mut parts = Vec::new();
                if let Some(ref cf) = f.client_format {
                    parts.push(format!("client={}", cf));
                }
                if let Some(ref tf) = f.target_format {
                    parts.push(format!("target={}", tf));
                }
                if let Some(ref m) = f.model {
                    parts.push(format!("model={}", m));
                }
                if let Some(sc) = f.status_code {
                    parts.push(format!("status={}", sc));
                }
                if let Some(ref e) = f.error_type {
                    parts.push(format!("error={}", e));
                }
                if parts.is_empty() {
                    String::new()
                } else {
                    format!(" [{}]", parts.join(" "))
                }
            })
            .unwrap_or_default();

        format!(
            "{} {:?} {} {}{}{}",
            self.timestamp.format("%Y-%m-%dT%H:%M:%S%.3fZ"),
            self.event_type,
            self.request_id,
            self.message,
            duration,
            fields_str
        )
    }

    /// 输出日志
    pub fn emit(&self) {
        let level: log::Level = self.level.into();
        log::log!(level, "{}", self.to_oneline());
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 请求追踪器
// ════════════════════════════════════════════════════════════════════════════

/// 请求追踪器 - 跟踪单个请求的完整生命周期
pub struct RequestTracer {
    /// 请求 ID
    request_id: String,
    /// 开始时间
    start_time: Instant,
    /// 最后事件时间
    last_event_time: Instant,
    /// 客户端格式
    client_format: Option<RequestFormat>,
    /// 目标格式
    target_format: Option<RequestFormat>,
    /// 模型名称
    model: Option<String>,
    /// 是否流式
    is_streaming: bool,
    /// 流式块计数
    chunk_count: u32,
    /// 配置信息
    config_id: Option<i64>,
    config_name: Option<String>,
    /// 远程地址
    remote_addr: Option<String>,
    /// 目标 URL
    target_url: Option<String>,
}

impl RequestTracer {
    /// 创建新的请求追踪器
    pub fn new() -> Self {
        Self {
            request_id: generate_request_id(),
            start_time: Instant::now(),
            last_event_time: Instant::now(),
            client_format: None,
            target_format: None,
            model: None,
            is_streaming: false,
            chunk_count: 0,
            config_id: None,
            config_name: None,
            remote_addr: None,
            target_url: None,
        }
    }

    /// 使用指定 ID 创建追踪器
    pub fn with_id(request_id: String) -> Self {
        Self {
            request_id,
            start_time: Instant::now(),
            last_event_time: Instant::now(),
            client_format: None,
            target_format: None,
            model: None,
            is_streaming: false,
            chunk_count: 0,
            config_id: None,
            config_name: None,
            remote_addr: None,
            target_url: None,
        }
    }

    /// 获取请求 ID
    pub fn request_id(&self) -> &str {
        &self.request_id
    }

    /// 获取总耗时
    pub fn elapsed(&self) -> Duration {
        self.start_time.elapsed()
    }

    /// 获取自上次事件的耗时
    pub fn since_last_event(&self) -> Duration {
        self.last_event_time.elapsed()
    }

    /// 设置客户端格式
    pub fn set_client_format(&mut self, format: RequestFormat) {
        self.client_format = Some(format);
    }

    /// 设置目标格式
    pub fn set_target_format(&mut self, format: RequestFormat) {
        self.target_format = Some(format);
    }

    /// 设置模型
    pub fn set_model(&mut self, model: &str) {
        self.model = Some(model.to_string());
    }

    /// 设置流式模式
    pub fn set_streaming(&mut self, streaming: bool) {
        self.is_streaming = streaming;
    }

    /// 增加块计数
    pub fn increment_chunk_count(&mut self) {
        self.chunk_count += 1;
    }

    /// 设置配置信息
    pub fn set_config(&mut self, id: i64, name: &str) {
        self.config_id = Some(id);
        self.config_name = Some(name.to_string());
    }

    /// 设置远程地址
    pub fn set_remote_addr(&mut self, addr: &str) {
        self.remote_addr = Some(addr.to_string());
    }

    /// 设置目标 URL
    pub fn set_target_url(&mut self, url: &str) {
        self.target_url = Some(url.to_string());
    }

    /// 生成基础日志字段
    fn base_fields(&self) -> LogFields {
        LogFields {
            client_format: self.client_format.as_ref().map(|f| format!("{:?}", f)),
            target_format: self.target_format.as_ref().map(|f| format!("{:?}", f)),
            model: self.model.clone(),
            converted_model: None,
            is_streaming: Some(self.is_streaming),
            status_code: None,
            request_size: None,
            response_size: None,
            chunk_count: if self.is_streaming {
                Some(self.chunk_count)
            } else {
                None
            },
            input_tokens: None,
            output_tokens: None,
            error_type: None,
            error_message: None,
            config_id: self.config_id,
            config_name: self.config_name.clone(),
            remote_addr: self.remote_addr.clone(),
            target_url: self.target_url.clone(),
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 日志事件方法
    // ════════════════════════════════════════════════════════════════════════

    /// 记录请求接收
    pub fn log_request_received(&mut self, method: &str, uri: &str) {
        self.last_event_time = Instant::now();

        let entry = StructuredLogEntry::new(
            LogLevel::Info,
            LogEventType::RequestReceived,
            &self.request_id,
            &format!("{} {}", method, uri),
        )
        .with_fields(self.base_fields());

        entry.emit();
    }

    /// 记录协议检测
    pub fn log_protocol_detected(&mut self, format: RequestFormat) {
        self.client_format = Some(format);
        let duration = self.since_last_event();
        self.last_event_time = Instant::now();

        let entry = StructuredLogEntry::new(
            LogLevel::Debug,
            LogEventType::ProtocolDetected,
            &self.request_id,
            &format!("Detected format: {:?}", format),
        )
        .with_fields(self.base_fields())
        .with_duration(duration);

        entry.emit();
    }

    /// 记录转换开始
    pub fn log_conversion_started(&mut self, from: RequestFormat, to: RequestFormat) {
        self.last_event_time = Instant::now();

        let mut fields = self.base_fields();
        fields.client_format = Some(format!("{:?}", from));
        fields.target_format = Some(format!("{:?}", to));

        let entry = StructuredLogEntry::new(
            LogLevel::Debug,
            LogEventType::ConversionStarted,
            &self.request_id,
            &format!("Converting {:?} → {:?}", from, to),
        )
        .with_fields(fields);

        entry.emit();
    }

    /// 记录转换完成
    pub fn log_conversion_completed(&mut self, original_model: &str, converted_model: &str) {
        let duration = self.since_last_event();
        self.last_event_time = Instant::now();

        let mut fields = self.base_fields();
        fields.model = Some(original_model.to_string());
        fields.converted_model = Some(converted_model.to_string());

        let entry = StructuredLogEntry::new(
            LogLevel::Debug,
            LogEventType::ConversionCompleted,
            &self.request_id,
            &format!("Model: {} → {}", original_model, converted_model),
        )
        .with_fields(fields)
        .with_duration(duration);

        entry.emit();
    }

    /// 记录上游请求发送
    pub fn log_upstream_request(&mut self, target_url: &str, request_size: u64) {
        self.target_url = Some(target_url.to_string());
        self.last_event_time = Instant::now();

        let mut fields = self.base_fields();
        fields.request_size = Some(request_size);

        let entry = StructuredLogEntry::new(
            LogLevel::Debug,
            LogEventType::UpstreamRequestSent,
            &self.request_id,
            &format!("Sending to {}", target_url),
        )
        .with_fields(fields);

        entry.emit();
    }

    /// 记录上游响应接收
    pub fn log_upstream_response(&mut self, status_code: u16, response_size: u64) {
        let duration = self.since_last_event();
        self.last_event_time = Instant::now();

        let mut fields = self.base_fields();
        fields.status_code = Some(status_code);
        fields.response_size = Some(response_size);

        let entry = StructuredLogEntry::new(
            LogLevel::Debug,
            LogEventType::UpstreamResponseReceived,
            &self.request_id,
            &format!("Received status {}", status_code),
        )
        .with_fields(fields)
        .with_duration(duration);

        entry.emit();
    }

    /// 记录流式块处理
    pub fn log_stream_chunk(&mut self, chunk_index: u32, chunk_size: usize) {
        self.chunk_count = chunk_index + 1;

        // 只在关键块记录 (第一块、每10块、或大块)
        if chunk_index == 0 || chunk_index % 10 == 0 || chunk_size > 1000 {
            let mut fields = self.base_fields();
            fields.chunk_count = Some(chunk_index + 1);

            let entry = StructuredLogEntry::new(
                LogLevel::Trace,
                LogEventType::StreamChunkProcessed,
                &self.request_id,
                &format!("Chunk #{} ({} bytes)", chunk_index, chunk_size),
            )
            .with_fields(fields);

            entry.emit();
        }
    }

    /// 记录请求完成
    pub fn log_request_completed(
        &mut self,
        status_code: u16,
        input_tokens: Option<i32>,
        output_tokens: Option<i32>,
    ) {
        let total_duration = self.elapsed();

        let mut fields = self.base_fields();
        fields.status_code = Some(status_code);
        fields.input_tokens = input_tokens;
        fields.output_tokens = output_tokens;

        let level = if status_code >= 500 {
            LogLevel::Error
        } else if status_code >= 400 {
            LogLevel::Warn
        } else {
            LogLevel::Info
        };

        let tokens_info = match (input_tokens, output_tokens) {
            (Some(i), Some(o)) => format!(" (tokens: {}→{})", i, o),
            _ => String::new(),
        };

        let entry = StructuredLogEntry::new(
            level,
            LogEventType::RequestCompleted,
            &self.request_id,
            &format!("Completed with status {}{}", status_code, tokens_info),
        )
        .with_fields(fields)
        .with_duration(total_duration);

        entry.emit();
    }

    /// 记录错误
    pub fn log_error(&mut self, error_type: &str, error_message: &str) {
        let duration = self.elapsed();

        let mut fields = self.base_fields();
        fields.error_type = Some(error_type.to_string());
        fields.error_message = Some(error_message.to_string());

        let entry = StructuredLogEntry::new(
            LogLevel::Error,
            LogEventType::ErrorOccurred,
            &self.request_id,
            &format!("{}: {}", error_type, error_message),
        )
        .with_fields(fields)
        .with_duration(duration);

        entry.emit();
    }
}

impl Default for RequestTracer {
    fn default() -> Self {
        Self::new()
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 性能指标收集器
// ════════════════════════════════════════════════════════════════════════════

/// 性能指标
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// 总请求数
    pub total_requests: u64,
    /// 成功请求数
    pub successful_requests: u64,
    /// 失败请求数
    pub failed_requests: u64,
    /// 总响应时间 (毫秒)
    pub total_response_time_ms: u64,
    /// 平均响应时间 (毫秒)
    pub avg_response_time_ms: f64,
    /// OpenAI → Claude 转换次数
    pub openai_to_claude_conversions: u64,
    /// Claude → OpenAI 转换次数
    pub claude_to_openai_conversions: u64,
    /// 流式请求数
    pub streaming_requests: u64,
    /// 总输入 token 数
    pub total_input_tokens: i64,
    /// 总输出 token 数
    pub total_output_tokens: i64,
}

use std::sync::RwLock;

/// 全局性能指标收集器
pub struct MetricsCollector {
    metrics: RwLock<PerformanceMetrics>,
}

impl MetricsCollector {
    /// 创建新的收集器
    pub fn new() -> Self {
        Self {
            metrics: RwLock::new(PerformanceMetrics::default()),
        }
    }

    /// 记录请求完成
    pub fn record_request(
        &self,
        success: bool,
        response_time_ms: u64,
        is_streaming: bool,
        input_tokens: Option<i32>,
        output_tokens: Option<i32>,
    ) {
        if let Ok(mut metrics) = self.metrics.write() {
            metrics.total_requests += 1;
            metrics.total_response_time_ms += response_time_ms;

            if success {
                metrics.successful_requests += 1;
            } else {
                metrics.failed_requests += 1;
            }

            if is_streaming {
                metrics.streaming_requests += 1;
            }

            if let Some(tokens) = input_tokens {
                metrics.total_input_tokens += tokens as i64;
            }
            if let Some(tokens) = output_tokens {
                metrics.total_output_tokens += tokens as i64;
            }

            // 更新平均响应时间
            if metrics.total_requests > 0 {
                metrics.avg_response_time_ms =
                    metrics.total_response_time_ms as f64 / metrics.total_requests as f64;
            }
        }
    }

    /// 记录转换
    pub fn record_conversion(&self, openai_to_claude: bool) {
        if let Ok(mut metrics) = self.metrics.write() {
            if openai_to_claude {
                metrics.openai_to_claude_conversions += 1;
            } else {
                metrics.claude_to_openai_conversions += 1;
            }
        }
    }

    /// 获取当前指标快照
    pub fn snapshot(&self) -> PerformanceMetrics {
        self.metrics
            .read()
            .map(|m| m.clone())
            .unwrap_or_default()
    }

    /// 重置指标
    pub fn reset(&self) {
        if let Ok(mut metrics) = self.metrics.write() {
            *metrics = PerformanceMetrics::default();
        }
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 全局实例
// ════════════════════════════════════════════════════════════════════════════

use std::sync::LazyLock;

/// 全局性能指标收集器
pub static METRICS: LazyLock<MetricsCollector> = LazyLock::new(MetricsCollector::new);

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_request_id() {
        let id1 = generate_request_id();
        let id2 = generate_request_id();

        assert!(id1.starts_with("req-"));
        assert!(id2.starts_with("req-"));
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_structured_log_entry() {
        let entry = StructuredLogEntry::new(
            LogLevel::Info,
            LogEventType::RequestReceived,
            "req-test-001",
            "POST /v1/messages",
        );

        let json = entry.to_json();
        assert!(json.contains("req-test-001"));
        assert!(json.contains("request_received"));

        let oneline = entry.to_oneline();
        assert!(oneline.contains("req-test-001"));
    }

    #[test]
    fn test_structured_log_entry_with_fields() {
        let fields = LogFields {
            client_format: Some("OpenAI".to_string()),
            target_format: Some("Claude".to_string()),
            model: Some("gpt-4o".to_string()),
            status_code: Some(200),
            ..Default::default()
        };

        let entry = StructuredLogEntry::new(
            LogLevel::Info,
            LogEventType::RequestCompleted,
            "req-test-002",
            "Request completed",
        )
        .with_fields(fields)
        .with_duration(Duration::from_millis(150));

        let oneline = entry.to_oneline();
        assert!(oneline.contains("150ms"));
        assert!(oneline.contains("client=OpenAI"));
        assert!(oneline.contains("status=200"));
    }

    #[test]
    fn test_request_tracer() {
        let mut tracer = RequestTracer::new();

        assert!(tracer.request_id().starts_with("req-"));

        tracer.set_client_format(RequestFormat::OpenAI);
        tracer.set_model("gpt-4o");
        tracer.set_streaming(true);

        for i in 0..5 {
            tracer.increment_chunk_count();
            assert_eq!(tracer.chunk_count, i + 1);
        }
    }

    #[test]
    fn test_metrics_collector() {
        let collector = MetricsCollector::new();

        collector.record_request(true, 100, false, Some(50), Some(100));
        collector.record_request(true, 200, true, Some(100), Some(200));
        collector.record_request(false, 50, false, None, None);

        let snapshot = collector.snapshot();
        assert_eq!(snapshot.total_requests, 3);
        assert_eq!(snapshot.successful_requests, 2);
        assert_eq!(snapshot.failed_requests, 1);
        assert_eq!(snapshot.streaming_requests, 1);
        assert_eq!(snapshot.total_input_tokens, 150);
        assert_eq!(snapshot.total_output_tokens, 300);

        // 平均响应时间 = (100 + 200 + 50) / 3 ≈ 116.67
        assert!((snapshot.avg_response_time_ms - 116.67).abs() < 1.0);
    }

    #[test]
    fn test_metrics_collector_conversion() {
        let collector = MetricsCollector::new();

        collector.record_conversion(true); // OpenAI → Claude
        collector.record_conversion(true);
        collector.record_conversion(false); // Claude → OpenAI

        let snapshot = collector.snapshot();
        assert_eq!(snapshot.openai_to_claude_conversions, 2);
        assert_eq!(snapshot.claude_to_openai_conversions, 1);
    }

    #[test]
    fn test_metrics_reset() {
        let collector = MetricsCollector::new();

        collector.record_request(true, 100, false, Some(50), Some(100));
        assert_eq!(collector.snapshot().total_requests, 1);

        collector.reset();
        assert_eq!(collector.snapshot().total_requests, 0);
    }

    #[test]
    fn test_log_level_conversion() {
        assert_eq!(log::Level::from(LogLevel::Info), log::Level::Info);
        assert_eq!(log::Level::from(LogLevel::Error), log::Level::Error);
        assert_eq!(log::Level::from(LogLevel::Debug), log::Level::Debug);
    }
}
