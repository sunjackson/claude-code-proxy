/**
 * 代理服务 API
 * 管理本地代理服务的启动、停止和状态查询
 */

import { invoke } from '@tauri-apps/api/core';
import type { ProxyService, SwitchLog } from '../types/tauri';

/**
 * 启动代理服务
 * @returns 代理服务状态
 */
export async function startProxyService(): Promise<ProxyService> {
  return invoke<ProxyService>('start_proxy_service');
}

/**
 * 停止代理服务
 * @returns 代理服务状态
 */
export async function stopProxyService(): Promise<ProxyService> {
  return invoke<ProxyService>('stop_proxy_service');
}

/**
 * 获取代理服务状态
 * @returns 代理服务状态
 */
export async function getProxyStatus(): Promise<ProxyService> {
  return invoke<ProxyService>('get_proxy_status');
}

/**
 * 切换到不同的配置分组
 * @param groupId 目标分组 ID
 * @returns 代理服务状态
 */
export async function switchProxyGroup(groupId: number): Promise<ProxyService> {
  return invoke<ProxyService>('switch_proxy_group', { groupId });
}

/**
 * 切换到不同的 API 配置
 * @param configId 目标配置 ID
 * @returns 代理服务状态
 */
export async function switchProxyConfig(configId: number): Promise<ProxyService> {
  return invoke<ProxyService>('switch_proxy_config', { configId });
}

/**
 * 获取切换日志
 * @param groupId 可选,按分组过滤
 * @param limit 返回数量限制,默认50
 * @param offset 偏移量,默认0
 * @returns 切换日志列表
 */
export async function getSwitchLogs(
  groupId?: number,
  limit?: number,
  offset?: number
): Promise<SwitchLog[]> {
  return invoke<SwitchLog[]>('get_switch_logs', {
    groupId: groupId ?? null,
    limit: limit ?? 50,
    offset: offset ?? 0,
  });
}

/**
 * 启用/禁用分组的自动切换功能
 * @param groupId 分组 ID
 * @param enabled 是否启用
 */
export async function toggleAutoSwitch(groupId: number, enabled: boolean): Promise<void> {
  return invoke<void>('toggle_auto_switch', { groupId, enabled });
}
