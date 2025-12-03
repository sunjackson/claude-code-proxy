// Claude Code 安装服务（简化版）
// 负责下载和安装 Claude Code CLI

use serde::{Deserialize, Serialize};
use tokio::process::Command as AsyncCommand;
use crate::services::env_detection::EnvironmentStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InstallMethod {
    Native,      // 使用官方脚本
    Homebrew,    // macOS: brew install
    NPM,         // npm install -g
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallOptions {
    pub method: InstallMethod,
    pub auto_configure: bool,
    pub auto_backup: bool,
    pub auto_test: bool,
    pub auto_start_proxy: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InstallStage {
    Detecting,
    Downloading,
    Installing,
    Configuring,
    Testing,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: InstallStage,
    pub progress: f32,  // 0.0 - 1.0
    pub message: String,
    pub success: bool,
}


/// 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub current: Option<String>,
    pub latest: Option<String>,
    pub update_available: bool,
    pub changelog_url: Option<String>,
}

pub struct ClaudeInstaller;

impl ClaudeInstaller {
    /// 安装 Claude Code
    pub async fn install(
        options: InstallOptions,
        progress_callback: impl Fn(InstallProgress) + Send + 'static,
    ) -> Result<(), String> {
        // 1. 检测环境
        progress_callback(InstallProgress {
            stage: InstallStage::Detecting,
            progress: 0.0,
            message: "检测系统环境...".to_string(),
            success: true,
        });

        let env = EnvironmentStatus::detect().map_err(|e| e.to_string())?;
        let (can_install, missing) = env.can_install();

        if !can_install {
            progress_callback(InstallProgress {
                stage: InstallStage::Failed,
                progress: 0.0,
                message: format!("环境检查失败: {:?}", missing),
                success: false,
            });
            return Err(format!("缺少必要依赖: {:?}", missing));
        }

        // 2. 根据安装方式执行安装
        progress_callback(InstallProgress {
            stage: InstallStage::Installing,
            progress: 0.2,
            message: "开始安装 Claude Code...".to_string(),
            success: true,
        });

        match options.method {
            InstallMethod::Homebrew => {
                Self::install_via_homebrew(&progress_callback).await?;
            }
            InstallMethod::Native => {
                Self::install_via_native_script(&progress_callback).await?;
            }
            InstallMethod::NPM => {
                Self::install_via_npm(&progress_callback).await?;
            }
        }

        // 3. 验证安装
        progress_callback(InstallProgress {
            stage: InstallStage::Testing,
            progress: 0.8,
            message: "验证安装...".to_string(),
            success: true,
        });

        if !Self::verify_installation().await {
            progress_callback(InstallProgress {
                stage: InstallStage::Failed,
                progress: 0.8,
                message: "安装验证失败".to_string(),
                success: false,
            });
            return Err("Claude Code 安装验证失败".to_string());
        }

        // 4. 运行 claude doctor
        if options.auto_test {
            progress_callback(InstallProgress {
                stage: InstallStage::Testing,
                progress: 0.9,
                message: "运行健康检查...".to_string(),
                success: true,
            });

            Self::run_doctor().await?;
        }

        // 5. 完成
        progress_callback(InstallProgress {
            stage: InstallStage::Complete,
            progress: 1.0,
            message: "Claude Code 安装完成！".to_string(),
            success: true,
        });

        Ok(())
    }

    /// 通过 Homebrew 安装 (macOS)
    async fn install_via_homebrew(
        progress_callback: &impl Fn(InstallProgress),
    ) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            progress_callback(InstallProgress {
                stage: InstallStage::Installing,
                progress: 0.3,
                message: "使用 Homebrew 安装...".to_string(),
                success: true,
            });

            let output = AsyncCommand::new("brew")
                .args(&["install", "--cask", "claude-code"])
                .output()
                .await
                .map_err(|e| format!("执行 brew 命令失败: {}", e))?;

            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Homebrew 安装失败: {}", error));
            }

            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("Homebrew 仅支持 macOS".to_string())
        }
    }

    /// 通过官方脚本安装
    async fn install_via_native_script(
        progress_callback: &impl Fn(InstallProgress),
    ) -> Result<(), String> {
        progress_callback(InstallProgress {
            stage: InstallStage::Downloading,
            progress: 0.3,
            message: "下载安装脚本...".to_string(),
            success: true,
        });

        #[cfg(target_os = "macos")]
        let install_cmd = "curl -fsSL https://claude.ai/install.sh | bash";

        #[cfg(target_os = "linux")]
        let install_cmd = "curl -fsSL https://claude.ai/install.sh | bash";

        #[cfg(target_os = "windows")]
        let install_cmd = "irm https://claude.ai/install.ps1 | iex";

        progress_callback(InstallProgress {
            stage: InstallStage::Installing,
            progress: 0.5,
            message: "执行安装...".to_string(),
            success: true,
        });

        #[cfg(not(target_os = "windows"))]
        {
            let output = AsyncCommand::new("bash")
                .arg("-c")
                .arg(install_cmd)
                .output()
                .await
                .map_err(|e| format!("执行安装脚本失败: {}", e))?;

            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr);
                return Err(format!("安装脚本执行失败: {}", error));
            }
        }

        #[cfg(target_os = "windows")]
        {
            let output = AsyncCommand::new("powershell")
                .arg("-Command")
                .arg(install_cmd)
                .output()
                .await
                .map_err(|e| format!("执行安装脚本失败: {}", e))?;

            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr);
                return Err(format!("安装脚本执行失败: {}", error));
            }
        }

        Ok(())
    }

    /// 通过 NPM 安装
    async fn install_via_npm(
        progress_callback: &impl Fn(InstallProgress),
    ) -> Result<(), String> {
        progress_callback(InstallProgress {
            stage: InstallStage::Installing,
            progress: 0.3,
            message: "使用 NPM 安装...".to_string(),
            success: true,
        });

        let output = AsyncCommand::new("npm")
            .args(&["install", "-g", "@anthropic-ai/claude-code"])
            .output()
            .await
            .map_err(|e| format!("执行 npm 命令失败: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("NPM 安装失败: {}", error));
        }

        Ok(())
    }

    /// 验证安装
    pub async fn verify_installation() -> bool {
        match AsyncCommand::new("claude")
            .arg("--version")
            .output()
            .await
        {
            Ok(output) => {
                let success = output.status.success();
                if success {
                    let version = String::from_utf8_lossy(&output.stdout);
                    log::info!("Claude Code 验证成功: {}", version.trim());
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::warn!("Claude Code 验证失败 (命令执行但返回错误): {}", stderr);
                }
                success
            }
            Err(e) => {
                log::error!("Claude Code 验证失败 (无法执行命令): {}", e);
                false
            }
        }
    }

    /// 运行 claude doctor (带超时处理)
    /// 注意: claude doctor 是交互式命令，程序化调用可能无法正常工作
    /// 这里使用 --version 作为替代来验证 claude 是否可用
    pub async fn run_doctor() -> Result<String, String> {
        use std::time::Duration;
        use tokio::time::timeout;

        // claude doctor 是交互式命令，不适合程序化调用
        // 改为执行一系列检查来模拟 doctor 功能
        let mut results: Vec<String> = Vec::new();

        // 检查 1: claude --version
        results.push("🔍 检查 Claude Code 版本...".to_string());
        match timeout(Duration::from_secs(10),
            AsyncCommand::new("claude")
                .arg("--version")
                .output()
        ).await {
            Ok(Ok(output)) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                results.push(format!("✅ Claude Code 版本: {}", version));
            }
            Ok(Ok(output)) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                results.push(format!("⚠️ 版本检查返回错误: {}", stderr.trim()));
            }
            Ok(Err(e)) => {
                results.push(format!("❌ 无法执行 claude 命令: {}", e));
            }
            Err(_) => {
                results.push("❌ 版本检查超时".to_string());
            }
        }

        // 检查 2: Node.js 版本
        results.push("\n🔍 检查 Node.js...".to_string());
        match timeout(Duration::from_secs(5),
            AsyncCommand::new("node")
                .arg("--version")
                .output()
        ).await {
            Ok(Ok(output)) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                results.push(format!("✅ Node.js 版本: {}", version));
            }
            Ok(_) => {
                results.push("⚠️ Node.js 检查失败".to_string());
            }
            Err(_) => {
                results.push("❌ Node.js 检查超时".to_string());
            }
        }

        // 检查 3: npm 版本
        results.push("\n🔍 检查 npm...".to_string());
        match timeout(Duration::from_secs(5),
            AsyncCommand::new("npm")
                .arg("--version")
                .output()
        ).await {
            Ok(Ok(output)) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                results.push(format!("✅ npm 版本: {}", version));
            }
            Ok(_) => {
                results.push("⚠️ npm 检查失败".to_string());
            }
            Err(_) => {
                results.push("❌ npm 检查超时".to_string());
            }
        }

        // 检查 4: ripgrep
        results.push("\n🔍 检查 ripgrep...".to_string());
        match timeout(Duration::from_secs(5),
            AsyncCommand::new("rg")
                .arg("--version")
                .output()
        ).await {
            Ok(Ok(output)) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout);
                let first_line = version.lines().next().unwrap_or("").trim();
                results.push(format!("✅ {}", first_line));
            }
            Ok(_) => {
                results.push("⚠️ ripgrep 未安装或无法访问".to_string());
            }
            Err(_) => {
                results.push("❌ ripgrep 检查超时".to_string());
            }
        }

        results.push("\n📋 诊断完成".to_string());
        results.push("💡 提示: 如需完整诊断，请在终端中运行 `claude doctor`".to_string());

        Ok(results.join("\n"))
    }

    /// 获取 Claude Code 版本
    pub async fn get_version() -> Result<String, String> {
        let output = AsyncCommand::new("claude")
            .arg("--version")
            .output()
            .await
            .map_err(|e| format!("获取版本失败: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err("获取版本失败".to_string())
        }
    }

    /// 卸载 Claude Code
    pub async fn uninstall(method: InstallMethod) -> Result<(), String> {
        match method {
            InstallMethod::Homebrew => {
                #[cfg(target_os = "macos")]
                {
                    let output = AsyncCommand::new("brew")
                        .args(&["uninstall", "--cask", "claude-code"])
                        .output()
                        .await
                        .map_err(|e| format!("执行卸载失败: {}", e))?;

                    if !output.status.success() {
                        let error = String::from_utf8_lossy(&output.stderr);
                        return Err(format!("卸载失败: {}", error));
                    }
                }

                #[cfg(not(target_os = "macos"))]
                {
                    return Err("Homebrew 仅支持 macOS".to_string());
                }
            }
            InstallMethod::NPM => {
                let output = AsyncCommand::new("npm")
                    .args(&["uninstall", "-g", "@anthropic-ai/claude-code"])
                    .output()
                    .await
                    .map_err(|e| format!("执行卸载失败: {}", e))?;

                if !output.status.success() {
                    let error = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("卸载失败: {}", error));
                }
            }
            InstallMethod::Native => {
                // 原生安装通常需要手动删除文件
                return Err("原生安装需要手动卸载".to_string());
            }
        }

        Ok(())
    }

    /// 检查 Claude Code 版本更新
    pub async fn check_for_updates() -> Result<VersionInfo, String> {
        // 获取本地版本
        let current = Self::get_version().await.ok();
        
        // 获取最新版本（通过 npm registry）
        let latest = Self::fetch_latest_version().await.ok();
        
        let update_available = match (&current, &latest) {
            (Some(cur), Some(lat)) => Self::compare_versions(cur, lat),
            _ => false,
        };
        
        Ok(VersionInfo {
            current,
            latest,
            update_available,
            changelog_url: Some("https://github.com/anthropics/claude-code/releases".to_string()),
        })
    }
    
    /// 从 npm registry 获取最新版本
    async fn fetch_latest_version() -> Result<String, String> {
        let output = AsyncCommand::new("npm")
            .args(&["view", "@anthropic-ai/claude-code", "version"])
            .output()
            .await
            .map_err(|e| format!("获取最新版本失败: {}", e))?;
        
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            log::info!("Claude Code 最新版本: {}", version);
            Ok(version)
        } else {
            Err("无法获取最新版本信息".to_string())
        }
    }
    
    /// 比较版本号
    fn compare_versions(current: &str, latest: &str) -> bool {
        // 移除 'v' 前缀和其他非数字字符
        let parse_version = |v: &str| -> Vec<u32> {
            v.trim_start_matches('v')
                .split('.')
                .filter_map(|s| s.parse().ok())
                .collect()
        };
        
        let current_parts = parse_version(current);
        let latest_parts = parse_version(latest);
        
        // 比较主版本号、次版本号、修订号
        for i in 0..3 {
            let cur = current_parts.get(i).copied().unwrap_or(0);
            let lat = latest_parts.get(i).copied().unwrap_or(0);
            
            if lat > cur {
                return true;
            } else if lat < cur {
                return false;
            }
        }
        
        false
    }
    
    /// 更新 Claude Code 到最新版本
    pub async fn update(
        method: InstallMethod,
        progress_callback: impl Fn(InstallProgress) + Send + 'static,
    ) -> Result<(), String> {
        log::info!("开始更新 Claude Code...");
        
        progress_callback(InstallProgress {
            stage: InstallStage::Detecting,
            progress: 0.1,
            message: "检查更新...".to_string(),
            success: true,
        });
        
        // 检查是否有更新
        let version_info = Self::check_for_updates().await?;
        
        if !version_info.update_available {
            return Err("已是最新版本".to_string());
        }
        
        progress_callback(InstallProgress {
            stage: InstallStage::Downloading,
            progress: 0.3,
            message: format!("发现新版本: {}", version_info.latest.unwrap_or_default()),
            success: true,
        });
        
        // 根据安装方式更新
        match method {
            InstallMethod::Homebrew => {
                Self::update_via_homebrew(&progress_callback).await
            }
            InstallMethod::NPM => {
                Self::update_via_npm(&progress_callback).await
            }
            InstallMethod::Native => {
                // Native 方式：重新安装
                Self::install_via_native_script(&progress_callback).await
            }
        }
    }
    
    /// 通过 Homebrew 更新
    async fn update_via_homebrew(
        progress_callback: &(impl Fn(InstallProgress) + Send),
    ) -> Result<(), String> {
        progress_callback(InstallProgress {
            stage: InstallStage::Installing,
            progress: 0.5,
            message: "通过 Homebrew 更新...".to_string(),
            success: true,
        });
        
        let output = AsyncCommand::new("brew")
            .args(&["upgrade", "claude-code"])
            .output()
            .await
            .map_err(|e| format!("Homebrew 更新失败: {}", e))?;
        
        if output.status.success() {
            progress_callback(InstallProgress {
                stage: InstallStage::Complete,
                progress: 1.0,
                message: "更新成功!".to_string(),
                success: true,
            });
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Homebrew 更新失败: {}", stderr))
        }
    }
    
    /// 通过 NPM 更新
    async fn update_via_npm(
        progress_callback: &(impl Fn(InstallProgress) + Send),
    ) -> Result<(), String> {
        progress_callback(InstallProgress {
            stage: InstallStage::Installing,
            progress: 0.5,
            message: "通过 NPM 更新...".to_string(),
            success: true,
        });
        
        let output = AsyncCommand::new("npm")
            .args(&["install", "-g", "@anthropic-ai/claude-code@latest"])
            .output()
            .await
            .map_err(|e| format!("NPM 更新失败: {}", e))?;
        
        if output.status.success() {
            progress_callback(InstallProgress {
                stage: InstallStage::Complete,
                progress: 1.0,
                message: "更新成功!".to_string(),
                success: true,
            });
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("NPM 更新失败: {}", stderr))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_verify_installation() {
        let result = ClaudeInstaller::verify_installation().await;
        println!("Claude Code 已安装: {}", result);
    }

    #[tokio::test]
    async fn test_get_version() {
        if let Ok(version) = ClaudeInstaller::get_version().await {
            println!("Claude Code 版本: {}", version);
        }
    }

    #[tokio::test]
    async fn test_run_doctor() {
        if let Ok(output) = ClaudeInstaller::run_doctor().await {
            println!("Claude Doctor 输出:\n{}", output);
        }
    }
}
