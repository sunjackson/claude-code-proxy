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
    pub claude_path: Option<String>,     // claude 命令的完整路径
    pub homebrew_installed: bool,  // macOS
    pub wsl_installed: bool,       // Windows
    pub git_bash_installed: bool,  // Windows
    pub node_installed: bool,
    pub node_version: Option<String>,
    pub node_path: Option<String>,       // node 命令的完整路径
    pub ripgrep_installed: bool,
    pub network_available: bool,
}

/// 辅助函数：检查命令是否存在
#[allow(dead_code)]
fn command_exists(cmd: &str) -> bool {
    // 方法1：使用 which/where 检查 PATH
    #[cfg(target_os = "windows")]
    let which_cmd = "where";
    
    #[cfg(not(target_os = "windows"))]
    let which_cmd = "which";
    
    let in_path = Command::new(which_cmd)
        .arg(cmd)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);
    
    if in_path {
        return true;
    }
    
    // 方法2：检查常见安装路径（macOS 和 Linux）
    #[cfg(not(target_os = "windows"))]
    {
        let common_paths = vec![
            format!("/usr/local/bin/{}", cmd),
            format!("/opt/homebrew/bin/{}", cmd),
            format!("/usr/bin/{}", cmd),
            format!("/bin/{}", cmd),
            format!("/opt/local/bin/{}", cmd),
        ];
        
        // 检查用户 home 目录下的常见路径
        if let Ok(home) = std::env::var("HOME") {
            let user_paths = vec![
                format!("{}/.local/bin/{}", home, cmd),
                format!("{}/.cargo/bin/{}", home, cmd),
                format!("{}/bin/{}", home, cmd),
            ];
            
            for path in user_paths {
                if std::path::Path::new(&path).exists() {
                    log::info!("在用户目录找到命令 {} : {}", cmd, path);
                    return true;
                }
            }
        }
        
        for path in common_paths {
            if std::path::Path::new(&path).exists() {
                log::info!("在常见路径找到命令 {} : {}", cmd, path);
                return true;
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        let common_paths = vec![
            format!("C:\\Program Files\\nodejs\\{}.exe", cmd),
            format!("C:\\Program Files (x86)\\nodejs\\{}.exe", cmd),
        ];
        
        for path in common_paths {
            if std::path::Path::new(&path).exists() {
                log::info!("在常见路径找到命令 {} : {}", cmd, path);
                return true;
            }
        }
    }
    
    false
}

/// 辅助函数：安全地执行命令并获取输出
fn safe_command_output(cmd: &str, args: &[&str]) -> Option<String> {
    // 方法1：尝试直接执行（依赖 PATH）
    if let Ok(output) = Command::new(cmd).args(args).output() {
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !result.is_empty() {
                return Some(result);
            }
        }
    }
    
    // 方法2：查找命令的完整路径并执行
    let full_path = find_command_path(cmd)?;
    
    Command::new(&full_path)
        .args(args)
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !result.is_empty() {
                    Some(result)
                } else {
                    None
                }
            } else {
                None
            }
        })
}

/// 查找命令的完整路径
fn find_command_path(cmd: &str) -> Option<String> {
    // 检查常见安装路径（macOS 和 Linux）
    #[cfg(not(target_os = "windows"))]
    {
        let common_paths = vec![
            format!("/usr/local/bin/{}", cmd),
            format!("/opt/homebrew/bin/{}", cmd),
            format!("/usr/bin/{}", cmd),
            format!("/bin/{}", cmd),
            format!("/opt/local/bin/{}", cmd),
        ];

        // 检查用户 home 目录下的常见路径
        if let Ok(home) = std::env::var("HOME") {
            let mut user_paths = vec![
                format!("{}/.local/bin/{}", home, cmd),
                format!("{}/.cargo/bin/{}", home, cmd),
                format!("{}/bin/{}", home, cmd),
                // npm 全局安装路径
                format!("{}/.npm-global/bin/{}", home, cmd),
                format!("{}/.npm/bin/{}", home, cmd),
            ];

            // 检查 nvm 安装的 node 版本
            let nvm_dir = format!("{}/.nvm/versions/node", home);
            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                for entry in entries.flatten() {
                    let node_bin = entry.path().join("bin").join(cmd);
                    if node_bin.exists() {
                        let path_str = node_bin.to_string_lossy().to_string();
                        log::info!("在 nvm 目录找到命令: {}", path_str);
                        return Some(path_str);
                    }
                }
            }

            // 检查 fnm 安装的 node 版本
            let fnm_dir = format!("{}/.local/share/fnm/node-versions", home);
            if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
                for entry in entries.flatten() {
                    let node_bin = entry.path().join("installation/bin").join(cmd);
                    if node_bin.exists() {
                        let path_str = node_bin.to_string_lossy().to_string();
                        log::info!("在 fnm 目录找到命令: {}", path_str);
                        return Some(path_str);
                    }
                }
            }

            // 检查 volta 安装路径
            let volta_bin = format!("{}/.volta/bin/{}", home, cmd);
            user_paths.push(volta_bin);

            // 检查 asdf 安装的 nodejs shim
            let asdf_shim = format!("{}/.asdf/shims/{}", home, cmd);
            user_paths.push(asdf_shim);

            // 检查 n (node version manager) 安装路径
            let n_bin = format!("{}/n/bin/{}", home, cmd);
            user_paths.push(n_bin);

            for path in user_paths {
                if std::path::Path::new(&path).exists() {
                    log::info!("找到命令完整路径: {}", path);
                    return Some(path);
                }
            }
        }

        for path in common_paths {
            if std::path::Path::new(&path).exists() {
                log::info!("找到命令完整路径: {}", path);
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let extensions = vec!["exe", "cmd", "bat", ""];
        let program_files = vec![
            "C:\\Program Files",
            "C:\\Program Files (x86)",
        ];

        // 检查用户目录下的 npm 全局安装路径
        if let Ok(appdata) = std::env::var("APPDATA") {
            for ext in &extensions {
                let suffix = if ext.is_empty() { String::new() } else { format!(".{}", ext) };
                let npm_path = format!("{}\\npm\\{}{}", appdata, cmd, suffix);
                if std::path::Path::new(&npm_path).exists() {
                    log::info!("找到命令完整路径: {}", npm_path);
                    return Some(npm_path);
                }
            }
        }

        // 检查 nvm-windows 安装路径
        if let Ok(home) = std::env::var("USERPROFILE") {
            let nvm_dir = format!("{}\\AppData\\Roaming\\nvm", home);
            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        for ext in &extensions {
                            let suffix = if ext.is_empty() { String::new() } else { format!(".{}", ext) };
                            let node_bin = entry.path().join(format!("{}{}", cmd, suffix));
                            if node_bin.exists() {
                                let path_str = node_bin.to_string_lossy().to_string();
                                log::info!("在 nvm-windows 目录找到命令: {}", path_str);
                                return Some(path_str);
                            }
                        }
                    }
                }
            }
        }

        // 检查 nodejs 目录
        for pf in &program_files {
            for ext in &extensions {
                let suffix = if ext.is_empty() { String::new() } else { format!(".{}", ext) };
                let path = format!("{}\\nodejs\\{}{}", pf, cmd, suffix);
                if std::path::Path::new(&path).exists() {
                    log::info!("找到命令完整路径: {}", path);
                    return Some(path);
                }
            }
        }

        // 检查 Git 目录
        for pf in &program_files {
            for ext in &extensions {
                let suffix = if ext.is_empty() { String::new() } else { format!(".{}", ext) };
                let path = format!("{}\\Git\\cmd\\{}{}", pf, cmd, suffix);
                if std::path::Path::new(&path).exists() {
                    log::info!("找到命令完整路径: {}", path);
                    return Some(path);
                }
            }
        }
    }

    None
}

impl EnvironmentStatus {
    /// 检测当前系统环境
    pub fn detect() -> AppResult<Self> {
        let os_type = Self::detect_os_type();
        let os_version = Self::detect_os_version();
        let shell = Self::detect_shell();
        let (claude_installed, claude_version, claude_path) = Self::detect_claude();
        let homebrew_installed = Self::detect_homebrew();
        let (wsl_installed, git_bash_installed) = Self::detect_windows_env();
        let (node_installed, node_version, node_path) = Self::detect_node();
        let ripgrep_installed = Self::detect_ripgrep();
        let network_available = Self::check_network();

        Ok(Self {
            os_type,
            os_version,
            shell,
            claude_installed,
            claude_version,
            claude_path,
            homebrew_installed,
            wsl_installed,
            git_bash_installed,
            node_installed,
            node_version,
            node_path,
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
    fn detect_claude() -> (bool, Option<String>, Option<String>) {
        // 先尝试查找 claude 命令的完整路径
        let claude_path = find_command_path("claude");

        // 使用完整路径执行命令获取版本
        if let Some(ref path) = claude_path {
            if let Ok(output) = Command::new(path).arg("--version").output() {
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !version.is_empty() {
                        log::info!("检测到 Claude Code 版本: {} (路径: {})", version, path);
                        return (true, Some(version), Some(path.clone()));
                    }
                }
            }
        }

        // 回退到使用安全的命令执行
        if let Some(version) = safe_command_output("claude", &["--version"]) {
            log::info!("检测到 Claude Code 版本: {}", version);
            return (true, Some(version), claude_path);
        }

        log::warn!("Claude Code 未检测到");
        (false, None, None)
    }

    /// 检测 Homebrew (macOS)
    fn detect_homebrew() -> bool {
        #[cfg(target_os = "macos")]
        {
            let installed = safe_command_output("brew", &["--version"]).is_some();
            if installed {
                log::info!("检测到 Homebrew");
            } else {
                log::warn!("Homebrew 未检测到");
            }
            installed
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
    fn detect_node() -> (bool, Option<String>, Option<String>) {
        // 先尝试查找 node 命令的完整路径
        let node_path = find_command_path("node");

        // 使用完整路径执行命令获取版本
        if let Some(ref path) = node_path {
            if let Ok(output) = Command::new(path).arg("--version").output() {
                if output.status.success() {
                    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let version = version_str.trim_start_matches('v').to_string();

                    // 检查版本是否 >= 18
                    let meets_requirement = version
                        .split('.')
                        .next()
                        .and_then(|major| major.parse::<u32>().ok())
                        .map(|major| major >= 18)
                        .unwrap_or(false);

                    if meets_requirement {
                        log::info!("检测到 Node.js 版本: {} (满足要求, 路径: {})", version, path);
                        return (true, Some(version), Some(path.clone()));
                    } else {
                        log::warn!("检测到 Node.js 版本: {} (不满足 >=18 的要求, 路径: {})", version, path);
                        return (false, Some(version), Some(path.clone()));
                    }
                }
            }
        }

        // 回退到使用安全的命令执行
        if let Some(version_str) = safe_command_output("node", &["--version"]) {
            let version = version_str.trim_start_matches('v').to_string();

            // 检查版本是否 >= 18
            let meets_requirement = version
                .split('.')
                .next()
                .and_then(|major| major.parse::<u32>().ok())
                .map(|major| major >= 18)
                .unwrap_or(false);

            if meets_requirement {
                log::info!("检测到 Node.js 版本: {} (满足要求)", version);
                return (true, Some(version), node_path);
            } else {
                log::warn!("检测到 Node.js 版本: {} (不满足 >=18 的要求)", version);
                return (false, Some(version), node_path);
            }
        }

        log::warn!("Node.js 未检测到");
        (false, None, None)
    }

    /// 检测 ripgrep
    fn detect_ripgrep() -> bool {
        let installed = safe_command_output("rg", &["--version"]).is_some();
        if installed {
            log::info!("检测到 ripgrep");
        } else {
            log::warn!("ripgrep 未检测到");
        }
        installed
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
