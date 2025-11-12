#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// ConfigBackup (配置备份) 数据模型
/// 代表 Claude Code 原始配置文件的备份
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigBackup {
    /// 备份唯一标识符
    pub id: i64,

    /// 备份文件路径
    pub file_path: String,

    /// 备份文件名（用于前端显示和操作）
    pub file_name: String,

    /// 原始配置文件路径
    pub original_path: String,

    /// 备份内容 (JSON 字符串)
    pub content: String,

    /// 备份时间（保持兼容）
    pub backup_at: String,

    /// 备份时间（前端字段）
    #[serde(rename = "backup_time")]
    pub backup_time: String,

    /// 备份原因
    pub reason: String,

    /// 文件大小（字节）
    pub file_size: i64,

    /// 操作系统平台
    pub platform: Platform,

    /// 是否已恢复
    pub is_restored: bool,
}

/// 操作系统平台
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Platform {
    Windows,
    #[serde(rename = "macOS")]
    MacOS,
    Linux,
}

impl Platform {
    /// 从字符串解析平台
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "Windows" => Ok(Platform::Windows),
            "macOS" => Ok(Platform::MacOS),
            "Linux" => Ok(Platform::Linux),
            _ => Err(format!("不支持的平台: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Platform::Windows => "Windows",
            Platform::MacOS => "macOS",
            Platform::Linux => "Linux",
        }
    }

    /// 获取当前运行的平台
    pub fn current() -> Self {
        #[cfg(target_os = "windows")]
        return Platform::Windows;

        #[cfg(target_os = "macos")]
        return Platform::MacOS;

        #[cfg(target_os = "linux")]
        return Platform::Linux;
    }
}

/// 创建配置备份的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConfigBackupInput {
    pub file_path: String,
    pub original_path: String,
    pub content: String,
    pub platform: Platform,
}

/// 备份列表项 (用于前端展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigBackupItem {
    /// 备份 ID
    pub id: i64,

    /// 备份文件路径
    pub file_path: String,

    /// 原始文件路径
    pub original_path: String,

    /// 备份时间
    pub backup_at: String,

    /// 平台
    pub platform: Platform,

    /// 是否已恢复
    pub is_restored: bool,

    /// 备份大小 (字节)
    pub size_bytes: usize,
}

impl ConfigBackup {
    /// 验证文件路径
    pub fn validate_file_path(path: &str) -> Result<(), String> {
        if path.is_empty() {
            return Err("文件路径不能为空".to_string());
        }

        // 可以添加更多验证,如路径格式检查
        Ok(())
    }

    /// 验证 JSON 内容
    pub fn validate_content(content: &str) -> Result<(), String> {
        if content.is_empty() {
            return Err("备份内容不能为空".to_string());
        }

        // 尝试解析 JSON 以验证格式
        serde_json::from_str::<serde_json::Value>(content)
            .map_err(|e| format!("备份内容不是有效的 JSON: {}", e))?;

        Ok(())
    }

    /// 获取备份大小 (字节)
    pub fn size_bytes(&self) -> usize {
        self.content.len()
    }

    /// 获取备份大小 (KB)
    pub fn size_kb(&self) -> f64 {
        self.size_bytes() as f64 / 1024.0
    }

    /// 检查备份是否可以恢复
    pub fn can_restore(&self) -> bool {
        // 只能恢复未被恢复过的备份(可选策略)
        // 这里允许多次恢复
        true
    }

    /// 生成备份文件名
    /// 格式: settings_YYYYMMDD_HHMMSS.json
    pub fn generate_filename() -> String {
        let now = chrono::Local::now();
        format!("settings_{}.json", now.format("%Y%m%d_%H%M%S"))
    }
}

impl CreateConfigBackupInput {
    /// 验证创建输入
    pub fn validate(&self) -> Result<(), String> {
        ConfigBackup::validate_file_path(&self.file_path)?;
        ConfigBackup::validate_file_path(&self.original_path)?;
        ConfigBackup::validate_content(&self.content)?;

        Ok(())
    }
}

impl ConfigBackupItem {
    /// 从 ConfigBackup 创建列表项
    pub fn from_backup(backup: ConfigBackup) -> Self {
        let size_bytes = backup.size_bytes();

        ConfigBackupItem {
            id: backup.id,
            file_path: backup.file_path,
            original_path: backup.original_path,
            backup_at: backup.backup_at,
            platform: backup.platform,
            is_restored: backup.is_restored,
            size_bytes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_from_str() {
        assert_eq!(Platform::from_str("Windows").unwrap(), Platform::Windows);
        assert_eq!(Platform::from_str("macOS").unwrap(), Platform::MacOS);
        assert_eq!(Platform::from_str("Linux").unwrap(), Platform::Linux);
        assert!(Platform::from_str("FreeBSD").is_err());
    }

    #[test]
    fn test_platform_as_str() {
        assert_eq!(Platform::Windows.as_str(), "Windows");
        assert_eq!(Platform::MacOS.as_str(), "macOS");
        assert_eq!(Platform::Linux.as_str(), "Linux");
    }

    #[test]
    fn test_platform_current() {
        let platform = Platform::current();
        #[cfg(target_os = "windows")]
        assert_eq!(platform, Platform::Windows);

        #[cfg(target_os = "macos")]
        assert_eq!(platform, Platform::MacOS);

        #[cfg(target_os = "linux")]
        assert_eq!(platform, Platform::Linux);
    }

    #[test]
    fn test_validate_file_path() {
        assert!(ConfigBackup::validate_file_path("/path/to/file.json").is_ok());
        assert!(ConfigBackup::validate_file_path("").is_err());
    }

    #[test]
    fn test_validate_content() {
        assert!(ConfigBackup::validate_content(r#"{"key": "value"}"#).is_ok());
        assert!(ConfigBackup::validate_content("").is_err());
        assert!(ConfigBackup::validate_content("invalid json").is_err());
    }

    #[test]
    fn test_size_calculations() {
        let backup = ConfigBackup {
            id: 1,
            file_path: "/backup/file.json".to_string(),
            original_path: "/original/file.json".to_string(),
            content: "a".repeat(1024), // 1 KB
            backup_at: "2025-11-09".to_string(),
            platform: Platform::MacOS,
            is_restored: false,
        };

        assert_eq!(backup.size_bytes(), 1024);
        assert_eq!(backup.size_kb(), 1.0);
    }

    #[test]
    fn test_generate_filename() {
        let filename = ConfigBackup::generate_filename();
        assert!(filename.starts_with("settings_"));
        assert!(filename.ends_with(".json"));
    }
}
