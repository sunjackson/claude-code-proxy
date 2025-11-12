#![allow(dead_code)]

use std::path::PathBuf;
use dirs;

/// 跨平台路径检测工具
/// 用于检测 Claude Code 配置文件路径和应用数据目录

/// 获取 Claude Code 配置文件路径
/// Windows: %USERPROFILE%\.claude\settings.json
/// macOS: ~/.claude/settings.json
/// Linux: ~/.claude/settings.json
pub fn get_claude_code_settings_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;

    let settings_path = home_dir.join(".claude").join("settings.json");
    Ok(settings_path)
}

/// 获取 Claude Code 配置目录
pub fn get_claude_code_config_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;

    let config_dir = home_dir.join(".claude");
    Ok(config_dir)
}

/// 获取应用数据目录
/// Windows: C:\Users\<用户名>\AppData\Roaming\claude-code-router
/// macOS: ~/Library/Application Support/com.claude-code-router
/// Linux: ~/.local/share/claude-code-router
pub fn get_app_data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "无法获取应用数据目录".to_string())?
            .join("claude-code-router");
        Ok(data_dir)
    }

    #[cfg(target_os = "macos")]
    {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "无法获取应用数据目录".to_string())?
            .join("com.claude-code-router");
        Ok(data_dir)
    }

    #[cfg(target_os = "linux")]
    {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "无法获取应用数据目录".to_string())?
            .join("claude-code-router");
        Ok(data_dir)
    }
}

/// 获取应用配置目录
pub fn get_app_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| "无法获取配置目录".to_string())?
            .join("claude-code-router");
        Ok(config_dir)
    }

    #[cfg(target_os = "macos")]
    {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| "无法获取配置目录".to_string())?
            .join("com.claude-code-router");
        Ok(config_dir)
    }

    #[cfg(target_os = "linux")]
    {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| "无法获取配置目录".to_string())?
            .join("claude-code-router");
        Ok(config_dir)
    }
}

/// 获取备份目录路径
pub fn get_backup_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?;

    let backup_dir = home_dir.join(".claude-code-proxy").join("backups");
    Ok(backup_dir)
}

/// 检测当前操作系统平台
pub fn get_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    return "Windows";

    #[cfg(target_os = "macos")]
    return "macOS";

    #[cfg(target_os = "linux")]
    return "Linux";
}

/// 确保目录存在,如果不存在则创建
pub fn ensure_dir_exists(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        std::fs::create_dir_all(path)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_claude_code_settings_path() {
        let path = get_claude_code_settings_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.to_string_lossy().contains(".claude"));
        assert!(path.to_string_lossy().contains("settings.json"));
    }

    #[test]
    fn test_get_app_data_dir() {
        let dir = get_app_data_dir();
        assert!(dir.is_ok());
        let dir = dir.unwrap();
        assert!(dir.to_string_lossy().contains("claude-code-router"));
    }

    #[test]
    fn test_get_platform() {
        let platform = get_platform();
        assert!(platform == "Windows" || platform == "macOS" || platform == "Linux");
    }

    #[test]
    fn test_get_backup_dir() {
        let dir = get_backup_dir();
        assert!(dir.is_ok());
        let dir = dir.unwrap();
        assert!(dir.to_string_lossy().contains(".claude-code-proxy"));
        assert!(dir.to_string_lossy().contains("backups"));
    }
}
