use crate::models::config_backup::ConfigBackup;
use crate::models::error::{AppError, AppResult};
use crate::services::{BackupService, ClaudeConfigService, ProxyConfig};
use crate::utils::paths;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Claude Code 配置路径检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodePath {
    /// 配置文件路径
    pub settings_path: String,

    /// 配置目录路径
    pub config_dir: String,

    /// 操作系统平台
    pub platform: String,

    /// 配置文件是否存在
    pub exists: bool,

    /// 是否可读
    pub readable: bool,

    /// 是否可写
    pub writable: bool,
}

/// 检测 Claude Code 配置路径
///
/// 跨平台检测 ~/.claude/settings.json 路径
/// - Windows: %USERPROFILE%\.claude\settings.json
/// - macOS: ~/.claude/settings.json
/// - Linux: ~/.claude/settings.json
#[tauri::command]
pub fn detect_claude_code_path() -> AppResult<ClaudeCodePath> {
    log::info!("开始检测 Claude Code 配置路径");

    // 获取配置文件路径
    let settings_path = paths::get_claude_code_settings_path()?;
    let config_dir = paths::get_claude_code_config_dir()?;
    let platform = paths::get_platform();

    // 检查文件是否存在
    let exists = settings_path.exists();

    // 检查文件权限
    let (readable, writable) = if exists {
        (
            check_readable(&settings_path),
            check_writable(&settings_path),
        )
    } else {
        // 文件不存在,检查目录权限
        let dir_readable = check_readable(&config_dir);
        let dir_writable = check_writable(&config_dir);
        (dir_readable, dir_writable)
    };

    let result = ClaudeCodePath {
        settings_path: settings_path.to_string_lossy().to_string(),
        config_dir: config_dir.to_string_lossy().to_string(),
        platform: platform.to_string(),
        exists,
        readable,
        writable,
    };

    log::info!(
        "Claude Code 配置路径检测完成: {} (存在: {}, 可读: {}, 可写: {})",
        result.settings_path,
        result.exists,
        result.readable,
        result.writable
    );

    Ok(result)
}

/// 列出所有 Claude Code 配置备份
///
/// 返回备份列表,按时间倒序排列
#[tauri::command]
pub fn list_claude_code_backups() -> AppResult<Vec<ConfigBackup>> {
    log::info!("开始列出 Claude Code 配置备份");

    let backups = BackupService::list_backups()?;

    log::info!("找到 {} 个配置备份", backups.len());
    Ok(backups)
}

/// 创建 Claude Code 配置备份
///
/// # 参数
/// - `reason`: 备份原因
#[tauri::command]
pub fn create_claude_code_backup(reason: String) -> AppResult<ConfigBackup> {
    log::info!("创建 Claude Code 配置备份: {}", reason);

    let backup = BackupService::create_backup(&reason)?;

    log::info!("配置备份已创建: {}", backup.file_path);
    Ok(backup)
}

/// 恢复 Claude Code 配置备份
///
/// # 参数
/// - `backup_filename`: 备份文件名
#[tauri::command]
pub fn restore_claude_code_backup(backup_filename: String) -> AppResult<()> {
    log::info!("恢复 Claude Code 配置备份: {}", backup_filename);

    BackupService::restore_backup(&backup_filename)?;

    log::info!("配置备份恢复成功");
    Ok(())
}

/// 删除 Claude Code 配置备份
///
/// # 参数
/// - `backup_filename`: 备份文件名
#[tauri::command]
pub fn delete_claude_code_backup(backup_filename: String) -> AppResult<()> {
    log::info!("删除 Claude Code 配置备份: {}", backup_filename);

    BackupService::delete_backup(&backup_filename)?;

    log::info!("配置备份已删除");
    Ok(())
}

/// 启用 Claude Code 代理
///
/// # 参数
/// - `host`: 代理服务器地址
/// - `port`: 代理服务器端口
#[tauri::command]
pub fn enable_claude_code_proxy(host: String, port: u16) -> AppResult<()> {
    log::info!("启用 Claude Code 代理: {}:{}", host, port);

    let proxy_config = ProxyConfig { host, port };
    ClaudeConfigService::enable_proxy(&proxy_config)?;

    log::info!("Claude Code 代理已启用");
    Ok(())
}

/// 禁用 Claude Code 代理
#[tauri::command]
pub fn disable_claude_code_proxy() -> AppResult<()> {
    log::info!("禁用 Claude Code 代理");

    ClaudeConfigService::disable_proxy()?;

    log::info!("Claude Code 代理已禁用");
    Ok(())
}

/// 获取当前 Claude Code 代理配置
///
/// # 返回
/// - `Some(ProxyConfig)`: 当前代理配置
/// - `None`: 未配置代理
#[tauri::command]
pub fn get_claude_code_proxy() -> AppResult<Option<ProxyConfig>> {
    log::debug!("获取当前 Claude Code 代理配置");

    let config = ClaudeConfigService::get_proxy_config()?;

    if let Some(ref cfg) = config {
        log::debug!("当前代理配置: {}:{}", cfg.host, cfg.port);
    } else {
        log::debug!("未配置代理");
    }

    Ok(config)
}

/// 恢复 Claude Code 配置到指定备份
///
/// 这是 restore_claude_code_backup 的别名,保持 API 一致性
///
/// # 参数
/// - `backup_filename`: 备份文件名
#[tauri::command]
pub fn restore_claude_code_config(backup_filename: String) -> AppResult<()> {
    log::info!("恢复 Claude Code 配置: {}", backup_filename);

    ClaudeConfigService::restore_config(&backup_filename)?;

    log::info!("Claude Code 配置已恢复");
    Ok(())
}

/// 预览备份配置内容
///
/// # 参数
/// - `backup_filename`: 备份文件名
///
/// # 返回
/// - 备份的配置内容 (JSON 字符串)
#[tauri::command]
pub fn preview_claude_code_backup(backup_filename: String) -> AppResult<String> {
    log::info!("预览 Claude Code 配置备份: {}", backup_filename);

    // 获取所有备份
    let backups = BackupService::list_backups()?;

    // 查找指定的备份
    let backup = backups
        .iter()
        .find(|b| b.file_name == backup_filename)
        .ok_or_else(|| AppError::PathNotFound {
            path: backup_filename.clone(),
        })?;

    log::info!("备份配置预览成功,大小: {} 字节", backup.content.len());
    Ok(backup.content.clone())
}

/// 清空所有配置备份
///
/// # 返回
/// - 删除的备份数量
#[tauri::command]
pub fn clear_all_claude_code_backups() -> AppResult<usize> {
    log::info!("开始清空所有 Claude Code 配置备份");

    let backups = BackupService::list_backups()?;
    let total_count = backups.len();

    let mut deleted_count = 0;
    let mut errors = Vec::new();

    for backup in backups {
        match BackupService::delete_backup(&backup.file_name) {
            Ok(_) => {
                deleted_count += 1;
                log::debug!("已删除备份: {}", backup.file_name);
            }
            Err(e) => {
                log::warn!("删除备份失败 {}: {}", backup.file_name, e);
                errors.push(format!("{}: {}", backup.file_name, e));
            }
        }
    }

    if !errors.is_empty() {
        log::warn!("部分备份删除失败: {:?}", errors);
    }

    log::info!(
        "清空配置备份完成: 成功 {} 个,失败 {} 个,总计 {} 个",
        deleted_count,
        errors.len(),
        total_count
    );

    Ok(deleted_count)
}

/// 获取当前 Claude Code 配置内容
///
/// # 返回
/// - `Ok(String)`: 配置文件内容 (JSON 字符串)
/// - `Err(AppError)`: 读取失败或文件不存在
#[tauri::command]
pub fn get_claude_code_settings() -> AppResult<String> {
    log::info!("读取当前 Claude Code 配置");

    let settings_path = paths::get_claude_code_settings_path()?;

    if !settings_path.exists() {
        log::warn!("配置文件不存在: {:?}", settings_path);
        return Err(AppError::PathNotFound {
            path: settings_path.to_string_lossy().to_string(),
        });
    }

    let content = std::fs::read_to_string(&settings_path).map_err(|e| AppError::IoError {
        message: format!("读取配置文件失败: {}", e),
    })?;

    log::info!("配置文件读取成功,大小: {} 字节", content.len());
    Ok(content)
}

/// 检查路径是否可读
fn check_readable(path: &PathBuf) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            let permissions = metadata.permissions();
            let mode = permissions.mode();
            // 检查用户读权限 (0o400)
            return (mode & 0o400) != 0;
        }
        false
    }

    #[cfg(windows)]
    {
        // Windows 上简单检查文件是否可以打开读取
        std::fs::File::open(path).is_ok()
    }

    #[cfg(not(any(unix, windows)))]
    {
        // 其他平台,尝试读取来检查
        std::fs::File::open(path).is_ok()
    }
}

/// 检查路径是否可写
fn check_writable(path: &PathBuf) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            let permissions = metadata.permissions();
            let mode = permissions.mode();
            // 检查用户写权限 (0o200)
            return (mode & 0o200) != 0;
        }
        false
    }

    #[cfg(windows)]
    {
        // Windows 上检查文件是否可以打开写入
        if path.is_file() {
            std::fs::OpenOptions::new()
                .write(true)
                .append(true)
                .open(path)
                .is_ok()
        } else if path.is_dir() {
            // 检查目录是否可写(尝试创建临时文件)
            let temp_file = path.join(".write_test_temp");
            let result = std::fs::File::create(&temp_file).is_ok();
            let _ = std::fs::remove_file(&temp_file);
            result
        } else {
            false
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        // 其他平台,尝试打开写入来检查
        if path.is_file() {
            std::fs::OpenOptions::new()
                .write(true)
                .append(true)
                .open(path)
                .is_ok()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn test_detect_claude_code_path() {
        let result = detect_claude_code_path();
        assert!(result.is_ok());

        let path_info = result.unwrap();
        assert!(!path_info.settings_path.is_empty());
        assert!(!path_info.config_dir.is_empty());
        assert!(!path_info.platform.is_empty());
        assert!(
            path_info.platform == "Windows"
                || path_info.platform == "macOS"
                || path_info.platform == "Linux"
        );
    }

    #[test]
    fn test_check_readable_writable() {
        // 创建临时文件用于测试
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("claude_code_test_file.txt");

        // 创建文件
        let mut file = fs::File::create(&test_file).unwrap();
        file.write_all(b"test content").unwrap();
        drop(file);

        // 测试读写权限检查
        assert!(check_readable(&test_file));
        assert!(check_writable(&test_file));

        // 清理
        fs::remove_file(&test_file).unwrap();
    }

    #[test]
    fn test_check_nonexistent_path() {
        let nonexistent = PathBuf::from("/nonexistent/path/file.txt");
        assert!(!check_readable(&nonexistent));
        assert!(!check_writable(&nonexistent));
    }
}
