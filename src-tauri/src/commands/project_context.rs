//! 项目上下文 Tauri 命令
//!
//! 提供获取项目记忆、命令等上下文信息的 IPC 命令

use crate::models::claude_advanced::{MemoryInfo, MemoryScope, ProjectContextInfo};
use crate::services::project_context::ProjectContextService;
use std::path::PathBuf;

/// 获取项目完整上下文信息
#[tauri::command]
pub fn get_project_context(project_path: String) -> Result<ProjectContextInfo, String> {
    let path = PathBuf::from(&project_path);

    if !path.exists() {
        return Err(format!("项目路径不存在: {}", project_path));
    }

    ProjectContextService::get_project_context(path)
        .map_err(|e| e.to_string())
}

/// 列出项目记忆
#[tauri::command]
pub fn list_project_memories(project_path: Option<String>) -> Result<Vec<MemoryInfo>, String> {
    let project_root = project_path.map(PathBuf::from);

    ProjectContextService::list_memories(project_root)
        .map_err(|e| e.to_string())
}

/// 读取记忆内容
#[tauri::command]
pub fn read_memory_content(
    name: String,
    scope: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let memory_scope = match scope.to_lowercase().as_str() {
        "user" => MemoryScope::User,
        "project" => MemoryScope::Project,
        _ => return Err(format!("无效的记忆作用域: {}", scope)),
    };

    let project_root = project_path.map(PathBuf::from);

    ProjectContextService::read_memory(&name, memory_scope, project_root)
        .map_err(|e| e.to_string())
}

/// 读取项目 CLAUDE.md 内容
#[tauri::command]
pub fn read_project_claude_md(project_path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&project_path);

    if !path.exists() {
        return Err(format!("项目路径不存在: {}", project_path));
    }

    ProjectContextService::read_claude_md(path)
        .map_err(|e| e.to_string())
}

/// 保存项目 CLAUDE.md 内容
#[tauri::command]
pub fn save_project_claude_md(project_path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&project_path);

    if !path.exists() {
        return Err(format!("项目路径不存在: {}", project_path));
    }

    ProjectContextService::save_claude_md(path, content)
        .map_err(|e| e.to_string())
}

/// 保存记忆内容
#[tauri::command]
pub fn save_memory_content(
    name: String,
    scope: String,
    content: String,
    project_path: Option<String>,
) -> Result<MemoryInfo, String> {
    let memory_scope = match scope.to_lowercase().as_str() {
        "user" => MemoryScope::User,
        "project" => MemoryScope::Project,
        _ => return Err(format!("无效的记忆作用域: {}", scope)),
    };

    let project_root = project_path.map(PathBuf::from);

    ProjectContextService::save_memory(&name, memory_scope, content, project_root)
        .map_err(|e| e.to_string())
}

/// 删除记忆
#[tauri::command]
pub fn delete_memory(
    name: String,
    scope: String,
    project_path: Option<String>,
) -> Result<(), String> {
    let memory_scope = match scope.to_lowercase().as_str() {
        "user" => MemoryScope::User,
        "project" => MemoryScope::Project,
        _ => return Err(format!("无效的记忆作用域: {}", scope)),
    };

    let project_root = project_path.map(PathBuf::from);

    ProjectContextService::delete_memory(&name, memory_scope, project_root)
        .map_err(|e| e.to_string())
}
