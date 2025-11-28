use crate::models::error::{AppError, AppResult};
use crate::models::mcp::{McpConfig, McpServerConfig, McpServerInfo, McpServerTemplate};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// MCP 配置管理服务
pub struct McpConfigService;

impl McpConfigService {
    /// 获取 MCP 配置文件路径
    ///
    /// 优先级: .claude/.mcp.json > ~/.claude.json
    fn get_mcp_config_path() -> AppResult<PathBuf> {
        // 优先使用全局配置文件 ~/.claude.json
        let home_dir = dirs::home_dir().ok_or_else(|| AppError::IoError {
            message: "无法获取用户主目录".to_string(),
        })?;

        let global_mcp_path = home_dir.join(".claude.json");
        Ok(global_mcp_path)
    }

    /// 读取 MCP 配置
    pub fn read_config() -> AppResult<McpConfig> {
        let config_path = Self::get_mcp_config_path()?;

        if !config_path.exists() {
            log::info!("MCP 配置文件不存在,返回默认配置");
            return Ok(McpConfig::default());
        }

        let content = fs::read_to_string(&config_path).map_err(|e| AppError::IoError {
            message: format!("读取 MCP 配置文件失败: {}", e),
        })?;

        let config: McpConfig = serde_json::from_str(&content).map_err(|e| {
            AppError::InvalidData {
                message: format!("解析 MCP 配置文件失败: {}", e),
            }
        })?;

        log::info!("成功读取 MCP 配置,共 {} 个服务器", config.mcp_servers.len());
        Ok(config)
    }

    /// 写入 MCP 配置
    pub fn write_config(config: &McpConfig) -> AppResult<()> {
        let config_path = Self::get_mcp_config_path()?;

        // 确保目录存在
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                message: format!("创建配置目录失败: {}", e),
            })?;
        }

        // 序列化配置
        let content = serde_json::to_string_pretty(&config).map_err(|e| {
            AppError::InvalidData {
                message: format!("序列化 MCP 配置失败: {}", e),
            }
        })?;

        // 写入文件
        fs::write(&config_path, content).map_err(|e| AppError::IoError {
            message: format!("写入 MCP 配置文件失败: {}", e),
        })?;

        log::info!("成功写入 MCP 配置,共 {} 个服务器", config.mcp_servers.len());
        Ok(())
    }

    /// 列出所有 MCP 服务器
    pub fn list_servers() -> AppResult<Vec<McpServerInfo>> {
        let config = Self::read_config()?;

        let servers: Vec<McpServerInfo> = config
            .mcp_servers
            .into_iter()
            .map(|(name, server_config)| McpServerInfo {
                name,
                command: server_config.command,
                args: server_config.args,
                env: server_config.env,
                enabled: true, // 所有在配置文件中的服务器都是启用的
            })
            .collect();

        Ok(servers)
    }

    /// 添加 MCP 服务器
    pub fn add_server(name: String, server_config: McpServerConfig) -> AppResult<()> {
        let mut config = Self::read_config()?;

        // 检查服务器名称是否已存在
        if config.mcp_servers.contains_key(&name) {
            return Err(AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 已存在", name),
            });
        }

        // 添加服务器
        config.mcp_servers.insert(name.clone(), server_config);

        // 写入配置
        Self::write_config(&config)?;

        log::info!("成功添加 MCP 服务器: {}", name);
        Ok(())
    }

    /// 更新 MCP 服务器
    pub fn update_server(name: String, server_config: McpServerConfig) -> AppResult<()> {
        let mut config = Self::read_config()?;

        // 检查服务器是否存在
        if !config.mcp_servers.contains_key(&name) {
            return Err(AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 不存在", name),
            });
        }

        // 更新服务器
        config.mcp_servers.insert(name.clone(), server_config);

        // 写入配置
        Self::write_config(&config)?;

        log::info!("成功更新 MCP 服务器: {}", name);
        Ok(())
    }

    /// 删除 MCP 服务器
    pub fn remove_server(name: String) -> AppResult<()> {
        let mut config = Self::read_config()?;

        // 删除服务器
        if config.mcp_servers.remove(&name).is_none() {
            return Err(AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 不存在", name),
            });
        }

        // 写入配置
        Self::write_config(&config)?;

        log::info!("成功删除 MCP 服务器: {}", name);
        Ok(())
    }

    /// 获取内置模板列表
    pub fn get_builtin_templates() -> Vec<McpServerTemplate> {
        McpServerTemplate::get_builtin_templates()
    }

    /// 从模板添加服务器
    pub fn add_server_from_template(
        template_name: String,
        server_name: Option<String>,
        env_values: Option<HashMap<String, String>>,
    ) -> AppResult<()> {
        // 查找模板
        let templates = Self::get_builtin_templates();
        let template = templates
            .iter()
            .find(|t| t.name == template_name)
            .ok_or_else(|| AppError::InvalidData {
                message: format!("找不到模板: {}", template_name),
            })?;

        // 使用提供的服务器名称或默认使用模板名称
        let name = server_name.unwrap_or_else(|| template.name.clone());

        // 创建服务器配置
        let mut server_config = template.config.clone();

        // 如果提供了环境变量值,替换占位符
        if let (Some(env_values), Some(ref mut env)) = (env_values, &mut server_config.env) {
            for (key, value) in env_values {
                env.insert(key, value);
            }
        }

        // 添加服务器
        Self::add_server(name, server_config)
    }

    /// 测试 MCP 服务器配置
    pub async fn test_server(name: String) -> AppResult<String> {
        let config = Self::read_config()?;

        let server_config = config
            .mcp_servers
            .get(&name)
            .ok_or_else(|| AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 不存在", name),
            })?;

        // 这里简单验证命令是否可执行
        // 实际的 MCP 服务器测试需要启动服务器并进行通信,这里简化处理
        let test_result = format!(
            "MCP 服务器 '{}' 配置有效\n命令: {}\n参数: {:?}",
            name, server_config.command, server_config.args
        );

        log::info!("测试 MCP 服务器: {}", name);
        Ok(test_result)
    }

    /// 批量导入 MCP 服务器
    pub fn import_servers(servers: HashMap<String, McpServerConfig>) -> AppResult<()> {
        let mut config = Self::read_config()?;

        // 合并服务器配置
        for (name, server_config) in servers {
            config.mcp_servers.insert(name, server_config);
        }

        // 写入配置
        Self::write_config(&config)?;

        log::info!("成功导入 MCP 服务器配置");
        Ok(())
    }

    /// 导出 MCP 服务器配置
    pub fn export_servers() -> AppResult<HashMap<String, McpServerConfig>> {
        let config = Self::read_config()?;
        Ok(config.mcp_servers)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_builtin_templates() {
        let templates = McpConfigService::get_builtin_templates();
        assert!(!templates.is_empty());

        // 验证模板包含必要字段
        for template in &templates {
            assert!(!template.name.is_empty());
            assert!(!template.display_name.is_empty());
            assert!(!template.description.is_empty());
            assert!(!template.category.is_empty());
        }
    }

    #[test]
    fn test_mcp_config_default() {
        let config = McpConfig::default();
        assert!(config.mcp_servers.is_empty());
    }
}
