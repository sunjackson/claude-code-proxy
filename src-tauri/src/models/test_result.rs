#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// TestResult (测试结果) 数据模型
/// 代表 API 配置的测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    /// 测试结果唯一标识符
    pub id: i64,

    /// 被测试的 API 配置 ID
    pub config_id: i64,

    /// 所属分组 ID (冗余,方便查询)
    pub group_id: Option<i64>,

    /// 测试时间
    pub test_at: String,

    /// 连接状态
    pub status: TestStatus,

    /// 响应延迟(毫秒),仅当 status = 'success'
    pub latency_ms: Option<i32>,

    /// 错误信息(当 status != 'success' 时)
    pub error_message: Option<String>,

    /// API 密钥是否有效
    pub is_valid_key: Option<bool>,
}

/// 测试状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    /// 成功
    Success,

    /// 失败
    Failed,

    /// 超时
    Timeout,
}

impl TestStatus {
    /// 从字符串解析状态
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "success" => Ok(TestStatus::Success),
            "failed" => Ok(TestStatus::Failed),
            "timeout" => Ok(TestStatus::Timeout),
            _ => Err(format!("无效的测试状态: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            TestStatus::Success => "success",
            TestStatus::Failed => "failed",
            TestStatus::Timeout => "timeout",
        }
    }

    /// 检查是否成功
    pub fn is_success(&self) -> bool {
        matches!(self, TestStatus::Success)
    }

    /// 检查是否失败
    pub fn is_failed(&self) -> bool {
        matches!(self, TestStatus::Failed | TestStatus::Timeout)
    }
}

/// 创建测试结果的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTestResultInput {
    pub config_id: i64,
    pub group_id: Option<i64>,
    pub status: TestStatus,
    pub latency_ms: Option<i32>,
    pub error_message: Option<String>,
    pub is_valid_key: Option<bool>,
}

/// 测试结果摘要 (用于批量测试)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResultSummary {
    /// 配置 ID
    pub config_id: i64,

    /// 配置名称
    pub config_name: String,

    /// 测试状态
    pub status: TestStatus,

    /// 延迟(毫秒)
    pub latency_ms: Option<i32>,

    /// API 密钥是否有效
    pub is_valid_key: Option<bool>,

    /// 错误信息
    pub error_message: Option<String>,

    /// 测试时间
    pub test_at: String,
}

impl TestResult {
    /// 验证延迟值
    pub fn validate_latency(latency_ms: i32) -> Result<(), String> {
        if latency_ms < 0 {
            return Err("延迟值不能为负数".to_string());
        }

        Ok(())
    }

    /// 检查测试是否成功
    pub fn is_success(&self) -> bool {
        self.status.is_success()
    }

    /// 检查测试是否失败
    pub fn is_failed(&self) -> bool {
        self.status.is_failed()
    }

    /// 获取延迟等级
    /// 返回: "excellent" | "good" | "fair" | "poor"
    pub fn latency_grade(&self) -> Option<&'static str> {
        self.latency_ms.map(|latency| {
            if latency < 500 {
                "excellent" // < 500ms: 优秀
            } else if latency < 1000 {
                "good" // 500-1000ms: 良好
            } else if latency < 3000 {
                "fair" // 1000-3000ms: 一般
            } else {
                "poor" // > 3000ms: 较差
            }
        })
    }
}

impl CreateTestResultInput {
    /// 验证创建输入
    pub fn validate(&self) -> Result<(), String> {
        if let Some(latency) = self.latency_ms {
            TestResult::validate_latency(latency)?;
        }

        // 成功的测试应该有延迟值
        if self.status.is_success() && self.latency_ms.is_none() {
            return Err("成功的测试必须包含延迟值".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_test_status_from_str() {
        assert_eq!(TestStatus::from_str("success").unwrap(), TestStatus::Success);
        assert_eq!(TestStatus::from_str("failed").unwrap(), TestStatus::Failed);
        assert_eq!(TestStatus::from_str("timeout").unwrap(), TestStatus::Timeout);
        assert!(TestStatus::from_str("invalid").is_err());
    }

    #[test]
    fn test_test_status_as_str() {
        assert_eq!(TestStatus::Success.as_str(), "success");
        assert_eq!(TestStatus::Failed.as_str(), "failed");
        assert_eq!(TestStatus::Timeout.as_str(), "timeout");
    }

    #[test]
    fn test_is_success() {
        assert!(TestStatus::Success.is_success());
        assert!(!TestStatus::Failed.is_success());
        assert!(!TestStatus::Timeout.is_success());
    }

    #[test]
    fn test_is_failed() {
        assert!(!TestStatus::Success.is_failed());
        assert!(TestStatus::Failed.is_failed());
        assert!(TestStatus::Timeout.is_failed());
    }

    #[test]
    fn test_validate_latency() {
        assert!(TestResult::validate_latency(100).is_ok());
        assert!(TestResult::validate_latency(0).is_ok());
        assert!(TestResult::validate_latency(-1).is_err());
    }

    #[test]
    fn test_latency_grade() {
        let result = TestResult {
            id: 1,
            config_id: 1,
            group_id: None,
            test_at: "2025-11-09".to_string(),
            status: TestStatus::Success,
            latency_ms: Some(300),
            error_message: None,
            is_valid_key: Some(true),
        };
        assert_eq!(result.latency_grade(), Some("excellent"));

        let result2 = TestResult {
            latency_ms: Some(800),
            ..result.clone()
        };
        assert_eq!(result2.latency_grade(), Some("good"));

        let result3 = TestResult {
            latency_ms: Some(2000),
            ..result.clone()
        };
        assert_eq!(result3.latency_grade(), Some("fair"));

        let result4 = TestResult {
            latency_ms: Some(5000),
            ..result.clone()
        };
        assert_eq!(result4.latency_grade(), Some("poor"));
    }

    #[test]
    fn test_create_input_validation() {
        let valid_input = CreateTestResultInput {
            config_id: 1,
            group_id: Some(1),
            status: TestStatus::Success,
            latency_ms: Some(500),
            error_message: None,
            is_valid_key: Some(true),
        };
        assert!(valid_input.validate().is_ok());

        let invalid_input = CreateTestResultInput {
            config_id: 1,
            group_id: Some(1),
            status: TestStatus::Success,
            latency_ms: None, // 成功的测试必须有延迟
            error_message: None,
            is_valid_key: Some(true),
        };
        assert!(invalid_input.validate().is_err());
    }
}
