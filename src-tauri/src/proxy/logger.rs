/**
 * Proxy Request Logger
 * Logs detailed information about proxy requests
 *
 * Records:
 * - Timestamp
 * - Request method and URI
 * - Target URL
 * - Latency
 * - Status code
 * - Error information (if any)
 * - Request/Response headers and bodies (dev mode)
 * - Timing details
 */

use chrono::{DateTime, Utc};
use hyper::{Method, StatusCode, Uri};
use std::time::Instant;

/// Request log entry
#[derive(Debug, Clone)]
pub struct RequestLogEntry {
    /// Timestamp when request was received
    pub timestamp: DateTime<Utc>,
    /// HTTP method
    pub method: Method,
    /// Request URI
    pub uri: Uri,
    /// Target server URL
    pub target_url: String,
    /// Target configuration ID
    pub config_id: Option<i64>,
    /// Configuration name
    pub config_name: Option<String>,
    /// Request processing latency in milliseconds
    pub latency_ms: u64,
    /// Response status code
    pub status_code: StatusCode,
    /// Error message (if request failed)
    pub error: Option<String>,
    /// Client remote address
    pub remote_addr: String,
    // === 新增详细字段 ===
    /// Request headers (JSON serialized)
    pub request_headers: Option<String>,
    /// Request body (truncated if too large)
    pub request_body: Option<String>,
    /// Response headers (JSON serialized)
    pub response_headers: Option<String>,
    /// Response body (truncated if too large)
    pub response_body: Option<String>,
    /// Response start timestamp
    pub response_start_at: Option<DateTime<Utc>>,
    /// Response end timestamp
    pub response_end_at: Option<DateTime<Utc>>,
    /// Request body size in bytes
    pub request_body_size: u64,
    /// Response body size in bytes
    pub response_body_size: u64,
    /// Whether the response is streaming
    pub is_streaming: bool,
    /// Number of stream chunks received
    pub stream_chunk_count: u32,
    /// Time to first byte in milliseconds
    pub time_to_first_byte_ms: Option<u64>,
    /// Content-Type header value
    pub content_type: Option<String>,
    /// User-Agent header value
    pub user_agent: Option<String>,
    /// Model name if available (e.g., claude-3-opus)
    pub model: Option<String>,
}

impl RequestLogEntry {
    /// Check if request was successful (2xx status)
    pub fn is_success(&self) -> bool {
        self.status_code.is_success()
    }

    /// Check if request failed (4xx or 5xx status)
    pub fn is_error(&self) -> bool {
        self.status_code.is_client_error() || self.status_code.is_server_error()
    }

    /// Get log level based on status
    pub fn log_level(&self) -> log::Level {
        if self.is_success() {
            log::Level::Info
        } else if self.status_code.is_client_error() {
            log::Level::Warn
        } else {
            log::Level::Error
        }
    }

    /// Format log entry as a single-line string
    pub fn format_oneline(&self) -> String {
        let config_info = match (&self.config_id, &self.config_name) {
            (Some(id), Some(name)) => format!("[config:{}:{}]", id, name),
            (Some(id), None) => format!("[config:{}]", id),
            _ => "[no-config]".to_string(),
        };

        let error_info = match &self.error {
            Some(err) => format!(" error=\"{}\"", err),
            None => String::new(),
        };

        format!(
            "{} {} {} -> {} {} {} {}ms{}",
            self.timestamp.format("%Y-%m-%dT%H:%M:%S%.3fZ"),
            self.method,
            self.uri,
            self.target_url,
            config_info,
            self.status_code.as_u16(),
            self.latency_ms,
            error_info
        )
    }
}

/// Proxy logger
pub struct ProxyLogger;

impl ProxyLogger {
    /// Log a request
    ///
    /// # Arguments
    /// - `entry`: Request log entry
    pub fn log_request(entry: &RequestLogEntry) {
        let level = entry.log_level();
        let message = entry.format_oneline();

        log::log!(level, "{}", message);

        // Additional detailed logging for errors
        if entry.is_error() {
            log::debug!(
                "Request failed details: method={} uri={} target={} config={:?} status={} latency={}ms error={:?} remote={}",
                entry.method,
                entry.uri,
                entry.target_url,
                entry.config_name,
                entry.status_code,
                entry.latency_ms,
                entry.error,
                entry.remote_addr
            );
        }
    }

    /// Create a request log entry builder
    pub fn start_request(
        method: Method,
        uri: Uri,
        remote_addr: String,
    ) -> RequestLogBuilder {
        RequestLogBuilder {
            timestamp: Utc::now(),
            method,
            uri,
            remote_addr,
            start_time: Instant::now(),
            target_url: None,
            config_id: None,
            config_name: None,
            // 新增详细字段
            request_headers: None,
            request_body: None,
            request_body_size: 0,
            user_agent: None,
            content_type: None,
            model: None,
            response_start_time: None,
        }
    }
}

/// Request log builder for tracking request lifecycle
pub struct RequestLogBuilder {
    timestamp: DateTime<Utc>,
    method: Method,
    uri: Uri,
    remote_addr: String,
    start_time: Instant,
    target_url: Option<String>,
    config_id: Option<i64>,
    config_name: Option<String>,
    // 新增详细字段
    request_headers: Option<String>,
    request_body: Option<String>,
    request_body_size: u64,
    user_agent: Option<String>,
    content_type: Option<String>,
    model: Option<String>,
    response_start_time: Option<Instant>,
}

impl RequestLogBuilder {
    /// Set target URL
    pub fn with_target(mut self, url: String) -> Self {
        self.target_url = Some(url);
        self
    }

    /// Set configuration info
    pub fn with_config(mut self, config_id: i64, config_name: String) -> Self {
        self.config_id = Some(config_id);
        self.config_name = Some(config_name);
        self
    }

    /// Set request headers (JSON serialized)
    pub fn with_request_headers(mut self, headers: String) -> Self {
        self.request_headers = Some(headers);
        self
    }

    /// Set request body (truncated if needed)
    pub fn with_request_body(mut self, body: String, size: u64) -> Self {
        self.request_body = Some(body);
        self.request_body_size = size;
        self
    }

    /// Set User-Agent header
    pub fn with_user_agent(mut self, user_agent: String) -> Self {
        self.user_agent = Some(user_agent);
        self
    }

    /// Set Content-Type header
    pub fn with_content_type(mut self, content_type: String) -> Self {
        self.content_type = Some(content_type);
        self
    }

    /// Set model name
    pub fn with_model(mut self, model: String) -> Self {
        self.model = Some(model);
        self
    }

    /// Mark response start time
    pub fn mark_response_start(&mut self) {
        self.response_start_time = Some(Instant::now());
    }

    /// Finalize log entry with success response
    #[allow(dead_code)]
    pub fn finish(self, status_code: StatusCode) -> RequestLogEntry {
        let latency_ms = self.start_time.elapsed().as_millis() as u64;
        let time_to_first_byte_ms = self.response_start_time
            .map(|t| self.start_time.elapsed().as_millis() as u64 - t.elapsed().as_millis() as u64);

        RequestLogEntry {
            timestamp: self.timestamp,
            method: self.method,
            uri: self.uri,
            target_url: self.target_url.unwrap_or_else(|| "unknown".to_string()),
            config_id: self.config_id,
            config_name: self.config_name,
            latency_ms,
            status_code,
            error: None,
            remote_addr: self.remote_addr,
            // 新增详细字段
            request_headers: self.request_headers,
            request_body: self.request_body,
            response_headers: None,
            response_body: None,
            response_start_at: None,
            response_end_at: None,
            request_body_size: self.request_body_size,
            response_body_size: 0,
            is_streaming: false,
            stream_chunk_count: 0,
            time_to_first_byte_ms,
            content_type: self.content_type,
            user_agent: self.user_agent,
            model: self.model,
        }
    }

    /// Finalize log entry with detailed response info
    pub fn finish_with_details(
        self,
        status_code: StatusCode,
        response_headers: Option<String>,
        response_body: Option<String>,
        response_body_size: u64,
        is_streaming: bool,
        stream_chunk_count: u32,
    ) -> RequestLogEntry {
        let now = Utc::now();
        let latency_ms = self.start_time.elapsed().as_millis() as u64;
        let time_to_first_byte_ms = self.response_start_time
            .map(|t| self.start_time.elapsed().as_millis() as u64 - t.elapsed().as_millis() as u64);

        RequestLogEntry {
            timestamp: self.timestamp,
            method: self.method,
            uri: self.uri,
            target_url: self.target_url.unwrap_or_else(|| "unknown".to_string()),
            config_id: self.config_id,
            config_name: self.config_name,
            latency_ms,
            status_code,
            error: None,
            remote_addr: self.remote_addr,
            // 详细字段
            request_headers: self.request_headers,
            request_body: self.request_body,
            response_headers,
            response_body,
            response_start_at: self.response_start_time.map(|_| self.timestamp),
            response_end_at: Some(now),
            request_body_size: self.request_body_size,
            response_body_size,
            is_streaming,
            stream_chunk_count,
            time_to_first_byte_ms,
            content_type: self.content_type,
            user_agent: self.user_agent,
            model: self.model,
        }
    }

    /// Finalize log entry with error
    pub fn finish_with_error(
        self,
        status_code: StatusCode,
        error: String,
    ) -> RequestLogEntry {
        let latency_ms = self.start_time.elapsed().as_millis() as u64;

        RequestLogEntry {
            timestamp: self.timestamp,
            method: self.method,
            uri: self.uri,
            target_url: self.target_url.unwrap_or_else(|| "unknown".to_string()),
            config_id: self.config_id,
            config_name: self.config_name,
            latency_ms,
            status_code,
            error: Some(error),
            remote_addr: self.remote_addr,
            // 错误情况下的默认值
            request_headers: self.request_headers,
            request_body: self.request_body,
            response_headers: None,
            response_body: None,
            response_start_at: None,
            response_end_at: Some(Utc::now()),
            request_body_size: self.request_body_size,
            response_body_size: 0,
            is_streaming: false,
            stream_chunk_count: 0,
            time_to_first_byte_ms: None,
            content_type: self.content_type,
            user_agent: self.user_agent,
            model: self.model,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_base_entry() -> RequestLogEntry {
        RequestLogEntry {
            timestamp: Utc::now(),
            method: Method::POST,
            uri: "/v1/messages".parse().unwrap(),
            target_url: "https://api.anthropic.com:443".to_string(),
            config_id: Some(1),
            config_name: Some("Test Config".to_string()),
            latency_ms: 250,
            status_code: StatusCode::OK,
            error: None,
            remote_addr: "127.0.0.1:54321".to_string(),
            // 新增字段默认值
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
            response_start_at: None,
            response_end_at: None,
            request_body_size: 0,
            response_body_size: 0,
            is_streaming: false,
            stream_chunk_count: 0,
            time_to_first_byte_ms: None,
            content_type: None,
            user_agent: None,
            model: None,
        }
    }

    #[test]
    fn test_request_log_entry_success() {
        let entry = create_base_entry();

        assert!(entry.is_success());
        assert!(!entry.is_error());
        assert_eq!(entry.log_level(), log::Level::Info);

        let formatted = entry.format_oneline();
        assert!(formatted.contains("POST"));
        assert!(formatted.contains("/v1/messages"));
        assert!(formatted.contains("250ms"));
        assert!(formatted.contains("200"));
    }

    #[test]
    fn test_request_log_entry_error() {
        let mut entry = create_base_entry();
        entry.method = Method::GET;
        entry.uri = "/health".parse().unwrap();
        entry.target_url = "https://api.test.com:443".to_string();
        entry.config_id = Some(2);
        entry.config_name = Some("Test Config 2".to_string());
        entry.latency_ms = 5000;
        entry.status_code = StatusCode::BAD_GATEWAY;
        entry.error = Some("Connection refused".to_string());
        entry.remote_addr = "127.0.0.1:54322".to_string();

        assert!(!entry.is_success());
        assert!(entry.is_error());
        assert_eq!(entry.log_level(), log::Level::Error);

        let formatted = entry.format_oneline();
        assert!(formatted.contains("GET"));
        assert!(formatted.contains("502"));
        assert!(formatted.contains("Connection refused"));
    }

    #[test]
    fn test_request_log_builder() {
        let builder = ProxyLogger::start_request(
            Method::POST,
            "/test".parse().unwrap(),
            "127.0.0.1:12345".to_string(),
        );

        let entry = builder
            .with_target("https://api.example.com:443".to_string())
            .with_config(1, "My Config".to_string())
            .finish(StatusCode::OK);

        assert_eq!(entry.method, Method::POST);
        assert_eq!(entry.target_url, "https://api.example.com:443");
        assert_eq!(entry.config_id, Some(1));
        assert_eq!(entry.config_name, Some("My Config".to_string()));
        assert_eq!(entry.status_code, StatusCode::OK);
        assert!(entry.error.is_none());
    }

    #[test]
    fn test_request_log_builder_with_error() {
        let builder = ProxyLogger::start_request(
            Method::GET,
            "/error".parse().unwrap(),
            "127.0.0.1:54321".to_string(),
        );

        let entry = builder
            .with_target("https://api.fail.com:443".to_string())
            .finish_with_error(StatusCode::SERVICE_UNAVAILABLE, "Server down".to_string());

        assert_eq!(entry.status_code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(entry.error, Some("Server down".to_string()));
    }

    #[test]
    fn test_request_log_builder_with_details() {
        let builder = ProxyLogger::start_request(
            Method::POST,
            "/v1/messages".parse().unwrap(),
            "127.0.0.1:12345".to_string(),
        );

        let entry = builder
            .with_target("https://api.anthropic.com:443".to_string())
            .with_config(1, "Claude API".to_string())
            .with_request_headers(r#"{"Content-Type": "application/json"}"#.to_string())
            .with_request_body(r#"{"model": "claude-3-opus"}"#.to_string(), 27)
            .with_user_agent("claude-code/1.0".to_string())
            .with_content_type("application/json".to_string())
            .with_model("claude-3-opus".to_string())
            .finish_with_details(
                StatusCode::OK,
                Some(r#"{"X-Request-Id": "abc123"}"#.to_string()),
                Some(r#"{"content": [{"text": "Hello"}]}"#.to_string()),
                34,
                false,
                0,
            );

        assert_eq!(entry.status_code, StatusCode::OK);
        assert_eq!(entry.request_body_size, 27);
        assert_eq!(entry.response_body_size, 34);
        assert_eq!(entry.model, Some("claude-3-opus".to_string()));
        assert!(!entry.is_streaming);
    }
}
