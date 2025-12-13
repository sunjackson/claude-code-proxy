/**
 * MCP (Model Context Protocol) 服务器配置相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { McpServerInfo, McpServerConfig, McpServerTemplate } from '../types/tauri';

/**
 * 列出所有 MCP 服务器
 */
export async function listMcpServers(): Promise<McpServerInfo[]> {
  return await invoke<McpServerInfo[]>('list_mcp_servers');
}

/**
 * 添加 MCP 服务器
 * @param name 服务器名称
 * @param serverConfig 服务器配置
 */
export async function addMcpServer(name: string, serverConfig: McpServerConfig): Promise<void> {
  return await invoke<void>('add_mcp_server', { name, serverConfig });
}

/**
 * 更新 MCP 服务器
 * @param name 服务器名称
 * @param serverConfig 服务器配置
 */
export async function updateMcpServer(name: string, serverConfig: McpServerConfig): Promise<void> {
  return await invoke<void>('update_mcp_server', { name, serverConfig });
}

/**
 * 删除 MCP 服务器
 * @param name 服务器名称
 */
export async function removeMcpServer(name: string): Promise<void> {
  return await invoke<void>('remove_mcp_server', { name });
}

/**
 * 获取内置 MCP 服务器模板列表
 */
export async function getMcpTemplates(): Promise<McpServerTemplate[]> {
  return await invoke<McpServerTemplate[]>('get_mcp_templates');
}

/**
 * 从模板添加 MCP 服务器
 * @param templateName 模板名称
 * @param serverName 服务器名称(可选,默认使用模板名称)
 * @param envValues 环境变量值
 */
export async function addMcpServerFromTemplate(
  templateName: string,
  serverName?: string,
  envValues?: Record<string, string>
): Promise<void> {
  return await invoke<void>('add_mcp_server_from_template', {
    templateName,
    serverName,
    envValues,
  });
}

/**
 * 测试 MCP 服务器配置
 * @param name 服务器名称
 * @returns 测试结果消息
 */
export async function testMcpServer(name: string): Promise<string> {
  return await invoke<string>('test_mcp_server', { name });
}

/**
 * 批量导入 MCP 服务器
 * @param servers 服务器配置映射
 */
export async function importMcpServers(servers: Record<string, McpServerConfig>): Promise<void> {
  return await invoke<void>('import_mcp_servers', { servers });
}

/**
 * 导出 MCP 服务器配置
 * @returns 服务器配置映射
 */
export async function exportMcpServers(): Promise<Record<string, McpServerConfig>> {
  return await invoke<Record<string, McpServerConfig>>('export_mcp_servers');
}
