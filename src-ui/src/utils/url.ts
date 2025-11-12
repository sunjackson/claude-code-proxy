/**
 * URL 工具函数
 */

/**
 * 移除 URL 中的端口号
 *
 * @param url - 完整的 URL 字符串
 * @returns 移除端口号后的 URL
 *
 * @example
 * removePortFromUrl('https://api.example.com:8443') // 'https://api.example.com'
 * removePortFromUrl('https://api.example.com') // 'https://api.example.com'
 * removePortFromUrl('http://127.0.0.1:25341') // 'http://127.0.0.1'
 */
export function removePortFromUrl(url: string): string {
  if (!url) return url;

  try {
    const urlObj = new URL(url);
    // 移除端口号，保留协议、主机名和路径
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
  } catch (e) {
    // 如果不是有效的 URL，尝试使用正则表达式移除端口
    return url.replace(/:\d+/, '');
  }
}

/**
 * 格式化显示 URL（移除端口号）
 *
 * @param serverUrl - 服务器 URL
 * @returns 格式化后的 URL（不带端口号）
 */
export function formatDisplayUrl(serverUrl: string): string {
  return removePortFromUrl(serverUrl);
}
