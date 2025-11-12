use crate::models::error::AppResult;
use crate::models::provider_preset::{ProviderCategory, ProviderPreset};
use crate::services::ProviderPresetService;

/// 获取所有供应商预设
///
/// # 返回
/// 返回所有供应商预设配置列表
#[tauri::command]
pub fn list_provider_presets() -> AppResult<Vec<ProviderPreset>> {
    log::debug!("获取所有供应商预设");
    ProviderPresetService::load_providers()
}

/// 根据 ID 获取供应商预设
///
/// # 参数
/// - `id`: 供应商 ID
///
/// # 返回
/// 返回指定的供应商预设配置
#[tauri::command]
pub fn get_provider_preset(id: String) -> AppResult<ProviderPreset> {
    log::debug!("获取供应商预设: {}", id);
    ProviderPresetService::get_provider_by_id(&id)
}

/// 根据分类获取供应商预设
///
/// # 参数
/// - `category`: 供应商分类
///
/// # 返回
/// 返回指定分类的供应商预设配置列表
#[tauri::command]
pub fn get_provider_presets_by_category(category: ProviderCategory) -> AppResult<Vec<ProviderPreset>> {
    log::debug!("获取供应商预设 (分类: {:?})", category);
    ProviderPresetService::get_providers_by_category(category)
}

/// 获取推荐的供应商预设
///
/// # 返回
/// 返回所有推荐的供应商预设配置列表
#[tauri::command]
pub fn get_recommended_provider_presets() -> AppResult<Vec<ProviderPreset>> {
    log::debug!("获取推荐的供应商预设");
    ProviderPresetService::get_recommended_providers()
}

/// 获取所有分类
///
/// # 返回
/// 返回所有供应商分类列表
#[tauri::command]
pub fn get_provider_categories() -> Vec<ProviderCategory> {
    log::debug!("获取所有供应商分类");
    ProviderPresetService::get_all_categories()
}
