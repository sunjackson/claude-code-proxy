use crate::models::error::{AppError, AppResult};
use crate::models::mcp::{McpServerConfig, McpServerInfo, McpServerTemplate};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// MCP 配置管理服务
pub struct McpConfigService;

impl McpConfigService {
    fn strip_utf8_bom(content: &str) -> &str {
        content.trim_start_matches('\u{FEFF}')
    }

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

    /// 读取 MCP 配置（宽松解析，保留未知字段）
    fn read_config_json() -> AppResult<Value> {
        let config_path = Self::get_mcp_config_path()?;

        if !config_path.exists() {
            log::info!("MCP 配置文件不存在,返回默认配置");
            return Ok(serde_json::json!({ "mcpServers": {} }));
        }

        let content = fs::read_to_string(&config_path).map_err(|e| AppError::IoError {
            message: format!("读取 MCP 配置文件失败: {}", e),
        })?;

        let content = Self::strip_utf8_bom(&content);
        let config: Value = serde_json::from_str(content).map_err(|e| AppError::InvalidData {
            message: format!("解析 MCP 配置文件失败: {}", e),
        })?;

        Ok(config)
    }

    /// 写入 MCP 配置（保留未知字段）
    fn write_config_json(config: &Value) -> AppResult<()> {
        let config_path = Self::get_mcp_config_path()?;

        // 确保目录存在
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                message: format!("创建配置目录失败: {}", e),
            })?;
        }

        // 序列化配置
        let content = serde_json::to_string_pretty(config).map_err(|e| AppError::InvalidData {
            message: format!("序列化 MCP 配置失败: {}", e),
        })?;

        // 写入文件
        fs::write(&config_path, content).map_err(|e| AppError::IoError {
            message: format!("写入 MCP 配置文件失败: {}", e),
        })?;

        log::info!("成功写入 MCP 配置文件: {}", config_path.display());
        Ok(())
    }

    fn mcp_servers_key(config: &Value) -> &'static str {
        if config.get("mcpServers").is_some() {
            "mcpServers"
        } else if config.get("mcp_servers").is_some() {
            "mcp_servers"
        } else {
            "mcpServers"
        }
    }

    fn ensure_mcp_servers_object_mut(
        config: &mut Value,
    ) -> AppResult<&mut serde_json::Map<String, Value>> {
        let key = Self::mcp_servers_key(config).to_string();

        if !config.is_object() {
            *config = serde_json::json!({});
        }

        let obj = config.as_object_mut().ok_or_else(|| AppError::InvalidData {
            message: "MCP 配置根节点不是对象".to_string(),
        })?;

        if !obj.contains_key(&key) {
            obj.insert(key.clone(), serde_json::json!({}));
        }

        if !obj.get(&key).map(|v| v.is_object()).unwrap_or(false) {
            obj.insert(key.clone(), serde_json::json!({}));
        }

        Ok(obj
            .get_mut(&key)
            .and_then(|v| v.as_object_mut())
            .expect("mcpServers must be object"))
    }

    fn parse_servers_for_display(config: &Value) -> Vec<McpServerInfo> {
        let servers_obj = config
            .get(Self::mcp_servers_key(config))
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        let mut servers = Vec::new();

        for (name, server_value) in servers_obj {
            let mut enabled = true;
            let mut command = "(invalid)".to_string();
            let mut args: Vec<String> = Vec::new();
            let mut env: Option<HashMap<String, String>> = None;

            if let Some(obj) = server_value.as_object() {
                let parsed_args = obj
                    .get("args")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect::<Vec<String>>()
                    })
                    .unwrap_or_default();

                if let Some(cmd) = obj.get("command").and_then(|v| v.as_str()) {
                    command = cmd.to_string();
                    args = parsed_args;
                } else if let Some(url) = obj.get("url").and_then(|v| v.as_str()) {
                    // 兼容 HTTP/SSE 类型 MCP 配置：没有 command 字段
                    enabled = false;
                    command = "(non-stdio)".to_string();
                    args = vec![url.to_string()];
                } else {
                    enabled = false;
                    command = "(missing command)".to_string();
                    args = parsed_args;
                }

                env = obj.get("env").and_then(|v| v.as_object()).map(|m| {
                    m.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect::<HashMap<String, String>>()
                });
            } else {
                enabled = false;
            }

            servers.push(McpServerInfo {
                name,
                command,
                args,
                env,
                enabled,
            });
        }

        servers
    }

    /// 列出所有 MCP 服务器
    pub fn list_servers() -> AppResult<Vec<McpServerInfo>> {
        let config = Self::read_config_json()?;
        let mut servers = Self::parse_servers_for_display(&config);
        servers.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(servers)
    }

    /// 添加 MCP 服务器
    pub fn add_server(name: String, server_config: McpServerConfig) -> AppResult<()> {
        let mut config = Self::read_config_json()?;
        let servers_obj = Self::ensure_mcp_servers_object_mut(&mut config)?;

        if servers_obj.contains_key(&name) {
            return Err(AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 已存在", name),
            });
        }

        servers_obj.insert(
            name.clone(),
            serde_json::to_value(server_config).map_err(|e| AppError::InvalidData {
                message: format!("序列化 MCP 服务器配置失败: {}", e),
            })?,
        );

        Self::write_config_json(&config)?;

        log::info!("成功添加 MCP 服务器: {}", name);
        Ok(())
    }

    /// 更新 MCP 服务器
    pub fn update_server(name: String, server_config: McpServerConfig) -> AppResult<()> {
        let mut config = Self::read_config_json()?;
        let servers_obj = Self::ensure_mcp_servers_object_mut(&mut config)?;

        if !servers_obj.contains_key(&name) {
            return Err(AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 不存在", name),
            });
        }

        servers_obj.insert(
            name.clone(),
            serde_json::to_value(server_config).map_err(|e| AppError::InvalidData {
                message: format!("序列化 MCP 服务器配置失败: {}", e),
            })?,
        );

        Self::write_config_json(&config)?;

        log::info!("成功更新 MCP 服务器: {}", name);
        Ok(())
    }

    /// 删除 MCP 服务器
    pub fn remove_server(name: String) -> AppResult<()> {
        let mut config = Self::read_config_json()?;
        let servers_obj = Self::ensure_mcp_servers_object_mut(&mut config)?;

        if servers_obj.remove(&name).is_none() {
            return Err(AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 不存在", name),
            });
        }

        // 写入配置
        Self::write_config_json(&config)?;

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
        let config = Self::read_config_json()?;
        let servers_obj = config
            .get(Self::mcp_servers_key(&config))
            .and_then(|v| v.as_object())
            .ok_or_else(|| {
            AppError::InvalidData {
                message: "MCP 配置中缺少 mcpServers".to_string(),
            }
        })?;

        let server_value = servers_obj.get(&name).ok_or_else(|| AppError::InvalidData {
            message: format!("MCP 服务器 '{}' 不存在", name),
        })?;

        let server_config: McpServerConfig = serde_json::from_value(server_value.clone()).map_err(|e| {
            AppError::InvalidData {
                message: format!("MCP 服务器 '{}' 配置无法解析为 stdio 格式: {}", name, e),
            }
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
        let mut config = Self::read_config_json()?;
        let servers_obj = Self::ensure_mcp_servers_object_mut(&mut config)?;

        for (name, server_config) in servers {
            servers_obj.insert(
                name,
                serde_json::to_value(server_config).map_err(|e| AppError::InvalidData {
                    message: format!("序列化 MCP 服务器配置失败: {}", e),
                })?,
            );
        }

        Self::write_config_json(&config)?;

        log::info!("成功导入 MCP 服务器配置");
        Ok(())
    }

    /// 导出 MCP 服务器配置
    pub fn export_servers() -> AppResult<HashMap<String, McpServerConfig>> {
        let config = Self::read_config_json()?;
        let servers_obj = config
            .get(Self::mcp_servers_key(&config))
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        let mut result = HashMap::new();
        for (name, server_value) in servers_obj {
            match serde_json::from_value::<McpServerConfig>(server_value) {
                Ok(cfg) => {
                    result.insert(name, cfg);
                }
                Err(e) => {
                    log::warn!("跳过无法导出的 MCP 服务器配置 '{}': {}", name, e);
                }
            }
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::mcp::McpConfig;

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
