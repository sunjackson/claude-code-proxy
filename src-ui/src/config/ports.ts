/**
 * 端口常量配置
 *
 * 区分开发环境和生产环境使用不同的默认端口：
 * - 开发环境 (dev): 15341
 * - 生产环境 (production): 25341
 */

/** 开发环境代理端口 */
export const DEV_PROXY_PORT = 15341;

/** 生产环境代理端口 */
export const PROD_PROXY_PORT = 25341;

/**
 * 获取当前环境的默认代理端口
 *
 * @returns 开发环境返回 15341，生产环境返回 25341
 */
export function getDefaultProxyPort(): number {
  return import.meta.env.DEV ? DEV_PROXY_PORT : PROD_PROXY_PORT;
}

/** 默认代理端口 (根据当前环境自动选择) */
export const DEFAULT_PROXY_PORT = getDefaultProxyPort();

/** 默认代理主机 */
export const DEFAULT_PROXY_HOST = '127.0.0.1';
