/**
 * Client Detection Module
 * Detects client source from HTTP request headers
 *
 * NOTE: This proxy only supports Claude Code terminal requests.
 * Other client types are detected for logging purposes but will
 * use Claude API format by default.
 */

use hyper::header::HeaderMap;

/// Detected client type
///
/// This proxy is designed for Claude Code terminal requests.
/// Other clients are detected for logging but will use Claude format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientType {
    /// Claude Code CLI - expects Claude API format (primary supported client)
    ClaudeCode,
    /// Generic Claude client - expects Claude API format
    GenericClaude,
    /// Unknown client - defaults to Claude API format
    Unknown,
}

impl std::fmt::Display for ClientType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientType::ClaudeCode => write!(f, "claude_code"),
            ClientType::GenericClaude => write!(f, "generic_claude"),
            ClientType::Unknown => write!(f, "unknown"),
        }
    }
}

impl ClientType {
    /// Check if client expects Claude API format
    ///
    /// NOTE: All clients default to Claude format since this proxy
    /// is designed for Claude Code terminal requests.
    pub fn expects_claude_format(&self) -> bool {
        true // All supported clients expect Claude format
    }

    /// Get the expected API format for this client
    ///
    /// Always returns Claude format as this proxy only supports
    /// Claude Code terminal requests.
    pub fn expected_format(&self) -> super::protocol_detector::RequestFormat {
        super::protocol_detector::RequestFormat::Claude
    }
}

/// Client detector
///
/// Detects client type from HTTP request headers.
/// Primary purpose: logging and debugging.
/// All requests are treated as Claude format regardless of detected client.
pub struct ClientDetector;

impl ClientDetector {
    /// Detect client type from request headers
    ///
    /// Detection priority:
    /// 1. Custom headers (X-Client-Type, X-Client-Name)
    /// 2. User-Agent patterns
    /// 3. API key header format (x-api-key indicates Claude)
    /// 4. Default to Unknown
    pub fn detect(headers: &HeaderMap) -> ClientType {
        // 1. Check for custom client identification headers
        if let Some(client_type) = Self::check_custom_headers(headers) {
            return client_type;
        }

        // 2. Check User-Agent
        if let Some(client_type) = Self::check_user_agent(headers) {
            return client_type;
        }

        // 3. Check API key format
        if Self::has_claude_api_key(headers) {
            return ClientType::GenericClaude;
        }

        // 4. Default to Unknown
        ClientType::Unknown
    }

    /// Detect client type with request path for additional context
    pub fn detect_with_path(headers: &HeaderMap, path: &str) -> ClientType {
        // First try header-based detection
        let header_result = Self::detect(headers);

        // If unknown, check if path indicates Claude API
        if header_result == ClientType::Unknown {
            // Claude API paths: /v1/messages, /v1/complete
            if path.contains("/messages") || path.contains("/complete") {
                return ClientType::GenericClaude;
            }
        }

        header_result
    }

    /// Check custom headers for client identification
    fn check_custom_headers(headers: &HeaderMap) -> Option<ClientType> {
        // X-Client-Type header (explicit client type)
        if let Some(value) = headers.get("x-client-type") {
            if let Ok(s) = value.to_str() {
                let lower = s.to_lowercase();
                if lower.contains("claude") || lower.contains("anthropic") {
                    return Some(ClientType::ClaudeCode);
                }
            }
        }

        // X-Client-Name header
        if let Some(value) = headers.get("x-client-name") {
            if let Ok(s) = value.to_str() {
                let lower = s.to_lowercase();
                if lower.contains("claude-code") || lower.contains("claude code") {
                    return Some(ClientType::ClaudeCode);
                }
            }
        }

        None
    }

    /// Check User-Agent header for Claude Code patterns
    fn check_user_agent(headers: &HeaderMap) -> Option<ClientType> {
        let user_agent = headers
            .get(hyper::header::USER_AGENT)
            .and_then(|v| v.to_str().ok())?;

        let lower_ua = user_agent.to_lowercase();

        // Claude Code patterns (primary supported client)
        if lower_ua.contains("claude-code")
            || lower_ua.contains("claude_code")
            || lower_ua.contains("anthropic-cli")
            || lower_ua.contains("anthropic/")
        {
            return Some(ClientType::ClaudeCode);
        }

        // Generic Anthropic SDK patterns
        if lower_ua.contains("anthropic-python")
            || lower_ua.contains("anthropic-node")
            || lower_ua.contains("anthropic-typescript")
            || lower_ua.contains("anthropic")
        {
            return Some(ClientType::GenericClaude);
        }

        None
    }

    /// Check if request has Claude API key format
    fn has_claude_api_key(headers: &HeaderMap) -> bool {
        // Claude uses x-api-key header
        if headers.contains_key("x-api-key") {
            return true;
        }
        // anthropic-version header indicates Claude client
        if headers.contains_key("anthropic-version") {
            return true;
        }
        false
    }
}

/// Detection result with additional context
#[derive(Debug, Clone)]
pub struct ClientDetectionResult {
    /// Detected client type
    pub client_type: ClientType,
    /// User-Agent string (if present)
    pub user_agent: Option<String>,
    /// Detection confidence
    pub confidence: DetectionConfidence,
    /// Detection method used
    pub method: DetectionMethod,
}

/// Detection confidence level
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectionConfidence {
    /// High confidence - explicit client identification
    High,
    /// Medium confidence - User-Agent pattern match
    Medium,
    /// Low confidence - inferred from API format
    Low,
}

/// Method used for detection
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectionMethod {
    /// Custom X-Client-* headers
    CustomHeader,
    /// User-Agent pattern matching
    UserAgent,
    /// API key format inference
    ApiKeyFormat,
    /// Request path inference
    RequestPath,
    /// Default fallback
    Default,
}

impl ClientDetector {
    /// Detect client with detailed result
    pub fn detect_detailed(headers: &HeaderMap, path: &str) -> ClientDetectionResult {
        // Extract User-Agent for result
        let user_agent = headers
            .get(hyper::header::USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        // 1. Check custom headers
        if let Some(client_type) = Self::check_custom_headers(headers) {
            return ClientDetectionResult {
                client_type,
                user_agent,
                confidence: DetectionConfidence::High,
                method: DetectionMethod::CustomHeader,
            };
        }

        // 2. Check User-Agent
        if let Some(client_type) = Self::check_user_agent(headers) {
            return ClientDetectionResult {
                client_type,
                user_agent,
                confidence: DetectionConfidence::Medium,
                method: DetectionMethod::UserAgent,
            };
        }

        // 3. Check API key format
        if Self::has_claude_api_key(headers) {
            return ClientDetectionResult {
                client_type: ClientType::GenericClaude,
                user_agent,
                confidence: DetectionConfidence::Medium,
                method: DetectionMethod::ApiKeyFormat,
            };
        }

        // 4. Infer from path
        let client_type = if path.contains("/messages") || path.contains("/complete") {
            ClientType::GenericClaude
        } else {
            ClientType::Unknown
        };

        ClientDetectionResult {
            client_type,
            user_agent,
            confidence: DetectionConfidence::Low,
            method: if client_type == ClientType::Unknown {
                DetectionMethod::Default
            } else {
                DetectionMethod::RequestPath
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hyper::header::{HeaderMap, HeaderValue, USER_AGENT};

    #[test]
    fn test_detect_claude_code() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("claude-code/1.0.0"));

        assert_eq!(ClientDetector::detect(&headers), ClientType::ClaudeCode);
    }

    #[test]
    fn test_detect_from_custom_header() {
        let mut headers = HeaderMap::new();
        headers.insert("x-client-type", HeaderValue::from_static("claude"));

        assert_eq!(ClientDetector::detect(&headers), ClientType::ClaudeCode);
    }

    #[test]
    fn test_detect_from_api_key() {
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static("sk-ant-xxx"));
        headers.insert("anthropic-version", HeaderValue::from_static("2024-01-01"));

        assert_eq!(ClientDetector::detect(&headers), ClientType::GenericClaude);
    }

    #[test]
    fn test_detect_with_path_claude() {
        let headers = HeaderMap::new();
        let path = "/v1/messages";

        assert_eq!(
            ClientDetector::detect_with_path(&headers, path),
            ClientType::GenericClaude
        );
    }

    #[test]
    fn test_unknown_client() {
        let headers = HeaderMap::new();
        let path = "/v1/some/random/path";

        assert_eq!(
            ClientDetector::detect_with_path(&headers, path),
            ClientType::Unknown
        );
    }

    #[test]
    fn test_all_clients_expect_claude_format() {
        // All client types should expect Claude format
        assert!(ClientType::ClaudeCode.expects_claude_format());
        assert!(ClientType::GenericClaude.expects_claude_format());
        assert!(ClientType::Unknown.expects_claude_format());
    }

    #[test]
    fn test_client_expected_format() {
        use super::super::protocol_detector::RequestFormat;

        // All clients should return Claude format
        assert_eq!(
            ClientType::ClaudeCode.expected_format(),
            RequestFormat::Claude
        );
        assert_eq!(
            ClientType::GenericClaude.expected_format(),
            RequestFormat::Claude
        );
        assert_eq!(
            ClientType::Unknown.expected_format(),
            RequestFormat::Claude
        );
    }
}
