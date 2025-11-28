/**
 * Permissions 配置相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { PermissionsConfig } from '../types/tauri';

/**
 * 获取 Permissions 配置
 */
export async function getPermissionsConfig(): Promise<PermissionsConfig> {
  return await invoke<PermissionsConfig>('get_permissions_config');
}

/**
 * 更新 Permissions 配置
 * @param config Permissions 配置
 */
export async function updatePermissionsConfig(config: PermissionsConfig): Promise<void> {
  return await invoke<void>('update_permissions_config', { config });
}

/**
 * 清除 Permissions 配置
 */
export async function clearPermissionsConfig(): Promise<void> {
  return await invoke<void>('clear_permissions_config');
}
