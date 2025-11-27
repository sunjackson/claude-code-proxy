// 环境检测服务
// 检测系统环境、Claude Code 安装状态和依赖

use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::models::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentStatus {
    pub os_type: String,
    pub os_version: String,
    pub shell: Option<String>,
    pub claude_installed: bool,
    pub claude_version: Option<String>,
    pub homebrew_installed: bool,  // macOS
    pub wsl_installed: bool,       // Windows
    pub git_bash_installed: bool,  // Windows
    pub node_installed: bool,
    pub node_version: Option<String>,
    pub ripgrep_installed: bool,
    pub network_available: bool,
}

impl EnvironmentStatus {
    /// 检测当前系统环境
    pub fn detect() -> AppResult<Self> {
        let os_type = Self::detect_os_type();
        let os_version = Self::detect_os_version();
        let shell = Self::detect_shell();
        let (claude_installed, claude_version) = Self::detect_claude();
        let homebrew_installed = Self::detect_homebrew();
        let (wsl_installed, git_bash_installed) = Self::detect_windows_env();
        let (node_installed, node_version) = Self::detect_node();
        let ripgrep_installed = Self::detect_ripgrep();
        let network_available = Self::check_network();

        Ok(Self {
            os_type,
            os_version,
            shell,
            claude_installed,
            claude_version,
            homebrew_installed,
            wsl_installed,
            git_bash_installed,
            node_installed,
            node_version,
            ripgrep_installed,
            network_available,
        })
    }

    /// 检测操作系统类型
    fn detect_os_type() -> String {
        std::env::consts::OS.to_string()
    }

    /// 检测操作系统版本
    fn detect_os_version() -> String {
        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = Command::new("sw_vers")
                .arg("-productVersion")
                .output()
            {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(output) = Command::new("lsb_release")
                .args(&["-d", "-s"])
                .output()
            {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }

            // 尝试读取 /etc/os-release
            if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
                for line in content.lines() {
                    if line.starts_with("PRETTY_NAME=") {
                        return line
                            .trim_start_matches("PRETTY_NAME=")
                            .trim_matches('"')
                            .to_string();
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("cmd")
                .args(&["/C", "ver"])
                .output()
            {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }

        "Unknown".to_string()
    }

    /// 检测当前 Shell 环境
    fn detect_shell() -> Option<String> {
        std::env::var("SHELL").ok().and_then(|shell_path| {
            std::path::Path::new(&shell_path)
                .file_name()
                .and_then(|name| name.to_str())
                .map(|s| s.to_string())
        })
    }

    /// 检测 Claude Code 是否已安装
    fn detect_claude() -> (bool, Option<String>) {
        if let Ok(output) = Command::new("claude").arg("--version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .to_string();
                return (true, Some(version));
            }
        }
        (false, None)
    }

    /// 检测 Homebrew (macOS)
    fn detect_homebrew() -> bool {
        #[cfg(target_os = "macos")]
        {
            Command::new("brew")
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }

        #[cfg(not(target_os = "macos"))]
        {
            false
        }
    }

    /// 检测 Windows 环境 (WSL, Git Bash)
    fn detect_windows_env() -> (bool, bool) {
        #[cfg(target_os = "windows")]
        {
            let wsl = Command::new("wsl")
                .arg("--status")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            let git_bash = Command::new("bash")
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            (wsl, git_bash)
        }

        #[cfg(not(target_os = "windows"))]
        {
            (false, false)
        }
    }

    /// 检测 Node.js
    fn detect_node() -> (bool, Option<String>) {
        if let Ok(output) = Command::new("node").arg("--version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .trim_start_matches('v')
                    .to_string();

                // 检查版本是否 >= 18
                let installed = version
                    .split('.')
                    .next()
                    .and_then(|major| major.parse::<u32>().ok())
                    .map(|major| major >= 18)
                    .unwrap_or(false);

                return (installed, Some(version));
            }
        }
        (false, None)
    }

    /// 检测 ripgrep
    fn detect_ripgrep() -> bool {
        Command::new("rg")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// 检查网络连接
    fn check_network() -> bool {
        // 尝试 ping claude.ai
        #[cfg(target_os = "windows")]
        {
            Command::new("ping")
                .args(&["-n", "1", "claude.ai"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }

        #[cfg(not(target_os = "windows"))]
        {
            Command::new("ping")
                .args(&["-c", "1", "claude.ai"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }
    }

    /// 生成环境报告
    pub fn generate_report(&self) -> String {
        let mut report = String::new();
        report.push_str(&format!("操作系统: {} {}\n", self.os_type, self.os_version));

        if let Some(shell) = &self.shell {
            report.push_str(&format!("Shell: {}\n", shell));
        }

        report.push_str(&format!(
            "Claude Code: {}\n",
            if self.claude_installed {
                format!("已安装 ({})", self.claude_version.as_deref().unwrap_or("未知版本"))
            } else {
                "未安装".to_string()
            }
        ));

        if self.os_type == "macos" {
            report.push_str(&format!(
                "Homebrew: {}\n",
                if self.homebrew_installed { "已安装" } else { "未安装" }
            ));
        }

        if self.os_type == "windows" {
            report.push_str(&format!(
                "WSL: {}\n",
                if self.wsl_installed { "已安装" } else { "未安装" }
            ));
            report.push_str(&format!(
                "Git Bash: {}\n",
                if self.git_bash_installed { "已安装" } else { "未安装" }
            ));
        }

        report.push_str(&format!(
            "Node.js: {}\n",
            if self.node_installed {
                format!("已安装 ({})", self.node_version.as_deref().unwrap_or("未知版本"))
            } else {
                "未安装".to_string()
            }
        ));

        report.push_str(&format!(
            "ripgrep: {}\n",
            if self.ripgrep_installed { "已安装" } else { "未安装" }
        ));

        report.push_str(&format!(
            "网络连接: {}\n",
            if self.network_available { "正常" } else { "异常" }
        ));

        report
    }

    /// 检查是否满足安装条件
    pub fn can_install(&self) -> (bool, Vec<String>) {
        let mut missing = Vec::new();

        // 必须有网络连接
        if !self.network_available {
            missing.push("需要网络连接".to_string());
        }

        // macOS 需要 Homebrew 或者使用脚本安装
        #[cfg(target_os = "macos")]
        if !self.homebrew_installed {
            missing.push("建议安装 Homebrew（或使用脚本安装）".to_string());
        }

        // Windows 需要 WSL 或 Git Bash
        #[cfg(target_os = "windows")]
        if !self.wsl_installed && !self.git_bash_installed {
            missing.push("需要 WSL 或 Git Bash".to_string());
        }

        let can_install = missing.is_empty();
        (can_install, missing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_environment() {
        let status = EnvironmentStatus::detect().unwrap();
        println!("Environment Report:\n{}", status.generate_report());

        assert!(!status.os_type.is_empty());
        assert!(!status.os_version.is_empty());
    }

    #[test]
    fn test_can_install() {
        let status = EnvironmentStatus::detect().unwrap();
        let (can_install, missing) = status.can_install();

        if !can_install {
            println!("缺失依赖: {:?}", missing);
        }
    }
}
