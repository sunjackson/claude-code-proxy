use serde::{Deserialize, Serialize};

/// 余额查询结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceInfo {
    /// 配置ID
    pub config_id: i64,
    /// 配置名称
    pub config_name: String,
    /// 余额
    pub balance: Option<f64>,
    /// 货币单位
    pub currency: Option<String>,
    /// 查询状态
    pub status: BalanceQueryStatus,
    /// 查询时间
    pub checked_at: String,
    /// 错误信息
    pub error_message: Option<String>,
}

/// 余额查询状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BalanceQueryStatus {
    /// 查询成功
    Success,
    /// 查询失败
    Failed,
    /// 等待查询
    Pending,
}

impl std::fmt::Display for BalanceQueryStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BalanceQueryStatus::Success => write!(f, "success"),
            BalanceQueryStatus::Failed => write!(f, "failed"),
            BalanceQueryStatus::Pending => write!(f, "pending"),
        }
    }
}

impl Default for BalanceQueryStatus {
    fn default() -> Self {
        BalanceQueryStatus::Pending
    }
}

/// 余额查询响应（不同供应商的API响应格式可能不同）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum BalanceResponse {
    /// 标准格式：{ "balance": 100.50, "currency": "CNY" }
    Standard {
        balance: f64,
        #[serde(default = "default_currency")]
        currency: String,
    },
    /// 嵌套格式：{ "data": { "balance": 100.50 } }
    Nested {
        data: NestedBalanceData,
    },
    /// 88code Usage 格式（已废弃）：{ "used_tokens": 1000, "remaining_tokens": 9000, "credit_limit": 100.0 }
    EightyEightCodeUsage {
        used_tokens: i64,
        remaining_tokens: i64,
        credit_limit: f64,
    },
    /// 88code Subscription 格式（当前使用）：数组，取第一个激活的订阅
    EightyEightCodeSubscription(Vec<EightyEightCodeSub>),
    /// 自定义格式
    Custom(serde_json::Value),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NestedBalanceData {
    pub balance: f64,
    #[serde(default = "default_currency")]
    pub currency: String,
}

/// 88code Subscription 数据结构（简化版，仅包含余额查询需要的字段）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EightyEightCodeSub {
    pub id: i64,
    pub current_credits: f64,
    pub subscription_plan_name: String,
    pub is_active: bool,
    #[serde(default)]
    pub remaining_days: i32,
    #[serde(default)]
    pub end_date: Option<String>,
}

fn default_currency() -> String {
    "CNY".to_string()
}

impl BalanceResponse {
    /// 提取余额值
    pub fn extract_balance(&self) -> Option<f64> {
        match self {
            BalanceResponse::Standard { balance, .. } => Some(*balance),
            BalanceResponse::Nested { data } => Some(data.balance),
            BalanceResponse::EightyEightCodeUsage {
                remaining_tokens, ..
            } => {
                // 88code Usage 格式：remaining_tokens 除以 100 得到美元
                Some((*remaining_tokens as f64) / 100.0)
            }
            BalanceResponse::EightyEightCodeSubscription(subs) => {
                // 取第一个激活的订阅，返回 currentCredits
                subs.iter()
                    .find(|s| s.is_active)
                    .map(|s| s.current_credits)
                    .or_else(|| {
                        // 如果没有激活的订阅，取第一个
                        subs.first().map(|s| s.current_credits)
                    })
            }
            BalanceResponse::Custom(value) => {
                // 尝试从各种可能的字段中提取余额
                value.get("balance")
                    .or_else(|| value.get("data").and_then(|d| d.get("balance")))
                    .or_else(|| value.get("amount"))
                    .and_then(|v| v.as_f64())
                    .or_else(|| {
                        // 尝试 88code Usage 格式
                        value.get("remaining_tokens")
                            .and_then(|v| v.as_i64())
                            .map(|t| (t as f64) / 100.0)
                    })
            }
        }
    }

    /// 提取货币单位
    pub fn extract_currency(&self) -> String {
        match self {
            BalanceResponse::Standard { currency, .. } => currency.clone(),
            BalanceResponse::Nested { data } => data.currency.clone(),
            BalanceResponse::EightyEightCodeUsage { .. } => "USD".to_string(), // 88code Usage 使用美元
            BalanceResponse::EightyEightCodeSubscription { .. } => "Credits".to_string(), // 88code Subscription 使用 Credits
            BalanceResponse::Custom(value) => {
                value.get("currency")
                    .or_else(|| value.get("data").and_then(|d| d.get("currency")))
                    .and_then(|v| v.as_str())
                    .unwrap_or("CNY")
                    .to_string()
            }
        }
    }
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;

    #[test]
    fn test_balance_response_standard() {
        let json = r#"{"balance": 100.50, "currency": "CNY"}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.extract_balance(), Some(100.50));
        assert_eq!(response.extract_currency(), "CNY");
    }

    #[test]
    fn test_balance_response_nested() {
        let json = r#"{"data": {"balance": 50.25, "currency": "USD"}}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.extract_balance(), Some(50.25));
        assert_eq!(response.extract_currency(), "USD");
    }

    #[test]
    fn test_balance_response_custom() {
        let json = r#"{"amount": 75.00}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.extract_balance(), Some(75.00));
        assert_eq!(response.extract_currency(), "CNY"); // 默认值
    }

    #[test]
    fn test_balance_response_88code_usage() {
        // 测试 88code Usage 格式（已废弃）
        let json = r#"{"used_tokens": 1000, "remaining_tokens": 9000, "credit_limit": 100.0}"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();

        // remaining_tokens = 9000, 除以 100 = 90.00
        assert_eq!(response.extract_balance(), Some(90.00));
        assert_eq!(response.extract_currency(), "USD");
    }

    #[test]
    fn test_balance_response_88code_subscription() {
        // 测试 88code Subscription 格式（当前使用）
        let json = r#"[
            {
                "id": 1,
                "currentCredits": 85.5,
                "subscriptionPlanName": "Pro Plan",
                "isActive": true,
                "remainingDays": 25,
                "endDate": "2025-12-31"
            }
        ]"#;
        let response: BalanceResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.extract_balance(), Some(85.5));
        assert_eq!(response.extract_currency(), "Credits");
    }
}
