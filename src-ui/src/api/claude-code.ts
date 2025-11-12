/**
 * Claude Code 集成相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { ClaudeCodePath, ConfigBackup, ProxyConfig } from '../types/tauri';

/**
 * 检测 Claude Code 配置路径
 */
export async function detectClaudeCodePath(): Promise<ClaudeCodePath> {
  return await invoke<ClaudeCodePath>('detect_claude_code_path');
}

/**
 * 列出所有配置备份
 */
export async function listClaudeCodeBackups(): Promise<ConfigBackup[]> {
  return await invoke<ConfigBackup[]>('list_claude_code_backups');
}

/**
 * 创建配置备份
 * @param reason 备份原因
 */
export async function createClaudeCodeBackup(reason: string): Promise<ConfigBackup> {
  return await invoke<ConfigBackup>('create_claude_code_backup', { reason });
}

/**
 * 恢复配置备份
 * @param backupFilename 备份文件名
 */
export async function restoreClaudeCodeBackup(backupFilename: string): Promise<void> {
  return await invoke<void>('restore_claude_code_backup', { backupFilename });
}

/**
 * 删除配置备份
 * @param backupFilename 备份文件名
 */
export async function deleteClaudeCodeBackup(backupFilename: string): Promise<void> {
  return await invoke<void>('delete_claude_code_backup', { backupFilename });
}

/**
 * 启用 Claude Code 代理
 * @param host 代理服务器地址
 * @param port 代理服务器端口
 */
export async function enableClaudeCodeProxy(host: string, port: number): Promise<void> {
  return await invoke<void>('enable_claude_code_proxy', { host, port });
}

/**
 * 禁用 Claude Code 代理
 */
export async function disableClaudeCodeProxy(): Promise<void> {
  return await invoke<void>('disable_claude_code_proxy');
}

/**
 * 获取当前代理配置
 */
export async function getClaudeCodeProxy(): Promise<ProxyConfig | null> {
  return await invoke<ProxyConfig | null>('get_claude_code_proxy');
}

/**
 * 恢复 Claude Code 配置
 * @param backupFilename 备份文件名
 */
export async function restoreClaudeCodeConfig(backupFilename: string): Promise<void> {
  return await invoke<void>('restore_claude_code_config', { backupFilename });
}

/**
 * 预览备份配置内容
 * @param backupFilename 备份文件名
 * @returns 备份的配置内容 (JSON 字符串)
 */
export async function previewClaudeCodeBackup(backupFilename: string): Promise<string> {
  return await invoke<string>('preview_claude_code_backup', { backupFilename });
}

/**
 * 清空所有配置备份
 * @returns 删除的备份数量
 */
export async function clearAllClaudeCodeBackups(): Promise<number> {
  return await invoke<number>('clear_all_claude_code_backups');
}

/**
 * 获取当前 Claude Code 配置内容
 * @returns 配置文件内容 (JSON 字符串)
 */
export async function getClaudeCodeSettings(): Promise<string> {
  return await invoke<string>('get_claude_code_settings');
}
