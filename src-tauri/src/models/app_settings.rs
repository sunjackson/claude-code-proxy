#![allow(dead_code)]

use crate::utils::constants::default_proxy_port_i32;
use serde::{Deserialize, Serialize};

/// AppSettings (应用设置) 数据模型
/// 应用的全局设置,单例模式 (id 固定为 1)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// 设置记录 ID (固定为 1)
    pub id: i64,

    /// 界面语言
    pub language: Language,

    /// 默认延迟阈值(毫秒)
    pub default_latency_threshold_ms: i32,

    /// 默认代理端口
    pub default_proxy_port: i32,

    /// 远程推荐服务 JSON URL
    pub remote_recommendation_url: Option<String>,

    /// 本地推荐服务 JSON 路径
    pub local_recommendation_path: Option<String>,

    /// 推荐服务缓存时间(秒)
    pub recommendation_cache_ttl_sec: i32,

    /// 是否启用自动健康检查
    pub auto_health_check_enabled: bool,

    /// 健康检查间隔(秒)，默认300秒(5分钟)
    pub health_check_interval_secs: i32,

    /// 最后更新时间
    pub updated_at: String,
}

/// 支持的语言
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Language {
    /// 简体中文
    ZhCn,

    /// 英语
    EnUs,
}

impl Language {
    /// 从字符串解析语言
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "zh-CN" => Ok(Language::ZhCn),
            "en-US" => Ok(Language::EnUs),
            _ => Err(format!("不支持的语言: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Language::ZhCn => "zh-CN",
            Language::EnUs => "en-US",
        }
    }

    /// 获取语言的友好名称
    pub fn display_name(&self) -> &'static str {
        match self {
            Language::ZhCn => "简体中文",
            Language::EnUs => "English",
        }
    }
}

/// 更新应用设置的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAppSettingsInput {
    pub language: Option<Language>,
    pub default_latency_threshold_ms: Option<i32>,
    pub default_proxy_port: Option<i32>,
    pub remote_recommendation_url: Option<String>,
    pub local_recommendation_path: Option<String>,
    pub recommendation_cache_ttl_sec: Option<i32>,
    pub auto_health_check_enabled: Option<bool>,
    pub health_check_interval_secs: Option<i32>,
}

impl AppSettings {
    /// 获取单例 ID
    pub const SINGLETON_ID: i64 = 1;

    /// 验证延迟阈值
    pub fn validate_latency_threshold(threshold_ms: i32) -> Result<(), String> {
        if threshold_ms <= 0 {
            return Err("延迟阈值必须大于 0".to_string());
        }

        if threshold_ms > 100000 {
            return Err("延迟阈值不能超过 100000 毫秒".to_string());
        }

        Ok(())
    }

    /// 验证代理端口
    pub fn validate_proxy_port(port: i32) -> Result<(), String> {
        if port < 1 || port > 65535 {
            return Err("代理端口必须在 1-65535 范围内".to_string());
        }

        Ok(())
    }

    /// 验证远程 URL
    pub fn validate_remote_url(url: &str) -> Result<(), String> {
        if url.is_empty() {
            return Err("远程 URL 不能为空".to_string());
        }

        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("远程 URL 必须以 http:// 或 https:// 开头".to_string());
        }

        Ok(())
    }

    /// 验证缓存 TTL
    pub fn validate_cache_ttl(ttl_sec: i32) -> Result<(), String> {
        if ttl_sec < 0 {
            return Err("缓存 TTL 不能为负数".to_string());
        }

        Ok(())
    }
}

impl UpdateAppSettingsInput {
    /// 验证更新输入
    pub fn validate(&self) -> Result<(), String> {
        if let Some(threshold) = self.default_latency_threshold_ms {
            AppSettings::validate_latency_threshold(threshold)?;
        }

        if let Some(port) = self.default_proxy_port {
            AppSettings::validate_proxy_port(port)?;
        }

        if let Some(ref url) = self.remote_recommendation_url {
            AppSettings::validate_remote_url(url)?;
        }

        if let Some(ttl) = self.recommendation_cache_ttl_sec {
            AppSettings::validate_cache_ttl(ttl)?;
        }

        Ok(())
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            id: Self::SINGLETON_ID,
            language: Language::ZhCn,
            default_latency_threshold_ms: 100000,
            default_proxy_port: default_proxy_port_i32(),
            remote_recommendation_url: None,
            local_recommendation_path: None,
            recommendation_cache_ttl_sec: 3600,
            auto_health_check_enabled: false,
            health_check_interval_secs: 300,
            updated_at: String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_from_str() {
        assert_eq!(Language::from_str("zh-CN").unwrap(), Language::ZhCn);
        assert_eq!(Language::from_str("en-US").unwrap(), Language::EnUs);
        assert!(Language::from_str("fr-FR").is_err());
    }

    #[test]
    fn test_language_as_str() {
        assert_eq!(Language::ZhCn.as_str(), "zh-CN");
        assert_eq!(Language::EnUs.as_str(), "en-US");
    }

    #[test]
    fn test_validate_latency_threshold() {
        assert!(AppSettings::validate_latency_threshold(3000).is_ok());
        assert!(AppSettings::validate_latency_threshold(0).is_err());
        assert!(AppSettings::validate_latency_threshold(60001).is_err());
    }

    #[test]
    fn test_validate_proxy_port() {
        assert!(AppSettings::validate_proxy_port(25341).is_ok());
        assert!(AppSettings::validate_proxy_port(0).is_err());
        assert!(AppSettings::validate_proxy_port(65536).is_err());
    }

    #[test]
    fn test_validate_remote_url() {
        assert!(AppSettings::validate_remote_url("https://api.example.com").is_ok());
        assert!(AppSettings::validate_remote_url("").is_err());
        assert!(AppSettings::validate_remote_url("ftp://invalid.com").is_err());
    }

    #[test]
    fn test_default_settings() {
        use crate::utils::constants::default_proxy_port_i32;

        let settings = AppSettings::default();
        assert_eq!(settings.id, AppSettings::SINGLETON_ID);
        assert_eq!(settings.language, Language::ZhCn);
        // Port is dynamically set based on build mode
        assert_eq!(settings.default_proxy_port, default_proxy_port_i32());
        assert_eq!(settings.default_latency_threshold_ms, 100000);
    }
}
