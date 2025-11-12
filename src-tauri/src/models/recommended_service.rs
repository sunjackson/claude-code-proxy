#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// RecommendedService (推荐服务) 数据模型
/// 代表导航页面展示的推荐中转服务站点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedService {
    /// 服务唯一标识符
    pub id: i64,

    /// 站点名称
    pub site_name: String,

    /// 推广链接 URL
    pub promotion_url: String,

    /// 是否推荐(显示推荐徽章)
    pub is_recommended: bool,

    /// 热度指标(0-100) - 用于排序，不显示
    pub hotness_score: i32,

    /// 服务区域：domestic(国内) 或 international(国外)
    #[serde(default = "default_region")]
    pub region: String,

    /// 服务商简介
    #[serde(default)]
    pub description: String,

    /// 数据源
    pub source: ServiceSource,

    /// 加载时间
    pub loaded_at: String,
}

/// 默认区域为国内
fn default_region() -> String {
    "domestic".to_string()
}

/// 服务数据源
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceSource {
    /// 远程 JSON
    Remote,

    /// 本地 JSON
    Local,
}

impl ServiceSource {
    /// 从字符串解析数据源
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "remote" => Ok(ServiceSource::Remote),
            "local" => Ok(ServiceSource::Local),
            _ => Err(format!("无效的数据源: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            ServiceSource::Remote => "remote",
            ServiceSource::Local => "local",
        }
    }
}

/// 创建推荐服务的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRecommendedServiceInput {
    pub site_name: String,
    pub promotion_url: String,
    pub is_recommended: Option<bool>,
    pub hotness_score: Option<i32>,
    pub source: ServiceSource,
}

impl RecommendedService {
    /// 验证站点名称
    pub fn validate_site_name(name: &str) -> Result<(), String> {
        if name.is_empty() {
            return Err("站点名称不能为空".to_string());
        }

        if name.len() > 200 {
            return Err("站点名称不能超过 200 个字符".to_string());
        }

        Ok(())
    }

    /// 验证推广 URL
    pub fn validate_promotion_url(url: &str) -> Result<(), String> {
        if url.is_empty() {
            return Err("推广链接不能为空".to_string());
        }

        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("推广链接必须以 http:// 或 https:// 开头".to_string());
        }

        Ok(())
    }

    /// 验证热度分数
    pub fn validate_hotness_score(score: i32) -> Result<(), String> {
        if score < 0 || score > 100 {
            return Err("热度分数必须在 0-100 范围内".to_string());
        }

        Ok(())
    }

    /// 获取热度等级
    pub fn hotness_grade(&self) -> &'static str {
        if self.hotness_score >= 80 {
            "hot" // 热门
        } else if self.hotness_score >= 50 {
            "warm" // 较热
        } else {
            "cool" // 一般
        }
    }
}

impl CreateRecommendedServiceInput {
    /// 验证创建输入
    pub fn validate(&self) -> Result<(), String> {
        RecommendedService::validate_site_name(&self.site_name)?;
        RecommendedService::validate_promotion_url(&self.promotion_url)?;

        if let Some(score) = self.hotness_score {
            RecommendedService::validate_hotness_score(score)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_source_from_str() {
        assert_eq!(ServiceSource::from_str("remote").unwrap(), ServiceSource::Remote);
        assert_eq!(ServiceSource::from_str("local").unwrap(), ServiceSource::Local);
        assert!(ServiceSource::from_str("invalid").is_err());
    }

    #[test]
    fn test_validate_site_name() {
        assert!(RecommendedService::validate_site_name("测试站点").is_ok());
        assert!(RecommendedService::validate_site_name("").is_err());
        assert!(RecommendedService::validate_site_name(&"a".repeat(201)).is_err());
    }

    #[test]
    fn test_validate_promotion_url() {
        assert!(RecommendedService::validate_promotion_url("https://example.com").is_ok());
        assert!(RecommendedService::validate_promotion_url("").is_err());
        assert!(RecommendedService::validate_promotion_url("ftp://invalid.com").is_err());
    }

    #[test]
    fn test_validate_hotness_score() {
        assert!(RecommendedService::validate_hotness_score(50).is_ok());
        assert!(RecommendedService::validate_hotness_score(0).is_ok());
        assert!(RecommendedService::validate_hotness_score(100).is_ok());
        assert!(RecommendedService::validate_hotness_score(-1).is_err());
        assert!(RecommendedService::validate_hotness_score(101).is_err());
    }

    #[test]
    fn test_hotness_grade() {
        let service = RecommendedService {
            id: 1,
            site_name: "Test".to_string(),
            promotion_url: "https://example.com".to_string(),
            is_recommended: true,
            hotness_score: 85,
            source: ServiceSource::Remote,
            loaded_at: "2025-11-09".to_string(),
        };
        assert_eq!(service.hotness_grade(), "hot");

        let service2 = RecommendedService {
            hotness_score: 60,
            ..service.clone()
        };
        assert_eq!(service2.hotness_grade(), "warm");

        let service3 = RecommendedService {
            hotness_score: 30,
            ..service.clone()
        };
        assert_eq!(service3.hotness_grade(), "cool");
    }
}
