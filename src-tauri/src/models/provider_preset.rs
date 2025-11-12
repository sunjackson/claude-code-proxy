#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// 供应商分类
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderCategory {
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

/// 默认区域为国内
fn default_region() -> String {
    "domestic".to_string()
}

/// 默认在推荐服务页面显示
fn default_show_in_recommendations() -> bool {
    true
}

/// 供应商预设配置
/// 从 config/providers.json 读取
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPreset {
    /// 供应商 ID (唯一标识)
    pub id: String,

    /// 供应商名称
    pub name: String,

    /// 供应商分类
    pub category: ProviderCategory,

    /// 供应商网站
    pub website_url: String,

    /// API Key 获取地址 (可选,如果与 websiteUrl 不同)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_url: Option<String>,

    /// 服务器地址
    pub server_url: String,

    /// 描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// 是否在推荐服务页面显示（默认 true）
    #[serde(default = "default_show_in_recommendations")]
    pub show_in_recommendations: bool,

    /// 是否为推荐供应商
    #[serde(default)]
    pub is_recommended: bool,

    /// 是否为合作伙伴
    #[serde(default)]
    pub is_partner: bool,

    /// 热度分数 (0-100)
    #[serde(default)]
    pub hotness_score: i32,

    /// 服务区域: domestic(国内) 或 international(国外)
    #[serde(default = "default_region")]
    pub region: String,

    // 模型配置
    /// 默认模型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,

    /// Haiku 模型 (快速、低成本)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub haiku_model: Option<String>,

    /// Sonnet 模型 (平衡)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sonnet_model: Option<String>,

    /// Opus 模型 (最强)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opus_model: Option<String>,

    /// 小型快速模型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub small_fast_model: Option<String>,

    // API 高级设置
    /// API 超时时间 (毫秒)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_timeout_ms: Option<i32>,

    /// 最大输出令牌数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<i32>,

    /// 备选服务器地址列表 (用于故障切换和测速)
    #[serde(default)]
    pub endpoint_candidates: Vec<String>,
}

/// 供应商配置文件根结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub providers: Vec<ProviderPreset>,
}

impl ProviderPreset {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hotness_grade() {
        let preset = ProviderPreset {
            id: "test".to_string(),
            name: "Test".to_string(),
            category: ProviderCategory::Official,
            website_url: "https://example.com".to_string(),
            api_key_url: None,
            server_url: "https://api.example.com".to_string(),
            description: None,
            show_in_recommendations: true,
            is_recommended: true,
            is_partner: false,
            hotness_score: 85,
            region: "domestic".to_string(),
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            endpoint_candidates: vec![],
        };

        assert_eq!(preset.hotness_grade(), "hot");
    }

    #[test]
    fn test_deserialize_provider_config() {
        let json = r#"
        {
            "version": "1.0",
            "description": "Test config",
            "providers": [
                {
                    "id": "test-provider",
                    "name": "Test Provider",
                    "category": "official",
                    "websiteUrl": "https://example.com",
                    "serverUrl": "https://api.example.com",
                    "isRecommended": true,
                    "isPartner": false,
                    "hotnessScore": 90,
                    "endpointCandidates": []
                }
            ]
        }
        "#;

        let config: ProviderConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.version, "1.0");
        assert_eq!(config.providers.len(), 1);
        assert_eq!(config.providers[0].id, "test-provider");
        assert_eq!(config.providers[0].category, ProviderCategory::Official);
    }
}
