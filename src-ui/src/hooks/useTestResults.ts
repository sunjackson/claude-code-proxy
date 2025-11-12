/**
 * 测试结果监听钩子
 * 监听 test-completed 事件并实时更新测试结果
 */

import { useState, useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { TestResult } from '../types/tauri';

/**
 * 测试结果钩子返回值
 */
export interface UseTestResultsResult {
  /** 最新的测试结果(按 config_id 索引) */
  testResults: Map<number, TestResult>;
  /** 是否正在初始化 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 清除所有测试结果 */
  clearResults: () => void;
  /** 清除指定配置的测试结果 */
  clearConfigResult: (configId: number) => void;
}

/**
 * 测试结果监听钩子
 *
 * 监听 test-completed 事件,当有新的测试完成时自动更新结果
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { testResults } = useTestResults();
 *
 *   return (
 *     <div>
 *       {Array.from(testResults.entries()).map(([configId, result]) => (
 *         <div key={configId}>
 *           Config {configId}: {result.is_success ? '成功' : '失败'}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTestResults(): UseTestResultsResult {
  const [testResults, setTestResults] = useState<Map<number, TestResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        // 监听 test-completed 事件
        unlisten = await listen<TestResult>('test-completed', (event) => {
          console.log('收到 test-completed 事件:', event.payload);

          const result = event.payload;
          setTestResults((prev) => {
            const next = new Map(prev);
            next.set(result.config_id, result);
            return next;
          });
        });

        setLoading(false);
        console.log('test-completed 事件监听器已设置');
      } catch (err) {
        console.error('设置 test-completed 事件监听器失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setLoading(false);
      }
    };

    setupListener();

    // 清理函数
    return () => {
      if (unlisten) {
        unlisten();
        console.log('test-completed 事件监听器已移除');
      }
    };
  }, []);

  // 清除所有测试结果
  const clearResults = () => {
    setTestResults(new Map());
  };

  // 清除指定配置的测试结果
  const clearConfigResult = (configId: number) => {
    setTestResults((prev) => {
      const next = new Map(prev);
      next.delete(configId);
      return next;
    });
  };

  return {
    testResults,
    loading,
    error,
    clearResults,
    clearConfigResult,
  };
}
