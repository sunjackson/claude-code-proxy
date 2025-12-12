// Node 环境检测模型
// 支持多环境检测和管理

use serde::{Deserialize, Serialize};

/// Node 版本管理器类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NodeVersionManager {
    /// 系统安装的 Node
    System,
    /// Node Version Manager (Unix)
    NVM,
    /// Fast Node Manager
    FNM,
    /// Volta
    Volta,
    /// ASDF version manager
    ASDF,
    /// n (node version manager)
    N,
    /// NVM for Windows
    NVMWindows,
    /// 未知来源
    Unknown,
}

impl NodeVersionManager {
    /// 获取管理器的显示名称
    pub fn display_name(&self) -> &'static str {
        match self {
            NodeVersionManager::System => "System",
            NodeVersionManager::NVM => "NVM",
            NodeVersionManager::FNM => "FNM",
            NodeVersionManager::Volta => "Volta",
            NodeVersionManager::ASDF => "ASDF",
            NodeVersionManager::N => "N",
            NodeVersionManager::NVMWindows => "NVM-Windows",
            NodeVersionManager::Unknown => "Unknown",
        }
    }

    /// 获取管理器的图标（预留供前端使用）
    #[allow(dead_code)]
    pub fn icon(&self) -> &'static str {
        match self {
            NodeVersionManager::System => "💻",
            NodeVersionManager::NVM => "🔄",
            NodeVersionManager::FNM => "⚡",
            NodeVersionManager::Volta => "⚡",
            NodeVersionManager::ASDF => "🔧",
            NodeVersionManager::N => "📦",
            NodeVersionManager::NVMWindows => "🪟",
            NodeVersionManager::Unknown => "❓",
        }
    }
}

/// Claude Code 安装信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeInfo {
    /// Claude Code 版本
    pub version: String,
    /// claude 命令路径
    pub path: String,
    /// 安装方式 (npm-global, homebrew, native 等)
    pub install_method: String,
}

/// Node 环境信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeEnvironment {
    /// 环境唯一标识 (格式: {manager}-{version})
    pub id: String,
    /// Node 版本 (如 "v20.10.0")
    pub version: String,
    /// Node 主版本号
    pub major_version: u32,
    /// Node 可执行文件路径
    pub node_path: String,
    /// npm 可执行文件路径
    pub npm_path: Option<String>,
    /// bin 目录路径 (用于查找 claude 等命令)
    pub bin_dir: String,
    /// 环境管理器类型
    pub manager: NodeVersionManager,
    /// Claude Code 安装信息 (如果已安装)
    pub claude_info: Option<ClaudeCodeInfo>,
    /// 是否为用户选择的默认环境
    pub is_default: bool,
    /// 是否满足 Node >= 18 的要求
    pub meets_requirement: bool,
}

impl NodeEnvironment {
    /// 创建新的 NodeEnvironment
    pub fn new(
        version: String,
        node_path: String,
        manager: NodeVersionManager,
    ) -> Self {
        // 解析主版本号
        let major_version = version
            .trim_start_matches('v')
            .split('.')
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        // 获取 bin 目录
        let bin_dir = std::path::Path::new(&node_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // 生成唯一 ID
        let id = format!(
            "{}-{}",
            manager.display_name().to_lowercase(),
            version.trim_start_matches('v')
        );

        Self {
            id,
            version: version.clone(),
            major_version,
            node_path,
            npm_path: None,
            bin_dir,
            manager,
            claude_info: None,
            is_default: false,
            meets_requirement: major_version >= 18,
        }
    }

    /// 设置 npm 路径
    pub fn with_npm_path(mut self, npm_path: String) -> Self {
        self.npm_path = Some(npm_path);
        self
    }

    /// 设置 Claude Code 信息
    pub fn with_claude_info(mut self, claude_info: ClaudeCodeInfo) -> Self {
        self.claude_info = Some(claude_info);
        self
    }

    /// 标记为默认环境
    pub fn set_default(&mut self, is_default: bool) {
        self.is_default = is_default;
    }
}

/// 增强的环境检测状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedEnvironmentStatus {
    /// 操作系统类型
    pub os_type: String,
    /// 操作系统版本
    pub os_version: String,
    /// Shell 环境
    pub shell: Option<String>,

    /// 所有检测到的 Node 环境
    pub node_environments: Vec<NodeEnvironment>,

    /// 用户选择的默认环境 ID
    pub default_environment_id: Option<String>,

    /// 系统中找到的 Claude Code (可能在任意环境中)
    /// 用于向后兼容
    pub claude_installed: bool,
    pub claude_version: Option<String>,
    pub claude_path: Option<String>,

    /// 其他依赖检测
    pub homebrew_installed: bool,
    pub wsl_installed: bool,
    pub git_bash_installed: bool,
    pub ripgrep_installed: bool,
    pub network_available: bool,

    /// 检测元数据
    pub detected_at: String,
    pub detection_duration_ms: u64,
}

impl EnhancedEnvironmentStatus {
    /// 获取满足要求 (Node >= 18) 的环境数量
    pub fn valid_environment_count(&self) -> usize {
        self.node_environments
            .iter()
            .filter(|e| e.meets_requirement)
            .count()
    }

    /// 获取安装了 Claude Code 的环境数量（预留供将来使用）
    #[allow(dead_code)]
    pub fn claude_installed_count(&self) -> usize {
        self.node_environments
            .iter()
            .filter(|e| e.claude_info.is_some())
            .count()
    }

    /// 获取默认环境（预留供将来使用）
    #[allow(dead_code)]
    pub fn get_default_environment(&self) -> Option<&NodeEnvironment> {
        self.node_environments.iter().find(|e| e.is_default)
    }

    /// 根据 ID 获取环境（预留供将来使用）
    #[allow(dead_code)]
    pub fn get_environment_by_id(&self, id: &str) -> Option<&NodeEnvironment> {
        self.node_environments.iter().find(|e| e.id == id)
    }

    /// 检查是否可以安装 Claude Code (至少有一个满足要求的 Node 环境)
    pub fn can_install_claude(&self) -> (bool, Vec<String>) {
        let mut missing = Vec::new();

        if !self.network_available {
            missing.push("需要网络连接".to_string());
        }

        if self.valid_environment_count() == 0 {
            missing.push("需要 Node.js >= 18".to_string());
        }

        #[cfg(target_os = "windows")]
        if !self.wsl_installed && !self.git_bash_installed {
            missing.push("需要 WSL 或 Git Bash".to_string());
        }

        (missing.is_empty(), missing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_environment_creation() {
        let env = NodeEnvironment::new(
            "v20.10.0".to_string(),
            "/home/user/.nvm/versions/node/v20.10.0/bin/node".to_string(),
            NodeVersionManager::NVM,
        );

        assert_eq!(env.id, "nvm-20.10.0");
        assert_eq!(env.major_version, 20);
        assert!(env.meets_requirement);
        assert!(!env.is_default);
    }

    #[test]
    fn test_old_node_version() {
        let env = NodeEnvironment::new(
            "v16.20.0".to_string(),
            "/usr/local/bin/node".to_string(),
            NodeVersionManager::System,
        );

        assert_eq!(env.major_version, 16);
        assert!(!env.meets_requirement);
    }

    #[test]
    fn test_manager_display_name() {
        assert_eq!(NodeVersionManager::NVM.display_name(), "NVM");
        assert_eq!(NodeVersionManager::NVMWindows.display_name(), "NVM-Windows");
    }
}
