/**
 * 应用更新相关 API
 */

import { invoke } from '@tauri-apps/api/core';

export interface AppVersionInfo {
  current_version: string;
  latest_version: string | null;
  has_update: boolean;
  release_notes: string | null;
  download_url: string | null;
  release_page_url: string | null;
  published_at: string | null;
}

/**
 * 检查应用更新
 */
export async function checkAppUpdates(): Promise<AppVersionInfo> {
  return await invoke('check_app_updates');
}

/**
 * 获取当前应用版本
 */
export async function getAppVersion(): Promise<string> {
  return await invoke('get_app_version');
}

/**
 * 下载更新包
 */
export async function downloadAppUpdate(url: string, savePath: string): Promise<void> {
  return await invoke('download_app_update', { url, savePath });
}

/**
 * 打开发布页面
 */
export async function openReleasePage(): Promise<void> {
  return await invoke('open_release_page');
}
