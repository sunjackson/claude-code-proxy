// Node 环境扫描器
// 自动发现系统中所有 Node 版本管理器管理的 Node 环境

use crate::models::node_environment::{ClaudeCodeInfo, NodeEnvironment, NodeVersionManager};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Node 环境扫描器
pub struct NodeScanner;

impl NodeScanner {
    /// 扫描所有 Node 环境
    pub fn scan_all_environments() -> Vec<NodeEnvironment> {
        let start = std::time::Instant::now();
        let mut environments = Vec::new();

        log::info!("开始扫描 Node 环境...");

        // 1. 扫描 NVM (Unix)
        #[cfg(not(target_os = "windows"))]
        {
            let nvm_envs = Self::scan_nvm();
            log::info!("NVM: 发现 {} 个环境", nvm_envs.len());
            environments.extend(nvm_envs);
        }

        // 2. 扫描 NVM-Windows
        #[cfg(target_os = "windows")]
        {
            let nvm_win_envs = Self::scan_nvm_windows();
            log::info!("NVM-Windows: 发现 {} 个环境", nvm_win_envs.len());
            environments.extend(nvm_win_envs);
        }

        // 3. 扫描 FNM
        let fnm_envs = Self::scan_fnm();
        log::info!("FNM: 发现 {} 个环境", fnm_envs.len());
        environments.extend(fnm_envs);

        // 4. 扫描 Volta
        let volta_envs = Self::scan_volta();
        log::info!("Volta: 发现 {} 个环境", volta_envs.len());
        environments.extend(volta_envs);

        // 5. 扫描 ASDF
        #[cfg(not(target_os = "windows"))]
        {
            let asdf_envs = Self::scan_asdf();
            log::info!("ASDF: 发现 {} 个环境", asdf_envs.len());
            environments.extend(asdf_envs);
        }

        // 6. 扫描 N
        #[cfg(not(target_os = "windows"))]
        {
            let n_envs = Self::scan_n();
            log::info!("N: 发现 {} 个环境", n_envs.len());
            environments.extend(n_envs);
        }

        // 7. 检测系统 Node (放在最后,优先级最低)
        if let Some(system_node) = Self::scan_system_node() {
            log::info!("System: 发现系统 Node {}", system_node.version);
            environments.push(system_node);
        }

        // 去重 (基于 node_path)
        let environments = Self::deduplicate_environments(environments);

        let duration = start.elapsed();
        log::info!(
            "Node 环境扫描完成: 共发现 {} 个环境, 耗时 {}ms",
            environments.len(),
            duration.as_millis()
        );

        environments
    }

    /// 扫描 NVM 管理的 Node 环境 (Unix)
    #[cfg(not(target_os = "windows"))]
    fn scan_nvm() -> Vec<NodeEnvironment> {
        let mut envs = Vec::new();

        let home = match std::env::var("HOME") {
            Ok(h) => h,
            Err(_) => return envs,
        };

        // 检查 NVM 目录
        let nvm_dir = PathBuf::from(&home).join(".nvm/versions/node");
        if !nvm_dir.exists() {
            return envs;
        }

        // 遍历所有 Node 版本目录
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }

                let node_bin = entry.path().join("bin/node");
                if !node_bin.exists() {
                    continue;
                }

                // 获取版本
                if let Some(version) = Self::get_node_version(&node_bin) {
                    let mut env = NodeEnvironment::new(
                        version,
                        node_bin.to_string_lossy().to_string(),
                        NodeVersionManager::NVM,
                    );

                    // 检查 npm
                    let npm_bin = entry.path().join("bin/npm");
                    if npm_bin.exists() {
                        env = env.with_npm_path(npm_bin.to_string_lossy().to_string());
                    }

                    // 检查 Claude Code
                    if let Some(claude_info) = Self::detect_claude_in_dir(&entry.path().join("bin"))
                    {
                        env = env.with_claude_info(claude_info);
                    }

                    envs.push(env);
                }
            }
        }

        envs
    }

    /// 扫描 NVM-Windows 管理的 Node 环境
    #[cfg(target_os = "windows")]
    fn scan_nvm_windows() -> Vec<NodeEnvironment> {
        let mut envs = Vec::new();

        let home = match std::env::var("USERPROFILE") {
            Ok(h) => h,
            Err(_) => return envs,
        };

        // NVM-Windows 默认安装目录
        let nvm_dir = PathBuf::from(&home).join("AppData\\Roaming\\nvm");
        if !nvm_dir.exists() {
            return envs;
        }

        // 遍历所有版本目录
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                // 跳过非版本目录 (如 nvm-settings 等)
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                if !dir_name.starts_with('v') && !dir_name.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                    continue;
                }

                let node_exe = path.join("node.exe");
                if !node_exe.exists() {
                    continue;
                }

                if let Some(version) = Self::get_node_version(&node_exe) {
                    let mut env = NodeEnvironment::new(
                        version,
                        node_exe.to_string_lossy().to_string(),
                        NodeVersionManager::NVMWindows,
                    );

                    // 检查 npm
                    let npm_cmd = path.join("npm.cmd");
                    if npm_cmd.exists() {
                        env = env.with_npm_path(npm_cmd.to_string_lossy().to_string());
                    }

                    // 检查 Claude Code
                    if let Some(claude_info) = Self::detect_claude_in_dir(&path) {
                        env = env.with_claude_info(claude_info);
                    }

                    envs.push(env);
                }
            }
        }

        envs
    }

    /// 扫描 FNM 管理的 Node 环境
    fn scan_fnm() -> Vec<NodeEnvironment> {
        let mut envs = Vec::new();

        #[cfg(not(target_os = "windows"))]
        let fnm_dir = {
            let home = match std::env::var("HOME") {
                Ok(h) => h,
                Err(_) => return envs,
            };
            PathBuf::from(&home).join(".local/share/fnm/node-versions")
        };

        #[cfg(target_os = "windows")]
        let fnm_dir = {
            let appdata = match std::env::var("APPDATA") {
                Ok(a) => a,
                Err(_) => return envs,
            };
            PathBuf::from(&appdata).join("fnm\\node-versions")
        };

        if !fnm_dir.exists() {
            return envs;
        }

        if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }

                #[cfg(not(target_os = "windows"))]
                let node_bin = entry.path().join("installation/bin/node");

                #[cfg(target_os = "windows")]
                let node_bin = entry.path().join("installation\\node.exe");

                if !node_bin.exists() {
                    continue;
                }

                if let Some(version) = Self::get_node_version(&node_bin) {
                    let mut env = NodeEnvironment::new(
                        version,
                        node_bin.to_string_lossy().to_string(),
                        NodeVersionManager::FNM,
                    );

                    // 检查 npm
                    #[cfg(not(target_os = "windows"))]
                    let npm_bin = entry.path().join("installation/bin/npm");
                    #[cfg(target_os = "windows")]
                    let npm_bin = entry.path().join("installation\\npm.cmd");

                    if npm_bin.exists() {
                        env = env.with_npm_path(npm_bin.to_string_lossy().to_string());
                    }

                    // 检查 Claude Code
                    #[cfg(not(target_os = "windows"))]
                    let bin_dir = entry.path().join("installation/bin");
                    #[cfg(target_os = "windows")]
                    let bin_dir = entry.path().join("installation");

                    if let Some(claude_info) = Self::detect_claude_in_dir(&bin_dir) {
                        env = env.with_claude_info(claude_info);
                    }

                    envs.push(env);
                }
            }
        }

        envs
    }

    /// 扫描 Volta 管理的 Node 环境
    fn scan_volta() -> Vec<NodeEnvironment> {
        let mut envs = Vec::new();

        #[cfg(not(target_os = "windows"))]
        let volta_dir = {
            let home = match std::env::var("HOME") {
                Ok(h) => h,
                Err(_) => return envs,
            };
            PathBuf::from(&home).join(".volta/tools/image/node")
        };

        #[cfg(target_os = "windows")]
        let volta_dir = {
            let appdata = match std::env::var("LOCALAPPDATA") {
                Ok(a) => a,
                Err(_) => return envs,
            };
            PathBuf::from(&appdata).join("Volta\\tools\\image\\node")
        };

        if !volta_dir.exists() {
            return envs;
        }

        if let Ok(entries) = std::fs::read_dir(&volta_dir) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }

                #[cfg(not(target_os = "windows"))]
                let node_bin = entry.path().join("bin/node");

                #[cfg(target_os = "windows")]
                let node_bin = entry.path().join("node.exe");

                if !node_bin.exists() {
                    continue;
                }

                if let Some(version) = Self::get_node_version(&node_bin) {
                    let mut env = NodeEnvironment::new(
                        version,
                        node_bin.to_string_lossy().to_string(),
                        NodeVersionManager::Volta,
                    );

                    // Volta 的 npm 在同一目录
                    #[cfg(not(target_os = "windows"))]
                    let npm_bin = entry.path().join("bin/npm");
                    #[cfg(target_os = "windows")]
                    let npm_bin = entry.path().join("npm.cmd");

                    if npm_bin.exists() {
                        env = env.with_npm_path(npm_bin.to_string_lossy().to_string());
                    }

                    // Volta 全局包在不同位置,暂不检测 Claude

                    envs.push(env);
                }
            }
        }

        envs
    }

    /// 扫描 ASDF 管理的 Node 环境 (Unix only)
    #[cfg(not(target_os = "windows"))]
    fn scan_asdf() -> Vec<NodeEnvironment> {
        let mut envs = Vec::new();

        let home = match std::env::var("HOME") {
            Ok(h) => h,
            Err(_) => return envs,
        };

        let asdf_dir = PathBuf::from(&home).join(".asdf/installs/nodejs");
        if !asdf_dir.exists() {
            return envs;
        }

        if let Ok(entries) = std::fs::read_dir(&asdf_dir) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }

                let node_bin = entry.path().join("bin/node");
                if !node_bin.exists() {
                    continue;
                }

                if let Some(version) = Self::get_node_version(&node_bin) {
                    let mut env = NodeEnvironment::new(
                        version,
                        node_bin.to_string_lossy().to_string(),
                        NodeVersionManager::ASDF,
                    );

                    let npm_bin = entry.path().join("bin/npm");
                    if npm_bin.exists() {
                        env = env.with_npm_path(npm_bin.to_string_lossy().to_string());
                    }

                    // 检查 Claude Code
                    if let Some(claude_info) = Self::detect_claude_in_dir(&entry.path().join("bin"))
                    {
                        env = env.with_claude_info(claude_info);
                    }

                    envs.push(env);
                }
            }
        }

        envs
    }

    /// 扫描 N 管理的 Node 环境 (Unix only)
    #[cfg(not(target_os = "windows"))]
    fn scan_n() -> Vec<NodeEnvironment> {
        let mut envs = Vec::new();

        let home = match std::env::var("HOME") {
            Ok(h) => h,
            Err(_) => return envs,
        };

        // n 默认安装到 ~/n/n/versions/node
        let n_dir = PathBuf::from(&home).join("n/n/versions/node");
        if !n_dir.exists() {
            // 也检查 /usr/local/n/versions/node (全局安装)
            let global_n_dir = PathBuf::from("/usr/local/n/versions/node");
            if !global_n_dir.exists() {
                return envs;
            }
        }

        let dirs_to_check = vec![
            PathBuf::from(&home).join("n/n/versions/node"),
            PathBuf::from("/usr/local/n/versions/node"),
        ];

        for n_dir in dirs_to_check {
            if !n_dir.exists() {
                continue;
            }

            if let Ok(entries) = std::fs::read_dir(&n_dir) {
                for entry in entries.flatten() {
                    if !entry.path().is_dir() {
                        continue;
                    }

                    let node_bin = entry.path().join("bin/node");
                    if !node_bin.exists() {
                        continue;
                    }

                    if let Some(version) = Self::get_node_version(&node_bin) {
                        let mut env = NodeEnvironment::new(
                            version,
                            node_bin.to_string_lossy().to_string(),
                            NodeVersionManager::N,
                        );

                        let npm_bin = entry.path().join("bin/npm");
                        if npm_bin.exists() {
                            env = env.with_npm_path(npm_bin.to_string_lossy().to_string());
                        }

                        if let Some(claude_info) =
                            Self::detect_claude_in_dir(&entry.path().join("bin"))
                        {
                            env = env.with_claude_info(claude_info);
                        }

                        envs.push(env);
                    }
                }
            }
        }

        envs
    }

    /// 检测系统安装的 Node
    fn scan_system_node() -> Option<NodeEnvironment> {
        // 常见的系统 Node 路径
        #[cfg(not(target_os = "windows"))]
        let possible_paths = vec![
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/homebrew/bin/node",
            "/opt/local/bin/node",
        ];

        #[cfg(target_os = "windows")]
        let possible_paths = vec![
            "C:\\Program Files\\nodejs\\node.exe",
            "C:\\Program Files (x86)\\nodejs\\node.exe",
        ];

        for path_str in possible_paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                if let Some(version) = Self::get_node_version(&path) {
                    let mut env = NodeEnvironment::new(
                        version,
                        path_str.to_string(),
                        NodeVersionManager::System,
                    );

                    // 检查 npm
                    #[cfg(not(target_os = "windows"))]
                    let npm_path = path.parent().map(|p| p.join("npm"));
                    #[cfg(target_os = "windows")]
                    let npm_path = path.parent().map(|p| p.join("npm.cmd"));

                    if let Some(npm) = npm_path {
                        if npm.exists() {
                            env = env.with_npm_path(npm.to_string_lossy().to_string());
                        }
                    }

                    // 检查 Claude Code
                    if let Some(parent) = path.parent() {
                        if let Some(claude_info) = Self::detect_claude_in_dir(parent) {
                            env = env.with_claude_info(claude_info);
                        }
                    }

                    return Some(env);
                }
            }
        }

        // 尝试通过 which/where 查找
        #[cfg(not(target_os = "windows"))]
        let which_cmd = "which";
        #[cfg(target_os = "windows")]
        let which_cmd = "where";

        if let Ok(output) = Command::new(which_cmd).arg("node").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();

                if !path_str.is_empty() {
                    let path = PathBuf::from(&path_str);
                    if let Some(version) = Self::get_node_version(&path) {
                        let mut env = NodeEnvironment::new(
                            version,
                            path_str.clone(),
                            NodeVersionManager::System,
                        );

                        if let Some(parent) = path.parent() {
                            #[cfg(not(target_os = "windows"))]
                            let npm_path = parent.join("npm");
                            #[cfg(target_os = "windows")]
                            let npm_path = parent.join("npm.cmd");

                            if npm_path.exists() {
                                env = env.with_npm_path(npm_path.to_string_lossy().to_string());
                            }

                            if let Some(claude_info) = Self::detect_claude_in_dir(parent) {
                                env = env.with_claude_info(claude_info);
                            }
                        }

                        return Some(env);
                    }
                }
            }
        }

        None
    }

    /// 获取 Node 版本
    fn get_node_version(node_path: &Path) -> Option<String> {
        let output = Command::new(node_path).arg("--version").output().ok()?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !version.is_empty() {
                Some(version)
            } else {
                None
            }
        } else {
            None
        }
    }

    /// 检测目录中的 Claude Code
    fn detect_claude_in_dir(bin_dir: &Path) -> Option<ClaudeCodeInfo> {
        #[cfg(not(target_os = "windows"))]
        let claude_path = bin_dir.join("claude");

        #[cfg(target_os = "windows")]
        let claude_path = {
            // Windows 上尝试多个扩展名
            let extensions = ["cmd", "exe", "bat", ""];
            extensions
                .iter()
                .map(|ext| {
                    if ext.is_empty() {
                        bin_dir.join("claude")
                    } else {
                        bin_dir.join(format!("claude.{}", ext))
                    }
                })
                .find(|p| p.exists())
                .unwrap_or_else(|| bin_dir.join("claude.cmd"))
        };

        if !claude_path.exists() {
            return None;
        }

        // 获取 Claude Code 版本
        let output = Command::new(&claude_path).arg("--version").output().ok()?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !version.is_empty() {
                return Some(ClaudeCodeInfo {
                    version,
                    path: claude_path.to_string_lossy().to_string(),
                    install_method: "npm-global".to_string(),
                });
            }
        }

        None
    }

    /// 去重环境列表 (基于 node_path)
    fn deduplicate_environments(envs: Vec<NodeEnvironment>) -> Vec<NodeEnvironment> {
        use std::collections::HashSet;
        let mut seen = HashSet::new();

        envs.into_iter()
            .filter(|env| seen.insert(env.node_path.clone()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_all_environments() {
        let envs = NodeScanner::scan_all_environments();
        println!("发现 {} 个 Node 环境:", envs.len());

        for env in &envs {
            println!(
                "  - {} {} ({})",
                env.manager.display_name(),
                env.version,
                env.node_path
            );
            if let Some(claude) = &env.claude_info {
                println!("    Claude Code: {}", claude.version);
            }
        }
    }

    #[test]
    fn test_deduplicate() {
        let envs = vec![
            NodeEnvironment::new("v20.0.0".to_string(), "/path/a".to_string(), NodeVersionManager::NVM),
            NodeEnvironment::new("v20.0.0".to_string(), "/path/a".to_string(), NodeVersionManager::NVM),
            NodeEnvironment::new("v18.0.0".to_string(), "/path/b".to_string(), NodeVersionManager::FNM),
        ];

        let deduped = NodeScanner::deduplicate_environments(envs);
        assert_eq!(deduped.len(), 2);
    }
}
