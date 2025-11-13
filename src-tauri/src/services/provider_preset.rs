use crate::models::error::{AppError, AppResult};
use crate::models::provider_preset::{ProviderCategory, ProviderConfig, ProviderPreset};

/// 内嵌的 providers.json 配置文件
/// 在编译时将配置文件内容嵌入到二进制文件中，避免打包后找不到文件
const EMBEDDED_PROVIDERS_JSON: &str = include_str!("../../../config/providers.json");

/// 供应商预设配置服务
pub struct ProviderPresetService;

impl ProviderPresetService {
    /// 从内嵌的 JSON 读取供应商配置
    pub fn load_providers() -> AppResult<Vec<ProviderPreset>> {
        // 解析内嵌的 JSON
        let config: ProviderConfig = serde_json::from_str(EMBEDDED_PROVIDERS_JSON).map_err(|e| {
            AppError::ParseError {
                message: format!("解析内嵌配置文件失败: {}", e),
            }
        })?;

        log::info!(
            "成功加载 {} 个供应商预设配置（版本: {}）",
            config.providers.len(),
            config.version
        );

        Ok(config.providers)
    }

    /// 根据 ID 获取预设
    pub fn get_provider_by_id(id: &str) -> AppResult<ProviderPreset> {
        let providers = Self::load_providers()?;
        providers
            .into_iter()
            .find(|p| p.id == id)
            .ok_or_else(|| {
                AppError::NotFound {
                    resource: "ProviderPreset".to_string(),
                    id: id.to_string(),
                }
            })
    }

    /// 根据分类获取预设列表
    pub fn get_providers_by_category(category: ProviderCategory) -> AppResult<Vec<ProviderPreset>> {
        let providers = Self::load_providers()?;
        Ok(providers
            .into_iter()
            .filter(|p| p.category == category)
            .collect())
    }

    /// 获取推荐的预设列表
    pub fn get_recommended_providers() -> AppResult<Vec<ProviderPreset>> {
        let providers = Self::load_providers()?;
        Ok(providers
            .into_iter()
            .filter(|p| p.is_recommended)
            .collect())
    }

    /// 获取所有分类
    pub fn get_all_categories() -> Vec<ProviderCategory> {
        vec![
            ProviderCategory::Official,
            ProviderCategory::CnOfficial,
            ProviderCategory::ThirdParty,
            ProviderCategory::Aggregator,
            ProviderCategory::Custom,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_all_categories() {
        let categories = ProviderPresetService::get_all_categories();
        assert_eq!(categories.len(), 5);
        assert!(categories.contains(&ProviderCategory::Official));
        assert!(categories.contains(&ProviderCategory::CnOfficial));
    }

    // 注意：以下测试需要 config/providers.json 文件存在
    #[test]
    #[ignore] // 默认忽略，需要时手动运行
    fn test_load_providers() {
        let result = ProviderPresetService::load_providers();
        assert!(result.is_ok());
        let providers = result.unwrap();
        assert!(!providers.is_empty());
    }

    #[test]
    #[ignore]
    fn test_get_provider_by_id() {
        let result = ProviderPresetService::get_provider_by_id("claude-official");
        assert!(result.is_ok());
        let provider = result.unwrap();
        assert_eq!(provider.name, "Claude Official");
    }

    #[test]
    #[ignore]
    fn test_get_recommended_providers() {
        let result = ProviderPresetService::get_recommended_providers();
        assert!(result.is_ok());
        let providers = result.unwrap();
        assert!(!providers.is_empty());
        assert!(providers.iter().all(|p| p.is_recommended));
    }
}
