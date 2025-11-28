use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MCP 服务器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    /// 执行命令
    pub command: String,

    /// 命令参数
    pub args: Vec<String>,

    /// 环境变量
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
}

/// MCP 配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    /// MCP 服务器列表
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            mcp_servers: HashMap::new(),
        }
    }
}

/// MCP 服务器信息(用于前端展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    /// 服务器名称
    pub name: String,

    /// 执行命令
    pub command: String,

    /// 命令参数
    pub args: Vec<String>,

    /// 环境变量
    pub env: Option<HashMap<String, String>>,

    /// 是否启用
    pub enabled: bool,
}

/// MCP 服务器预设模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerTemplate {
    /// 模板名称
    pub name: String,

    /// 显示名称
    pub display_name: String,

    /// 描述
    pub description: String,

    /// 分类
    pub category: String,

    /// 服务器配置
    pub config: McpServerConfig,

    /// 需要的环境变量
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_env_vars: Option<Vec<String>>,
}

impl McpServerTemplate {
    /// 获取内置模板列表
    pub fn get_builtin_templates() -> Vec<Self> {
        vec![
            // 搜索工具
            Self {
                name: "brave-search".to_string(),
                display_name: "Brave Search".to_string(),
                description: "使用 Brave Search API 进行网络搜索".to_string(),
                category: "搜索".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@modelcontextprotocol/server-brave-search".to_string()],
                    env: Some(HashMap::from([
                        ("BRAVE_API_KEY".to_string(), "${BRAVE_API_KEY}".to_string()),
                    ])),
                },
                required_env_vars: Some(vec!["BRAVE_API_KEY".to_string()]),
            },

            // 浏览器自动化
            Self {
                name: "playwright".to_string(),
                display_name: "Playwright".to_string(),
                description: "浏览器自动化和网页测试工具".to_string(),
                category: "浏览器".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@playwright/mcp@latest".to_string()],
                    env: None,
                },
                required_env_vars: None,
            },

            // 文件系统
            Self {
                name: "filesystem".to_string(),
                display_name: "Filesystem".to_string(),
                description: "安全的文件系统访问工具".to_string(),
                category: "文件".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@modelcontextprotocol/server-filesystem".to_string()],
                    env: None,
                },
                required_env_vars: None,
            },

            // Git
            Self {
                name: "git".to_string(),
                display_name: "Git".to_string(),
                description: "Git 仓库管理工具".to_string(),
                category: "开发工具".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@modelcontextprotocol/server-git".to_string()],
                    env: None,
                },
                required_env_vars: None,
            },

            // GitHub
            Self {
                name: "github".to_string(),
                display_name: "GitHub".to_string(),
                description: "GitHub API 集成工具".to_string(),
                category: "开发工具".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@modelcontextprotocol/server-github".to_string()],
                    env: Some(HashMap::from([
                        ("GITHUB_TOKEN".to_string(), "${GITHUB_TOKEN}".to_string()),
                    ])),
                },
                required_env_vars: Some(vec!["GITHUB_TOKEN".to_string()]),
            },

            // PostgreSQL
            Self {
                name: "postgresql".to_string(),
                display_name: "PostgreSQL".to_string(),
                description: "PostgreSQL 数据库工具".to_string(),
                category: "数据库".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@modelcontextprotocol/server-postgres".to_string()],
                    env: Some(HashMap::from([
                        ("POSTGRES_CONNECTION_STRING".to_string(), "${POSTGRES_CONNECTION_STRING}".to_string()),
                    ])),
                },
                required_env_vars: Some(vec!["POSTGRES_CONNECTION_STRING".to_string()]),
            },

            // Exa 搜索
            Self {
                name: "exa".to_string(),
                display_name: "Exa Search".to_string(),
                description: "Exa AI 驱动的网络搜索".to_string(),
                category: "搜索".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "mcp-exa".to_string()],
                    env: Some(HashMap::from([
                        ("EXA_API_KEY".to_string(), "${EXA_API_KEY}".to_string()),
                    ])),
                },
                required_env_vars: Some(vec!["EXA_API_KEY".to_string()]),
            },

            // Fetch
            Self {
                name: "fetch".to_string(),
                display_name: "Fetch".to_string(),
                description: "高效的网页内容抓取工具".to_string(),
                category: "网络".to_string(),
                config: McpServerConfig {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string(), "@modelcontextprotocol/server-fetch".to_string()],
                    env: None,
                },
                required_env_vars: None,
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_config_serialization() {
        let mut servers = HashMap::new();
        servers.insert(
            "test-server".to_string(),
            McpServerConfig {
                command: "npx".to_string(),
                args: vec!["-y".to_string(), "test-package".to_string()],
                env: Some(HashMap::from([("KEY".to_string(), "value".to_string())])),
            },
        );

        let config = McpConfig {
            mcp_servers: servers,
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        assert!(json.contains("mcpServers"));
        assert!(json.contains("test-server"));
    }

    #[test]
    fn test_builtin_templates() {
        let templates = McpServerTemplate::get_builtin_templates();
        assert!(!templates.is_empty());

        // 验证有 Brave Search 模板
        let brave_template = templates.iter().find(|t| t.name == "brave-search");
        assert!(brave_template.is_some());
    }
}
