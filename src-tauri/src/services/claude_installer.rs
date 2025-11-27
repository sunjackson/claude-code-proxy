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
        AsyncCommand::new("claude")
            .arg("--version")
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// 运行 claude doctor
    pub async fn run_doctor() -> Result<String, String> {
        let output = AsyncCommand::new("claude")
            .arg("doctor")
            .output()
            .await
            .map_err(|e| format!("执行 claude doctor 失败: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(format!("claude doctor 执行失败: {}", error))
        }
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
