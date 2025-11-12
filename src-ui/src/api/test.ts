/**
 * API 测试相关的 API 调用
 */

import { invoke } from '@tauri-apps/api/core';
import type { TestResult } from '../types/tauri';

/**
 * 测试单个 API 配置
 * @param configId API 配置 ID
 * @returns 测试结果
 */
export async function testApiConfig(configId: number): Promise<TestResult> {
  return invoke<TestResult>('test_api_config', { configId });
}

/**
 * 测试分组内所有配置
 * @param groupId 分组 ID
 * @returns 所有配置的测试结果
 */
export async function testGroupConfigs(groupId: number): Promise<TestResult[]> {
  return invoke<TestResult[]>('test_group_configs', { groupId });
}

/**
 * 获取配置的最近测试结果
 * @param configId API 配置 ID
 * @param limit 最多返回的结果数量(默认10)
 * @returns 测试结果列表
 */
export async function getTestResults(configId: number, limit?: number): Promise<TestResult[]> {
  return invoke<TestResult[]>('get_test_results', { configId, limit });
}

/**
 * 端点测试结果
 */
export interface EndpointTestResult {
  /** 端点 URL */
  url: string;
  /** 是否成功 */
  success: boolean;
  /** 延迟（毫秒） */
  latency_ms: number | null;
  /** 错误信息 */
  error: string | null;
}

/**
 * 测试多个端点的延迟
 * @param endpoints 端点 URL 列表
 * @param timeoutMs 超时时间（毫秒），默认 8000ms
 * @returns 每个端点的测试结果
 */
export async function testApiEndpoints(
  endpoints: string[],
  timeoutMs?: number
): Promise<EndpointTestResult[]> {
  return invoke<EndpointTestResult[]>('test_api_endpoints', { endpoints, timeoutMs });
}
