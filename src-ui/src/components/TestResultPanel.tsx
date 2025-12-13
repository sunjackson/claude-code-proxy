/**
 * 测试结果面板组件
 * 显示 API 配置的测试结果
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          group_id: config.group_id,
          test_at: config.last_test_at,
          status: config.is_available ? 'success' : 'failed',
          latency_ms: config.last_latency_ms,
          error_message: null,
          is_valid_key: null,
          response_text: null,
          test_model: null,
          attempt: null,
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
    <div className="space-y-4">
      {/* 头部：标题 + 测速全部按钮 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-yellow-400">{t('test.endpointTest')}</h3>
        {groupId && configs.length > 0 && (
          <button
            onClick={handleTestAll}
            disabled={testingAll}
            className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            {testingAll ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('test.testAllProgress')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('test.testAll')}
              </>
            )}
          </button>
        )}
      </div>

      {/* 配置列表 */}
      {configs.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-400">{t('test.noConfigs')}</p>
          <p className="mt-1 text-sm text-gray-500">{t('test.pleaseAddConfig')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const result = testResults.get(config.id);
            const isTesting = testing.has(config.id) || testingAll;

            return (
              <div
                key={config.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-yellow-500/30 transition-all"
              >
                {/* 使用grid布局确保列对齐 */}
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* 状态图标 - 1列 */}
                  <div className="col-span-1 flex justify-center">
                    {isTesting ? (
                      <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    ) : result ? (
                      result.status === 'success' ? (
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

                  {/* 配置信息 - 5列 */}
                  <div className="col-span-5">
                    <div className="text-white font-medium truncate">{config.name}</div>
                    <div className="text-sm text-gray-400 truncate">
                      {formatDisplayUrl(config.server_url)}
                    </div>
                  </div>

                  {/* 延迟 - 2列 */}
                  <div className="col-span-2 text-center">
                    {result && result.latency_ms !== null ? (
                      <div className={`font-mono font-semibold inline-block px-2.5 py-1 rounded-md ${
                        result.latency_ms < 200
                          ? 'bg-green-500/20 text-green-400'
                          : result.latency_ms < 500
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {formatLatency(result.latency_ms)}
                      </div>
                    ) : (
                      <div className="text-gray-500">-</div>
                    )}
                  </div>

                  {/* 可用性 - 2列 */}
                  <div className="col-span-2 text-center">
                    {result ? (
                      result.status === 'success' ? (
                        <span className="inline-block px-2.5 py-1 bg-green-500/20 text-green-400 text-sm rounded-md border border-green-500/50">
                          {t('common.available')}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 bg-red-500/20 text-red-400 text-sm rounded-md border border-red-500/50">
                          {t('common.unavailable')}
                        </span>
                      )
                    ) : (
                      <span className="inline-block px-2.5 py-1 bg-gray-600/20 text-gray-500 text-sm rounded-md">
                        {t('status.pending')}
                      </span>
                    )}
                  </div>

                  {/* 测试按钮 - 2列 */}
                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => handleTestConfig(config.id)}
                      disabled={isTesting}
                      className={`px-3 py-1.5 rounded-md transition-colors text-sm border inline-flex items-center gap-1.5 ${
                        isTesting
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 cursor-wait'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20 hover:border-yellow-500/50'
                      }`}
                    >
                      {isTesting ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('test.testSingleProgress')}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {t('test.testSingle')}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 测试时间（如果有） */}
                {result && (
                  <div className="mt-2 pt-2 border-t border-gray-800 text-xs text-gray-500 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('test.lastTest')}: {formatTime(new Date(result.test_at).getTime() / 1000)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
