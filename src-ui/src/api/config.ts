/**
 * 配置管理 API 包装器
 * 封装与后端 Tauri 命令的交互
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ConfigGroup,
  ApiConfig,
  CreateApiConfigInput,
  UpdateApiConfigInput,
} from '../types/tauri';

// ==================== 配置分组 API ====================

/**
 * 创建配置分组
 */
export async function createConfigGroup(
  name: string,
  description: string | null,
  autoSwitchEnabled: boolean,
  latencyThresholdMs: number,
  healthCheckEnabled?: boolean,
  healthCheckIntervalSec?: number
): Promise<ConfigGroup> {
  return await invoke('create_config_group', {
    name,
    description,
    autoSwitchEnabled,
    latencyThresholdMs,
    healthCheckEnabled,
    healthCheckIntervalSec,
  });
}

/**
 * 列出所有配置分组
 */
export async function listConfigGroups(): Promise<ConfigGroup[]> {
  return await invoke('list_config_groups');
}

/**
 * 获取配置分组详情
 */
export async function getConfigGroup(id: number): Promise<ConfigGroup> {
  return await invoke('get_config_group', { id });
}

/**
 * 更新配置分组
 */
export async function updateConfigGroup(
  id: number,
  name: string,
  description: string | null,
  autoSwitchEnabled: boolean,
  latencyThresholdMs: number,
  healthCheckEnabled?: boolean,
  healthCheckIntervalSec?: number
): Promise<ConfigGroup> {
  return await invoke('update_config_group', {
    id,
    name,
    description,
    autoSwitchEnabled,
    latencyThresholdMs,
    healthCheckEnabled,
    healthCheckIntervalSec,
  });
}

/**
 * 删除配置分组
 * @param id 分组ID
 * @param moveToDefault 是否将分组下的配置移到"未分组"(true: 移动, false: 删除配置)
 */
export async function deleteConfigGroup(
  id: number,
  moveToDefault: boolean
): Promise<void> {
  return await invoke('delete_config_group', { id, moveToDefault });
}

/**
 * 统计分组下的配置数量
 */
export async function countConfigsInGroup(groupId: number): Promise<number> {
  return await invoke('count_configs_in_group', { groupId });
}

// ==================== API 配置 API ====================

/**
 * 创建 API 配置
 */
export async function createApiConfig(
  input: CreateApiConfigInput
): Promise<ApiConfig> {
  return await invoke('create_api_config', { input });
}

/**
 * 列出所有 API 配置
 * @param groupId 可选的分组ID筛选
 */
export async function listApiConfigs(
  groupId?: number | null
): Promise<ApiConfig[]> {
  return await invoke('list_api_configs', { groupId: groupId || null });
}

/**
 * 获取 API 配置详情
 */
export async function getApiConfig(id: number): Promise<ApiConfig> {
  return await invoke('get_api_config', { id });
}

/**
 * 更新 API 配置
 */
export async function updateApiConfig(
  input: UpdateApiConfigInput
): Promise<ApiConfig> {
  return await invoke('update_api_config', { input });
}

/**
 * 删除 API 配置
 */
export async function deleteApiConfig(id: number): Promise<void> {
  return await invoke('delete_api_config', { id });
}

/**
 * 重新排序 API 配置
 */
export async function reorderApiConfig(
  configId: number,
  newSortOrder: number
): Promise<void> {
  return await invoke('reorder_api_config', { configId, newSortOrder });
}

/**
 * 获取 API 密钥(明文)
 *
 * ⚠️ 安全提示: 此函数返回明文 API 密钥,请谨慎使用
 */
export async function getApiKey(configId: number): Promise<string> {
  return await invoke('get_api_key', { configId });
}

/**
 * 设置配置的启用/停用状态
 *
 * @param configId 配置ID
 * @param enabled 是否启用
 * @returns 更新后的配置
 *
 * 注意：如果停用的是当前激活的配置，会自动切换到下一个可用配置
 */
export async function setConfigEnabled(
  configId: number,
  enabled: boolean
): Promise<ApiConfig> {
  return await invoke('set_config_enabled', { configId, enabled });
}

/**
 * 测试 API 配置连接性
 * @returns [延迟毫秒, 是否可用]
 */
export async function testApiConfig(
  configId: number
): Promise<[number, boolean]> {
  return await invoke('test_api_config', { configId });
}
