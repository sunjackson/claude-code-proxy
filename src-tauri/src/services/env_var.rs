/**
 * 环境变量服务
 * 管理应用运行时的环境变量设置
 */

use crate::models::error::{AppError, AppResult};
use crate::models::api_config::ApiConfig;
use std::collections::HashMap;
use std::env;

/// 环境变量键名常量
pub const ENV_KEY_ANTHROPIC_API_KEY: &str = "ANTHROPIC_API_KEY";
pub const ENV_KEY_ANTHROPIC_BASE_URL: &str = "ANTHROPIC_BASE_URL";

/// 环境变量服务
pub struct EnvironmentVariableService;

impl EnvironmentVariableService {
    /// 创建新的环境变量服务实例
    pub fn new() -> Self {
        Self
    }

    /// 设置环境变量
    ///
    /// # 参数
    /// - `key`: 环境变量名
    /// - `value`: 环境变量值
    pub fn set_env(&self, key: &str, value: &str) -> AppResult<()> {
        if key.is_empty() {
            return Err(AppError::ValidationError {
                field: "key".to_string(),
                message: "环境变量名不能为空".to_string(),
            });
        }

        env::set_var(key, value);
        log::info!("环境变量已设置: {}", key);
        Ok(())
    }

    /// 删除环境变量
    ///
    /// # 参数
    /// - `key`: 环境变量名
    pub fn unset_env(&self, key: &str) -> AppResult<()> {
        if key.is_empty() {
            return Err(AppError::ValidationError {
                field: "key".to_string(),
                message: "环境变量名不能为空".to_string(),
            });
        }

        env::remove_var(key);
        log::info!("环境变量已删除: {}", key);
        Ok(())
    }

    /// 获取环境变量值
    ///
    /// # 参数
    /// - `key`: 环境变量名
    ///
    /// # 返回
    /// - `Ok(Some(value))`: 环境变量存在
    /// - `Ok(None)`: 环境变量不存在
    pub fn get_env(&self, key: &str) -> AppResult<Option<String>> {
        Ok(env::var(key).ok())
    }

    /// 列出所有环境变量
    ///
    /// # 返回
    /// 返回所有环境变量的键值对映射
    pub fn list_all(&self) -> HashMap<String, String> {
        env::vars().collect()
    }

    /// 从 API 配置应用环境变量
    ///
    /// # 参数
    /// - `config`: API 配置对象
    ///
    /// # 说明
    /// 设置以下环境变量:
    /// - ANTHROPIC_API_KEY: API 密钥
    /// - ANTHROPIC_BASE_URL: 服务器地址(完整 URL)
    pub fn apply_from_config(&self, config: &ApiConfig) -> AppResult<()> {
        // 设置 API 密钥
        self.set_env(ENV_KEY_ANTHROPIC_API_KEY, &config.api_key)?;

        // 直接使用完整的 server_url (已包含协议和端口)
        self.set_env(ENV_KEY_ANTHROPIC_BASE_URL, &config.server_url)?;

        log::info!(
            "已从配置 '{}' 应用环境变量",
            config.name
        );

        Ok(())
    }

    /// 清除 Anthropic 相关的环境变量
    pub fn clear_anthropic_env(&self) -> AppResult<()> {
        self.unset_env(ENV_KEY_ANTHROPIC_API_KEY)?;
        self.unset_env(ENV_KEY_ANTHROPIC_BASE_URL)?;
        log::info!("已清除 Anthropic 环境变量");
        Ok(())
    }

    /// 检查必需的 Anthropic 环境变量是否已设置
    ///
    /// # 返回
    /// - `Ok(true)`: 所有必需的环境变量都已设置
    /// - `Ok(false)`: 有环境变量未设置
    pub fn check_anthropic_env(&self) -> AppResult<bool> {
        let api_key = self.get_env(ENV_KEY_ANTHROPIC_API_KEY)?;
        let base_url = self.get_env(ENV_KEY_ANTHROPIC_BASE_URL)?;

        Ok(api_key.is_some() && base_url.is_some())
    }
}

impl Default for EnvironmentVariableService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::time::now_rfc3339;

    #[test]
    fn test_set_and_get_env() {
        let service = EnvironmentVariableService::new();
        let key = "TEST_VAR_SET_GET";
        let value = "test_value";

        // 设置环境变量
        service.set_env(key, value).unwrap();

        // 获取环境变量
        let result = service.get_env(key).unwrap();
        assert_eq!(result, Some(value.to_string()));

        // 清理
        service.unset_env(key).unwrap();
    }

    #[test]
    fn test_unset_env() {
        let service = EnvironmentVariableService::new();
        let key = "TEST_VAR_UNSET";
        let value = "test_value";

        // 先设置
        service.set_env(key, value).unwrap();
        assert!(service.get_env(key).unwrap().is_some());

        // 删除
        service.unset_env(key).unwrap();
        assert!(service.get_env(key).unwrap().is_none());
    }

    #[test]
    fn test_set_empty_key() {
        let service = EnvironmentVariableService::new();
        let result = service.set_env("", "value");
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_from_config() {
        let service = EnvironmentVariableService::new();

        #[allow(deprecated)]
        let config = ApiConfig {
            id: 1,
            name: "Test Config".to_string(),
            api_key: "test-api-key".to_string(),
            server_url: "http://api.example.com:8080".to_string(),
            server_port: 8080, // deprecated, but kept for compatibility
            group_id: None,
            sort_order: 0,
            is_available: true,
            is_enabled: true,
            weight_score: 1.0,
            last_success_time: None,
            consecutive_failures: 0,
            last_test_at: None,
            last_latency_ms: None,
            provider_type: crate::models::api_config::ProviderType::Claude,
            category: crate::models::api_config::VendorCategory::Custom,
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
            created_at: now_rfc3339(),
            updated_at: now_rfc3339(),
        };

        // 应用配置
        service.apply_from_config(&config).unwrap();

        // 验证环境变量
        let api_key = service.get_env(ENV_KEY_ANTHROPIC_API_KEY).unwrap();
        assert_eq!(api_key, Some("test-api-key".to_string()));

        let base_url = service.get_env(ENV_KEY_ANTHROPIC_BASE_URL).unwrap();
        assert_eq!(base_url, Some("http://api.example.com:8080".to_string()));

        // 清理
        service.clear_anthropic_env().unwrap();
    }

    #[test]
    fn test_check_anthropic_env() {
        let service = EnvironmentVariableService::new();

        // Test with valid config
        #[allow(deprecated)]
        let config = ApiConfig {
            id: 1,
            name: "Test Config".to_string(),
            api_key: "test-api-key".to_string(),
            server_url: "https://api.example.com:8080".to_string(),  // Fixed: added protocol
            server_port: 8080,
            group_id: None,
            sort_order: 0,
            is_available: true,
            is_enabled: true,
            weight_score: 1.0,
            last_success_time: None,
            consecutive_failures: 0,
            last_test_at: None,
            last_latency_ms: None,
            provider_type: crate::models::api_config::ProviderType::Claude,
            category: crate::models::api_config::VendorCategory::Custom,
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
            created_at: now_rfc3339(),
            updated_at: now_rfc3339(),
        };

        // 设置环境变量
        service.apply_from_config(&config).unwrap();
        assert!(service.check_anthropic_env().unwrap());

        // 清除后应该返回 false
        service.clear_anthropic_env().unwrap();
        assert!(!service.check_anthropic_env().unwrap());
    }

    #[test]
    fn test_list_all() {
        let service = EnvironmentVariableService::new();
        let all_vars = service.list_all();

        // 应该至少有一些系统环境变量
        assert!(!all_vars.is_empty());
    }
}
