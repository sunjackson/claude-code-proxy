/**
 * 首次启动状态管理
 * 用于判断是否需要显示设置向导
 */

const FIRST_RUN_KEY = 'claude_router_first_run';
const SETUP_COMPLETED_KEY = 'claude_router_setup_completed';

/**
 * 检查是否首次运行
 */
export function isFirstRun(): boolean {
  return localStorage.getItem(FIRST_RUN_KEY) === null;
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
}

/**
 * 跳过设置向导
 */
export function skipSetup(): void {
  localStorage.setItem(FIRST_RUN_KEY, 'false');
}

/**
 * 重置设置状态 (用于测试)
 */
export function resetSetupState(): void {
  localStorage.removeItem(FIRST_RUN_KEY);
  localStorage.removeItem(SETUP_COMPLETED_KEY);
}
