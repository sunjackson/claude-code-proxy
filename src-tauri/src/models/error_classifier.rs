#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// 错误可恢复性枚举
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorRecoverability {
    /// 可恢复错误 - 应该重试
    /// 包括: 网络波动、临时超时、服务器暂时不可用 (502/503)
    Recoverable,

    /// 不可恢复错误 - 应该立即切换
    /// 包括: 余额不足、账号封禁、认证失败
    Unrecoverable,

    /// 限流错误 - 需要特殊延迟后重试
    /// 包括: 429 Rate Limit
    RateLimit,

    /// 未知错误 - 默认当作可恢复处理
    Unknown,
}

impl ErrorRecoverability {
    /// 判断是否应该重试
    pub fn should_retry(&self) -> bool {
        matches!(
            self,
            ErrorRecoverability::Recoverable
                | ErrorRecoverability::RateLimit
                | ErrorRecoverability::Unknown
        )
    }

    /// 判断是否应该立即切换
    pub fn should_switch_immediately(&self) -> bool {
        matches!(self, ErrorRecoverability::Unrecoverable)
    }

    /// 判断是否需要特殊延迟
    pub fn needs_rate_limit_delay(&self) -> bool {
        matches!(self, ErrorRecoverability::RateLimit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_retry() {
        assert!(ErrorRecoverability::Recoverable.should_retry());
        assert!(ErrorRecoverability::RateLimit.should_retry());
        assert!(ErrorRecoverability::Unknown.should_retry());
        assert!(!ErrorRecoverability::Unrecoverable.should_retry());
    }

    #[test]
    fn test_should_switch_immediately() {
        assert!(ErrorRecoverability::Unrecoverable.should_switch_immediately());
        assert!(!ErrorRecoverability::Recoverable.should_switch_immediately());
        assert!(!ErrorRecoverability::RateLimit.should_switch_immediately());
        assert!(!ErrorRecoverability::Unknown.should_switch_immediately());
    }

    #[test]
    fn test_needs_rate_limit_delay() {
        assert!(ErrorRecoverability::RateLimit.needs_rate_limit_delay());
        assert!(!ErrorRecoverability::Recoverable.needs_rate_limit_delay());
        assert!(!ErrorRecoverability::Unrecoverable.needs_rate_limit_delay());
        assert!(!ErrorRecoverability::Unknown.needs_rate_limit_delay());
    }
}
