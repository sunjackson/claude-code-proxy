use crate::models::claude_advanced::{SkillDefinition, SkillInfo};
use crate::services::SkillsConfigService;
use std::collections::HashMap;

/// 列出所有技能
#[tauri::command]
pub async fn list_skills() -> Result<Vec<SkillInfo>, String> {
    SkillsConfigService::list_skills().map_err(|e| e.to_string())
}

/// 添加技能
#[tauri::command]
pub async fn add_skill(
    name: String,
    prompt_content: String,
    description: Option<String>,
) -> Result<(), String> {
    SkillsConfigService::add_skill(name, prompt_content, description).map_err(|e| e.to_string())
}

/// 更新技能
#[tauri::command]
pub async fn update_skill(
    name: String,
    prompt_content: Option<String>,
    description: Option<String>,
    enabled: Option<bool>,
) -> Result<(), String> {
    SkillsConfigService::update_skill(name, prompt_content, description, enabled)
        .map_err(|e| e.to_string())
}

/// 删除技能
#[tauri::command]
pub async fn remove_skill(name: String) -> Result<(), String> {
    SkillsConfigService::remove_skill(name).map_err(|e| e.to_string())
}

/// 读取技能提示词内容
#[tauri::command]
pub async fn read_skill_prompt(name: String) -> Result<String, String> {
    SkillsConfigService::read_skill_prompt(name).map_err(|e| e.to_string())
}

/// 批量导入技能
#[tauri::command]
pub async fn import_skills(skills: HashMap<String, SkillDefinition>) -> Result<(), String> {
    SkillsConfigService::import_skills(skills).map_err(|e| e.to_string())
}

/// 导出技能配置
#[tauri::command]
pub async fn export_skills() -> Result<HashMap<String, SkillDefinition>, String> {
    SkillsConfigService::export_skills().map_err(|e| e.to_string())
}
