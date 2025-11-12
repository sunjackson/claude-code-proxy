/**
 * 防抖 Hook
 * 延迟执行函数,直到在指定时间内没有新的调用
 */

import { useEffect, useState } from 'react';

/**
 * 防抖值 Hook
 *
 * @param value 需要防抖的值
 * @param delay 延迟时间(毫秒)
 * @returns 防抖后的值
 *
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 设置定时器,在延迟后更新值
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清理函数:如果值在延迟期间改变,清除之前的定时器
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 *
 * @param callback 需要防抖的回调函数
 * @param delay 延迟时间(毫秒)
 * @returns 防抖后的回调函数
 *
 * @example
 * const debouncedSearch = useDebouncedCallback((query) => {
 *   searchApi(query);
 * }, 500);
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return (...args: Parameters<T>) => {
    // 清除之前的定时器
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 设置新的定时器
    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };
}
