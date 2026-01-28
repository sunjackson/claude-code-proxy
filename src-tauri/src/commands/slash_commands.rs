//! 斜杠命令 (Slash Commands) Tauri 命令
//!
//! 提供 Claude Code 新版斜杠命令管理的 IPC 接口

use crate::models::claude_advanced::{
    CommandScope, SlashCommand, SlashCommandInfo, SlashCommandInput,
};
use crate::services::SlashCommandService;
use std::path::PathBuf;

/// 列出所有斜杠命令
#[tauri::command]
pub async fn list_slash_commands(
    project_root: Option<String>,
) -> Result<Vec<SlashCommandInfo>, String> {
    let root = project_root.map(PathBuf::from);
    SlashCommandService::list_commands(root).map_err(|e| e.to_string())
}

/// 获取斜杠命令详情
#[tauri::command]
pub async fn get_slash_command(
    name: String,
    scope: CommandScope,
    project_root: Option<String>,
) -> Result<SlashCommand, String> {
    let root = project_root.map(PathBuf::from);
    SlashCommandService::get_command(&name, scope, root).map_err(|e| e.to_string())
}

/// 创建斜杠命令
#[tauri::command]
pub async fn create_slash_command(
    input: SlashCommandInput,
    project_root: Option<String>,
) -> Result<SlashCommandInfo, String> {
    let root = project_root.map(PathBuf::from);
    SlashCommandService::create_command(input, root).map_err(|e| e.to_string())
}

/// 更新斜杠命令
#[tauri::command]
pub async fn update_slash_command(
    input: SlashCommandInput,
    project_root: Option<String>,
) -> Result<SlashCommandInfo, String> {
    let root = project_root.map(PathBuf::from);
    SlashCommandService::update_command(input, root).map_err(|e| e.to_string())
}

/// 删除斜杠命令
#[tauri::command]
pub async fn delete_slash_command(
    name: String,
    scope: CommandScope,
    project_root: Option<String>,
) -> Result<(), String> {
    let root = project_root.map(PathBuf::from);
    SlashCommandService::delete_command(&name, scope, root).map_err(|e| e.to_string())
}

/// 读取斜杠命令内容
#[tauri::command]
pub async fn read_slash_command_body(
    name: String,
    scope: CommandScope,
    project_root: Option<String>,
) -> Result<String, String> {
    let root = project_root.map(PathBuf::from);
    SlashCommandService::read_command_body(&name, scope, root).map_err(|e| e.to_string())
}

/// 从旧版 skills 迁移到新版 commands
#[tauri::command]
pub async fn migrate_skills_to_commands() -> Result<Vec<String>, String> {
    SlashCommandService::migrate_from_skills().map_err(|e| e.to_string())
}
