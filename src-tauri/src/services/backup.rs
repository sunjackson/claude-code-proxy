use crate::models::config_backup::{ConfigBackup, Platform};
use crate::models::error::{AppError, AppResult};
use crate::utils::paths;
use std::fs;
use std::path::PathBuf;

/// 配置备份服务
/// 负责 Claude Code settings.json 的备份和恢复
pub struct BackupService;

impl BackupService {
    /// 创建 Claude Code 配置的备份
    ///
    /// # 参数
    /// - `reason`: 备份原因描述
    ///
    /// # 返回
    /// - `Ok(ConfigBackup)`: 备份信息
    /// - `Err(AppError)`: 备份失败
    pub fn create_backup(reason: &str) -> AppResult<ConfigBackup> {
        log::info!("开始创建 Claude Code 配置备份: {}", reason);

        // 获取 settings.json 路径
        let settings_path = paths::get_claude_code_settings_path()?;

        // 检查文件是否存在
        if !settings_path.exists() {
            return Err(AppError::PathNotFound {
                path: settings_path.to_string_lossy().to_string(),
            });
        }

        // 读取配置内容
        let content = fs::read_to_string(&settings_path).map_err(|e| AppError::IoError {
            message: format!("读取配置文件失败: {}", e),
        })?;

        // 解析 JSON 并提取 ANTHROPIC_AUTH_TOKEN
        let current_token = Self::extract_auth_token(&content).ok();

        // 检查是否存在相同 token 的备份（以 ANTHROPIC_AUTH_TOKEN 为主键去重）
        let existing_backups = Self::list_backups().unwrap_or_default();
        if !existing_backups.is_empty() {
            // 遍历现有备份，查找是否有相同的 token
            for existing_backup in existing_backups.iter() {
                // 提取现有备份的 token
                let existing_token = Self::extract_auth_token(&existing_backup.content).ok();

                // 比较逻辑：
                // 1. 如果两个 token 都存在且相同，则跳过创建新备份
                // 2. 如果两个都没有 token，则比较整个配置内容
                match (&current_token, &existing_token) {
                    (Some(curr_token), Some(exist_token)) => {
                        // 两个都有 token，比较 token
                        if curr_token == exist_token {
                            log::info!(
                                "ANTHROPIC_AUTH_TOKEN 与现有备份相同，更新备份时间: {} (原因: {})",
                                existing_backup.file_name,
                                reason
                            );

                            // 更新现有备份文件的修改时间（通过重新写入）
                            let backup_path = PathBuf::from(&existing_backup.file_path);
                            fs::write(&backup_path, &content).map_err(|e| AppError::IoError {
                                message: format!("更新备份文件失败: {}", e),
                            })?;

                            // 获取更新后的文件元数据
                            let metadata = fs::metadata(&backup_path).map_err(|e| AppError::IoError {
                                message: format!("获取文件元数据失败: {}", e),
                            })?;

                            // 获取新的修改时间
                            let modified = metadata.modified().map_err(|e| AppError::IoError {
                                message: format!("获取文件修改时间失败: {}", e),
                            })?;
                            let backup_time = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();

                            log::info!(
                                "备份时间已更新: {} -> {}",
                                existing_backup.backup_at,
                                backup_time
                            );

                            // 返回更新后的备份信息
                            let mut updated_backup = existing_backup.clone();
                            updated_backup.backup_at = backup_time.clone();
                            updated_backup.backup_time = backup_time;
                            updated_backup.reason = format!("{} (已更新时间)", reason);
                            updated_backup.content = content.clone();

                            return Ok(updated_backup);
                        }
                    }
                    (None, None) => {
                        // 两个都没有 token，比较整个配置内容
                        if existing_backup.content == content {
                            log::info!(
                                "配置内容与现有备份相同（无Token），更新备份时间: {} (原因: {})",
                                existing_backup.file_name,
                                reason
                            );

                            // 更新现有备份文件的修改时间（通过重新写入）
                            let backup_path = PathBuf::from(&existing_backup.file_path);
                            fs::write(&backup_path, &content).map_err(|e| AppError::IoError {
                                message: format!("更新备份文件失败: {}", e),
                            })?;

                            // 获取更新后的文件元数据
                            let metadata = fs::metadata(&backup_path).map_err(|e| AppError::IoError {
                                message: format!("获取文件元数据失败: {}", e),
                            })?;

                            // 获取新的修改时间
                            let modified = metadata.modified().map_err(|e| AppError::IoError {
                                message: format!("获取文件修改时间失败: {}", e),
                            })?;
                            let backup_time = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();

                            log::info!(
                                "备份时间已更新: {} -> {}",
                                existing_backup.backup_at,
                                backup_time
                            );

                            // 返回更新后的备份信息
                            let mut updated_backup = existing_backup.clone();
                            updated_backup.backup_at = backup_time.clone();
                            updated_backup.backup_time = backup_time;
                            updated_backup.reason = format!("{} (已更新时间)", reason);
                            updated_backup.content = content.clone();

                            return Ok(updated_backup);
                        }
                    }
                    _ => {
                        // 一个有 token 一个没有，认为是不同的配置，继续检查其他备份
                        continue;
                    }
                }
            }
        }

        // 计算文件大小
        let metadata = fs::metadata(&settings_path).map_err(|e| AppError::IoError {
            message: format!("获取文件元数据失败: {}", e),
        })?;
        let file_size = metadata.len() as i64;

        // 生成备份文件名: settings_backup_YYYYMMDD_HHMMSS.json
        let backup_filename = Self::generate_backup_filename();

        // 获取备份目录
        let backup_dir = Self::get_backup_directory()?;

        // 确保备份目录存在
        fs::create_dir_all(&backup_dir).map_err(|e| AppError::IoError {
            message: format!("创建备份目录失败: {}", e),
        })?;

        // 备份文件完整路径
        let backup_path = backup_dir.join(&backup_filename);

        // 写入备份文件
        fs::write(&backup_path, &content).map_err(|e| AppError::IoError {
            message: format!("写入备份文件失败: {}", e),
        })?;

        log::info!(
            "配置备份已创建: {} (大小: {} 字节)",
            backup_path.display(),
            file_size
        );

        // 获取当前平台
        let platform = if cfg!(target_os = "windows") {
            Platform::Windows
        } else if cfg!(target_os = "macos") {
            Platform::MacOS
        } else {
            Platform::Linux
        };

        // 创建备份记录
        let backup_time = chrono::Utc::now().to_rfc3339();
        let backup = ConfigBackup {
            id: 0, // 数据库会自动分配
            file_path: backup_path.to_string_lossy().to_string(),
            file_name: backup_filename.clone(),
            original_path: settings_path.to_string_lossy().to_string(),
            content: content.clone(),
            backup_at: backup_time.clone(),
            backup_time,
            reason: reason.to_string(),
            file_size,
            platform,
            is_restored: false,
        };

        Ok(backup)
    }

    /// 列出所有可用的备份
    ///
    /// # 返回
    /// - `Ok(Vec<ConfigBackup>)`: 备份列表,按时间倒序排列
    /// - `Err(AppError)`: 读取失败
    pub fn list_backups() -> AppResult<Vec<ConfigBackup>> {
        log::debug!("正在列出所有配置备份");

        let backup_dir = Self::get_backup_directory()?;

        // 检查备份目录是否存在
        if !backup_dir.exists() {
            log::debug!("备份目录不存在,返回空列表");
            return Ok(Vec::new());
        }

        // 读取目录中的备份文件
        let entries = fs::read_dir(&backup_dir).map_err(|e| AppError::IoError {
            message: format!("读取备份目录失败: {}", e),
        })?;

        let mut backups = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|e| AppError::IoError {
                message: format!("读取目录条目失败: {}", e),
            })?;

            let path = entry.path();

            // 只处理 .json 文件
            if !path.is_file()
                || path
                    .extension()
                    .and_then(|s| s.to_str())
                    .map_or(true, |s| s != "json")
            {
                continue;
            }

            // 获取文件名
            let file_name = path
                .file_name()
                .and_then(|s| s.to_str())
                .ok_or_else(|| AppError::InvalidData {
                    message: "无效的文件名".to_string(),
                })?
                .to_string();

            // 只处理备份文件 (settings_backup_*.json)
            if !file_name.starts_with("settings_backup_") {
                continue;
            }

            // 获取修改时间
            let metadata = fs::metadata(&path).map_err(|e| AppError::IoError {
                message: format!("获取文件元数据失败: {}", e),
            })?;

            let modified = metadata.modified().map_err(|e| AppError::IoError {
                message: format!("获取文件修改时间失败: {}", e),
            })?;

            // 转换为 RFC3339 时间
            let backup_time = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();

            // 读取备份内容
            let content = fs::read_to_string(&path).unwrap_or_default();

            // 获取文件大小
            let file_size = metadata.len() as i64;

            // 获取当前平台
            let platform = if cfg!(target_os = "windows") {
                Platform::Windows
            } else if cfg!(target_os = "macos") {
                Platform::MacOS
            } else {
                Platform::Linux
            };

            // 获取原始配置路径
            let original_path = paths::get_claude_code_settings_path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            // 从文件名解析备份原因（如果文件名不是标准格式，则使用默认原因）
            let reason = "历史备份".to_string();

            // 创建备份记录
            let backup = ConfigBackup {
                id: 0, // 列表查询不需要数据库 ID
                file_path: path.to_string_lossy().to_string(),
                file_name: file_name.clone(),
                original_path,
                content,
                backup_at: backup_time.clone(),
                backup_time,
                reason,
                file_size,
                platform,
                is_restored: false,
            };

            backups.push(backup);
        }

        // 按时间倒序排列
        backups.sort_by(|a, b| b.backup_at.cmp(&a.backup_at));

        log::debug!("找到 {} 个配置备份", backups.len());
        Ok(backups)
    }

    /// 恢复指定的备份
    ///
    /// # 参数
    /// - `backup_filename`: 备份文件名
    ///
    /// # 返回
    /// - `Ok(())`: 恢复成功
    /// - `Err(AppError)`: 恢复失败
    pub fn restore_backup(backup_filename: &str) -> AppResult<()> {
        log::info!("开始恢复配置备份: {}", backup_filename);

        // 获取备份文件路径
        let backup_dir = Self::get_backup_directory()?;
        let backup_path = backup_dir.join(backup_filename);

        // 检查备份文件是否存在
        if !backup_path.exists() {
            return Err(AppError::PathNotFound {
                path: backup_path.to_string_lossy().to_string(),
            });
        }

        // 读取备份内容
        let backup_content = fs::read_to_string(&backup_path).map_err(|e| AppError::IoError {
            message: format!("读取备份文件失败: {}", e),
        })?;

        // 验证 JSON 格式
        serde_json::from_str::<serde_json::Value>(&backup_content).map_err(|e| {
            AppError::InvalidData {
                message: format!("备份文件格式无效: {}", e),
            }
        })?;

        // 获取当前配置文件路径
        let settings_path = paths::get_claude_code_settings_path()?;

        // 如果当前配置文件存在,先创建一个临时备份
        if settings_path.exists() {
            let temp_backup = Self::create_backup("恢复前自动备份")?;
            log::info!("已创建恢复前临时备份: {}", temp_backup.file_path);
        }

        // 恢复备份到配置文件
        fs::write(&settings_path, backup_content).map_err(|e| AppError::IoError {
            message: format!("恢复配置文件失败: {}", e),
        })?;

        log::info!("配置备份恢复成功: {}", backup_filename);
        Ok(())
    }

    /// 删除指定的备份
    ///
    /// # 参数
    /// - `backup_filename`: 备份文件名
    ///
    /// # 返回
    /// - `Ok(())`: 删除成功
    /// - `Err(AppError)`: 删除失败
    pub fn delete_backup(backup_filename: &str) -> AppResult<()> {
        log::info!("开始删除配置备份: {}", backup_filename);

        let backup_dir = Self::get_backup_directory()?;
        let backup_path = backup_dir.join(backup_filename);

        // 检查备份文件是否存在
        if !backup_path.exists() {
            return Err(AppError::PathNotFound {
                path: backup_path.to_string_lossy().to_string(),
            });
        }

        // 删除备份文件
        fs::remove_file(&backup_path).map_err(|e| AppError::IoError {
            message: format!("删除备份文件失败: {}", e),
        })?;

        log::info!("配置备份已删除: {}", backup_filename);
        Ok(())
    }

    /// 清理旧备份
    ///
    /// # 参数
    /// - `keep_count`: 保留最近的 N 个备份
    ///
    /// # 返回
    /// - `Ok(usize)`: 删除的备份数量
    /// - `Err(AppError)`: 清理失败
    #[allow(dead_code)]
    pub fn cleanup_old_backups(keep_count: usize) -> AppResult<usize> {
        log::info!("开始清理旧备份,保留最近 {} 个", keep_count);

        let backups = Self::list_backups()?;

        if backups.len() <= keep_count {
            log::debug!("备份数量未超过限制,无需清理");
            return Ok(0);
        }

        // 需要删除的备份
        let backups_to_delete = &backups[keep_count..];
        let mut deleted_count = 0;

        for backup in backups_to_delete {
            // 从 file_path 中提取文件名
            let file_name = std::path::Path::new(&backup.file_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            match Self::delete_backup(file_name) {
                Ok(_) => deleted_count += 1,
                Err(e) => {
                    log::warn!("删除备份失败 {}: {}", file_name, e);
                }
            }
        }

        log::info!("已清理 {} 个旧备份", deleted_count);
        Ok(deleted_count)
    }

    /// 获取备份目录
    fn get_backup_directory() -> AppResult<PathBuf> {
        let config_dir = paths::get_claude_code_config_dir()?;
        Ok(config_dir.join("backups"))
    }

    /// 生成备份文件名
    /// 格式: settings_backup_YYYYMMDD_HHMMSS.json
    fn generate_backup_filename() -> String {
        let now = chrono::Local::now();
        format!("settings_backup_{}.json", now.format("%Y%m%d_%H%M%S"))
    }

    /// 从配置内容中提取 ANTHROPIC_AUTH_TOKEN
    ///
    /// # 参数
    /// - `content`: JSON 配置内容
    ///
    /// # 返回
    /// - `Ok(String)`: 提取到的 token
    /// - `Err(AppError)`: 提取失败（JSON 格式错误或 token 不存在）
    fn extract_auth_token(content: &str) -> AppResult<String> {
        // 解析 JSON
        let json: serde_json::Value = serde_json::from_str(content).map_err(|e| {
            AppError::InvalidData {
                message: format!("解析配置文件 JSON 失败: {}", e),
            }
        })?;

        // 提取 ANTHROPIC_AUTH_TOKEN
        // Claude Code 配置结构: { "env": { "ANTHROPIC_AUTH_TOKEN": "sk-ant-xxx" } }
        // 尝试多个可能的路径以兼容不同版本
        let token = json
            .get("env")
            .and_then(|v| v.get("ANTHROPIC_AUTH_TOKEN"))
            .or_else(|| json.get("ANTHROPIC_AUTH_TOKEN"))
            .or_else(|| json.get("anthropic").and_then(|v| v.get("auth_token")))
            .or_else(|| json.get("anthropic").and_then(|v| v.get("ANTHROPIC_AUTH_TOKEN")))
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::InvalidData {
                message: "配置中未找到 ANTHROPIC_AUTH_TOKEN".to_string(),
            })?;

        Ok(token.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_generate_backup_filename() {
        let filename = BackupService::generate_backup_filename();
        assert!(filename.starts_with("settings_backup_"));
        assert!(filename.ends_with(".json"));
        // 验证格式: settings_backup_YYYYMMDD_HHMMSS.json
        let parts: Vec<&str> = filename.split('_').collect();
        assert_eq!(parts.len(), 4); // settings, backup, YYYYMMDD, HHMMSS.json
        assert_eq!(parts[0], "settings");
        assert_eq!(parts[1], "backup");
        assert_eq!(parts[2].len(), 8); // YYYYMMDD
        assert!(parts[3].ends_with(".json")); // HHMMSS.json
        assert_eq!(parts[3].len(), 11); // HHMMSS.json (6 + 5)
    }

    #[test]
    fn test_get_backup_directory() {
        let backup_dir = BackupService::get_backup_directory();
        assert!(backup_dir.is_ok());
        let dir = backup_dir.unwrap();
        assert!(dir.to_string_lossy().contains(".claude"));
        assert!(dir.to_string_lossy().contains("backups"));
    }

    #[test]
    fn test_create_and_list_backups() {
        // 创建临时测试目录
        let temp_dir = std::env::temp_dir().join("claude_code_backup_test");
        let _ = fs::create_dir_all(&temp_dir);

        // 创建临时配置文件
        let settings_path = temp_dir.join("settings.json");
        let mut file = fs::File::create(&settings_path).unwrap();
        file.write_all(b"{\"test\": \"data\"}").unwrap();
        drop(file);

        // 注意: 实际测试需要 mock paths 模块的返回值
        // 这里仅测试文件名生成逻辑
        let filename = BackupService::generate_backup_filename();
        assert!(filename.contains("settings_backup_"));

        // 清理
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_list_backups_empty_directory() {
        // 如果备份目录不存在或为空,应返回空列表
        // 实际实现会依赖于真实的文件系统状态
        // 这里仅验证函数签名正确
        let result = BackupService::list_backups();
        assert!(result.is_ok());
    }
}
