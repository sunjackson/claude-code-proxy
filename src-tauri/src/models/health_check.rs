#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// 健康检查状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthCheckStatus {
    /// 检查成功
    Success,
    /// 检查失败
    Failed,
    /// 检查超时
    Timeout,
}

impl HealthCheckStatus {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "success" => Ok(HealthCheckStatus::Success),
            "failed" => Ok(HealthCheckStatus::Failed),
            "timeout" => Ok(HealthCheckStatus::Timeout),
            _ => Err(format!("未知的健康检查状态: {}", s)),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            HealthCheckStatus::Success => "success",
            HealthCheckStatus::Failed => "failed",
            HealthCheckStatus::Timeout => "timeout",
        }
    }
}

/// 健康检查记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckRecord {
    /// 记录 ID
    pub id: i64,
    /// 配置 ID
    pub config_id: i64,
    /// 检查时间
    pub check_at: String,
    /// 检查状态
    pub status: HealthCheckStatus,
    /// 延迟(毫秒)
    pub latency_ms: Option<i64>,
    /// 错误信息
    pub error_message: Option<String>,
    /// HTTP 状态码
    pub http_status_code: Option<i32>,
}

/// 创建健康检查记录的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHealthCheckRecordInput {
    pub config_id: i64,
    pub status: HealthCheckStatus,
    pub latency_ms: Option<i64>,
    pub error_message: Option<String>,
    pub http_status_code: Option<i32>,
}

/// 小时级别健康检查统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckHourlyStats {
    /// 配置 ID
    pub config_id: i64,
    /// 小时时间戳 (格式: YYYY-MM-DD HH:00:00)
    pub hour: String,
    /// 总检查次数
    pub total_checks: i64,
    /// 成功次数
    pub success_count: i64,
    /// 失败次数
    pub failed_count: i64,
    /// 超时次数
    pub timeout_count: i64,
    /// 平均延迟(毫秒)
    pub avg_latency_ms: Option<f64>,
    /// 最小延迟(毫秒)
    pub min_latency_ms: Option<i64>,
    /// 最大延迟(毫秒)
    pub max_latency_ms: Option<i64>,
}

/// 配置健康检查摘要(用于前端显示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigHealthSummary {
    /// 配置 ID
    pub config_id: i64,
    /// 配置名称
    pub config_name: String,
    /// 当天小时级别统计 (0:00-23:00)
    pub hourly_stats: Vec<HealthCheckHourlyStats>,
    /// 最后一次检查记录
    pub last_check: Option<HealthCheckRecord>,
    /// 当天可用率(0-100)，字段名保留 24h 以保持 API 兼容性
    pub availability_24h: f64,
    /// 当天平均延迟，字段名保留 24h 以保持 API 兼容性
    pub avg_latency_24h: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_check_status_from_str() {
        assert_eq!(
            HealthCheckStatus::from_str("success").unwrap(),
            HealthCheckStatus::Success
        );
        assert_eq!(
            HealthCheckStatus::from_str("failed").unwrap(),
            HealthCheckStatus::Failed
        );
        assert_eq!(
            HealthCheckStatus::from_str("timeout").unwrap(),
            HealthCheckStatus::Timeout
        );
        assert!(HealthCheckStatus::from_str("unknown").is_err());
    }

    #[test]
    fn test_health_check_status_as_str() {
        assert_eq!(HealthCheckStatus::Success.as_str(), "success");
        assert_eq!(HealthCheckStatus::Failed.as_str(), "failed");
        assert_eq!(HealthCheckStatus::Timeout.as_str(), "timeout");
    }
}
