/**
 * Protocol Detection Module
 * Automatically detects request format (Claude/OpenAI/Gemini) based on URI path
 *
 * Supports bidirectional protocol conversion:
 * - Claude Code → OpenAI API (Claude format → OpenAI format)
 * - Codex/Cursor → Claude API (OpenAI format → Claude format)
 */

use hyper::Uri;

/// Detected request format based on URI path
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestFormat {
    /// Claude Messages API format
    /// Path: /v1/messages
    Claude,

    /// OpenAI Chat Completions API format
    /// Path: /v1/chat/completions
    OpenAI,

    /// Gemini API format
    /// Path: /v1beta/models/*/generateContent
    Gemini,

    /// Unknown format - default to Claude for backward compatibility
    Unknown,
}

impl std::fmt::Display for RequestFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RequestFormat::Claude => write!(f, "claude"),
            RequestFormat::OpenAI => write!(f, "openai"),
            RequestFormat::Gemini => write!(f, "gemini"),
            RequestFormat::Unknown => write!(f, "unknown"),
        }
    }
}

impl RequestFormat {
    /// Check if format is Claude (including Unknown which defaults to Claude)
    pub fn is_claude_compatible(&self) -> bool {
        matches!(self, RequestFormat::Claude | RequestFormat::Unknown)
    }

    /// Check if format is OpenAI
    pub fn is_openai(&self) -> bool {
        matches!(self, RequestFormat::OpenAI)
    }

    /// Check if format is Gemini
    pub fn is_gemini(&self) -> bool {
        matches!(self, RequestFormat::Gemini)
    }
}

/// Protocol detector for identifying API request formats
pub struct ProtocolDetector;

impl ProtocolDetector {
    /// Detect request format from URI
    ///
    /// # Arguments
    /// - `uri`: The request URI
    ///
    /// # Returns
    /// - `RequestFormat`: The detected request format
    ///
    /// # Examples
    /// ```
    /// use proxy::protocol_detector::{ProtocolDetector, RequestFormat};
    ///
    /// let uri: hyper::Uri = "/v1/messages".parse().unwrap();
    /// assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::Claude);
    ///
    /// let uri: hyper::Uri = "/v1/chat/completions".parse().unwrap();
    /// assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::OpenAI);
    /// ```
    pub fn detect(uri: &Uri) -> RequestFormat {
        let path = uri.path();

        // Claude Messages API
        // Standard path: /v1/messages
        if path.starts_with("/v1/messages") {
            return RequestFormat::Claude;
        }

        // OpenAI Chat Completions API
        // Standard path: /v1/chat/completions
        if path.starts_with("/v1/chat/completions") {
            return RequestFormat::OpenAI;
        }

        // OpenAI Completions API (legacy)
        // Standard path: /v1/completions
        if path.starts_with("/v1/completions") && !path.contains("chat") {
            return RequestFormat::OpenAI;
        }

        // OpenAI Models API (for health check)
        // Standard path: /v1/models
        if path.starts_with("/v1/models") {
            return RequestFormat::OpenAI;
        }

        // Gemini API
        // Standard path: /v1beta/models/{model}:generateContent
        // Or: /v1beta/models/{model}:streamGenerateContent
        if path.contains("/generateContent") || path.contains(":streamGenerateContent") {
            return RequestFormat::Gemini;
        }

        // Gemini models list
        if path.starts_with("/v1beta/models") {
            return RequestFormat::Gemini;
        }

        // Unknown format - default to Claude for backward compatibility
        // This ensures existing Claude Code clients continue to work
        log::debug!(
            "Unknown request path format: {}, defaulting to Claude",
            path
        );
        RequestFormat::Unknown
    }

    /// Detect request format from path string
    ///
    /// Convenience method for when you only have the path string
    pub fn detect_from_path(path: &str) -> RequestFormat {
        // Parse path as URI
        match path.parse::<Uri>() {
            Ok(uri) => Self::detect(&uri),
            Err(_) => {
                // If parsing fails, try simple string matching
                if path.starts_with("/v1/messages") {
                    RequestFormat::Claude
                } else if path.starts_with("/v1/chat/completions") {
                    RequestFormat::OpenAI
                } else if path.starts_with("/v1/completions") {
                    RequestFormat::OpenAI
                } else if path.starts_with("/v1/models") {
                    RequestFormat::OpenAI
                } else if path.contains("/generateContent") {
                    RequestFormat::Gemini
                } else {
                    RequestFormat::Unknown
                }
            }
        }
    }

    /// Get the standard API path for a given format
    ///
    /// # Arguments
    /// - `format`: The request format
    ///
    /// # Returns
    /// - The standard API path for that format
    pub fn get_standard_path(format: RequestFormat) -> &'static str {
        match format {
            RequestFormat::Claude => "/v1/messages",
            RequestFormat::OpenAI => "/v1/chat/completions",
            RequestFormat::Gemini => "/v1beta/models",
            RequestFormat::Unknown => "/v1/messages", // Default to Claude
        }
    }
}

/// Conversion matrix entry
/// Defines how to convert between source and target formats
#[derive(Debug, Clone)]
pub struct ConversionRule {
    /// Source request format
    pub source_format: RequestFormat,
    /// Target API provider format
    pub target_provider: crate::models::api_config::ProviderType,
    /// Whether direct passthrough is possible (no conversion needed)
    pub is_passthrough: bool,
    /// Description of the conversion
    pub description: &'static str,
}

impl ConversionRule {
    /// Create a new conversion rule
    pub const fn new(
        source_format: RequestFormat,
        target_provider: crate::models::api_config::ProviderType,
        is_passthrough: bool,
        description: &'static str,
    ) -> Self {
        Self {
            source_format,
            target_provider,
            is_passthrough,
            description,
        }
    }
}

/// Conversion matrix for protocol conversion decisions
///
/// Matrix layout:
/// ```text
/// ┌─────────────┬─────────┬─────────┬─────────┐
/// │ 请求/目标   │ Claude  │ Gemini  │ OpenAI  │
/// ├─────────────┼─────────┼─────────┼─────────┤
/// │ Claude 格式 │  直通   │ C→G 转换│ C→O 转换│
/// │ OpenAI 格式 │ O→C 转换│ O→G 转换│  直通   │
/// └─────────────┴─────────┴─────────┴─────────┘
/// ```
pub struct ConversionMatrix;

impl ConversionMatrix {
    /// Determine if conversion is needed and get the conversion type
    ///
    /// # Arguments
    /// - `source_format`: The detected request format
    /// - `target_provider`: The target API provider type
    ///
    /// # Returns
    /// - `ConversionRule`: The conversion rule to apply
    pub fn get_conversion_rule(
        source_format: RequestFormat,
        target_provider: crate::models::api_config::ProviderType,
    ) -> ConversionRule {
        use crate::models::api_config::ProviderType;

        match (source_format, &target_provider) {
            // Claude format requests
            (RequestFormat::Claude, ProviderType::Claude) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                true,
                "Claude → Claude: Passthrough",
            ),
            (RequestFormat::Claude, ProviderType::Gemini) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                false,
                "Claude → Gemini: Convert request/response",
            ),
            (RequestFormat::Claude, ProviderType::OpenAI) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                false,
                "Claude → OpenAI: Convert request/response",
            ),

            // OpenAI format requests
            (RequestFormat::OpenAI, ProviderType::Claude) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                false,
                "OpenAI → Claude: Convert request/response",
            ),
            (RequestFormat::OpenAI, ProviderType::Gemini) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                false,
                "OpenAI → Gemini: Convert request/response",
            ),
            (RequestFormat::OpenAI, ProviderType::OpenAI) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                true,
                "OpenAI → OpenAI: Passthrough",
            ),

            // Gemini format requests (future support)
            (RequestFormat::Gemini, ProviderType::Gemini) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                true,
                "Gemini → Gemini: Passthrough",
            ),
            (RequestFormat::Gemini, ProviderType::Claude) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                false,
                "Gemini → Claude: Convert request/response",
            ),
            (RequestFormat::Gemini, ProviderType::OpenAI) => ConversionRule::new(
                source_format,
                target_provider.clone(),
                false,
                "Gemini → OpenAI: Convert request/response",
            ),

            // Unknown format - treat as Claude (backward compatibility)
            (RequestFormat::Unknown, ProviderType::Claude) => ConversionRule::new(
                RequestFormat::Claude,
                target_provider.clone(),
                true,
                "Unknown (Claude) → Claude: Passthrough",
            ),
            (RequestFormat::Unknown, ProviderType::Gemini) => ConversionRule::new(
                RequestFormat::Claude,
                target_provider.clone(),
                false,
                "Unknown (Claude) → Gemini: Convert request/response",
            ),
            (RequestFormat::Unknown, ProviderType::OpenAI) => ConversionRule::new(
                RequestFormat::Claude,
                target_provider.clone(),
                false,
                "Unknown (Claude) → OpenAI: Convert request/response",
            ),
        }
    }

    /// Check if direct passthrough is possible
    pub fn is_passthrough(
        source_format: RequestFormat,
        target_provider: crate::models::api_config::ProviderType,
    ) -> bool {
        Self::get_conversion_rule(source_format, target_provider).is_passthrough
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::api_config::ProviderType;

    #[test]
    fn test_detect_claude_format() {
        let uri: Uri = "/v1/messages".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::Claude);

        let uri: Uri = "/v1/messages?some=param".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::Claude);
    }

    #[test]
    fn test_detect_openai_format() {
        let uri: Uri = "/v1/chat/completions".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::OpenAI);

        let uri: Uri = "/v1/completions".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::OpenAI);

        let uri: Uri = "/v1/models".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::OpenAI);
    }

    #[test]
    fn test_detect_gemini_format() {
        let uri: Uri = "/v1beta/models/gemini-pro:generateContent".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::Gemini);

        let uri: Uri = "/v1beta/models/gemini-pro:streamGenerateContent"
            .parse()
            .unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::Gemini);
    }

    #[test]
    fn test_detect_unknown_defaults_to_unknown() {
        let uri: Uri = "/some/random/path".parse().unwrap();
        assert_eq!(ProtocolDetector::detect(&uri), RequestFormat::Unknown);

        // But it should be Claude-compatible
        assert!(ProtocolDetector::detect(&uri).is_claude_compatible());
    }

    #[test]
    fn test_detect_from_path() {
        assert_eq!(
            ProtocolDetector::detect_from_path("/v1/messages"),
            RequestFormat::Claude
        );
        assert_eq!(
            ProtocolDetector::detect_from_path("/v1/chat/completions"),
            RequestFormat::OpenAI
        );
    }

    #[test]
    fn test_conversion_matrix_passthrough() {
        // Claude → Claude should be passthrough
        assert!(ConversionMatrix::is_passthrough(
            RequestFormat::Claude,
            ProviderType::Claude
        ));

        // OpenAI → OpenAI should be passthrough
        assert!(ConversionMatrix::is_passthrough(
            RequestFormat::OpenAI,
            ProviderType::OpenAI
        ));

        // Claude → OpenAI should NOT be passthrough
        assert!(!ConversionMatrix::is_passthrough(
            RequestFormat::Claude,
            ProviderType::OpenAI
        ));

        // OpenAI → Claude should NOT be passthrough
        assert!(!ConversionMatrix::is_passthrough(
            RequestFormat::OpenAI,
            ProviderType::Claude
        ));
    }

    #[test]
    fn test_conversion_matrix_rules() {
        let rule = ConversionMatrix::get_conversion_rule(RequestFormat::OpenAI, ProviderType::Claude);

        assert_eq!(rule.source_format, RequestFormat::OpenAI);
        assert_eq!(rule.target_provider, ProviderType::Claude);
        assert!(!rule.is_passthrough);
        assert!(rule.description.contains("OpenAI → Claude"));
    }

    #[test]
    fn test_request_format_display() {
        assert_eq!(format!("{}", RequestFormat::Claude), "claude");
        assert_eq!(format!("{}", RequestFormat::OpenAI), "openai");
        assert_eq!(format!("{}", RequestFormat::Gemini), "gemini");
        assert_eq!(format!("{}", RequestFormat::Unknown), "unknown");
    }

    #[test]
    fn test_get_standard_path() {
        assert_eq!(
            ProtocolDetector::get_standard_path(RequestFormat::Claude),
            "/v1/messages"
        );
        assert_eq!(
            ProtocolDetector::get_standard_path(RequestFormat::OpenAI),
            "/v1/chat/completions"
        );
        assert_eq!(
            ProtocolDetector::get_standard_path(RequestFormat::Gemini),
            "/v1beta/models"
        );
    }
}
