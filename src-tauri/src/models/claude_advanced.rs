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

/// 技能信息(用于列表展示) - 旧格式，保持兼容
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

// ============================================================
// Claude Code 新版斜杠命令 (Slash Commands) 数据模型
// 路径: ~/.claude/commands/ (用户级) 或 .claude/commands/ (项目级)
// ============================================================

/// 命令作用域
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CommandScope {
    /// 用户级别 (~/.claude/commands/)
    User,
    /// 项目级别 (.claude/commands/)
    Project,
}

impl Default for CommandScope {
    fn default() -> Self {
        CommandScope::User
    }
}

/// 斜杠命令元数据 (YAML frontmatter)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct SlashCommandMeta {
    /// 命令描述 (必需)
    pub description: String,

    /// 允许使用的工具列表
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_tools: Vec<String>,

    /// 参数提示
    #[serde(skip_serializing_if = "Option::is_none")]
    pub argument_hint: Option<String>,

    /// 使用的模型 (sonnet, opus, haiku)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for SlashCommandMeta {
    fn default() -> Self {
        Self {
            description: String::new(),
            allowed_tools: Vec::new(),
            argument_hint: None,
            model: None,
        }
    }
}

/// 斜杠命令完整信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommand {
    /// 命令名称 (不含 / 前缀)
    pub name: String,

    /// 命令作用域
    pub scope: CommandScope,

    /// 文件路径 (相对于 commands 目录)
    pub file_path: String,

    /// 元数据
    pub meta: SlashCommandMeta,

    /// 命令主体内容 (不含 frontmatter)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

/// 创建/更新斜杠命令的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandInput {
    /// 命令名称
    pub name: String,

    /// 命令作用域
    #[serde(default)]
    pub scope: CommandScope,

    /// 命令描述
    pub description: String,

    /// 允许使用的工具列表
    #[serde(default)]
    pub allowed_tools: Vec<String>,

    /// 参数提示
    pub argument_hint: Option<String>,

    /// 使用的模型
    pub model: Option<String>,

    /// 命令主体内容
    pub body: String,
}

/// 斜杠命令列表项 (用于前端展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandInfo {
    /// 命令名称 (不含 / 前缀)
    pub name: String,

    /// 完整命令 (含 / 前缀)
    pub full_command: String,

    /// 命令作用域
    pub scope: CommandScope,

    /// 描述
    pub description: String,

    /// 参数提示
    pub argument_hint: Option<String>,

    /// 使用的模型
    pub model: Option<String>,

    /// 文件路径
    pub file_path: String,
}

// ============================================================
// Claude Code 项目记忆 (Memories) 数据模型
// 路径: ~/.claude/memories/ (用户级) 或 .claude/memories/ (项目级)
// ============================================================

/// 记忆作用域
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryScope {
    /// 用户级别 (~/.claude/memories/)
    User,
    /// 项目级别 (.claude/memories/)
    Project,
}

impl Default for MemoryScope {
    fn default() -> Self {
        MemoryScope::User
    }
}

/// 记忆信息 (用于列表展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    /// 记忆名称 (文件名，不含 .md 后缀)
    pub name: String,

    /// 记忆作用域
    pub scope: MemoryScope,

    /// 文件路径
    pub file_path: String,

    /// 内容摘要 (前100字符)
    pub summary: String,

    /// 文件大小 (字节)
    pub size: u64,

    /// 最后修改时间 (Unix 时间戳)
    pub modified_at: i64,
}

/// 记忆完整内容
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    /// 记忆名称
    pub name: String,

    /// 作用域
    pub scope: MemoryScope,

    /// 文件路径
    pub file_path: String,

    /// 完整内容
    pub content: String,

    /// 最后修改时间
    pub modified_at: i64,
}

/// 项目上下文信息 (整合项目记忆和命令)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContextInfo {
    /// 项目路径
    pub project_path: String,

    /// 是否有 CLAUDE.md 文件
    pub has_claude_md: bool,

    /// CLAUDE.md 内容摘要
    pub claude_md_summary: Option<String>,

    /// 项目级记忆列表
    pub memories: Vec<MemoryInfo>,

    /// 项目级命令列表
    pub commands: Vec<SlashCommandInfo>,

    /// 用户级记忆数量
    pub user_memory_count: usize,

    /// 用户级命令数量
    pub user_command_count: usize,
}
