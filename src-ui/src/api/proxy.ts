/**
 * 代理服务 API
 * 管理本地代理服务的启动、停止和状态查询
 */

import { invoke } from '@tauri-apps/api/core';
import type { ProxyService, SwitchLog, ProxyRequestLog, HealthCheckStatusResponse } from '../types/tauri';

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

/**
 * 清空切换日志
 * @param groupId 可选,按分组过滤。如果提供，只清空该分组的日志；否则清空所有日志
 * @returns 删除的日志数量
 */
export async function clearSwitchLogs(groupId?: number): Promise<number> {
  return invoke<number>('clear_switch_logs', {
    groupId: groupId ?? null,
  });
}

/**
 * 获取指定配置的代理请求日志
 * @param configId 配置 ID
 * @param limit 返回数量限制，默认100
 * @returns 代理请求日志列表
 */
export async function getProxyRequestLogs(
  configId: number,
  limit?: number
): Promise<ProxyRequestLog[]> {
  return invoke<ProxyRequestLog[]>('get_proxy_request_logs', {
    configId,
    limit: limit ?? 100,
  });
}

/**
 * 获取所有代理请求日志（带分页）
 * @param limit 返回数量限制，默认100
 * @param offset 偏移量，默认0
 * @returns 代理请求日志列表
 */
export async function getAllProxyRequestLogs(
  limit?: number,
  offset?: number
): Promise<ProxyRequestLog[]> {
  return invoke<ProxyRequestLog[]>('get_all_proxy_request_logs', {
    limit: limit ?? 100,
    offset: offset ?? 0,
  });
}

/**
 * 清理旧的代理请求日志
 * @param keepCount 保留的日志数量，默认10000
 * @returns 删除的日志数量
 */
export async function cleanupProxyRequestLogs(keepCount?: number): Promise<number> {
  return invoke<number>('cleanup_proxy_request_logs', {
    keepCount: keepCount ?? 10000,
  });
}

/**
 * 获取代理请求日志总数
 * @returns 日志总数
 */
export async function getProxyRequestLogCount(): Promise<number> {
  return invoke<number>('get_proxy_request_log_count');
}

// ============== 健康检查 API ==============

/**
 * 启动健康检查调度器
 * @param intervalSecs 检查间隔（秒），默认60秒
 * @returns 健康检查状态
 */
export async function startHealthCheck(intervalSecs?: number): Promise<HealthCheckStatusResponse> {
  return invoke<HealthCheckStatusResponse>('start_health_check', {
    intervalSecs: intervalSecs ?? null,
  });
}

/**
 * 停止健康检查调度器
 * @returns 健康检查状态
 */
export async function stopHealthCheck(): Promise<HealthCheckStatusResponse> {
  return invoke<HealthCheckStatusResponse>('stop_health_check');
}

/**
 * 手动执行一次健康检查
 */
export async function runHealthCheckNow(): Promise<void> {
  return invoke<void>('run_health_check_now');
}
