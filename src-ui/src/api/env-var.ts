/**
 * 环境变量 API
 * 管理应用运行时的环境变量
 */

import { invoke } from '@tauri-apps/api/core';
import type { EnvironmentVariable } from '../types/tauri';

/**
 * 列出所有环境变量
 * @returns 环境变量列表
 */
export async function listEnvironmentVariables(): Promise<EnvironmentVariable[]> {
  return invoke<EnvironmentVariable[]>('list_environment_variables');
}

/**
 * 获取指定的环境变量
 * @param key 变量名
 * @returns 变量值,如果不存在则返回 null
 */
export async function getEnvironmentVariable(key: string): Promise<string | null> {
  return invoke<string | null>('get_environment_variable', { key });
}

/**
 * 设置环境变量
 * @param key 变量名
 * @param value 变量值
 */
export async function setEnvironmentVariable(key: string, value: string): Promise<void> {
  return invoke('set_environment_variable', { key, value });
}

/**
 * 删除环境变量
 * @param key 变量名
 */
export async function unsetEnvironmentVariable(key: string): Promise<void> {
  return invoke('unset_environment_variable', { key });
}

/**
 * 批量设置环境变量
 * @param variables 环境变量键值对
 */
export async function setEnvironmentVariables(variables: Record<string, string>): Promise<void> {
  return invoke('set_environment_variables', { variables });
}

/**
 * 从 API 配置应用环境变量
 * @param configId API 配置 ID
 */
export async function applyConfigToEnv(configId: number): Promise<void> {
  return invoke('apply_config_to_env', { configId });
}

/**
 * 检查 Anthropic 环境变量是否已设置
 * @returns 是否已设置所有必需的 Anthropic 环境变量
 */
export async function checkAnthropicEnv(): Promise<boolean> {
  return invoke<boolean>('check_anthropic_env');
}

/**
 * 清除 Anthropic 相关环境变量
 */
export async function clearAnthropicEnv(): Promise<void> {
  return invoke('clear_anthropic_env');
}
