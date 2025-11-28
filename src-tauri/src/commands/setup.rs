// 环境设置和 Claude Code 安装相关的 Tauri Commands

use crate::db::DbPool;
use crate::services::{ClaudeInstaller, EnvironmentStatus, InstallOptions, InstallProgress};
use std::sync::Arc;
use tauri::{Emitter, State, Window};

/// 检查系统是否已完成初始配置
/// 通过检查数据库中是否有配置项来判断
#[tauri::command]
pub async fn check_system_configured(pool: State<'_, Arc<DbPool>>) -> Result<bool, String> {
    pool.with_connection(|conn| {
        // 检查是否至少有一个配置项
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ApiConfig", [], |row| row.get(0))
            .map_err(|e| format!("数据库查询失败: {}", e))?;
        Ok(count > 0)
    })
    .map_err(|e| e.to_string())
}

/// 检测系统环境
#[tauri::command]
pub async fn detect_environment() -> Result<EnvironmentStatus, String> {
    EnvironmentStatus::detect().map_err(|e| e.to_string())
}

/// 安装 Claude Code
#[tauri::command]
pub async fn install_claude_code(
    options: InstallOptions,
    window: Window,
) -> Result<(), String> {
    // 创建进度回调，通过事件发送进度
    let progress_callback = move |progress: InstallProgress| {
        let _ = window.emit("install-progress", &progress);
    };

    ClaudeInstaller::install(options, progress_callback)
        .await
        .map_err(|e| e.to_string())
}

/// 运行 claude doctor
#[tauri::command]
pub async fn run_claude_doctor() -> Result<String, String> {
    ClaudeInstaller::run_doctor()
        .await
        .map_err(|e| e.to_string())
}

/// 获取 Claude Code 版本
#[tauri::command]
pub async fn get_claude_version() -> Result<String, String> {
    ClaudeInstaller::get_version()
        .await
        .map_err(|e| e.to_string())
}

/// 验证 Claude Code 安装
#[tauri::command]
pub async fn verify_claude_installation() -> Result<bool, String> {
    Ok(ClaudeInstaller::verify_installation().await)
}

/// 卸载 Claude Code
#[tauri::command]
pub async fn uninstall_claude_code(
    method: crate::services::InstallMethod,
) -> Result<(), String> {
    ClaudeInstaller::uninstall(method)
        .await
        .map_err(|e| e.to_string())
}

/// 生成环境报告
#[tauri::command]
pub async fn generate_environment_report() -> Result<String, String> {
    let env = EnvironmentStatus::detect().map_err(|e| e.to_string())?;
    Ok(env.generate_report())
}

/// 检查是否可以安装
#[tauri::command]
pub async fn check_can_install() -> Result<(bool, Vec<String>), String> {
    let env = EnvironmentStatus::detect().map_err(|e| e.to_string())?;
    Ok(env.can_install())
}

/// 检查 Claude Code 更新
#[tauri::command]
pub async fn check_for_updates() -> Result<crate::services::VersionInfo, String> {
    ClaudeInstaller::check_for_updates()
        .await
        .map_err(|e| e.to_string())
}

/// 更新 Claude Code
#[tauri::command]
pub async fn update_claude_code(
    method: crate::services::InstallMethod,
    window: Window,
) -> Result<(), String> {
    // 创建进度回调，通过事件发送进度
    let progress_callback = move |progress: InstallProgress| {
        let _ = window.emit("install-progress", &progress);
    };

    ClaudeInstaller::update(method, progress_callback)
        .await
        .map_err(|e| e.to_string())
}
