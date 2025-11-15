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

    /// Finalize log entry with success response
    pub fn finish(self, status_code: StatusCode) -> RequestLogEntry {
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
            error: None,
            remote_addr: self.remote_addr,
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
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_log_entry_success() {
        let entry = RequestLogEntry {
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
        };

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
        let entry = RequestLogEntry {
            timestamp: Utc::now(),
            method: Method::GET,
            uri: "/health".parse().unwrap(),
            target_url: "https://api.test.com:443".to_string(),
            config_id: Some(2),
            config_name: Some("Test Config 2".to_string()),
            latency_ms: 5000,
            status_code: StatusCode::BAD_GATEWAY,
            error: Some("Connection refused".to_string()),
            remote_addr: "127.0.0.1:54322".to_string(),
        };

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
}
