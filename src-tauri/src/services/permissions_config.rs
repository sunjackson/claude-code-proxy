use crate::models::claude_advanced::PermissionsConfig;
use crate::models::error::{AppError, AppResult};
use crate::utils::paths;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

/// Permissions 配置管理服务
pub struct PermissionsConfigService;

impl PermissionsConfigService {
    /// 获取 Claude Code settings.json 配置文件路径
    fn get_settings_path() -> AppResult<PathBuf> {
        paths::get_claude_code_settings_path().map_err(|e| AppError::IoError { message: e })
    }

    /// 读取完整的 settings.json 配置
    fn read_settings() -> AppResult<Value> {
        let settings_path = Self::get_settings_path()?;

        if !settings_path.exists() {
            log::info!("Settings 文件不存在,返回默认配置");
            return Ok(serde_json::json!({}));
        }

        let content = fs::read_to_string(&settings_path).map_err(|e| AppError::IoError {
            message: format!("读取 settings.json 文件失败: {}", e),
        })?;

        let settings: Value = serde_json::from_str(&content).map_err(|e| {
            AppError::InvalidData {
                message: format!("解析 settings.json 文件失败: {}", e),
            }
        })?;

        Ok(settings)
    }

    /// 写入完整的 settings.json 配置
    fn write_settings(settings: &Value) -> AppResult<()> {
        let settings_path = Self::get_settings_path()?;

        // 确保目录存在
        if let Some(parent) = settings_path.parent() {
            fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                message: format!("创建配置目录失败: {}", e),
            })?;
        }

        // 序列化配置
        let content = serde_json::to_string_pretty(&settings).map_err(|e| {
            AppError::InvalidData {
                message: format!("序列化 settings.json 失败: {}", e),
            }
        })?;

        // 写入文件
        fs::write(&settings_path, content).map_err(|e| AppError::IoError {
            message: format!("写入 settings.json 文件失败: {}", e),
        })?;

        log::info!("成功写入 Permissions 配置到 settings.json");
        Ok(())
    }

    /// 读取 Permissions 配置
    pub fn read_permissions() -> AppResult<PermissionsConfig> {
        let settings = Self::read_settings()?;

        if let Some(permissions_value) = settings.get("permissions") {
            let permissions: PermissionsConfig =
                serde_json::from_value(permissions_value.clone()).map_err(|e| {
                    AppError::InvalidData {
                        message: format!("解析 Permissions 配置失败: {}", e),
                    }
                })?;
            Ok(permissions)
        } else {
            log::info!("Settings 中没有 Permissions 配置,返回默认配置");
            Ok(PermissionsConfig::default())
        }
    }

    /// 写入 Permissions 配置
    pub fn write_permissions(permissions: &PermissionsConfig) -> AppResult<()> {
        let mut settings = Self::read_settings()?;

        // 更新 permissions 字段
        let permissions_value =
            serde_json::to_value(permissions).map_err(|e| AppError::InvalidData {
                message: format!("序列化 Permissions 配置失败: {}", e),
            })?;

        settings["permissions"] = permissions_value;

        // 写入配置
        Self::write_settings(&settings)?;

        log::info!("成功更新 Permissions 配置");
        Ok(())
    }

    /// 清除 Permissions 配置
    pub fn clear_permissions() -> AppResult<()> {
        let mut settings = Self::read_settings()?;

        // 移除 permissions 字段
        if let Some(obj) = settings.as_object_mut() {
            obj.remove("permissions");
        }

        // 写入配置
        Self::write_settings(&settings)?;

        log::info!("成功清除 Permissions 配置");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permissions_config_default() {
        let config = PermissionsConfig::default();
        assert!(config.allow.is_empty());
        assert!(config.deny.is_empty());
    }
}
