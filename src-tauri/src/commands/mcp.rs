use crate::models::mcp::{McpServerConfig, McpServerInfo, McpServerTemplate};
use crate::services::McpConfigService;
use std::collections::HashMap;

/// 列出所有 MCP 服务器
#[tauri::command]
pub async fn list_mcp_servers() -> Result<Vec<McpServerInfo>, String> {
    McpConfigService::list_servers().map_err(|e| e.to_string())
}

/// 添加 MCP 服务器
#[tauri::command]
pub async fn add_mcp_server(
    name: String,
    server_config: McpServerConfig,
) -> Result<(), String> {
    McpConfigService::add_server(name, server_config).map_err(|e| e.to_string())
}

/// 更新 MCP 服务器
#[tauri::command]
pub async fn update_mcp_server(
    name: String,
    server_config: McpServerConfig,
) -> Result<(), String> {
    McpConfigService::update_server(name, server_config).map_err(|e| e.to_string())
}

/// 删除 MCP 服务器
#[tauri::command]
pub async fn remove_mcp_server(name: String) -> Result<(), String> {
    McpConfigService::remove_server(name).map_err(|e| e.to_string())
}

/// 获取内置 MCP 服务器模板列表
#[tauri::command]
pub async fn get_mcp_templates() -> Result<Vec<McpServerTemplate>, String> {
    Ok(McpConfigService::get_builtin_templates())
}

/// 从模板添加 MCP 服务器
#[tauri::command]
pub async fn add_mcp_server_from_template(
    template_name: String,
    server_name: Option<String>,
    env_values: Option<HashMap<String, String>>,
) -> Result<(), String> {
    McpConfigService::add_server_from_template(template_name, server_name, env_values)
        .map_err(|e| e.to_string())
}

/// 测试 MCP 服务器配置
#[tauri::command]
pub async fn test_mcp_server(name: String) -> Result<String, String> {
    McpConfigService::test_server(name)
        .await
        .map_err(|e| e.to_string())
}

/// 批量导入 MCP 服务器
#[tauri::command]
pub async fn import_mcp_servers(
    servers: HashMap<String, McpServerConfig>,
) -> Result<(), String> {
    McpConfigService::import_servers(servers).map_err(|e| e.to_string())
}

/// 导出 MCP 服务器配置
#[tauri::command]
pub async fn export_mcp_servers() -> Result<HashMap<String, McpServerConfig>, String> {
    McpConfigService::export_servers().map_err(|e| e.to_string())
}
