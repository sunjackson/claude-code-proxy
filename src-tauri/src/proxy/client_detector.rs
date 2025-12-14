/**
 * Client Detection Module
 * Detects client source from HTTP request headers
 *
 * Supported clients:
 * - Claude Code: Official Anthropic CLI (User-Agent contains "claude-code" or "anthropic")
 * - Codex: OpenAI Codex CLI (User-Agent contains "codex" or specific headers)
 * - Cursor: Cursor IDE (User-Agent contains "cursor")
 * - Continue: Continue.dev extension (User-Agent contains "continue")
 * - Generic OpenAI: Other OpenAI-compatible clients
 * - Generic Claude: Other Claude-compatible clients
 * - Unknown: Unable to determine
 */

use hyper::header::HeaderMap;

/// Detected client type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientType {
    /// Claude Code CLI - expects Claude API format
    ClaudeCode,
    /// OpenAI Codex CLI - expects OpenAI API format
    Codex,
    /// Cursor IDE - expects OpenAI API format
    Cursor,
    /// Continue.dev - can use either format
    Continue,
    /// Cline VS Code extension - expects Claude API format
    Cline,
    /// Generic OpenAI client - expects OpenAI API format
    GenericOpenAI,
    /// Generic Claude client - expects Claude API format
    GenericClaude,
    /// Unknown client
    Unknown,
}

impl std::fmt::Display for ClientType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientType::ClaudeCode => write!(f, "claude_code"),
            ClientType::Codex => write!(f, "codex"),
            ClientType::Cursor => write!(f, "cursor"),
            ClientType::Continue => write!(f, "continue"),
            ClientType::Cline => write!(f, "cline"),
            ClientType::GenericOpenAI => write!(f, "generic_openai"),
            ClientType::GenericClaude => write!(f, "generic_claude"),
            ClientType::Unknown => write!(f, "unknown"),
        }
    }
}

impl ClientType {
    /// Check if client expects Claude API format
    pub fn expects_claude_format(&self) -> bool {
        matches!(
            self,
            ClientType::ClaudeCode | ClientType::Cline | ClientType::GenericClaude
        )
    }

    /// Check if client expects OpenAI API format
    pub fn expects_openai_format(&self) -> bool {
        matches!(
            self,
            ClientType::Codex | ClientType::Cursor | ClientType::GenericOpenAI
        )
    }

    /// Get the expected API format for this client
    pub fn expected_format(&self) -> super::protocol_detector::RequestFormat {
        use super::protocol_detector::RequestFormat;
        match self {
            ClientType::ClaudeCode | ClientType::Cline | ClientType::GenericClaude => {
                RequestFormat::Claude
            }
            ClientType::Codex | ClientType::Cursor | ClientType::GenericOpenAI => {
                RequestFormat::OpenAI
            }
            ClientType::Continue | ClientType::Unknown => RequestFormat::Unknown,
        }
    }
}

/// Client detector
pub struct ClientDetector;

impl ClientDetector {
    /// Detect client type from request headers
    ///
    /// Detection priority:
    /// 1. Custom headers (X-Client-Type, X-Client-Name)
    /// 2. User-Agent patterns
    /// 3. API key header format (x-api-key vs Authorization Bearer)
    /// 4. Request path (fallback)
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
        if let Some(client_type) = Self::check_api_key_format(headers) {
            return client_type;
        }

        // 4. Default to Unknown
        ClientType::Unknown
    }

    /// Detect client type with request path for additional context
    pub fn detect_with_path(headers: &HeaderMap, path: &str) -> ClientType {
        // First try header-based detection
        let header_result = Self::detect(headers);

        // If unknown, use path to determine format
        if header_result == ClientType::Unknown {
            // Use protocol detector to determine format from path
            use super::protocol_detector::ProtocolDetector;
            let format = ProtocolDetector::detect_from_path(path);

            match format {
                super::protocol_detector::RequestFormat::Claude => ClientType::GenericClaude,
                super::protocol_detector::RequestFormat::OpenAI => ClientType::GenericOpenAI,
                super::protocol_detector::RequestFormat::Gemini => ClientType::Unknown, // Gemini clients not yet supported
                super::protocol_detector::RequestFormat::Unknown => ClientType::Unknown,
            }
        } else {
            header_result
        }
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
                if lower.contains("codex") {
                    return Some(ClientType::Codex);
                }
                if lower.contains("cursor") {
                    return Some(ClientType::Cursor);
                }
                if lower.contains("continue") {
                    return Some(ClientType::Continue);
                }
                if lower.contains("cline") {
                    return Some(ClientType::Cline);
                }
                if lower.contains("openai") {
                    return Some(ClientType::GenericOpenAI);
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
                if lower.contains("codex") {
                    return Some(ClientType::Codex);
                }
                if lower.contains("cursor") {
                    return Some(ClientType::Cursor);
                }
            }
        }

        None
    }

    /// Check User-Agent header for known client patterns
    fn check_user_agent(headers: &HeaderMap) -> Option<ClientType> {
        let user_agent = headers
            .get(hyper::header::USER_AGENT)
            .and_then(|v| v.to_str().ok())?;

        let lower_ua = user_agent.to_lowercase();

        // Claude Code patterns
        if lower_ua.contains("claude-code")
            || lower_ua.contains("claude_code")
            || lower_ua.contains("anthropic-cli")
            || lower_ua.contains("anthropic/")
        {
            return Some(ClientType::ClaudeCode);
        }

        // Cline patterns
        if lower_ua.contains("cline") || lower_ua.contains("claude-dev") {
            return Some(ClientType::Cline);
        }

        // Codex patterns
        if lower_ua.contains("codex") || lower_ua.contains("openai-codex") {
            return Some(ClientType::Codex);
        }

        // Cursor patterns
        if lower_ua.contains("cursor") {
            return Some(ClientType::Cursor);
        }

        // Continue patterns
        if lower_ua.contains("continue") || lower_ua.contains("continue.dev") {
            return Some(ClientType::Continue);
        }

        // Generic OpenAI SDK patterns
        if lower_ua.contains("openai-python")
            || lower_ua.contains("openai-node")
            || lower_ua.contains("openai/")
        {
            return Some(ClientType::GenericOpenAI);
        }

        // Generic Anthropic SDK patterns
        if lower_ua.contains("anthropic-python")
            || lower_ua.contains("anthropic-node")
            || lower_ua.contains("anthropic-typescript")
        {
            return Some(ClientType::GenericClaude);
        }

        None
    }

    /// Check API key format to infer client type
    fn check_api_key_format(headers: &HeaderMap) -> Option<ClientType> {
        // Claude uses x-api-key header
        if headers.contains_key("x-api-key") {
            // If also has anthropic-version, definitely Claude
            if headers.contains_key("anthropic-version") {
                return Some(ClientType::GenericClaude);
            }
            // x-api-key alone suggests Claude
            return Some(ClientType::GenericClaude);
        }

        // OpenAI uses Authorization: Bearer header
        if let Some(auth) = headers.get(hyper::header::AUTHORIZATION) {
            if let Ok(s) = auth.to_str() {
                if s.starts_with("Bearer ") {
                    // Check for OpenAI-specific headers
                    if headers.contains_key("openai-organization")
                        || headers.contains_key("openai-project")
                    {
                        return Some(ClientType::GenericOpenAI);
                    }
                    // Bearer token without Claude markers suggests OpenAI
                    if !headers.contains_key("anthropic-version") {
                        return Some(ClientType::GenericOpenAI);
                    }
                }
            }
        }

        None
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
        if let Some(client_type) = Self::check_api_key_format(headers) {
            return ClientDetectionResult {
                client_type,
                user_agent,
                confidence: DetectionConfidence::Medium,
                method: DetectionMethod::ApiKeyFormat,
            };
        }

        // 4. Infer from path
        use super::protocol_detector::ProtocolDetector;
        let format = ProtocolDetector::detect_from_path(path);
        let (client_type, confidence) = match format {
            super::protocol_detector::RequestFormat::Claude => {
                (ClientType::GenericClaude, DetectionConfidence::Low)
            }
            super::protocol_detector::RequestFormat::OpenAI => {
                (ClientType::GenericOpenAI, DetectionConfidence::Low)
            }
            _ => (ClientType::Unknown, DetectionConfidence::Low),
        };

        ClientDetectionResult {
            client_type,
            user_agent,
            confidence,
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
    fn test_detect_cursor() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("Cursor/0.40.0"));

        assert_eq!(ClientDetector::detect(&headers), ClientType::Cursor);
    }

    #[test]
    fn test_detect_codex() {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("openai-codex/1.0"));

        assert_eq!(ClientDetector::detect(&headers), ClientType::Codex);
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
    fn test_detect_with_path_openai() {
        let headers = HeaderMap::new();
        let path = "/v1/chat/completions";

        assert_eq!(
            ClientDetector::detect_with_path(&headers, path),
            ClientType::GenericOpenAI
        );
    }

    #[test]
    fn test_client_expected_format() {
        use super::super::protocol_detector::RequestFormat;

        assert_eq!(
            ClientType::ClaudeCode.expected_format(),
            RequestFormat::Claude
        );
        assert_eq!(ClientType::Cursor.expected_format(), RequestFormat::OpenAI);
        assert_eq!(ClientType::Codex.expected_format(), RequestFormat::OpenAI);
    }
}
