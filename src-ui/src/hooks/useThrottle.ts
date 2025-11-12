/**
 * 节流 Hook
 * 限制函数在指定时间内只能执行一次
 */

import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * 节流值 Hook
 *
 * @param value 需要节流的值
 * @param interval 时间间隔(毫秒)
 * @returns 节流后的值
 *
 * @example
 * const throttledScrollY = useThrottle(scrollY, 100);
 */
export function useThrottle<T>(value: T, interval: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted.current;

    if (timeSinceLastExecution >= interval) {
      // 如果已经过了指定时间,立即更新
      setThrottledValue(value);
      lastExecuted.current = now;
    } else {
      // 否则,设置定时器在剩余时间后更新
      const timeoutId = setTimeout(() => {
        setThrottledValue(value);
        lastExecuted.current = Date.now();
      }, interval - timeSinceLastExecution);

      return () => clearTimeout(timeoutId);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * 节流回调 Hook
 *
 * @param callback 需要节流的回调函数
 * @param interval 时间间隔(毫秒)
 * @returns 节流后的回调函数
 *
 * @example
 * const throttledHandleScroll = useThrottledCallback(() => {
 *   console.log('Scrolling...');
 * }, 100);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 500
): (...args: Parameters<T>) => void {
  const lastExecuted = useRef<number>(Date.now());
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecuted.current;

      if (timeSinceLastExecution >= interval) {
        // 如果已经过了指定时间,立即执行
        callback(...args);
        lastExecuted.current = now;

        // 清除任何待执行的定时器
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
          timeoutId.current = null;
        }
      } else {
        // 否则,取消之前的定时器,设置新的定时器
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }

        timeoutId.current = setTimeout(() => {
          callback(...args);
          lastExecuted.current = Date.now();
          timeoutId.current = null;
        }, interval - timeSinceLastExecution);
      }
    },
    [callback, interval]
  );

  // 清理函数
  useEffect(() => {
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);

  return throttledCallback;
}
