use crate::models::claude_advanced::PermissionsConfig;
use crate::services::PermissionsConfigService;

/// 读取 Permissions 配置
#[tauri::command]
pub async fn get_permissions_config() -> Result<PermissionsConfig, String> {
    PermissionsConfigService::read_permissions().map_err(|e| e.to_string())
}

/// 更新 Permissions 配置
#[tauri::command]
pub async fn update_permissions_config(config: PermissionsConfig) -> Result<(), String> {
    PermissionsConfigService::write_permissions(&config).map_err(|e| e.to_string())
}

/// 清除 Permissions 配置
#[tauri::command]
pub async fn clear_permissions_config() -> Result<(), String> {
    PermissionsConfigService::clear_permissions().map_err(|e| e.to_string())
}
