//! 斜杠命令 (Slash Commands) 配置管理服务
//!
//! 支持 Claude Code 新版命令管理机制:
//! - 用户级命令: ~/.claude/commands/
//! - 项目级命令: .claude/commands/

use crate::models::claude_advanced::{
    CommandScope, SlashCommand, SlashCommandInfo, SlashCommandInput, SlashCommandMeta,
};
use crate::models::error::{AppError, AppResult};
use regex::Regex;
use std::fs;
use std::path::PathBuf;

/// 斜杠命令配置管理服务
pub struct SlashCommandService;

impl SlashCommandService {
    fn strip_utf8_bom(content: &str) -> &str {
        content.trim_start_matches('\u{FEFF}')
    }

    // ============================================================
    // 路径获取
    // ============================================================

    /// 获取用户级命令目录 (~/.claude/commands/)
    fn get_user_commands_dir() -> AppResult<PathBuf> {
        let home_dir = dirs::home_dir().ok_or_else(|| AppError::IoError {
            message: "无法获取用户主目录".to_string(),
        })?;
        Ok(home_dir.join(".claude").join("commands"))
    }

    /// 获取项目级命令目录 (.claude/commands/)
    /// 需要传入项目根目录路径
    fn get_project_commands_dir(project_root: &PathBuf) -> PathBuf {
        project_root.join(".claude").join("commands")
    }

    /// 确保目录存在
    fn ensure_dir_exists(dir: &PathBuf) -> AppResult<()> {
        if !dir.exists() {
            fs::create_dir_all(dir).map_err(|e| AppError::IoError {
                message: format!("创建目录失败: {}", e),
            })?;
        }
        Ok(())
    }

    // ============================================================
    // YAML Frontmatter 解析
    // ============================================================

    /// 解析 Markdown 文件的 YAML frontmatter
    fn parse_frontmatter(content: &str) -> AppResult<(SlashCommandMeta, String)> {
        let content = Self::strip_utf8_bom(content);
        let frontmatter_re = Regex::new(r"(?s)^---\r?\n(.*?)\r?\n---\r?\n?(.*)$").unwrap();

        if let Some(captures) = frontmatter_re.captures(content) {
            let yaml_content = captures.get(1).map(|m| m.as_str()).unwrap_or("");
            let body = captures.get(2).map(|m| m.as_str()).unwrap_or("").trim().to_string();

            // 解析 YAML 字段
            let description = Self::extract_yaml_field(yaml_content, "description")
                .unwrap_or_default();
            let allowed_tools = Self::extract_yaml_list(yaml_content, "allowed-tools");
            let argument_hint = Self::extract_yaml_field(yaml_content, "argument-hint");
            let model = Self::extract_yaml_field(yaml_content, "model");

            let meta = SlashCommandMeta {
                description,
                allowed_tools,
                argument_hint,
                model,
            };

            Ok((meta, body))
        } else {
            // 没有 frontmatter，整个内容作为 body
            Ok((SlashCommandMeta::default(), content.to_string()))
        }
    }

    /// 提取 YAML 单值字段
    fn extract_yaml_field(yaml: &str, field: &str) -> Option<String> {
        let pattern = format!(r"{}:\s*(.+)", regex::escape(field));
        let re = Regex::new(&pattern).ok()?;
        re.captures(yaml)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().trim_matches('"').to_string())
    }

    /// 提取 YAML 列表字段
    fn extract_yaml_list(yaml: &str, field: &str) -> Vec<String> {
        let mut result = Vec::new();
        let lines: Vec<&str> = yaml.lines().collect();
        let mut in_list = false;

        for line in lines {
            if line.starts_with(&format!("{}:", field)) {
                in_list = true;
                // 检查是否是行内列表格式 [item1, item2]
                if let Some(inline) = line.split(':').nth(1) {
                    let inline = inline.trim();
                    if inline.starts_with('[') && inline.ends_with(']') {
                        let items = inline[1..inline.len()-1].split(',');
                        for item in items {
                            let item = item.trim().trim_matches('"').trim_matches('\'');
                            if !item.is_empty() {
                                result.push(item.to_string());
                            }
                        }
                        return result;
                    }
                }
                continue;
            }

            if in_list {
                let trimmed = line.trim();
                if trimmed.starts_with("- ") {
                    let item = trimmed[2..].trim().trim_matches('"').trim_matches('\'');
                    result.push(item.to_string());
                } else if !trimmed.is_empty() && !trimmed.starts_with('-') {
                    // 新字段开始，退出列表解析
                    break;
                }
            }
        }

        result
    }

    /// 生成 YAML frontmatter
    fn generate_frontmatter(meta: &SlashCommandMeta) -> String {
        let mut yaml = String::from("---\n");

        yaml.push_str(&format!("description: \"{}\"\n", meta.description.replace('"', "\\\"")));

        if !meta.allowed_tools.is_empty() {
            yaml.push_str("allowed-tools:\n");
            for tool in &meta.allowed_tools {
                yaml.push_str(&format!("  - {}\n", tool));
            }
        }

        if let Some(ref hint) = meta.argument_hint {
            yaml.push_str(&format!("argument-hint: \"{}\"\n", hint.replace('"', "\\\"")));
        }

        if let Some(ref model) = meta.model {
            yaml.push_str(&format!("model: {}\n", model));
        }

        yaml.push_str("---\n\n");
        yaml
    }

    // ============================================================
    // 命令操作
    // ============================================================

    /// 列出所有斜杠命令
    pub fn list_commands(project_root: Option<PathBuf>) -> AppResult<Vec<SlashCommandInfo>> {
        let mut commands = Vec::new();

        // 1. 扫描用户级命令
        if let Ok(user_dir) = Self::get_user_commands_dir() {
            if user_dir.exists() {
                commands.extend(Self::scan_commands_dir(&user_dir, CommandScope::User)?);
            }
        }

        // 2. 扫描项目级命令 (如果提供了项目路径)
        if let Some(ref root) = project_root {
            let project_dir = Self::get_project_commands_dir(root);
            if project_dir.exists() {
                commands.extend(Self::scan_commands_dir(&project_dir, CommandScope::Project)?);
            }
        }

        // 按名称排序
        commands.sort_by(|a, b| a.name.cmp(&b.name));

        log::info!("扫描到 {} 个斜杠命令", commands.len());
        Ok(commands)
    }

    /// 扫描命令目录
    fn scan_commands_dir(dir: &PathBuf, scope: CommandScope) -> AppResult<Vec<SlashCommandInfo>> {
        let mut commands = Vec::new();

        let entries = fs::read_dir(dir).map_err(|e| AppError::IoError {
            message: format!("读取命令目录失败: {}", e),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| AppError::IoError {
                message: format!("读取目录项失败: {}", e),
            })?;

            let path = entry.path();

            // 只处理 .md 文件
            if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    match Self::parse_command_file(&path, file_stem, scope) {
                        Ok(info) => commands.push(info),
                        Err(e) => {
                            log::warn!("解析命令文件 {:?} 失败: {}", path, e);
                        }
                    }
                }
            }
        }

        Ok(commands)
    }

    /// 解析命令文件
    fn parse_command_file(
        path: &PathBuf,
        name: &str,
        scope: CommandScope,
    ) -> AppResult<SlashCommandInfo> {
        let content = fs::read_to_string(path).map_err(|e| AppError::IoError {
            message: format!("读取命令文件失败: {}", e),
        })?;

        let (meta, _body) = Self::parse_frontmatter(&content)?;

        Ok(SlashCommandInfo {
            name: name.to_string(),
            full_command: format!("/{}", name),
            scope,
            description: meta.description,
            argument_hint: meta.argument_hint,
            model: meta.model,
            file_path: path.to_string_lossy().to_string(),
        })
    }

    /// 获取命令详情
    pub fn get_command(name: &str, scope: CommandScope, project_root: Option<PathBuf>) -> AppResult<SlashCommand> {
        let dir = match scope {
            CommandScope::User => Self::get_user_commands_dir()?,
            CommandScope::Project => {
                let root = project_root.ok_or_else(|| AppError::InvalidData {
                    message: "项目级命令需要提供项目根目录".to_string(),
                })?;
                Self::get_project_commands_dir(&root)
            }
        };

        let file_path = dir.join(format!("{}.md", name));

        if !file_path.exists() {
            return Err(AppError::NotFound {
                resource: "SlashCommand".to_string(),
                id: name.to_string(),
            });
        }

        let content = fs::read_to_string(&file_path).map_err(|e| AppError::IoError {
            message: format!("读取命令文件失败: {}", e),
        })?;

        let (meta, body) = Self::parse_frontmatter(&content)?;

        Ok(SlashCommand {
            name: name.to_string(),
            scope,
            file_path: file_path.to_string_lossy().to_string(),
            meta,
            body: Some(body),
        })
    }

    /// 创建新命令
    pub fn create_command(input: SlashCommandInput, project_root: Option<PathBuf>) -> AppResult<SlashCommandInfo> {
        // 验证命令名称
        Self::validate_command_name(&input.name)?;

        let dir = match input.scope {
            CommandScope::User => Self::get_user_commands_dir()?,
            CommandScope::Project => {
                let root = project_root.ok_or_else(|| AppError::InvalidData {
                    message: "项目级命令需要提供项目根目录".to_string(),
                })?;
                Self::get_project_commands_dir(&root)
            }
        };

        // 确保目录存在
        Self::ensure_dir_exists(&dir)?;

        let file_path = dir.join(format!("{}.md", input.name));

        // 检查是否已存在
        if file_path.exists() {
            return Err(AppError::InvalidData {
                message: format!("命令 '{}' 已存在", input.name),
            });
        }

        // 构建文件内容
        let meta = SlashCommandMeta {
            description: input.description.clone(),
            allowed_tools: input.allowed_tools.clone(),
            argument_hint: input.argument_hint.clone(),
            model: input.model.clone(),
        };

        let content = format!("{}{}", Self::generate_frontmatter(&meta), input.body);

        // 写入文件
        fs::write(&file_path, content).map_err(|e| AppError::IoError {
            message: format!("写入命令文件失败: {}", e),
        })?;

        log::info!("成功创建斜杠命令: /{} ({:?})", input.name, input.scope);

        Ok(SlashCommandInfo {
            name: input.name.clone(),
            full_command: format!("/{}", input.name),
            scope: input.scope,
            description: input.description,
            argument_hint: input.argument_hint,
            model: input.model,
            file_path: file_path.to_string_lossy().to_string(),
        })
    }

    /// 更新命令
    pub fn update_command(input: SlashCommandInput, project_root: Option<PathBuf>) -> AppResult<SlashCommandInfo> {
        let dir = match input.scope {
            CommandScope::User => Self::get_user_commands_dir()?,
            CommandScope::Project => {
                let root = project_root.ok_or_else(|| AppError::InvalidData {
                    message: "项目级命令需要提供项目根目录".to_string(),
                })?;
                Self::get_project_commands_dir(&root)
            }
        };

        let file_path = dir.join(format!("{}.md", input.name));

        if !file_path.exists() {
            return Err(AppError::NotFound {
                resource: "SlashCommand".to_string(),
                id: input.name.clone(),
            });
        }

        // 构建新内容
        let meta = SlashCommandMeta {
            description: input.description.clone(),
            allowed_tools: input.allowed_tools.clone(),
            argument_hint: input.argument_hint.clone(),
            model: input.model.clone(),
        };

        let content = format!("{}{}", Self::generate_frontmatter(&meta), input.body);

        // 写入文件
        fs::write(&file_path, content).map_err(|e| AppError::IoError {
            message: format!("更新命令文件失败: {}", e),
        })?;

        log::info!("成功更新斜杠命令: /{}", input.name);

        Ok(SlashCommandInfo {
            name: input.name.clone(),
            full_command: format!("/{}", input.name),
            scope: input.scope,
            description: input.description,
            argument_hint: input.argument_hint,
            model: input.model,
            file_path: file_path.to_string_lossy().to_string(),
        })
    }

    /// 删除命令
    pub fn delete_command(name: &str, scope: CommandScope, project_root: Option<PathBuf>) -> AppResult<()> {
        let dir = match scope {
            CommandScope::User => Self::get_user_commands_dir()?,
            CommandScope::Project => {
                let root = project_root.ok_or_else(|| AppError::InvalidData {
                    message: "项目级命令需要提供项目根目录".to_string(),
                })?;
                Self::get_project_commands_dir(&root)
            }
        };

        let file_path = dir.join(format!("{}.md", name));

        if !file_path.exists() {
            return Err(AppError::NotFound {
                resource: "SlashCommand".to_string(),
                id: name.to_string(),
            });
        }

        fs::remove_file(&file_path).map_err(|e| AppError::IoError {
            message: format!("删除命令文件失败: {}", e),
        })?;

        log::info!("成功删除斜杠命令: /{}", name);
        Ok(())
    }

    /// 验证命令名称
    fn validate_command_name(name: &str) -> AppResult<()> {
        // 命令名称规则：
        // - 只能包含小写字母、数字、连字符和冒号
        // - 冒号用于命名空间 (如 zcf:git-commit)
        // - 最大 64 字符
        let valid_re = Regex::new(r"^[a-z][a-z0-9:-]{0,63}$").unwrap();

        if !valid_re.is_match(name) {
            return Err(AppError::InvalidData {
                message: format!(
                    "命令名称 '{}' 格式不正确。\n\
                    规则：以小写字母开头，只能包含小写字母、数字、连字符和冒号，最大 64 字符。\n\
                    示例：my-command, zcf:git-commit",
                    name
                ),
            });
        }

        Ok(())
    }

    /// 读取命令内容 (兼容旧 API)
    pub fn read_command_body(name: &str, scope: CommandScope, project_root: Option<PathBuf>) -> AppResult<String> {
        let command = Self::get_command(name, scope, project_root)?;
        Ok(command.body.unwrap_or_default())
    }

    // ============================================================
    // 迁移工具
    // ============================================================

    /// 从旧版 skills 迁移到新版 commands
    pub fn migrate_from_skills() -> AppResult<Vec<String>> {
        let mut migrated = Vec::new();

        let home_dir = dirs::home_dir().ok_or_else(|| AppError::IoError {
            message: "无法获取用户主目录".to_string(),
        })?;

        let old_skills_dir = home_dir.join(".claude").join("skills");
        let new_commands_dir = Self::get_user_commands_dir()?;

        if !old_skills_dir.exists() {
            log::info!("旧版 skills 目录不存在，无需迁移");
            return Ok(migrated);
        }

        // 确保新目录存在
        Self::ensure_dir_exists(&new_commands_dir)?;

        // 遍历旧技能目录
        let entries = fs::read_dir(&old_skills_dir).map_err(|e| AppError::IoError {
            message: format!("读取旧技能目录失败: {}", e),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| AppError::IoError {
                message: format!("读取目录项失败: {}", e),
            })?;

            let path = entry.path();

            // 处理技能目录
            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    if let Some(skill_name) = path.file_name().and_then(|s| s.to_str()) {
                        // 读取旧文件内容
                        if let Ok(content) = fs::read_to_string(&skill_md) {
                            // 写入新位置
                            let new_path = new_commands_dir.join(format!("{}.md", skill_name));
                            if !new_path.exists() {
                                if fs::write(&new_path, &content).is_ok() {
                                    migrated.push(skill_name.to_string());
                                    log::info!("迁移技能: {} -> {}", skill_name, new_path.display());
                                }
                            }
                        }
                    }
                }
            }
        }

        log::info!("成功迁移 {} 个技能", migrated.len());
        Ok(migrated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_command_name() {
        assert!(SlashCommandService::validate_command_name("my-command").is_ok());
        assert!(SlashCommandService::validate_command_name("zcf:git-commit").is_ok());
        assert!(SlashCommandService::validate_command_name("test123").is_ok());

        assert!(SlashCommandService::validate_command_name("My-Command").is_err()); // 大写
        assert!(SlashCommandService::validate_command_name("123test").is_err()); // 数字开头
        assert!(SlashCommandService::validate_command_name("").is_err()); // 空
    }

    #[test]
    fn test_parse_frontmatter() {
        let content = r#"---
description: Test command
allowed-tools:
  - Bash
  - Read
argument-hint: "[arg1] [arg2]"
model: opus
---

# Command Body

This is the command body."#;

        let (meta, body) = SlashCommandService::parse_frontmatter(content).unwrap();

        assert_eq!(meta.description, "Test command");
        assert_eq!(meta.allowed_tools, vec!["Bash", "Read"]);
        assert_eq!(meta.argument_hint, Some("[arg1] [arg2]".to_string()));
        assert_eq!(meta.model, Some("opus".to_string()));
        assert!(body.contains("# Command Body"));
    }

    #[test]
    fn test_generate_frontmatter() {
        let meta = SlashCommandMeta {
            description: "Test description".to_string(),
            allowed_tools: vec!["Bash".to_string(), "Read".to_string()],
            argument_hint: Some("[arg]".to_string()),
            model: Some("sonnet".to_string()),
        };

        let yaml = SlashCommandService::generate_frontmatter(&meta);

        assert!(yaml.starts_with("---\n"));
        assert!(yaml.ends_with("---\n\n"));
        assert!(yaml.contains("description: \"Test description\""));
        assert!(yaml.contains("allowed-tools:"));
        assert!(yaml.contains("  - Bash"));
    }
}
