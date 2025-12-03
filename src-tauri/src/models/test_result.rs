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

    /// API 响应内容（截断到100字符）
    pub response_text: Option<String>,

    /// 测试使用的模型
    pub test_model: Option<String>,

    /// 尝试次数（1=首次，2=重试）
    pub attempt: Option<i32>,
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
    pub response_text: Option<String>,
    pub test_model: Option<String>,
    pub attempt: Option<i32>,
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

    /// API 响应内容
    pub response_text: Option<String>,

    /// 测试使用的模型
    pub test_model: Option<String>,

    /// 尝试次数
    pub attempt: Option<i32>,
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

    /// 检查服务是否可用
    ///
    /// 服务可用的标准：能够连接并收到HTTP响应，且不是服务器端错误
    /// - ✅ 可用：200-299 成功，400-499 客户端错误（认证、权限、限流等可修复问题）
    /// - ❌ 不可用：500-599状态码、server_error、超时、连接失败、DNS失败、负载过高
    ///
    /// 注意：此方法与 is_success() 不同
    /// - is_success()：API调用完全成功（200-299且有正确响应）
    /// - is_available()：服务器可连接且能正常处理请求（不是服务端问题）
    pub fn is_available(&self) -> bool {
        match self.status {
            // 成功的测试，服务肯定可用
            TestStatus::Success => true,

            // 超时，服务不可用
            TestStatus::Timeout => false,

            // 失败的测试，需要检查错误信息来判断
            TestStatus::Failed => {
                if let Some(ref error) = self.error_message {
                    let error_lower = error.to_lowercase();

                    // 服务器错误（5xx）表示不可用
                    if error.contains("HTTP 5")
                        || error.contains("服务器错误")
                        || error.contains("服务商错误") {
                        return false;
                    }

                    // server_error 类型的错误表示服务端问题，不可用
                    if error_lower.contains("server_error") {
                        return false;
                    }

                    // 负载过高、服务过载等表示不可用
                    if error.contains("负载过高")
                        || error.contains("过载")
                        || error_lower.contains("overloaded")
                        || error_lower.contains("overload") {
                        return false;
                    }

                    // 连接失败表示不可用
                    if error.contains("连接失败")
                        || error.contains("DNS解析失败")
                        || error.contains("连接被拒绝")
                        || error.contains("连接重置") {
                        return false;
                    }

                    // 其他错误（400、401、403、429等）说明服务可用，只是配置或权限问题
                    true
                } else {
                    // 没有错误信息，默认认为不可用
                    false
                }
            }
        }
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
            response_text: None,
            test_model: None,
            attempt: None,
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
            response_text: None,
            test_model: None,
            attempt: None,
        };
        assert!(valid_input.validate().is_ok());

        let invalid_input = CreateTestResultInput {
            config_id: 1,
            group_id: Some(1),
            status: TestStatus::Success,
            latency_ms: None, // 成功的测试必须有延迟
            error_message: None,
            is_valid_key: Some(true),
            response_text: None,
            test_model: None,
            attempt: None,
        };
        assert!(invalid_input.validate().is_err());
    }

    #[test]
    fn test_is_available() {
        // 成功的测试，服务可用
        let success_result = TestResult {
            id: 1,
            config_id: 1,
            group_id: None,
            test_at: "2025-11-12".to_string(),
            status: TestStatus::Success,
            latency_ms: Some(300),
            error_message: None,
            is_valid_key: Some(true),
            response_text: Some("Success".to_string()),
            test_model: Some("claude-haiku-4-5-20251001".to_string()),
            attempt: Some(1),
        };
        assert!(success_result.is_available());

        // 超时，服务不可用
        let timeout_result = TestResult {
            status: TestStatus::Timeout,
            error_message: Some("测试超时(>30秒)".to_string()),
            latency_ms: None,
            ..success_result.clone()
        };
        assert!(!timeout_result.is_available());

        // 401 认证失败，服务可用（只是密钥问题）
        let auth_failed_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("认证失败：API Key 无效".to_string()),
            latency_ms: Some(500),
            is_valid_key: Some(false),
            response_text: None,
            ..success_result.clone()
        };
        assert!(auth_failed_result.is_available());

        // 403 访问被拒绝，服务可用（只是权限问题）
        let forbidden_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("访问被拒绝：IP地址受限".to_string()),
            latency_ms: Some(500),
            ..success_result.clone()
        };
        assert!(forbidden_result.is_available());

        // 429 配额耗尽，服务可用（只是限流问题）
        let rate_limited_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("配额耗尽：请求过多或余额不足".to_string()),
            latency_ms: Some(500),
            ..success_result.clone()
        };
        assert!(rate_limited_result.is_available());

        // 400 请求格式错误，服务可用（只是请求问题）
        let bad_request_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("请求格式错误：模型参数无效".to_string()),
            latency_ms: Some(500),
            ..success_result.clone()
        };
        assert!(bad_request_result.is_available());

        // 500 服务器错误，服务不可用
        let server_error_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("服务器错误：HTTP 500 - Internal Server Error".to_string()),
            latency_ms: Some(500),
            ..success_result.clone()
        };
        assert!(!server_error_result.is_available());

        // 502 网关错误，服务不可用
        let gateway_error_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("服务器错误：HTTP 502 - Bad Gateway".to_string()),
            latency_ms: Some(500),
            ..success_result.clone()
        };
        assert!(!gateway_error_result.is_available());

        // 连接失败，服务不可用
        let connection_failed_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("连接失败：无法连接到服务器".to_string()),
            latency_ms: Some(5000),
            ..success_result.clone()
        };
        assert!(!connection_failed_result.is_available());

        // DNS解析失败，服务不可用
        let dns_failed_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("DNS解析失败：域名无法解析".to_string()),
            latency_ms: Some(5000),
            ..success_result.clone()
        };
        assert!(!dns_failed_result.is_available());

        // server_error 类型错误（如负载过高），服务不可用
        let server_error_overload = TestResult {
            status: TestStatus::Failed,
            error_message: Some("服务商错误: 错误代码 400 - server_error: 当前模型负载过高，请稍后重试".to_string()),
            latency_ms: Some(1500),
            ..success_result.clone()
        };
        assert!(!server_error_overload.is_available());

        // 包含 "负载过高" 关键词的错误，服务不可用
        let load_too_high = TestResult {
            status: TestStatus::Failed,
            error_message: Some("API 错误: 当前模型负载过高".to_string()),
            latency_ms: Some(1500),
            ..success_result.clone()
        };
        assert!(!load_too_high.is_available());

        // overloaded 错误，服务不可用
        let overloaded_result = TestResult {
            status: TestStatus::Failed,
            error_message: Some("Error: Service is overloaded, please try again later".to_string()),
            latency_ms: Some(1500),
            ..success_result.clone()
        };
        assert!(!overloaded_result.is_available());
    }
}
