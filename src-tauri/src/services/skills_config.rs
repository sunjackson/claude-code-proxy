use crate::models::claude_advanced::{SkillDefinition, SkillInfo, SkillsConfig};
use crate::models::error::{AppError, AppResult};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use regex::Regex;

/// Skills 配置管理服务
pub struct SkillsConfigService;

impl SkillsConfigService {
    /// 获取 Skills 配置目录路径 (~/.claude/skills/)
    fn get_skills_dir() -> AppResult<PathBuf> {
        let home_dir = dirs::home_dir().ok_or_else(|| AppError::IoError {
            message: "无法获取用户主目录".to_string(),
        })?;

        let skills_dir = home_dir.join(".claude").join("skills");
        Ok(skills_dir)
    }

    /// 获取 Skills 索引文件路径 (~/.claude/skills/skills.json)
    fn get_skills_index_path() -> AppResult<PathBuf> {
        let skills_dir = Self::get_skills_dir()?;
        Ok(skills_dir.join("skills.json"))
    }

    /// 读取 Skills 配置索引
    pub fn read_skills_index() -> AppResult<SkillsConfig> {
        let index_path = Self::get_skills_index_path()?;

        if !index_path.exists() {
            log::info!("Skills 索引文件不存在,返回默认配置");
            return Ok(SkillsConfig::default());
        }

        let content = fs::read_to_string(&index_path).map_err(|e| AppError::IoError {
            message: format!("读取 Skills 索引文件失败: {}", e),
        })?;

        let config: SkillsConfig = serde_json::from_str(&content).map_err(|e| {
            AppError::InvalidData {
                message: format!("解析 Skills 索引文件失败: {}", e),
            }
        })?;

        log::info!("成功读取 Skills 配置,共 {} 个技能", config.skills.len());
        Ok(config)
    }

    /// 写入 Skills 配置索引
    pub fn write_skills_index(config: &SkillsConfig) -> AppResult<()> {
        let index_path = Self::get_skills_index_path()?;

        // 确保目录存在
        if let Some(parent) = index_path.parent() {
            fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                message: format!("创建 Skills 目录失败: {}", e),
            })?;
        }

        // 序列化配置
        let content = serde_json::to_string_pretty(&config).map_err(|e| {
            AppError::InvalidData {
                message: format!("序列化 Skills 配置失败: {}", e),
            }
        })?;

        // 写入文件
        fs::write(&index_path, content).map_err(|e| AppError::IoError {
            message: format!("写入 Skills 索引文件失败: {}", e),
        })?;

        log::info!("成功写入 Skills 配置,共 {} 个技能", config.skills.len());
        Ok(())
    }

    /// 列出所有技能
    pub fn list_skills() -> AppResult<Vec<SkillInfo>> {
        let skills_dir = Self::get_skills_dir()?;

        // 如果技能目录不存在，返回空列表
        if !skills_dir.exists() {
            log::info!("Skills 目录不存在");
            return Ok(Vec::new());
        }

        let mut skills = Vec::new();

        // 遍历技能目录，查找所有包含 SKILL.md 的子目录
        let entries = fs::read_dir(&skills_dir).map_err(|e| AppError::IoError {
            message: format!("读取 Skills 目录失败: {}", e),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| AppError::IoError {
                message: format!("读取目录项失败: {}", e),
            })?;

            let path = entry.path();

            // 跳过非目录项和隐藏目录
            if !path.is_dir() {
                continue;
            }

            let folder_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            // 跳过隐藏目录（以 . 开头）
            if folder_name.starts_with('.') {
                continue;
            }

            // 查找 SKILL.md 文件
            let skill_md_path = path.join("SKILL.md");
            if skill_md_path.exists() {
                // 读取 SKILL.md 文件
                match Self::parse_skill_file(&skill_md_path, &folder_name) {
                    Ok(skill_info) => skills.push(skill_info),
                    Err(e) => {
                        log::warn!("解析技能文件 {} 失败: {}", folder_name, e);
                    }
                }
            }
        }

        log::info!("成功扫描到 {} 个技能", skills.len());
        Ok(skills)
    }

    /// 解析技能文件，提取元数据
    fn parse_skill_file(file_path: &PathBuf, folder_name: &str) -> AppResult<SkillInfo> {
        let content = fs::read_to_string(file_path).map_err(|e| AppError::IoError {
            message: format!("读取技能文件失败: {}", e),
        })?;

        // 解析 YAML front matter
        let (name, description) = Self::parse_front_matter(&content, folder_name)?;

        Ok(SkillInfo {
            name: name.clone(),
            prompt: file_path
                .to_str()
                .unwrap_or("")
                .to_string(),
            description,
            enabled: true, // 目录中的技能默认启用
        })
    }

    /// 解析 YAML front matter
    fn parse_front_matter(
        content: &str,
        fallback_name: &str,
    ) -> AppResult<(String, Option<String>)> {
        // 匹配 YAML front matter (--- ... ---)
        let front_matter_re = Regex::new(r"(?s)^---\n(.*?)\n---").unwrap();

        if let Some(captures) = front_matter_re.captures(content) {
            let yaml_content = captures.get(1).map(|m| m.as_str()).unwrap_or("");

            // 简单解析 YAML（只提取 name 和 description）
            let name_re = Regex::new(r"name:\s*(.+)").unwrap();
            let desc_re = Regex::new(r"description:\s*(.+)").unwrap();

            let name = name_re
                .captures(yaml_content)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_else(|| fallback_name.to_string());

            let description = desc_re
                .captures(yaml_content)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().trim().to_string());

            Ok((name, description))
        } else {
            // 没有 front matter，使用文件夹名称
            Ok((fallback_name.to_string(), None))
        }
    }

    /// 添加技能
    pub fn add_skill(
        name: String,
        prompt_content: String,
        description: Option<String>,
    ) -> AppResult<()> {
        let mut config = Self::read_skills_index()?;

        // 检查技能是否已存在
        if config.skills.contains_key(&name) {
            return Err(AppError::InvalidData {
                message: format!("技能 '{}' 已存在", name),
            });
        }

        // 验证技能名称格式（仅允许小写字母、数字和连字符，最大64字符）
        if !name.chars().all(|c| c.is_lowercase() || c.is_numeric() || c == '-') || name.len() > 64 {
            return Err(AppError::InvalidData {
                message: format!(
                    "技能名称 '{}' 格式不正确。名称只能包含小写字母、数字和连字符，最大64字符",
                    name
                ),
            });
        }

        // 创建技能目录结构：~/.claude/skills/{skill-name}/
        let skills_dir = Self::get_skills_dir()?;
        let skill_dir = skills_dir.join(&name);

        // 创建技能目录
        fs::create_dir_all(&skill_dir).map_err(|e| AppError::IoError {
            message: format!("创建技能目录失败: {}", e),
        })?;

        // 创建可选的子目录
        fs::create_dir_all(skill_dir.join("scripts")).ok();
        fs::create_dir_all(skill_dir.join("references")).ok();
        fs::create_dir_all(skill_dir.join("assets")).ok();

        // 构建 SKILL.md 文件内容，包含 YAML frontmatter
        let skill_md_content = format!(
            "---\nname: {}\ndescription: {}\n---\n\n{}",
            name,
            description.as_deref().unwrap_or(""),
            prompt_content
        );

        // 创建 SKILL.md 文件
        let skill_md_path = skill_dir.join("SKILL.md");
        fs::write(&skill_md_path, skill_md_content).map_err(|e| AppError::IoError {
            message: format!("写入 SKILL.md 文件失败: {}", e),
        })?;

        // 添加技能定义（prompt 路径指向目录）
        config.skills.insert(
            name.clone(),
            SkillDefinition {
                prompt: format!("{}/SKILL.md", name),
                description,
                enabled: true,
            },
        );

        // 写入配置
        Self::write_skills_index(&config)?;

        log::info!("成功添加技能: {} (目录结构: {})", name, skill_dir.display());
        Ok(())
    }

    /// 更新技能
    pub fn update_skill(
        name: String,
        prompt_content: Option<String>,
        description: Option<String>,
        enabled: Option<bool>,
    ) -> AppResult<()> {
        let mut config = Self::read_skills_index()?;

        // 检查技能是否存在
        let skill_def = config
            .skills
            .get_mut(&name)
            .ok_or_else(|| AppError::InvalidData {
                message: format!("技能 '{}' 不存在", name),
            })?;

        // 更新提示词内容
        if let Some(content) = prompt_content {
            let skills_dir = Self::get_skills_dir()?;
            let skill_md_path = skills_dir.join(&name).join("SKILL.md");

            // 读取现有文件以保留 YAML frontmatter
            let existing_content = fs::read_to_string(&skill_md_path).ok();
            
            let updated_content = if let Some(existing) = existing_content {
                // 尝试保留现有的 frontmatter
                if existing.starts_with("---\n") {
                    if let Some(end_idx) = existing[4..].find("\n---\n") {
                        let frontmatter = &existing[0..end_idx + 8]; // 包含 "---\n...---\n"
                        format!("{}{}", frontmatter, content)
                    } else {
                        // 如果格式不正确，重新生成
                        format!(
                            "---\nname: {}\ndescription: {}\n---\n\n{}",
                            name,
                            skill_def.description.as_deref().unwrap_or(""),
                            content
                        )
                    }
                } else {
                    // 如果没有 frontmatter，添加它
                    format!(
                        "---\nname: {}\ndescription: {}\n---\n\n{}",
                        name,
                        skill_def.description.as_deref().unwrap_or(""),
                        content
                    )
                }
            } else {
                // 如果文件不存在，创建新的
                format!(
                    "---\nname: {}\ndescription: {}\n---\n\n{}",
                    name,
                    skill_def.description.as_deref().unwrap_or(""),
                    content
                )
            };

            fs::write(&skill_md_path, updated_content).map_err(|e| AppError::IoError {
                message: format!("写入 SKILL.md 文件失败: {}", e),
            })?;
        }

        // 更新描述（同时需要更新 SKILL.md 中的 frontmatter）
        if let Some(desc) = description {
            skill_def.description = Some(desc.clone());
            
            // 更新 SKILL.md 文件中的描述
            let skills_dir = Self::get_skills_dir()?;
            let skill_md_path = skills_dir.join(&name).join("SKILL.md");
            
            if let Ok(content) = fs::read_to_string(&skill_md_path) {
                let updated_content = if content.starts_with("---\n") {
                    if let Some(end_idx) = content[4..].find("\n---\n") {
                        let body = &content[end_idx + 8..];
                        format!("---\nname: {}\ndescription: {}\n---\n{}", name, desc, body)
                    } else {
                        content
                    }
                } else {
                    format!("---\nname: {}\ndescription: {}\n---\n\n{}", name, desc, content)
                };
                
                fs::write(&skill_md_path, updated_content).ok();
            }
        }

        // 更新启用状态
        if let Some(enable) = enabled {
            skill_def.enabled = enable;
        }

        // 写入配置
        Self::write_skills_index(&config)?;

        log::info!("成功更新技能: {}", name);
        Ok(())
    }

    /// 删除技能
    pub fn remove_skill(name: String) -> AppResult<()> {
        let mut config = Self::read_skills_index()?;

        // 删除技能定义
        let _skill_def = config.skills.remove(&name).ok_or_else(|| {
            AppError::InvalidData {
                message: format!("技能 '{}' 不存在", name),
            }
        })?;

        // 删除整个技能目录
        let skills_dir = Self::get_skills_dir()?;
        let skill_dir = skills_dir.join(&name);

        if skill_dir.exists() && skill_dir.is_dir() {
            fs::remove_dir_all(&skill_dir).map_err(|e| AppError::IoError {
                message: format!("删除技能目录失败: {}", e),
            })?;
            log::info!("已删除技能目录: {}", skill_dir.display());
        }

        // 写入配置
        Self::write_skills_index(&config)?;

        log::info!("成功删除技能: {}", name);
        Ok(())
    }

    /// 读取技能提示词内容
    pub fn read_skill_prompt(name: String) -> AppResult<String> {
        let skills_dir = Self::get_skills_dir()?;

        // 优先查找文件夹形式的技能
        let skill_folder_path = skills_dir.join(&name);
        let skill_md_path = skill_folder_path.join("SKILL.md");

        if skill_md_path.exists() {
            let content = fs::read_to_string(&skill_md_path).map_err(|e| AppError::IoError {
                message: format!("读取技能文件失败: {}", e),
            })?;
            return Ok(content);
        }

        // 回退到旧的索引文件方式
        let config = Self::read_skills_index()?;

        let skill_def = config
            .skills
            .get(&name)
            .ok_or_else(|| AppError::InvalidData {
                message: format!("技能 '{}' 不存在", name),
            })?;

        let prompt_path = skills_dir.join(&skill_def.prompt);

        let content = fs::read_to_string(&prompt_path).map_err(|e| AppError::IoError {
            message: format!("读取技能提示词文件失败: {}", e),
        })?;

        Ok(content)
    }

    /// 批量导入技能
    pub fn import_skills(skills: HashMap<String, SkillDefinition>) -> AppResult<()> {
        let mut config = Self::read_skills_index()?;

        // 合并技能配置
        for (name, skill_def) in skills {
            config.skills.insert(name, skill_def);
        }

        // 写入配置
        Self::write_skills_index(&config)?;

        log::info!("成功导入技能配置");
        Ok(())
    }

    /// 导出技能配置
    pub fn export_skills() -> AppResult<HashMap<String, SkillDefinition>> {
        let config = Self::read_skills_index()?;
        Ok(config.skills)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skills_config_default() {
        let config = SkillsConfig::default();
        assert!(config.skills.is_empty());
    }
}
