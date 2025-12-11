/**
 * 服务商监控大屏组件（简化版）
 * 聚焦核心指标：在线状态、延迟、成功率
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ApiConfig, ConfigGroup, TestResult, ProxyRequestLog } from '../types/tauri';
import * as testApi from '../api/test';
import * as proxyApi from '../api/proxy';
import { useAutoRefreshStore } from '../store/autoRefreshStore';

interface ProviderMonitorProps {
  isOpen: boolean;
  configs: ApiConfig[];
  groups: ConfigGroup[];
  selectedGroupId: number | null;
  onClose: () => void;
}

interface ConfigStats {
  config: ApiConfig;
  testHistory: TestResult[];
  proxyLogs: ProxyRequestLog[];
  avgLatency: number | null;
  successRate: number;
  totalTests: number;
  proxyAvgLatency: number | null;
  proxySuccessRate: number;
  proxyTotalRequests: number;
}

export const ProviderMonitor: React.FC<ProviderMonitorProps> = ({
  isOpen,
  configs,
  groups,
  selectedGroupId,
  onClose,
}) => {
  const [configStats, setConfigStats] = useState<ConfigStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { monitorAutoRefresh: autoRefresh, setMonitorAutoRefresh: setAutoRefresh } = useAutoRefreshStore();
  const [testingAll, setTestingAll] = useState(false);

  // 筛选当前分组
  const filteredConfigs = useMemo(() => {
    if (selectedGroupId === null) return configs;
    return configs.filter(c => c.group_id === selectedGroupId);
  }, [configs, selectedGroupId]);

  // 加载数据
  const loadData = useCallback(async () => {
    if (filteredConfigs.length === 0) {
      setConfigStats([]);
      setLoading(false);
      return;
    }

    try {
      const stats = await Promise.all(
        filteredConfigs.map(async (config) => {
          try {
            const [history, proxyLogs] = await Promise.all([
              testApi.getTestResults(config.id, 50),
              proxyApi.getProxyRequestLogs(config.id, 50).catch(() => [] as ProxyRequestLog[]),
            ]);

            const successTests = history.filter(t => t.status === 'success');
            const latencies = successTests.map(t => t.latency_ms).filter((l): l is number => l !== null);
            const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
            const successRate = history.length > 0 ? Math.round((successTests.length / history.length) * 100) : 100;

            const successProxyLogs = proxyLogs.filter(l => l.is_success);
            const proxyLatencies = successProxyLogs.map(l => l.latency_ms);
            const proxyAvgLatency = proxyLatencies.length > 0 ? Math.round(proxyLatencies.reduce((a, b) => a + b, 0) / proxyLatencies.length) : null;
            const proxySuccessRate = proxyLogs.length > 0 ? Math.round((successProxyLogs.length / proxyLogs.length) * 100) : 100;

            return {
              config,
              testHistory: history,
              proxyLogs,
              avgLatency,
              successRate,
              totalTests: history.length,
              proxyAvgLatency,
              proxySuccessRate,
              proxyTotalRequests: proxyLogs.length,
            };
          } catch {
            return {
              config,
              testHistory: [],
              proxyLogs: [],
              avgLatency: null,
              successRate: 100,
              totalTests: 0,
              proxyAvgLatency: null,
              proxySuccessRate: 100,
              proxyTotalRequests: 0,
            };
          }
        })
      );
      setConfigStats(stats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filteredConfigs]);

  // 测试所有
  const handleTestAll = async () => {
    if (testingAll) return;
    setTestingAll(true);
    try {
      for (const config of filteredConfigs) {
        try { await testApi.testApiConfig(config.id); } catch { /* continue */ }
      }
      setRefreshing(true);
      await loadData();
    } finally {
      setTestingAll(false);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!autoRefresh || !isOpen) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, isOpen, loadData]);

  // 按延迟排序
  const sortedStats = useMemo(() => {
    return [...configStats].sort((a, b) => {
      if (a.avgLatency === null) return 1;
      if (b.avgLatency === null) return -1;
      return a.avgLatency - b.avgLatency;
    });
  }, [configStats]);

  // 汇总统计
  const summary = useMemo(() => {
    const online = filteredConfigs.filter(c => c.is_available).length;
    const validLatencies = configStats.filter(s => s.avgLatency !== null);
    const avgLatency = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((sum, s) => sum + (s.avgLatency || 0), 0) / validLatencies.length)
      : null;
    const totalRequests = configStats.reduce((sum, s) => sum + s.proxyTotalRequests, 0);
    return { online, total: filteredConfigs.length, avgLatency, totalRequests };
  }, [filteredConfigs, configStats]);

  // 延迟颜色
  const getLatencyColor = (latency: number | null) => {
    if (latency === null) return 'text-gray-500';
    if (latency < 500) return 'text-green-400';
    if (latency < 1500) return 'text-yellow-400';
    return 'text-red-400';
  };

  // 热力图
  const renderHeatmap = (data: { success: boolean; latency: number }[], type: 'test' | 'request') => {
    const maxCells = 50;
    const items = data.slice(0, maxCells).reverse();
    const cells = Array(maxCells).fill(null).map((_, i) => items[i] || null);

    const getColor = (item: { success: boolean; latency: number } | null) => {
      if (!item) return 'bg-gray-800/40';
      if (!item.success) return 'bg-red-500';
      if (type === 'test') {
        if (item.latency < 1500) return 'bg-green-500';
        if (item.latency < 5000) return 'bg-yellow-500';
        return 'bg-orange-500';
      } else {
        if (item.latency < 5000) return 'bg-cyan-500';
        if (item.latency < 20000) return 'bg-blue-500';
        return 'bg-purple-500';
      }
    };

    return (
      <div className="flex flex-wrap gap-[3px]">
        {cells.map((item, i) => (
          <div
            key={i}
            className={`w-[8px] h-[8px] rounded-[2px] ${getColor(item)}`}
            title={item ? `${item.latency}ms - ${item.success ? '成功' : '失败'}` : ''}
          />
        ))}
      </div>
    );
  };

  const currentGroupName = selectedGroupId === null
    ? '全部'
    : groups.find(g => g.id === selectedGroupId)?.name || '配置';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-auto">
      {/* 顶部栏 */}
      <div className="sticky top-0 z-10 bg-black border-b border-gray-800">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* 左侧 */}
          <div className="flex items-center gap-5">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div>
              <h1 className="text-xl font-bold text-yellow-500">服务商监控 · {currentGroupName}</h1>
              <p className="text-sm text-gray-500">{filteredConfigs.length} 个配置</p>
            </div>

            {/* 核心指标 */}
            <div className="flex items-center gap-6 pl-5 border-l border-gray-800">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{summary.online}/{summary.total}</div>
                <div className="text-xs text-gray-500">在线</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getLatencyColor(summary.avgLatency)}`}>
                  {summary.avgLatency ?? '-'}<span className="text-sm text-gray-500">ms</span>
                </div>
                <div className="text-xs text-gray-500">平均延迟</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{summary.totalRequests}</div>
                <div className="text-xs text-gray-500">请求</div>
              </div>
            </div>
          </div>

          {/* 右侧 */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-0"
              />
              自动刷新
            </label>

            <button
              onClick={() => { setRefreshing(true); loadData(); }}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={handleTestAll}
              disabled={testingAll}
              className="px-4 py-2 bg-yellow-500 text-black text-sm font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50"
            >
              {testingAll ? '测试中...' : '测试全部'}
            </button>
          </div>
        </div>
      </div>

      {/* 配置列表 */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-base">加载中...</div>
        ) : sortedStats.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-base">暂无配置</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedStats.map((stats) => {
              const testData = stats.testHistory.map(t => ({ success: t.status === 'success', latency: t.latency_ms || 0 }));
              const requestData = stats.proxyLogs.map(l => ({ success: l.is_success, latency: l.latency_ms }));

              return (
                <div
                  key={stats.config.id}
                  className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                >
                  {/* 头部 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stats.config.is_available ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-base text-white font-medium truncate flex-1" title={stats.config.name}>
                      {stats.config.name}
                    </span>
                  </div>

                  {/* 指标 */}
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                    <div>
                      <div className={`text-lg font-bold ${getLatencyColor(stats.avgLatency)}`}>{stats.avgLatency ?? '-'}</div>
                      <div className="text-xs text-gray-500">测试</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${stats.successRate >= 90 ? 'text-green-400' : stats.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {stats.successRate}%
                      </div>
                      <div className="text-xs text-gray-500">成功</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${getLatencyColor(stats.proxyAvgLatency)}`}>{stats.proxyAvgLatency ?? '-'}</div>
                      <div className="text-xs text-gray-500">请求</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-cyan-400">{stats.proxyTotalRequests}</div>
                      <div className="text-xs text-gray-500">次数</div>
                    </div>
                  </div>

                  {/* 热力图 */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>连通性</span>
                        <span>{stats.totalTests}次</span>
                      </div>
                      {renderHeatmap(testData, 'test')}
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>实际请求</span>
                        <span>{stats.proxyTotalRequests}次</span>
                      </div>
                      {renderHeatmap(requestData, 'request')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 图例 */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500" />正常</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500" />较慢</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" />失败</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-800/40" />无数据</span>
        </div>
      </div>
    </div>
  );
};

export default ProviderMonitor;
