//! 项目上下文服务
//!
//! 读取项目的记忆、命令等上下文信息，用于终端面板右侧显示
//!
//! 相关路径：
//! - 记忆: ~/.claude/memories/ (用户级) 或 .claude/memories/ (项目级)
//! - 命令: ~/.claude/commands/ (用户级) 或 .claude/commands/ (项目级)
//! - 项目文档: CLAUDE.md

use crate::models::claude_advanced::{
    CommandScope, MemoryInfo, MemoryScope, ProjectContextInfo, SlashCommandInfo,
};
use crate::models::error::{AppError, AppResult};
use crate::services::slash_commands::SlashCommandService;
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

/// 项目上下文服务
pub struct ProjectContextService;

impl ProjectContextService {
    // ============================================================
    // 路径获取
    // ============================================================

    /// 获取用户级记忆目录 (~/.claude/memories/)
    fn get_user_memories_dir() -> AppResult<PathBuf> {
        let home_dir = dirs::home_dir().ok_or_else(|| AppError::IoError {
            message: "无法获取用户主目录".to_string(),
        })?;
        Ok(home_dir.join(".claude").join("memories"))
    }

    /// 获取项目级记忆目录 (.claude/memories/)
    fn get_project_memories_dir(project_root: &PathBuf) -> PathBuf {
        project_root.join(".claude").join("memories")
    }

    /// 获取项目 CLAUDE.md 路径
    fn get_claude_md_path(project_root: &PathBuf) -> PathBuf {
        project_root.join("CLAUDE.md")
    }

    // ============================================================
    // 记忆操作
    // ============================================================

    /// 列出所有记忆
    pub fn list_memories(project_root: Option<PathBuf>) -> AppResult<Vec<MemoryInfo>> {
        let mut memories = Vec::new();

        // 1. 扫描用户级记忆
        if let Ok(user_dir) = Self::get_user_memories_dir() {
            if user_dir.exists() {
                memories.extend(Self::scan_memories_dir(&user_dir, MemoryScope::User)?);
            }
        }

        // 2. 扫描项目级记忆 (如果提供了项目路径)
        if let Some(ref root) = project_root {
            let project_dir = Self::get_project_memories_dir(root);
            if project_dir.exists() {
                memories.extend(Self::scan_memories_dir(&project_dir, MemoryScope::Project)?);
            }
        }

        // 按修改时间倒序排序
        memories.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

        log::info!("扫描到 {} 个记忆", memories.len());
        Ok(memories)
    }

    /// 扫描记忆目录
    fn scan_memories_dir(dir: &PathBuf, scope: MemoryScope) -> AppResult<Vec<MemoryInfo>> {
        let mut memories = Vec::new();

        let entries = fs::read_dir(dir).map_err(|e| AppError::IoError {
            message: format!("读取记忆目录失败: {}", e),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| AppError::IoError {
                message: format!("读取目录项失败: {}", e),
            })?;

            let path = entry.path();

            // 只处理 .md 文件
            if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    match Self::parse_memory_file(&path, file_stem, scope) {
                        Ok(info) => memories.push(info),
                        Err(e) => {
                            log::warn!("解析记忆文件 {:?} 失败: {}", path, e);
                        }
                    }
                }
            }
        }

        Ok(memories)
    }

    /// 解析记忆文件
    fn parse_memory_file(
        path: &PathBuf,
        name: &str,
        scope: MemoryScope,
    ) -> AppResult<MemoryInfo> {
        let metadata = fs::metadata(path).map_err(|e| AppError::IoError {
            message: format!("获取文件元数据失败: {}", e),
        })?;

        let content = fs::read_to_string(path).map_err(|e| AppError::IoError {
            message: format!("读取记忆文件失败: {}", e),
        })?;

        // 提取摘要 (前100字符)
        let summary = content.chars().take(100).collect::<String>().trim().to_string();

        // 获取修改时间
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        Ok(MemoryInfo {
            name: name.to_string(),
            scope,
            file_path: path.to_string_lossy().to_string(),
            summary,
            size: metadata.len(),
            modified_at,
        })
    }

    // ============================================================
    // 项目上下文整合
    // ============================================================

    /// 获取项目完整上下文信息
    pub fn get_project_context(project_root: PathBuf) -> AppResult<ProjectContextInfo> {
        // 1. 检查 CLAUDE.md
        let claude_md_path = Self::get_claude_md_path(&project_root);
        let has_claude_md = claude_md_path.exists();
        let claude_md_summary = if has_claude_md {
            fs::read_to_string(&claude_md_path)
                .ok()
                .map(|content| content.chars().take(200).collect::<String>().trim().to_string())
        } else {
            None
        };

        // 2. 获取项目级记忆
        let project_memories_dir = Self::get_project_memories_dir(&project_root);
        let project_memories = if project_memories_dir.exists() {
            Self::scan_memories_dir(&project_memories_dir, MemoryScope::Project)?
        } else {
            Vec::new()
        };

        // 3. 获取项目级命令
        let project_commands_dir = project_root.join(".claude").join("commands");
        let project_commands = if project_commands_dir.exists() {
            SlashCommandService::list_commands(Some(project_root.clone()))?
                .into_iter()
                .filter(|c| c.scope == CommandScope::Project)
                .collect()
        } else {
            Vec::new()
        };

        // 4. 获取用户级记忆数量
        let user_memory_count = if let Ok(user_dir) = Self::get_user_memories_dir() {
            if user_dir.exists() {
                Self::scan_memories_dir(&user_dir, MemoryScope::User)
                    .map(|v| v.len())
                    .unwrap_or(0)
            } else {
                0
            }
        } else {
            0
        };

        // 5. 获取用户级命令数量
        let user_command_count = SlashCommandService::list_commands(None)?
            .into_iter()
            .filter(|c| c.scope == CommandScope::User)
            .count();

        Ok(ProjectContextInfo {
            project_path: project_root.to_string_lossy().to_string(),
            has_claude_md,
            claude_md_summary,
            memories: project_memories,
            commands: project_commands,
            user_memory_count,
            user_command_count,
        })
    }

    /// 读取 CLAUDE.md 内容
    pub fn read_claude_md(project_root: PathBuf) -> AppResult<Option<String>> {
        let path = Self::get_claude_md_path(&project_root);
        if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| AppError::IoError {
                message: format!("读取 CLAUDE.md 失败: {}", e),
            })?;
            Ok(Some(content))
        } else {
            Ok(None)
        }
    }

    /// 保存 CLAUDE.md 内容
    pub fn save_claude_md(project_root: PathBuf, content: String) -> AppResult<()> {
        let path = Self::get_claude_md_path(&project_root);
        fs::write(&path, content).map_err(|e| AppError::IoError {
            message: format!("保存 CLAUDE.md 失败: {}", e),
        })?;
        log::info!("保存 CLAUDE.md: {:?}", path);
        Ok(())
    }

    /// 读取记忆内容
    pub fn read_memory(name: &str, scope: MemoryScope, project_root: Option<PathBuf>) -> AppResult<String> {
        let dir = match scope {
            MemoryScope::User => Self::get_user_memories_dir()?,
            MemoryScope::Project => {
                let root = project_root.ok_or_else(|| AppError::InvalidData {
                    message: "项目级记忆需要提供项目根目录".to_string(),
                })?;
                Self::get_project_memories_dir(&root)
            }
        };

        let file_path = dir.join(format!("{}.md", name));

        if !file_path.exists() {
            return Err(AppError::NotFound {
                resource: "Memory".to_string(),
                id: name.to_string(),
            });
        }

        fs::read_to_string(&file_path).map_err(|e| AppError::IoError {
            message: format!("读取记忆文件失败: {}", e),
        })
    }

    /// 保存记忆内容
    pub fn save_memory(name: &str, scope: MemoryScope, content: String, project_root: Option<PathBuf>) -> AppResult<MemoryInfo> {
        let dir = match scope {
            MemoryScope::User => Self::get_user_memories_dir()?,
            MemoryScope::Project => {
                let root = project_root.clone().ok_or_else(|| AppError::InvalidData {
                    message: "项目级记忆需要提供项目根目录".to_string(),
                })?;
                Self::get_project_memories_dir(&root)
            }
        };

        // 确保目录存在
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| AppError::IoError {
                message: format!("创建记忆目录失败: {}", e),
            })?;
        }

        let file_path = dir.join(format!("{}.md", name));

        fs::write(&file_path, &content).map_err(|e| AppError::IoError {
            message: format!("保存记忆文件失败: {}", e),
        })?;

        log::info!("保存记忆: {:?}", file_path);

        // 返回更新后的记忆信息
        Self::parse_memory_file(&file_path, name, scope)
    }

    /// 删除记忆
    pub fn delete_memory(name: &str, scope: MemoryScope, project_root: Option<PathBuf>) -> AppResult<()> {
        let dir = match scope {
            MemoryScope::User => Self::get_user_memories_dir()?,
            MemoryScope::Project => {
                let root = project_root.ok_or_else(|| AppError::InvalidData {
                    message: "项目级记忆需要提供项目根目录".to_string(),
                })?;
                Self::get_project_memories_dir(&root)
            }
        };

        let file_path = dir.join(format!("{}.md", name));

        if !file_path.exists() {
            return Err(AppError::NotFound {
                resource: "Memory".to_string(),
                id: name.to_string(),
            });
        }

        fs::remove_file(&file_path).map_err(|e| AppError::IoError {
            message: format!("删除记忆文件失败: {}", e),
        })?;

        log::info!("删除记忆: {:?}", file_path);
        Ok(())
    }
}
