#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 默认值函数：返回 true
fn default_true() -> bool {
    true
}

/// 默认值函数：返回权重默认值 1.0
fn default_weight() -> f64 {
    1.0
}

/// API 提供商类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    /// Claude API
    Claude,
    /// Gemini API
    Gemini,
}

impl Default for ProviderType {
    fn default() -> Self {
        ProviderType::Claude
    }
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::Claude => write!(f, "claude"),
            ProviderType::Gemini => write!(f, "gemini"),
        }
    }
}

/// 供应商分类
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VendorCategory {
    /// 官方（Claude Official）
    Official,
    /// 国产官方（DeepSeek, GLM, Qwen, Kimi等）
    CnOfficial,
    /// 聚合平台（AiHubMix, DMXAPI等）
    Aggregator,
    /// 第三方供应商（PackyCode, AnyRouter等）
    ThirdParty,
    /// 自定义
    Custom,
}

impl Default for VendorCategory {
    fn default() -> Self {
        VendorCategory::Custom
    }
}

impl std::fmt::Display for VendorCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VendorCategory::Official => write!(f, "official"),
            VendorCategory::CnOfficial => write!(f, "cn_official"),
            VendorCategory::Aggregator => write!(f, "aggregator"),
            VendorCategory::ThirdParty => write!(f, "third_party"),
            VendorCategory::Custom => write!(f, "custom"),
        }
    }
}

/// 视觉主题配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VendorTheme {
    /// 图标类型
    pub icon: Option<String>,
    /// 背景色（Tailwind类名或hex颜色）
    pub bg_color: Option<String>,
    /// 文字色
    pub text_color: Option<String>,
}

/// 自定义端点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomEndpoint {
    pub url: String,
    pub added_at: i64,
    pub last_used: Option<i64>,
}

/// 供应商元数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VendorMeta {
    /// 自定义端点列表（URL -> CustomEndpoint）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_endpoints: Option<HashMap<String, CustomEndpoint>>,
    /// 模板变量值
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_values: Option<HashMap<String, String>>,
}

/// ApiConfig (API 配置) 数据模型
/// 代表一个 API 中转站的完整配置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// 配置唯一标识符
    pub id: i64,

    /// 配置名称(如"Claude Official", "DeepSeek"等)
    pub name: String,

    /// API 密钥（直接存储在数据库）
    pub api_key: String,

    /// 服务器地址（完整URL，如"https://api.deepseek.com"）
    pub server_url: String,

    /// 服务器端口（已弃用，保留用于向后兼容）
    /// 新版本使用 server_url 中的完整URL
    #[deprecated(note = "Use full URL in server_url instead")]
    pub server_port: i32,

    /// 所属分组 ID,NULL 表示"未分组"
    pub group_id: Option<i64>,

    /// 分组内排序顺序,用于自动切换优先级
    pub sort_order: i32,

    /// 可用状态(由测试和自动切换更新)
    pub is_available: bool,

    /// 是否启用（用户手动控制，停用后不参与自动切换）
    /// 区别于 is_available（系统自动设置的可用状态）
    #[serde(default = "default_true")]
    pub is_enabled: bool,

    /// 权重计算分数，用于智能选择（0.0 - 1.0）
    #[serde(default = "default_weight")]
    pub weight_score: f64,

    /// 最后一次成功请求的时间
    pub last_success_time: Option<String>,

    /// 连续失败次数
    #[serde(default)]
    pub consecutive_failures: i32,

    /// 最后测试时间
    pub last_test_at: Option<String>,

    /// 最后测试延迟(毫秒)
    pub last_latency_ms: Option<i32>,

    /// API 提供商类型
    #[serde(default)]
    pub provider_type: ProviderType,

    /// 供应商分类
    #[serde(default)]
    pub category: VendorCategory,

    /// 是否为合作伙伴
    #[serde(default)]
    pub is_partner: bool,

    /// 视觉主题配置（JSON字符串）
    pub theme_icon: Option<String>,
    pub theme_bg_color: Option<String>,
    pub theme_text_color: Option<String>,

    /// 元数据（JSON字符串）
    #[serde(default)]
    pub meta: String,

    /// Claude 模型配置
    /// 默认模型
    pub default_model: Option<String>,
    /// Haiku 模型（快速、低成本）
    pub haiku_model: Option<String>,
    /// Sonnet 模型（平衡）
    pub sonnet_model: Option<String>,
    /// Opus 模型（最强）
    pub opus_model: Option<String>,
    /// 小型快速模型
    pub small_fast_model: Option<String>,

    /// API 高级设置
    /// API 超时时间（毫秒）
    pub api_timeout_ms: Option<i32>,
    /// 最大输出令牌数
    pub max_output_tokens: Option<i32>,

    /// 余额查询相关字段
    /// 余额查询接口URL
    pub balance_query_url: Option<String>,
    /// 最后查询到的余额
    pub last_balance: Option<f64>,
    /// 余额货币单位
    pub balance_currency: Option<String>,
    /// 最后余额查询时间
    pub last_balance_check_at: Option<String>,
    /// 余额查询状态
    pub balance_query_status: Option<String>,
    /// 余额查询错误信息
    pub balance_query_error: Option<String>,
    /// 是否启用自动余额查询
    pub auto_balance_check: bool,
    /// 余额查询间隔（秒）
    pub balance_check_interval_sec: Option<i32>,

    /// 创建时间
    pub created_at: String,

    /// 最后修改时间
    pub updated_at: String,
}

/// 创建 API 配置的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiConfigInput {
    pub name: String,
    pub api_key: String,
    pub server_url: String,

    /// 服务器端口（已弃用，保留用于向后兼容）
    #[deprecated(note = "Use full URL in server_url instead")]
    pub server_port: Option<i32>,

    pub group_id: Option<i64>,
    pub sort_order: Option<i32>,

    // API 提供商类型
    pub provider_type: Option<ProviderType>,

    // 供应商配置
    pub category: Option<VendorCategory>,
    pub is_partner: Option<bool>,

    // 视觉主题
    pub theme_icon: Option<String>,
    pub theme_bg_color: Option<String>,
    pub theme_text_color: Option<String>,

    // 元数据（JSON字符串）
    pub meta: Option<String>,

    // Claude 模型配置
    pub default_model: Option<String>,
    pub haiku_model: Option<String>,
    pub sonnet_model: Option<String>,
    pub opus_model: Option<String>,
    pub small_fast_model: Option<String>,

    // API 高级设置
    pub api_timeout_ms: Option<i32>,
    pub max_output_tokens: Option<i32>,

    // 余额查询设置
    pub balance_query_url: Option<String>,
    pub auto_balance_check: Option<bool>,
    pub balance_check_interval_sec: Option<i32>,
    pub balance_currency: Option<String>,
}

/// 更新 API 配置的输入参数
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[allow(deprecated)]
pub struct UpdateApiConfigInput {
    pub id: i64,
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub server_url: Option<String>,

    /// 服务器端口（已弃用，保留用于向后兼容）
    #[deprecated(note = "Use full URL in server_url instead")]
    pub server_port: Option<i32>,

    pub group_id: Option<i64>,
    pub sort_order: Option<i32>,
    pub is_available: Option<bool>,

    // API 提供商类型
    pub provider_type: Option<ProviderType>,

    // 供应商配置
    pub category: Option<VendorCategory>,
    pub is_partner: Option<bool>,

    // 视觉主题
    pub theme_icon: Option<String>,
    pub theme_bg_color: Option<String>,
    pub theme_text_color: Option<String>,

    // 元数据（JSON字符串）
    pub meta: Option<String>,

    // Claude 模型配置
    pub default_model: Option<String>,
    pub haiku_model: Option<String>,
    pub sonnet_model: Option<String>,
    pub opus_model: Option<String>,
    pub small_fast_model: Option<String>,

    // API 高级设置
    pub api_timeout_ms: Option<i32>,
    pub max_output_tokens: Option<i32>,

    // 余额查询设置
    pub balance_query_url: Option<String>,
    pub auto_balance_check: Option<bool>,
    pub balance_check_interval_sec: Option<i32>,
    pub balance_currency: Option<String>,
}

/// 重新排序配置的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderConfigInput {
    pub config_id: i64,
    pub new_sort_order: i32,
}

impl ApiConfig {
    /// 验证配置名称
    pub fn validate_name(name: &str) -> Result<(), String> {
        if name.is_empty() {
            return Err("配置名称不能为空".to_string());
        }

        if name.len() > 100 {
            return Err("配置名称不能超过 100 个字符".to_string());
        }

        Ok(())
    }

    /// 验证 API 密钥
    pub fn validate_api_key(api_key: &str) -> Result<(), String> {
        if api_key.is_empty() {
            return Err("API 密钥不能为空".to_string());
        }

        // 可以添加更多验证规则,如密钥格式
        Ok(())
    }

    /// 验证服务器 URL
    pub fn validate_server_url(url: &str) -> Result<(), String> {
        if url.is_empty() {
            return Err("服务器地址不能为空".to_string());
        }

        // 检查是否为有效的 HTTP/HTTPS URL
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("服务器地址必须以 http:// 或 https:// 开头".to_string());
        }

        Ok(())
    }

    /// 验证服务器端口
    pub fn validate_server_port(port: i32) -> Result<(), String> {
        // 允许 port = 0，表示从 URL 中提取端口
        if port == 0 {
            return Ok(());
        }

        if port < 1 || port > 65535 {
            return Err("服务器端口必须在 1-65535 范围内".to_string());
        }

        Ok(())
    }

    /// 验证排序顺序
    pub fn validate_sort_order(order: i32) -> Result<(), String> {
        if order < 0 {
            return Err("排序顺序必须大于等于 0".to_string());
        }

        Ok(())
    }

    /// 检查 API 密钥是否已加密
    pub fn is_encrypted(&self) -> bool {
        self.api_key == "[ENCRYPTED]"
    }

    /// 获取密钥链服务标识符
    pub fn keychain_service() -> &'static str {
        "claude-code-proxy"
    }

    /// 获取密钥链账户标识符
    pub fn keychain_account(&self) -> String {
        format!("api_config_{}", self.id)
    }
}

impl CreateApiConfigInput {
    /// 验证创建输入
    #[allow(deprecated)]
    pub fn validate(&self) -> Result<(), String> {
        ApiConfig::validate_name(&self.name)?;
        ApiConfig::validate_api_key(&self.api_key)?;
        ApiConfig::validate_server_url(&self.server_url)?;

        if let Some(port) = self.server_port {
            ApiConfig::validate_server_port(port)?;
        }

        if let Some(order) = self.sort_order {
            ApiConfig::validate_sort_order(order)?;
        }

        Ok(())
    }
}

impl UpdateApiConfigInput {
    /// 验证更新输入
    #[allow(deprecated)]
    pub fn validate(&self) -> Result<(), String> {
        if let Some(ref name) = self.name {
            ApiConfig::validate_name(name)?;
        }

        if let Some(ref api_key) = self.api_key {
            ApiConfig::validate_api_key(api_key)?;
        }

        if let Some(ref url) = self.server_url {
            ApiConfig::validate_server_url(url)?;
        }

        if let Some(port) = self.server_port {
            ApiConfig::validate_server_port(port)?;
        }

        if let Some(order) = self.sort_order {
            ApiConfig::validate_sort_order(order)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name() {
        assert!(ApiConfig::validate_name("测试配置").is_ok());
        assert!(ApiConfig::validate_name("").is_err());
        assert!(ApiConfig::validate_name(&"a".repeat(101)).is_err());
    }

    #[test]
    fn test_validate_api_key() {
        assert!(ApiConfig::validate_api_key("sk-1234567890").is_ok());
        assert!(ApiConfig::validate_api_key("").is_err());
    }

    #[test]
    fn test_validate_server_url() {
        // ✅ 应该通过：完整的URL（带或不带端口都可以）
        assert!(ApiConfig::validate_server_url("https://api.example.com").is_ok());
        assert!(ApiConfig::validate_server_url("https://api.example.com:443").is_ok());
        assert!(ApiConfig::validate_server_url("https://api.example.com:8443").is_ok());
        assert!(ApiConfig::validate_server_url("http://localhost:8080").is_ok());
        assert!(ApiConfig::validate_server_url("http://api.example.com").is_ok());

        // ❌ 应该失败：错误格式
        assert!(ApiConfig::validate_server_url("").is_err());
        assert!(ApiConfig::validate_server_url("ftp://invalid.com").is_err());
        assert!(ApiConfig::validate_server_url("api.example.com").is_err());
    }

    #[test]
    fn test_validate_server_port() {
        // port=0 表示从 URL 中提取端口，应该通过验证
        assert!(ApiConfig::validate_server_port(0).is_ok());
        assert!(ApiConfig::validate_server_port(443).is_ok());
        assert!(ApiConfig::validate_server_port(1).is_ok());
        assert!(ApiConfig::validate_server_port(65535).is_ok());
        assert!(ApiConfig::validate_server_port(-1).is_err());
        assert!(ApiConfig::validate_server_port(65536).is_err());
    }

    #[test]
    fn test_is_encrypted() {
        let config = ApiConfig {
            id: 1,
            name: "Test".to_string(),
            api_key: "[ENCRYPTED]".to_string(),
            server_url: "https://api.example.com".to_string(),
            server_port: 443,
            group_id: None,
            sort_order: 0,
            is_available: true,
            is_enabled: true,
            weight_score: 1.0,
            last_success_time: None,
            consecutive_failures: 0,
            last_test_at: None,
            last_latency_ms: None,
            provider_type: ProviderType::Claude,
            category: VendorCategory::Custom,
            is_partner: false,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: "{}".to_string(),
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            last_balance: None,
            balance_currency: None,
            last_balance_check_at: None,
            balance_query_status: None,
            balance_query_error: None,
            auto_balance_check: false,
            balance_check_interval_sec: None,
            created_at: "2025-11-09".to_string(),
            updated_at: "2025-11-09".to_string(),
        };

        assert!(config.is_encrypted());
    }

    #[test]
    fn test_keychain_account() {
        let config = ApiConfig {
            id: 123,
            name: "Test".to_string(),
            api_key: "[ENCRYPTED]".to_string(),
            server_url: "https://api.example.com".to_string(),
            server_port: 443,
            group_id: None,
            sort_order: 0,
            is_available: true,
            is_enabled: true,
            weight_score: 1.0,
            last_success_time: None,
            consecutive_failures: 0,
            last_test_at: None,
            last_latency_ms: None,
            provider_type: ProviderType::Claude,
            category: VendorCategory::Custom,
            is_partner: false,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: "{}".to_string(),
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            last_balance: None,
            balance_currency: None,
            last_balance_check_at: None,
            balance_query_status: None,
            balance_query_error: None,
            auto_balance_check: false,
            balance_check_interval_sec: None,
            created_at: "2025-11-09".to_string(),
            updated_at: "2025-11-09".to_string(),
        };

        assert_eq!(config.keychain_account(), "api_config_123");
    }
}
