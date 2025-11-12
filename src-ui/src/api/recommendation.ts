/**
 * 推荐服务 API
 * 管理推荐服务列表的加载和刷新
 */

import { invoke } from '@tauri-apps/api/core';
import type { RecommendedService } from '../types/tauri';

/**
 * 加载推荐服务列表
 * @param forceRefresh 是否强制刷新，忽略缓存
 * @returns 推荐服务列表
 */
export async function loadRecommendedServices(
  forceRefresh?: boolean
): Promise<RecommendedService[]> {
  return invoke<RecommendedService[]>('load_recommended_services', {
    forceRefresh: forceRefresh ?? false,
  });
}

/**
 * 强制刷新推荐服务列表
 * @returns 刷新后的推荐服务列表
 */
export async function refreshRecommendedServices(): Promise<RecommendedService[]> {
  return invoke<RecommendedService[]>('refresh_recommended_services');
}
