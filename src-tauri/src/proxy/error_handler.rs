#![allow(dead_code)]

/**
 * Proxy Error Handler
 * Handles various error scenarios in proxy service
 *
 * Error types:
 * - ConnectionFailed: Cannot connect to target server
 * - Timeout: Request timeout
 * - QuotaExceeded: API quota exceeded
 * - InvalidResponse: Invalid response from server
 * - NetworkError: Network-related errors
 */

use hyper::{Response, StatusCode};
use std::time::Duration;

/// Proxy error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProxyErrorType {
    /// Connection failed
    ConnectionFailed,
    /// Request timeout
    Timeout,
    /// API quota exceeded
    QuotaExceeded,
    /// Invalid response
    InvalidResponse,
    /// Network error
    NetworkError,
    /// Unknown error
    Unknown,
}

impl ProxyErrorType {
    /// Convert error message to error type
    pub fn from_error_message(message: &str) -> Self {
        let msg_lower = message.to_lowercase();

        if msg_lower.contains("timeout") || msg_lower.contains("timed out") {
            Self::Timeout
        } else if msg_lower.contains("connection")
            || msg_lower.contains("connect")
            || msg_lower.contains("refused")
        {
            Self::ConnectionFailed
        } else if msg_lower.contains("quota") || msg_lower.contains("rate limit") {
            Self::QuotaExceeded
        } else if msg_lower.contains("invalid") || msg_lower.contains("parse") {
            Self::InvalidResponse
        } else if msg_lower.contains("network") || msg_lower.contains("dns") {
            Self::NetworkError
        } else {
            Self::Unknown
        }
    }

    /// Get HTTP status code for error type
    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::ConnectionFailed => StatusCode::BAD_GATEWAY,
            Self::Timeout => StatusCode::GATEWAY_TIMEOUT,
            Self::QuotaExceeded => StatusCode::TOO_MANY_REQUESTS,
            Self::InvalidResponse => StatusCode::BAD_GATEWAY,
            Self::NetworkError => StatusCode::BAD_GATEWAY,
            Self::Unknown => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Get user-friendly error message
    pub fn user_message(&self) -> &'static str {
        match self {
            Self::ConnectionFailed => {
                "Failed to connect to API server. Please check your configuration."
            }
            Self::Timeout => {
                "Request timed out. The API server is not responding in time."
            }
            Self::QuotaExceeded => {
                "API quota exceeded. Please try again later or switch to another configuration."
            }
            Self::InvalidResponse => {
                "Received invalid response from API server. The server may be misconfigured."
            }
            Self::NetworkError => {
                "Network error occurred. Please check your internet connection."
            }
            Self::Unknown => "An unknown error occurred. Please try again later.",
        }
    }
}

/// Proxy error handler
pub struct ProxyErrorHandler;

impl ProxyErrorHandler {
    /// Create error response from error message
    ///
    /// # Arguments
    /// - `error_message`: Original error message
    /// - `config_name`: Name of the configuration that failed
    ///
    /// # Returns
    /// - HTTP response with appropriate status code and error message
    pub fn handle_error(
        error_message: &str,
        config_name: Option<&str>,
    ) -> Response<String> {
        let error_type = ProxyErrorType::from_error_message(error_message);
        let status = error_type.status_code();
        let user_msg = error_type.user_message();

        log::error!(
            "Proxy error ({:?}): {} | Config: {:?}",
            error_type,
            error_message,
            config_name
        );

        let body = if let Some(name) = config_name {
            format!(
                "Proxy Error (Config: {})\n\nType: {:?}\n\n{}\n\nTechnical Details:\n{}",
                name, error_type, user_msg, error_message
            )
        } else {
            format!(
                "Proxy Error\n\nType: {:?}\n\n{}\n\nTechnical Details:\n{}",
                error_type, user_msg, error_message
            )
        };

        Response::builder()
            .status(status)
            .header("Content-Type", "text/plain; charset=utf-8")
            .header("X-Proxy-Error-Type", format!("{:?}", error_type))
            .body(body)
            .unwrap()
    }

    /// Check if error should trigger auto-switch
    ///
    /// # Arguments
    /// - `error_type`: Type of error that occurred
    ///
    /// # Returns
    /// - true if auto-switch should be triggered, false otherwise
    pub fn should_trigger_auto_switch(error_type: &ProxyErrorType) -> bool {
        matches!(
            error_type,
            ProxyErrorType::ConnectionFailed
                | ProxyErrorType::Timeout
                | ProxyErrorType::QuotaExceeded
        )
    }

    /// Get retry delay based on error type
    ///
    /// # Arguments
    /// - `error_type`: Type of error that occurred
    ///
    /// # Returns
    /// - Duration to wait before retry
    pub fn get_retry_delay(error_type: &ProxyErrorType) -> Duration {
        match error_type {
            ProxyErrorType::ConnectionFailed => Duration::from_secs(5),
            ProxyErrorType::Timeout => Duration::from_secs(10),
            ProxyErrorType::QuotaExceeded => Duration::from_secs(60),
            ProxyErrorType::InvalidResponse => Duration::from_secs(5),
            ProxyErrorType::NetworkError => Duration::from_secs(10),
            ProxyErrorType::Unknown => Duration::from_secs(5),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_type_detection() {
        assert_eq!(
            ProxyErrorType::from_error_message("connection refused"),
            ProxyErrorType::ConnectionFailed
        );
        assert_eq!(
            ProxyErrorType::from_error_message("request timed out"),
            ProxyErrorType::Timeout
        );
        assert_eq!(
            ProxyErrorType::from_error_message("quota exceeded"),
            ProxyErrorType::QuotaExceeded
        );
        assert_eq!(
            ProxyErrorType::from_error_message("some random error"),
            ProxyErrorType::Unknown
        );
    }

    #[test]
    fn test_status_codes() {
        assert_eq!(
            ProxyErrorType::ConnectionFailed.status_code(),
            StatusCode::BAD_GATEWAY
        );
        assert_eq!(
            ProxyErrorType::Timeout.status_code(),
            StatusCode::GATEWAY_TIMEOUT
        );
        assert_eq!(
            ProxyErrorType::QuotaExceeded.status_code(),
            StatusCode::TOO_MANY_REQUESTS
        );
    }

    #[test]
    fn test_auto_switch_trigger() {
        assert!(ProxyErrorHandler::should_trigger_auto_switch(
            &ProxyErrorType::ConnectionFailed
        ));
        assert!(ProxyErrorHandler::should_trigger_auto_switch(
            &ProxyErrorType::Timeout
        ));
        assert!(ProxyErrorHandler::should_trigger_auto_switch(
            &ProxyErrorType::QuotaExceeded
        ));
        assert!(!ProxyErrorHandler::should_trigger_auto_switch(
            &ProxyErrorType::InvalidResponse
        ));
    }

    #[test]
    fn test_retry_delays() {
        assert_eq!(
            ProxyErrorHandler::get_retry_delay(&ProxyErrorType::ConnectionFailed),
            Duration::from_secs(5)
        );
        assert_eq!(
            ProxyErrorHandler::get_retry_delay(&ProxyErrorType::QuotaExceeded),
            Duration::from_secs(60)
        );
    }

    #[test]
    fn test_error_response() {
        let response = ProxyErrorHandler::handle_error(
            "connection refused",
            Some("Test Config"),
        );

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        assert!(response.body().contains("Test Config"));
        assert!(response.body().contains("ConnectionFailed"));
    }
}
