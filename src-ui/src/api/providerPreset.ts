/**
 * 供应商预设 API
 * 从后端 Tauri 命令获取配置
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 供应商分类
 */
export type ProviderCategory = 'official' | 'cn_official' | 'third_party' | 'aggregator' | 'custom';

/**
 * 供应商预设配置
 */
export interface ProviderPreset {
  id: string;
  name: string;
  category: ProviderCategory;
  websiteUrl: string;
  apiKeyUrl?: string;
  serverUrl: string;
  balanceQueryUrl?: string;
  description?: string;
  isRecommended: boolean;
  isPartner: boolean;
  hotnessScore: number;

  // 模型配置
  defaultModel?: string;
  haikuModel?: string;
  sonnetModel?: string;
  opusModel?: string;
  smallFastModel?: string;

  // API 高级设置
  apiTimeoutMs?: number;
  maxOutputTokens?: number;

  // 备选端点
  endpointCandidates: string[];
}

/**
 * 获取所有供应商预设
 */
export async function listProviderPresets(): Promise<ProviderPreset[]> {
  return invoke<ProviderPreset[]>('list_provider_presets');
}

/**
 * 根据 ID 获取供应商预设
 */
export async function getProviderPreset(id: string): Promise<ProviderPreset> {
  return invoke<ProviderPreset>('get_provider_preset', { id });
}

/**
 * 根据分类获取供应商预设
 */
export async function getProviderPresetsByCategory(category: ProviderCategory): Promise<ProviderPreset[]> {
  return invoke<ProviderPreset[]>('get_provider_presets_by_category', { category });
}

/**
 * 获取推荐的供应商预设
 */
export async function getRecommendedProviderPresets(): Promise<ProviderPreset[]> {
  return invoke<ProviderPreset[]>('get_recommended_provider_presets');
}

/**
 * 获取所有分类
 */
export async function getProviderCategories(): Promise<ProviderCategory[]> {
  return invoke<ProviderCategory[]>('get_provider_categories');
}
