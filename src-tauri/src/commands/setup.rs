// 环境设置和 Claude Code 安装相关的 Tauri Commands

use crate::db::DbPool;
use crate::models::node_environment::EnhancedEnvironmentStatus;
use crate::services::{ClaudeInstaller, EnhancedEnvironmentDetector, EnvironmentStatus, InstallOptions, InstallProgress};
use std::sync::Arc;
use tauri::{Emitter, State, Window};
use rusqlite::params;

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

// ============================================
// 增强的环境检测命令
// ============================================

/// 增强的环境检测 - 支持多 Node 环境
#[tauri::command]
pub async fn detect_environment_enhanced(
    pool: State<'_, Arc<DbPool>>,
) -> Result<EnhancedEnvironmentStatus, String> {
    // 从数据库读取用户配置的默认环境 ID
    let default_env_id = pool
        .with_connection(|conn| {
            Ok(conn
                .query_row(
                    "SELECT environment_id FROM NodeEnvironmentConfig WHERE is_default = 1 LIMIT 1",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .ok())
        })
        .ok()
        .flatten();

    EnhancedEnvironmentDetector::detect(default_env_id).map_err(|e| e.to_string())
}

/// 设置默认 Node 环境
#[tauri::command]
pub async fn set_default_node_environment(
    pool: State<'_, Arc<DbPool>>,
    env_id: String,
    node_path: String,
    node_version: String,
    manager_type: String,
) -> Result<(), String> {
    pool.with_connection(|conn| {
        // 开启事务
        conn.execute("BEGIN TRANSACTION", [])
            .map_err(|e| format!("开始事务失败: {}", e))?;

        // 1. 清除所有环境的默认标记
        conn.execute("UPDATE NodeEnvironmentConfig SET is_default = 0", [])
            .map_err(|e| format!("清除默认标记失败: {}", e))?;

        // 2. 插入或更新选中的环境
        conn.execute(
            "INSERT INTO NodeEnvironmentConfig
                (environment_id, node_path, node_version, manager_type, is_default)
             VALUES (?1, ?2, ?3, ?4, 1)
             ON CONFLICT(environment_id) DO UPDATE SET
                node_path = excluded.node_path,
                node_version = excluded.node_version,
                manager_type = excluded.manager_type,
                is_default = 1,
                updated_at = datetime('now')",
            params![env_id, node_path, node_version, manager_type],
        )
        .map_err(|e| format!("设置默认环境失败: {}", e))?;

        // 提交事务
        conn.execute("COMMIT", [])
            .map_err(|e| format!("提交事务失败: {}", e))?;

        log::info!("已设置默认 Node 环境: {} ({})", env_id, node_path);
        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// 获取默认 Node 环境信息
#[tauri::command]
pub async fn get_default_node_environment(
    pool: State<'_, Arc<DbPool>>,
) -> Result<Option<NodeEnvironmentConfig>, String> {
    pool.with_connection(|conn| {
        Ok(conn
            .query_row(
                "SELECT environment_id, node_path, node_version, manager_type, claude_path, claude_version
             FROM NodeEnvironmentConfig WHERE is_default = 1 LIMIT 1",
                [],
                |row| {
                    Ok(NodeEnvironmentConfig {
                        environment_id: row.get(0)?,
                        node_path: row.get(1)?,
                        node_version: row.get(2)?,
                        manager_type: row.get(3)?,
                        claude_path: row.get(4).ok(),
                        claude_version: row.get(5).ok(),
                    })
                },
            )
            .ok())
    })
    .map_err(|e| e.to_string())
}

/// Node 环境配置（数据库记录）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NodeEnvironmentConfig {
    pub environment_id: String,
    pub node_path: String,
    pub node_version: String,
    pub manager_type: String,
    pub claude_path: Option<String>,
    pub claude_version: Option<String>,
}

/// 检查增强版是否可以安装
#[tauri::command]
pub async fn check_can_install_enhanced(
    pool: State<'_, Arc<DbPool>>,
) -> Result<(bool, Vec<String>), String> {
    let default_env_id = pool
        .with_connection(|conn| {
            Ok(conn
                .query_row(
                    "SELECT environment_id FROM NodeEnvironmentConfig WHERE is_default = 1 LIMIT 1",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .ok())
        })
        .ok()
        .flatten();

    let env = EnhancedEnvironmentDetector::detect(default_env_id).map_err(|e| e.to_string())?;
    Ok(env.can_install_claude())
}
