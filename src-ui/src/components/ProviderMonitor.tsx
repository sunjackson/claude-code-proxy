/**
 * 服务商监控大屏组件
 * 展示各配置的连通性测试记录和实际代理请求记录
 *
 * 两种数据类型：
 * - 连通性测试：手动或定时执行的API可用性检测
 * - 实际请求：Claude Code通过代理转发的真实API调用
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ApiConfig, ConfigGroup, TestResult, ProxyRequestLog } from '../types/tauri';
import * as testApi from '../api/test';
import * as proxyApi from '../api/proxy';

interface ProviderMonitorProps {
  isOpen: boolean;
  configs: ApiConfig[];
  groups: ConfigGroup[];
  selectedGroupId: number | null;
  onClose: () => void;
}

interface ConfigStats {
  config: ApiConfig;
  testHistory: TestResult[];        // 连通性测试记录
  proxyLogs: ProxyRequestLog[];     // 实际代理请求记录
  avgLatency: number | null;        // 测试平均延迟
  minLatency: number | null;
  maxLatency: number | null;
  successRate: number;              // 测试成功率
  totalTests: number;               // 测试总次数
  recentTrend: 'up' | 'down' | 'stable';
  stability: 'excellent' | 'good' | 'fair' | 'poor';
  // 实际请求统计
  proxyAvgLatency: number | null;   // 请求平均延迟
  proxySuccessRate: number;         // 请求成功率
  proxyTotalRequests: number;       // 请求总次数
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'stability' | 'successRate'>('latency');

  // 筛选当前分组的配置
  const filteredConfigs = useMemo(() => {
    if (selectedGroupId === null) return configs;
    return configs.filter(c => c.group_id === selectedGroupId);
  }, [configs, selectedGroupId]);

  // 加载连通性测试和实际请求数据
  const loadTestHistory = useCallback(async () => {
    if (filteredConfigs.length === 0) {
      setConfigStats([]);
      setLoading(false);
      return;
    }

    try {
      const statsPromises = filteredConfigs.map(async (config) => {
        try {
          // 并行获取连通性测试记录和实际请求记录
          const [history, proxyLogs] = await Promise.all([
            testApi.getTestResults(config.id, 100),
            proxyApi.getProxyRequestLogs(config.id, 100).catch(() => [] as ProxyRequestLog[]),
          ]);
          return calculateStats(config, history, proxyLogs);
        } catch (err) {
          console.error(`Failed to load data for config ${config.id}:`, err);
          return calculateStats(config, [], []);
        }
      });

      const stats = await Promise.all(statsPromises);
      setConfigStats(stats);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filteredConfigs]);

  // 计算配置的统计数据
  const calculateStats = (config: ApiConfig, history: TestResult[], proxyLogs: ProxyRequestLog[] = []): ConfigStats => {
    const successTests = history.filter(t => t.status === 'success');
    const latencies = successTests
      .map(t => t.latency_ms)
      .filter((l): l is number => l !== null && l !== undefined);

    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;

    const successRate = history.length > 0
      ? Math.round((successTests.length / history.length) * 100)
      : 100;

    // 计算趋势：比较最近5次和之前的平均值
    let recentTrend: 'up' | 'down' | 'stable' = 'stable';
    if (latencies.length >= 6) {
      const recent = latencies.slice(0, 5);
      const older = latencies.slice(5, 10);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const diff = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (diff > 15) recentTrend = 'up';
      else if (diff < -15) recentTrend = 'down';
    }

    // 稳定性评估
    let stability: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (successRate < 50 || (avgLatency && avgLatency > 2000)) {
      stability = 'poor';
    } else if (successRate < 80 || (avgLatency && avgLatency > 1000)) {
      stability = 'fair';
    } else if (successRate < 95 || (avgLatency && avgLatency > 500)) {
      stability = 'good';
    }

    // 计算实际请求统计
    const successProxyLogs = proxyLogs.filter(l => l.is_success);
    const proxyLatencies = successProxyLogs.map(l => l.latency_ms);
    const proxyAvgLatency = proxyLatencies.length > 0
      ? Math.round(proxyLatencies.reduce((a, b) => a + b, 0) / proxyLatencies.length)
      : null;
    const proxySuccessRate = proxyLogs.length > 0
      ? Math.round((successProxyLogs.length / proxyLogs.length) * 100)
      : 100;

    return {
      config,
      testHistory: history,
      proxyLogs,
      avgLatency,
      minLatency,
      maxLatency,
      successRate,
      totalTests: history.length,
      recentTrend,
      stability,
      proxyAvgLatency,
      proxySuccessRate,
      proxyTotalRequests: proxyLogs.length,
    };
  };

  // 测试所有配置连通性 - 与 Dashboard 保持一致的测试方法
  const handleTestAll = async () => {
    if (testingAll || filteredConfigs.length === 0) return;

    setTestingAll(true);
    try {
      // 逐个测试所有配置，与 Dashboard 的 handleTestConfig 逻辑保持一致
      for (const config of filteredConfigs) {
        try {
          await testApi.testApiConfig(config.id);
        } catch (err) {
          console.error(`Failed to test config ${config.id}:`, err);
          // 继续测试下一个配置
        }
      }
      // 重新加载数据
      setRefreshing(true);
      await loadTestHistory();
    } catch (err) {
      console.error('Failed to test all configs:', err);
    } finally {
      setTestingAll(false);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTestHistory();
  };

  // 初始加载
  useEffect(() => {
    loadTestHistory();
  }, [loadTestHistory]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadTestHistory();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, loadTestHistory]);

  // 排序配置
  const sortedStats = useMemo(() => {
    return [...configStats].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.config.name.localeCompare(b.config.name);
        case 'latency':
          if (a.avgLatency === null) return 1;
          if (b.avgLatency === null) return -1;
          return a.avgLatency - b.avgLatency;
        case 'stability':
          const stabilityOrder = { excellent: 0, good: 1, fair: 2, poor: 3 };
          return stabilityOrder[a.stability] - stabilityOrder[b.stability];
        case 'successRate':
          return b.successRate - a.successRate;
        default:
          return 0;
      }
    });
  }, [configStats, sortBy]);

  // 获取稳定性颜色
  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'excellent': return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'good': return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
      case 'fair': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'poor': return 'text-red-400 bg-red-500/20 border-red-500/50';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };

  // 获取延迟颜色
  const getLatencyColor = (latency: number | null) => {
    if (latency === null) return 'text-gray-500';
    if (latency < 200) return 'text-green-400';
    if (latency < 500) return 'text-blue-400';
    if (latency < 1000) return 'text-yellow-400';
    return 'text-red-400';
  };

  // 渲染连通性测试热力图（绿黄橙红色系）
  const renderLatencyHeatmap = (stats: ConfigStats) => {
    const { testHistory } = stats;
    // 最多显示100个方格，从旧到新排列
    const maxCells = 100;
    const recentTests = testHistory.slice(0, maxCells).reverse();

    // 每行显示的方格数
    const cellsPerRow = 20;
    const totalRows = Math.ceil(maxCells / cellsPerRow);

    // 连通性测试延迟颜色（暖色系：绿→黄→橙→红）
    const getLatencyCellColor = (test: TestResult | null): string => {
      if (!test) return 'bg-gray-800/30'; // 空位
      if (test.status !== 'success') return 'bg-red-500'; // 失败
      const latency = test.latency_ms || 0;
      if (latency < 1500) return 'bg-green-500';
      if (latency < 3000) return 'bg-green-400';
      if (latency < 5000) return 'bg-yellow-400';
      if (latency < 8000) return 'bg-yellow-500';
      if (latency < 12000) return 'bg-orange-400';
      if (latency < 20000) return 'bg-orange-500';
      return 'bg-red-400';
    };

    // 生成方格数据，不足的用 null 填充
    const cells: (TestResult | null)[] = [];
    for (let i = 0; i < maxCells; i++) {
      cells.push(recentTests[i] || null);
    }

    return (
      <div className="space-y-0.5">
        {Array.from({ length: totalRows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-0.5">
            {cells.slice(rowIdx * cellsPerRow, (rowIdx + 1) * cellsPerRow).map((test, cellIdx) => {
              const globalIdx = rowIdx * cellsPerRow + cellIdx;
              return (
                <div
                  key={globalIdx}
                  className={`w-2 h-2 rounded-sm transition-all hover:scale-150 hover:z-10 cursor-default ${getLatencyCellColor(test)}`}
                  title={test ? `${test.latency_ms ?? '-'}ms - ${test.status === 'success' ? '成功' : '失败'}\n测试时间: ${new Date(test.test_at).toLocaleString()}` : '无数据'}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // 渲染实际请求热力图（青蓝紫色系，区分于连通性测试）
  const renderProxyLogsHeatmap = (stats: ConfigStats) => {
    const { proxyLogs } = stats;
    // 最多显示100个方格，从旧到新排列
    const maxCells = 100;
    const recentLogs = proxyLogs.slice(0, maxCells).reverse();

    // 每行显示的方格数
    const cellsPerRow = 20;
    const totalRows = Math.ceil(maxCells / cellsPerRow);

    // 实际请求延迟颜色（冷色系：青→蓝→紫，与测试区分）
    const getProxyLatencyCellColor = (log: ProxyRequestLog | null): string => {
      if (!log) return 'bg-gray-800/30'; // 空位
      if (!log.is_success) return 'bg-red-500'; // 失败
      const latency = log.latency_ms || 0;
      if (latency < 2000) return 'bg-cyan-500';
      if (latency < 5000) return 'bg-cyan-400';
      if (latency < 10000) return 'bg-blue-400';
      if (latency < 20000) return 'bg-blue-500';
      if (latency < 30000) return 'bg-purple-400';
      if (latency < 60000) return 'bg-purple-500';
      return 'bg-red-400';
    };

    // 生成方格数据，不足的用 null 填充
    const cells: (ProxyRequestLog | null)[] = [];
    for (let i = 0; i < maxCells; i++) {
      cells.push(recentLogs[i] || null);
    }

    return (
      <div className="space-y-0.5">
        {Array.from({ length: totalRows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-0.5">
            {cells.slice(rowIdx * cellsPerRow, (rowIdx + 1) * cellsPerRow).map((log, cellIdx) => {
              const globalIdx = rowIdx * cellsPerRow + cellIdx;
              return (
                <div
                  key={globalIdx}
                  className={`w-2 h-2 rounded-sm transition-all hover:scale-150 hover:z-10 cursor-default ${getProxyLatencyCellColor(log)}`}
                  title={log ? `${log.latency_ms}ms - ${log.is_success ? '成功' : '失败'} (HTTP ${log.status_code})\n${log.method} ${log.uri}\n请求时间: ${new Date(log.request_at).toLocaleString()}` : '无数据'}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // 获取当前分组名称
  const currentGroupName = selectedGroupId === null
    ? '全部配置'
    : groups.find(g => g.id === selectedGroupId)?.name || '配置';

  // 不显示时返回 null
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-auto">
      <div className="min-h-screen p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-black text-white">服务商监控大屏</h1>
              <p className="text-sm text-gray-500">{currentGroupName} · {filteredConfigs.length} 个配置</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 自动刷新开关 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">自动刷新</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`w-10 h-5 rounded-full transition-all ${
                  autoRefresh ? 'bg-yellow-500' : 'bg-gray-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                  autoRefresh ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            {/* 排序选择 */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-yellow-500"
            >
              <option value="latency">按延迟排序</option>
              <option value="name">按名称排序</option>
              <option value="stability">按稳定性排序</option>
              <option value="successRate">按成功率排序</option>
            </select>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>

            {/* 全部测试按钮 */}
            <button
              onClick={handleTestAll}
              disabled={testingAll}
              className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {testingAll ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  测试中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  测试全部
                </>
              )}
            </button>
          </div>
        </div>

        {/* 概览统计 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">总配置数</div>
            <div className="text-3xl font-black text-white">{filteredConfigs.length}</div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">在线配置</div>
            <div className="text-3xl font-black text-green-400">
              {filteredConfigs.filter(c => c.is_available).length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">平均延迟</div>
            <div className="text-3xl font-black text-blue-400">
              {configStats.length > 0 && configStats.some(s => s.avgLatency !== null)
                ? Math.round(
                    configStats
                      .filter(s => s.avgLatency !== null)
                      .reduce((sum, s) => sum + (s.avgLatency || 0), 0) /
                    configStats.filter(s => s.avgLatency !== null).length
                  )
                : '-'
              }
              <span className="text-lg text-gray-500 ml-1">ms</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">平均成功率</div>
            <div className="text-3xl font-black text-yellow-400">
              {configStats.length > 0
                ? Math.round(configStats.reduce((sum, s) => sum + s.successRate, 0) / configStats.length)
                : 100
              }
              <span className="text-lg text-gray-500 ml-1">%</span>
            </div>
          </div>
        </div>

        {/* 配置列表 */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : sortedStats.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-3 text-sm font-medium text-gray-400">暂无配置</h3>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedStats.map((stats) => (
              <div
                key={stats.config.id}
                className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/30 transition-all"
              >
                {/* 头部：名称和状态 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate" title={stats.config.name}>
                      {stats.config.name}
                    </h3>
                    <p className="text-xs text-gray-600 truncate">
                      {groups.find(g => g.id === stats.config.group_id)?.name || '未分组'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {/* 在线状态 */}
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      stats.config.is_available ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    {/* 稳定性标签 */}
                    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getStabilityColor(stats.stability)}`}>
                      {stats.stability === 'excellent' ? '优秀' :
                       stats.stability === 'good' ? '良好' :
                       stats.stability === 'fair' ? '一般' : '较差'}
                    </span>
                  </div>
                </div>

                {/* 连通性测试热力图 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                      连通性测试
                    </span>
                    <span className="flex items-center gap-1">
                      {stats.recentTrend === 'up' && (
                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                      {stats.recentTrend === 'down' && (
                        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                      <span className="text-yellow-400/80">{stats.totalTests}</span>次
                    </span>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2">
                    {renderLatencyHeatmap(stats)}
                  </div>
                </div>

                {/* 实际请求热力图 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                      实际请求
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-cyan-400">{stats.proxyTotalRequests}</span>次
                    </span>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2">
                    {renderProxyLogsHeatmap(stats)}
                  </div>
                  {stats.proxyTotalRequests > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-600">
                        平均 <span className="text-cyan-400">{stats.proxyAvgLatency ?? '-'}ms</span>
                      </span>
                      <span className="text-gray-600">
                        成功率 <span className={stats.proxySuccessRate >= 95 ? 'text-green-400' : stats.proxySuccessRate >= 80 ? 'text-yellow-400' : 'text-red-400'}>
                          {stats.proxySuccessRate}%
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* 连通性测试统计数据 */}
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1.5">测试延迟统计 (ms)</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className={`text-lg font-black ${getLatencyColor(stats.avgLatency)}`}>
                      {stats.avgLatency ?? '-'}
                    </div>
                    <div className="text-xs text-gray-600">平均</div>
                  </div>
                  <div>
                    <div className={`text-lg font-black ${getLatencyColor(stats.minLatency)}`}>
                      {stats.minLatency ?? '-'}
                    </div>
                    <div className="text-xs text-gray-600">最小</div>
                  </div>
                  <div>
                    <div className={`text-lg font-black ${getLatencyColor(stats.maxLatency)}`}>
                      {stats.maxLatency ?? '-'}
                    </div>
                    <div className="text-xs text-gray-600">最大</div>
                  </div>
                  <div>
                    <div className={`text-lg font-black ${
                      stats.successRate >= 95 ? 'text-green-400' :
                      stats.successRate >= 80 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {stats.successRate}%
                    </div>
                    <div className="text-xs text-gray-600">成功率</div>
                  </div>
                </div>
                </div>

                {/* 底部信息 */}
                <div className="mt-4 pt-3 border-t border-gray-800/50 flex items-center justify-between text-xs text-gray-600">
                  <span>测试次数: {stats.totalTests}</span>
                  {stats.testHistory[0] && (
                    <span>
                      最后测试: {new Date(stats.testHistory[0].test_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 图例说明 */}
        <div className="mt-6 space-y-3">
          {/* 连通性测试延迟图例 */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5 text-gray-600 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
              连通性测试延迟:
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
              <span>&lt;1.5s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
              <span>1.5-3s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
              <span>3-5s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />
              <span>5-8s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-400" />
              <span>8-12s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
              <span>12-20s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
              <span>&gt;20s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span>失败</span>
            </div>
          </div>

          {/* 实际请求延迟图例 */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5 text-gray-600 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
              实际请求延迟:
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
              <span>&lt;2s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span>2-5s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
              <span>5-10s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>10-20s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
              <span>20-30s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span>30-60s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
              <span>&gt;60s</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span>失败</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-gray-800/30" />
              <span>无数据</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderMonitor;
