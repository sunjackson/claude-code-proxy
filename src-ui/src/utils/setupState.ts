/**
 * 首次启动状态管理
 * 用于判断是否需要显示设置向导
 */

import { invoke } from '@tauri-apps/api/core';

const FIRST_RUN_KEY = 'claudecodeproxy_first_run';
const SETUP_COMPLETED_KEY = 'claudecodeproxy_setup_completed';
const AUTO_CONFIG_NEEDED_KEY = 'claudecodeproxy_auto_config_needed';

/**
 * 检查是否首次运行
 * 通过后端 API 检查数据库中是否有配置数据
 */
export async function isFirstRun(): Promise<boolean> {
  try {
    // 调用后端 API 检查系统是否已配置
    const isConfigured = await invoke<boolean>('check_system_configured');
    return !isConfigured;
  } catch (error) {
    console.error('检查系统配置状态失败:', error);
    // 出错时回退到 localStorage 检查
    return localStorage.getItem(FIRST_RUN_KEY) === null;
  }
}

/**
 * 标记首次运行已完成
 */
export function markFirstRunComplete(): void {
  localStorage.setItem(FIRST_RUN_KEY, 'false');
}

/**
 * 检查设置是否完成
 */
export function isSetupCompleted(): boolean {
  return localStorage.getItem(SETUP_COMPLETED_KEY) === 'true';
}

/**
 * 标记设置已完成
 */
export function markSetupCompleted(): void {
  localStorage.setItem(SETUP_COMPLETED_KEY, 'true');
  localStorage.setItem(FIRST_RUN_KEY, 'false');
  // 标记需要自动配置
  localStorage.setItem(AUTO_CONFIG_NEEDED_KEY, 'true');
}

/**
 * 跳过设置向导
 */
export function skipSetup(): void {
  localStorage.setItem(FIRST_RUN_KEY, 'false');
}

/**
 * 检查是否需要自动配置（进入页面后执行）
 */
export function needsAutoConfig(): boolean {
  return localStorage.getItem(AUTO_CONFIG_NEEDED_KEY) === 'true';
}

/**
 * 标记自动配置已完成
 */
export function markAutoConfigDone(): void {
  localStorage.removeItem(AUTO_CONFIG_NEEDED_KEY);
}

/**
 * 重置设置状态 (用于测试)
 */
export function resetSetupState(): void {
  localStorage.removeItem(FIRST_RUN_KEY);
  localStorage.removeItem(SETUP_COMPLETED_KEY);
  localStorage.removeItem(AUTO_CONFIG_NEEDED_KEY);
}
