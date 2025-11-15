#![allow(dead_code)]

use crate::models::error_classifier::ErrorRecoverability;
use crate::models::switch_log::ErrorType;

/// 错误分类器 - 分析错误信息并判断是否可恢复
pub struct ErrorClassifier;

impl ErrorClassifier {
    /// 创建新的错误分类器
    pub fn new() -> Self {
        Self
    }

    /// 分类错误信息
    /// 返回: (ErrorType, ErrorRecoverability)
    pub fn classify(&self, error_message: &str) -> (ErrorType, ErrorRecoverability) {
        let lower_msg = error_message.to_lowercase();

        // 1. 网络错误 (可恢复)
        if self.contains_keyword(
            &lower_msg,
            &[
                "dns",
                "connection refused",
                "connection reset",
                "network unreachable",
                "host unreachable",
                "tcp connect",
                "socket",
            ],
        ) {
            return (ErrorType::Network, ErrorRecoverability::Recoverable);
        }

        // 2. 超时错误 (可恢复)
        if self.contains_keyword(
            &lower_msg,
            &["timeout", "timed out", "deadline exceeded", "connection timeout"],
        ) {
            return (ErrorType::Timeout, ErrorRecoverability::Recoverable);
        }

        // 3. 限流错误 (需要特殊延迟)
        if self.contains_keyword(&lower_msg, &["429", "rate limit", "too many requests"]) {
            return (ErrorType::RateLimit, ErrorRecoverability::RateLimit);
        }

        // 4. 余额不足 (不可恢复)
        if self.contains_keyword(
            &lower_msg,
            &[
                "insufficient",
                "balance",
                "credit",
                "quota",
                "billing",
                "payment required",
                "402",
            ],
        ) {
            return (
                ErrorType::InsufficientBalance,
                ErrorRecoverability::Unrecoverable,
            );
        }

        // 5. 账号封禁 (不可恢复)
        if self.contains_keyword(
            &lower_msg,
            &[
                "banned", "suspended", "disabled", "blocked", "terminated", "forbidden", "403",
            ],
        ) {
            return (
                ErrorType::AccountBanned,
                ErrorRecoverability::Unrecoverable,
            );
        }

        // 6. 认证失败 (不可恢复)
        if self.contains_keyword(
            &lower_msg,
            &[
                "unauthorized",
                "401",
                "invalid api key",
                "invalid token",
                "authentication failed",
                "unauthenticated",
            ],
        ) {
            return (
                ErrorType::Authentication,
                ErrorRecoverability::Unrecoverable,
            );
        }

        // 7. 服务器错误 (部分可恢复)
        if self.contains_keyword(&lower_msg, &["500", "502", "503", "504"]) {
            // 502/503 网关错误和服务不可用是临时的,可以重试
            if self.contains_keyword(&lower_msg, &["502", "503", "service unavailable"]) {
                return (ErrorType::ServerError, ErrorRecoverability::Recoverable);
            }
            // 其他 5xx 错误通常不可恢复
            return (
                ErrorType::ServerError,
                ErrorRecoverability::Unrecoverable,
            );
        }

        // 默认: 未知错误,保守处理为可恢复
        (ErrorType::Unknown, ErrorRecoverability::Unknown)
    }

    /// 检查错误消息是否包含任意关键词
    pub fn contains_keyword(&self, message: &str, keywords: &[&str]) -> bool {
        keywords
            .iter()
            .any(|keyword| message.contains(*keyword))
    }

    /// 解析错误消息并提取详细信息
    /// 返回: Option<(错误代码, 错误描述)>
    pub fn parse_error_message(&self, error_message: &str) -> Option<(String, String)> {
        // 尝试提取 HTTP 状态码
        if let Some(code_start) = error_message.find("HTTP ") {
            let code_str = &error_message[code_start + 5..];
            if let Some(code_end) = code_str.find(' ') {
                let code = &code_str[..code_end];
                let description = code_str[code_end + 1..].trim();
                return Some((code.to_string(), description.to_string()));
            }
        }

        // 尝试提取 "Error: " 后的内容
        if let Some(error_start) = error_message.find("Error: ") {
            let description = &error_message[error_start + 7..];
            return Some(("UNKNOWN".to_string(), description.trim().to_string()));
        }

        // 尝试提取数字错误码 (如 "429 Too Many Requests")
        let parts: Vec<&str> = error_message.split_whitespace().collect();
        if !parts.is_empty() {
            if let Ok(_code) = parts[0].parse::<u16>() {
                let description = parts[1..].join(" ");
                return Some((parts[0].to_string(), description));
            }
        }

        None
    }
}

impl Default for ErrorClassifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_network_errors() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("DNS resolution failed");
        assert_eq!(err_type, ErrorType::Network);
        assert_eq!(recoverability, ErrorRecoverability::Recoverable);

        let (err_type, recoverability) = classifier.classify("Connection refused");
        assert_eq!(err_type, ErrorType::Network);
        assert!(recoverability.should_retry());
    }

    #[test]
    fn test_classify_timeout_errors() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("Request timed out");
        assert_eq!(err_type, ErrorType::Timeout);
        assert_eq!(recoverability, ErrorRecoverability::Recoverable);
    }

    #[test]
    fn test_classify_rate_limit() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("429 Too Many Requests");
        assert_eq!(err_type, ErrorType::RateLimit);
        assert_eq!(recoverability, ErrorRecoverability::RateLimit);
        assert!(recoverability.needs_rate_limit_delay());
    }

    #[test]
    fn test_classify_insufficient_balance() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("Insufficient credits");
        assert_eq!(err_type, ErrorType::InsufficientBalance);
        assert_eq!(recoverability, ErrorRecoverability::Unrecoverable);
        assert!(recoverability.should_switch_immediately());
    }

    #[test]
    fn test_classify_account_banned() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("403 Account suspended");
        assert_eq!(err_type, ErrorType::AccountBanned);
        assert!(!recoverability.should_retry());
    }

    #[test]
    fn test_classify_authentication_failed() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("401 Unauthorized - Invalid API Key");
        assert_eq!(err_type, ErrorType::Authentication);
        assert_eq!(recoverability, ErrorRecoverability::Unrecoverable);
    }

    #[test]
    fn test_classify_server_errors() {
        let classifier = ErrorClassifier::new();

        // 502/503 是临时错误,可恢复
        let (err_type, recoverability) = classifier.classify("502 Bad Gateway");
        assert_eq!(err_type, ErrorType::ServerError);
        assert_eq!(recoverability, ErrorRecoverability::Recoverable);

        let (err_type, recoverability) = classifier.classify("503 Service Unavailable");
        assert_eq!(err_type, ErrorType::ServerError);
        assert!(recoverability.should_retry());

        // 500 Internal Server Error 通常不可恢复
        let (err_type, recoverability) = classifier.classify("500 Internal Server Error");
        assert_eq!(err_type, ErrorType::ServerError);
        assert_eq!(recoverability, ErrorRecoverability::Unrecoverable);
    }

    #[test]
    fn test_classify_unknown_error() {
        let classifier = ErrorClassifier::new();

        let (err_type, recoverability) = classifier.classify("Some unknown error");
        assert_eq!(err_type, ErrorType::Unknown);
        assert_eq!(recoverability, ErrorRecoverability::Unknown);
        assert!(recoverability.should_retry()); // 未知错误默认可重试
    }

    #[test]
    fn test_contains_keyword() {
        let classifier = ErrorClassifier::new();

        assert!(classifier.contains_keyword("Connection timeout occurred", &["timeout"]));
        assert!(classifier.contains_keyword("DNS lookup failed", &["dns", "lookup"]));
        assert!(!classifier.contains_keyword("Everything is fine", &["error", "failed"]));
    }

    #[test]
    fn test_parse_error_message() {
        let classifier = ErrorClassifier::new();

        // HTTP 状态码格式
        let result = classifier.parse_error_message("HTTP 429 Too Many Requests");
        assert_eq!(result, Some(("429".to_string(), "Too Many Requests".to_string())));

        // "Error: " 格式
        let result = classifier.parse_error_message("Error: Connection refused");
        assert_eq!(
            result,
            Some(("UNKNOWN".to_string(), "Connection refused".to_string()))
        );

        // 纯数字码格式
        let result = classifier.parse_error_message("401 Unauthorized");
        assert_eq!(result, Some(("401".to_string(), "Unauthorized".to_string())));

        // 无法解析的格式
        let result = classifier.parse_error_message("Something went wrong");
        assert_eq!(result, None);
    }
}
