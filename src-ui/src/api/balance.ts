/**
 * 余额查询相关的 API 调用
 */

import { invoke } from '@tauri-apps/api/core';
import type { BalanceInfo } from '../types/tauri';

/**
 * 查询单个配置的余额
 * @param configId API 配置 ID
 * @returns 余额查询结果
 */
export async function queryBalance(configId: number): Promise<BalanceInfo> {
  return invoke<BalanceInfo>('query_balance', { configId });
}

/**
 * 批量查询所有启用了自动余额查询的配置
 * @returns 所有配置的余额查询结果
 */
export async function queryAllBalances(): Promise<BalanceInfo[]> {
  return invoke<BalanceInfo[]>('query_all_balances');
}

/**
 * 获取所有配置的余额信息（从数据库读取缓存）
 * @returns 所有配置的余额信息
 */
export async function getAllBalanceInfo(): Promise<BalanceInfo[]> {
  return invoke<BalanceInfo[]>('get_all_balance_info');
}
