/**
 * 测试结果面板组件
 * 显示 API 配置的测试结果
 */

import React, { useState, useEffect } from 'react';
import type { ApiConfig, TestResult } from '../types/tauri';
import * as testApi from '../api/test';
import { useTestResults } from '../hooks/useTestResults';
import { formatDisplayUrl } from '../utils/url';

interface TestResultPanelProps {
  /** 配置列表 */
  configs: ApiConfig[];
  /** 分组 ID (如果指定,则显示测试全部按钮) */
  groupId?: number | null;
  /** 刷新回调 */
  onRefresh?: () => void;
}

/**
 * 测试结果面板
 */
export const TestResultPanel: React.FC<TestResultPanelProps> = ({
  configs,
  groupId,
  onRefresh,
}) => {
  const [testResults, setTestResults] = useState<Map<number, TestResult>>(new Map());
  const [testing, setTesting] = useState<Set<number>>(new Set());
  const [testingAll, setTestingAll] = useState(false);

  // 监听实时测试结果
  const { testResults: liveTestResults } = useTestResults();

  // 从配置中提取最新的测试结果,并合并实时结果
  useEffect(() => {
    const results = new Map<number, TestResult>();
    configs.forEach(config => {
      if (config.last_test_at) {
        results.set(config.id, {
          id: 0,
          config_id: config.id,
          test_time: new Date(config.last_test_at).getTime() / 1000,
          is_success: config.is_available,
          latency_ms: config.last_latency_ms,
          error_message: null,
        });
      }
    });

    // 合并实时测试结果(实时结果优先)
    liveTestResults.forEach((result, configId) => {
      results.set(configId, result);
    });

    setTestResults(results);
  }, [configs, liveTestResults]);

  // 测试单个配置
  const handleTestConfig = async (configId: number) => {
    setTesting(prev => new Set(prev).add(configId));
    try {
      const result = await testApi.testApiConfig(configId);
      setTestResults(prev => new Map(prev).set(configId, result));
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error(`测试配置 ${configId} 失败:`, error);
    } finally {
      setTesting(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  // 测试全部配置
  const handleTestAll = async () => {
    if (!groupId) return;

    setTestingAll(true);
    try {
      const results = await testApi.testGroupConfigs(groupId);
      const resultMap = new Map<number, TestResult>();
      results.forEach(result => {
        resultMap.set(result.config_id, result);
      });
      setTestResults(resultMap);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('测试全部配置失败:', error);
    } finally {
      setTestingAll(false);
    }
  };

  // 格式化延迟显示
  const formatLatency = (latencyMs: number | null): string => {
    if (latencyMs === null) return '-';
    return `${latencyMs}ms`;
  };

  // 格式化时间显示
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-amber-400">端点测速结果</h2>
        {groupId && configs.length > 0 && (
          <button
            onClick={handleTestAll}
            disabled={testingAll}
            className="px-4 py-2 bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testingAll ? '测速中...' : '测速全部'}
          </button>
        )}
      </div>

      {configs.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          暂无配置
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map(config => {
            const result = testResults.get(config.id);
            const isTesting = testing.has(config.id) || testingAll;

            return (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* 状态图标 */}
                  <div className="flex-shrink-0">
                    {isTesting ? (
                      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    ) : result ? (
                      result.is_success ? (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )
                    ) : (
                      <div className="w-6 h-6 bg-gray-600 rounded-full" />
                    )}
                  </div>

                  {/* 配置名称 */}
                  <div className="flex-1">
                    <div className="text-white font-medium">{config.name}</div>
                    <div className="text-sm text-gray-400">
                      {formatDisplayUrl(config.server_url)}
                    </div>
                  </div>

                  {/* 延迟显示 */}
                  <div className="text-right min-w-20">
                    {result && result.latency_ms !== null ? (
                      <div className="text-amber-400 font-mono font-semibold">
                        {formatLatency(result.latency_ms)}
                      </div>
                    ) : (
                      <div className="text-gray-500">-</div>
                    )}
                  </div>

                  {/* API 有效性 */}
                  <div className="min-w-16 text-center">
                    {result ? (
                      result.is_success ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded">
                          可用
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-sm rounded">
                          不可用
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-1 bg-gray-600/20 text-gray-500 text-sm rounded">
                        未测试
                      </span>
                    )}
                  </div>

                  {/* 测试时间 */}
                  {result && (
                    <div className="text-sm text-gray-500 min-w-24">
                      {formatTime(result.test_time)}
                    </div>
                  )}
                </div>

                {/* 测试按钮 */}
                <button
                  onClick={() => handleTestConfig(config.id)}
                  disabled={isTesting}
                  className="ml-4 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isTesting ? '测速中' : '测速'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
