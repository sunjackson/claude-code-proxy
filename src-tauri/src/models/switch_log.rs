#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// SwitchLog (切换日志) 数据模型
/// 代表自动切换事件的记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchLog {
    /// 日志唯一标识符
    pub id: i64,

    /// 切换时间
    pub switch_at: String,

    /// 切换原因
    pub reason: SwitchReason,

    /// 源配置 ID (切换前)
    pub source_config_id: Option<i64>,

    /// 目标配置 ID (切换后)
    pub target_config_id: i64,

    /// 所属分组 ID
    pub group_id: i64,

    /// 是否跨分组切换 (应始终为 FALSE)
    pub is_cross_group: bool,

    /// 切换前延迟(仅当 reason = 'high_latency')
    pub latency_before_ms: Option<i32>,

    /// 切换后延迟
    pub latency_after_ms: Option<i32>,

    /// 导致切换的错误信息
    pub error_message: Option<String>,

    /// 重试次数 (切换前已经重试的次数)
    pub retry_count: i32,

    /// 错误类型 (用于统计和分析)
    pub error_type: Option<ErrorType>,

    /// 错误详情 (JSON格式的详细错误信息)
    pub error_details: Option<String>,
}

/// 错误类型枚举
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorType {
    /// 网络错误 (DNS, TCP连接失败)
    Network,

    /// 超时错误
    Timeout,

    /// 认证失败 (API Key无效)
    Authentication,

    /// 余额不足
    InsufficientBalance,

    /// 账号封禁
    AccountBanned,

    /// 限流错误 (429 Rate Limit)
    RateLimit,

    /// 服务器错误 (5xx)
    ServerError,

    /// 其他未知错误
    Unknown,
}

impl ErrorType {
    /// 从字符串解析错误类型
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "network" => Ok(ErrorType::Network),
            "timeout" => Ok(ErrorType::Timeout),
            "authentication" => Ok(ErrorType::Authentication),
            "insufficient_balance" => Ok(ErrorType::InsufficientBalance),
            "account_banned" => Ok(ErrorType::AccountBanned),
            "rate_limit" => Ok(ErrorType::RateLimit),
            "server_error" => Ok(ErrorType::ServerError),
            "unknown" => Ok(ErrorType::Unknown),
            _ => Err(format!("无效的错误类型: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            ErrorType::Network => "network",
            ErrorType::Timeout => "timeout",
            ErrorType::Authentication => "authentication",
            ErrorType::InsufficientBalance => "insufficient_balance",
            ErrorType::AccountBanned => "account_banned",
            ErrorType::RateLimit => "rate_limit",
            ErrorType::ServerError => "server_error",
            ErrorType::Unknown => "unknown",
        }
    }

    /// 获取友好描述
    pub fn description(&self) -> &'static str {
        match self {
            ErrorType::Network => "网络错误",
            ErrorType::Timeout => "请求超时",
            ErrorType::Authentication => "认证失败",
            ErrorType::InsufficientBalance => "余额不足",
            ErrorType::AccountBanned => "账号被封禁",
            ErrorType::RateLimit => "请求频率限制",
            ErrorType::ServerError => "服务器错误",
            ErrorType::Unknown => "未知错误",
        }
    }
}

/// 切换原因
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwitchReason {
    /// 连接失败
    ConnectionFailed,

    /// 超时
    Timeout,

    /// 配额超限
    QuotaExceeded,

    /// 高延迟
    HighLatency,

    /// 手动切换
    Manual,

    /// 重试失败 (达到最大重试次数后切换)
    RetryFailed,

    /// 不可恢复错误 (余额不足、账号封禁等)
    UnrecoverableError,

    /// 限流错误 (等待后切换)
    RateLimitExceeded,
}

impl SwitchReason {
    /// 从字符串解析原因
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "connection_failed" => Ok(SwitchReason::ConnectionFailed),
            "timeout" => Ok(SwitchReason::Timeout),
            "quota_exceeded" => Ok(SwitchReason::QuotaExceeded),
            "high_latency" => Ok(SwitchReason::HighLatency),
            "manual" => Ok(SwitchReason::Manual),
            "retry_failed" => Ok(SwitchReason::RetryFailed),
            "unrecoverable_error" => Ok(SwitchReason::UnrecoverableError),
            "rate_limit_exceeded" => Ok(SwitchReason::RateLimitExceeded),
            _ => Err(format!("无效的切换原因: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            SwitchReason::ConnectionFailed => "connection_failed",
            SwitchReason::Timeout => "timeout",
            SwitchReason::QuotaExceeded => "quota_exceeded",
            SwitchReason::HighLatency => "high_latency",
            SwitchReason::Manual => "manual",
            SwitchReason::RetryFailed => "retry_failed",
            SwitchReason::UnrecoverableError => "unrecoverable_error",
            SwitchReason::RateLimitExceeded => "rate_limit_exceeded",
        }
    }

    /// 检查是否为自动切换
    pub fn is_automatic(&self) -> bool {
        !matches!(self, SwitchReason::Manual)
    }

    /// 获取原因的友好描述
    pub fn description(&self) -> &'static str {
        match self {
            SwitchReason::ConnectionFailed => "连接失败",
            SwitchReason::Timeout => "请求超时",
            SwitchReason::QuotaExceeded => "配额超限",
            SwitchReason::HighLatency => "延迟过高",
            SwitchReason::Manual => "手动切换",
            SwitchReason::RetryFailed => "重试失败",
            SwitchReason::UnrecoverableError => "不可恢复错误",
            SwitchReason::RateLimitExceeded => "请求频率限制",
        }
    }
}

/// 创建切换日志的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSwitchLogInput {
    pub reason: SwitchReason,
    pub source_config_id: Option<i64>,
    pub target_config_id: i64,
    pub group_id: i64,
    pub latency_before_ms: Option<i32>,
    pub latency_after_ms: Option<i32>,
    pub error_message: Option<String>,
    pub retry_count: Option<i32>,
    pub error_type: Option<ErrorType>,
    pub error_details: Option<String>,
}

/// 切换日志详情 (用于前端展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchLogDetail {
    /// 日志 ID
    pub id: i64,

    /// 切换时间
    pub switch_at: String,

    /// 切换原因
    pub reason: SwitchReason,

    /// 源配置名称
    pub source_config_name: Option<String>,

    /// 目标配置名称
    pub target_config_name: String,

    /// 分组名称
    pub group_name: String,

    /// 切换前延迟
    pub latency_before_ms: Option<i32>,

    /// 切换后延迟
    pub latency_after_ms: Option<i32>,

    /// 延迟改善 (负值表示恶化)
    pub latency_improvement_ms: Option<i32>,

    /// 错误信息
    pub error_message: Option<String>,

    /// 重试次数
    pub retry_count: i32,

    /// 错误类型
    pub error_type: Option<ErrorType>,

    /// 错误详情
    pub error_details: Option<String>,
}

impl SwitchLog {
    /// 验证切换日志
    pub fn validate(&self) -> Result<(), String> {
        // 验证不跨分组切换 (FR-017)
        if self.is_cross_group {
            return Err("不允许跨分组切换".to_string());
        }

        // 验证延迟值
        if let Some(latency) = self.latency_before_ms {
            if latency < 0 {
                return Err("切换前延迟不能为负数".to_string());
            }
        }

        if let Some(latency) = self.latency_after_ms {
            if latency < 0 {
                return Err("切换后延迟不能为负数".to_string());
            }
        }

        Ok(())
    }

    /// 计算延迟改善 (毫秒)
    /// 返回正值表示改善,负值表示恶化
    pub fn latency_improvement(&self) -> Option<i32> {
        match (self.latency_before_ms, self.latency_after_ms) {
            (Some(before), Some(after)) => Some(before - after),
            _ => None,
        }
    }

    /// 检查切换是否有效 (延迟是否改善)
    pub fn is_improvement(&self) -> Option<bool> {
        self.latency_improvement().map(|improvement| improvement > 0)
    }
}

impl CreateSwitchLogInput {
    /// 验证创建输入
    pub fn validate(&self) -> Result<(), String> {
        if let Some(latency) = self.latency_before_ms {
            if latency < 0 {
                return Err("切换前延迟不能为负数".to_string());
            }
        }

        if let Some(latency) = self.latency_after_ms {
            if latency < 0 {
                return Err("切换后延迟不能为负数".to_string());
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_switch_reason_from_str() {
        assert_eq!(
            SwitchReason::from_str("connection_failed").unwrap(),
            SwitchReason::ConnectionFailed
        );
        assert_eq!(SwitchReason::from_str("manual").unwrap(), SwitchReason::Manual);
        assert!(SwitchReason::from_str("invalid").is_err());
    }

    #[test]
    fn test_is_automatic() {
        assert!(SwitchReason::ConnectionFailed.is_automatic());
        assert!(SwitchReason::HighLatency.is_automatic());
        assert!(!SwitchReason::Manual.is_automatic());
    }

    #[test]
    fn test_latency_improvement() {
        let log = SwitchLog {
            id: 1,
            switch_at: "2025-11-09".to_string(),
            reason: SwitchReason::HighLatency,
            source_config_id: Some(1),
            target_config_id: 2,
            group_id: 1,
            is_cross_group: false,
            latency_before_ms: Some(5000),
            latency_after_ms: Some(500),
            error_message: None,
            retry_count: 0,
            error_type: None,
            error_details: None,
        };

        assert_eq!(log.latency_improvement(), Some(4500)); // 改善了 4500ms
        assert_eq!(log.is_improvement(), Some(true));
    }

    #[test]
    fn test_latency_deterioration() {
        let log = SwitchLog {
            id: 1,
            switch_at: "2025-11-09".to_string(),
            reason: SwitchReason::Manual,
            source_config_id: Some(1),
            target_config_id: 2,
            group_id: 1,
            is_cross_group: false,
            latency_before_ms: Some(500),
            latency_after_ms: Some(5000),
            error_message: None,
            retry_count: 0,
            error_type: None,
            error_details: None,
        };

        assert_eq!(log.latency_improvement(), Some(-4500)); // 恶化了 4500ms
        assert_eq!(log.is_improvement(), Some(false));
    }

    #[test]
    fn test_validate() {
        let valid_log = SwitchLog {
            id: 1,
            switch_at: "2025-11-09".to_string(),
            reason: SwitchReason::Manual,
            source_config_id: Some(1),
            target_config_id: 2,
            group_id: 1,
            is_cross_group: false,
            latency_before_ms: Some(500),
            latency_after_ms: Some(300),
            error_message: None,
            retry_count: 0,
            error_type: None,
            error_details: None,
        };
        assert!(valid_log.validate().is_ok());

        let invalid_log = SwitchLog {
            is_cross_group: true, // 不允许跨分组
            ..valid_log
        };
        assert!(invalid_log.validate().is_err());
    }
}
