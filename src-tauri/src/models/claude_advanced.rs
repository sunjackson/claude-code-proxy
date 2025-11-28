use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Claude Code Permissions 配置
/// 基于 ~/.claude/settings.json 中的 permissions 字段
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsConfig {
    /// 允许的工具列表
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allow: Vec<String>,

    /// 禁止的工具列表
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub deny: Vec<String>,
}

impl Default for PermissionsConfig {
    fn default() -> Self {
        Self {
            allow: Vec::new(),
            deny: Vec::new(),
        }
    }
}

/// Claude Code Skills 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsConfig {
    /// 技能映射
    pub skills: HashMap<String, SkillDefinition>,
}

/// 技能定义
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDefinition {
    /// 技能提示词文件路径
    pub prompt: String,

    /// 技能描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for SkillsConfig {
    fn default() -> Self {
        Self {
            skills: HashMap::new(),
        }
    }
}

/// 技能信息(用于列表展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    /// 技能名称
    pub name: String,

    /// 提示词文件路径
    pub prompt: String,

    /// 技能描述
    pub description: Option<String>,

    /// 是否启用
    pub enabled: bool,
}
