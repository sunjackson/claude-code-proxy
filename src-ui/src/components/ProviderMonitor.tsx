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

  // 计算汇总统计
  const summaryStats = useMemo(() => {
    const onlineCount = filteredConfigs.filter(c => c.is_available).length;
    const offlineCount = filteredConfigs.length - onlineCount;
    const onlineRate = filteredConfigs.length > 0 ? Math.round((onlineCount / filteredConfigs.length) * 100) : 0;

    const avgLatency = configStats.length > 0 && configStats.some(s => s.avgLatency !== null)
      ? Math.round(
          configStats
            .filter(s => s.avgLatency !== null)
            .reduce((sum, s) => sum + (s.avgLatency || 0), 0) /
          configStats.filter(s => s.avgLatency !== null).length
        )
      : null;

    const avgSuccessRate = configStats.length > 0
      ? Math.round(configStats.reduce((sum, s) => sum + s.successRate, 0) / configStats.length)
      : 100;

    const totalTests = configStats.reduce((sum, s) => sum + s.totalTests, 0);
    const totalRequests = configStats.reduce((sum, s) => sum + s.proxyTotalRequests, 0);

    // 稳定性分布
    const stabilityDist = {
      excellent: configStats.filter(s => s.stability === 'excellent').length,
      good: configStats.filter(s => s.stability === 'good').length,
      fair: configStats.filter(s => s.stability === 'fair').length,
      poor: configStats.filter(s => s.stability === 'poor').length,
    };

    return { onlineCount, offlineCount, onlineRate, avgLatency, avgSuccessRate, totalTests, totalRequests, stabilityDist };
  }, [filteredConfigs, configStats]);

  // 不显示时返回 null
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-auto">
      {/* ==================== 顶部监控头 ==================== */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black/95 to-transparent pb-4">
        {/* 主标题栏 */}
        <div className="bg-gradient-to-r from-gray-900/90 via-black to-gray-900/90 border-b border-yellow-500/30">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* 左侧：返回按钮 + 标题 + 实时状态 */}
              <div className="flex items-center gap-5">
                <button
                  onClick={onClose}
                  className="p-2.5 bg-gray-800/80 text-gray-400 rounded-xl hover:bg-gray-700 hover:text-white transition-all border border-gray-700/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>

                <div className="flex items-center gap-4">
                  {/* 标题区 */}
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-black text-yellow-500">服务商监控</h1>
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/40">
                        {currentGroupName}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      实时监控 · {filteredConfigs.length} 个配置 · {autoRefresh ? '自动刷新中' : '手动刷新'}
                    </p>
                  </div>

                  {/* 实时状态指示器 */}
                  <div className="flex items-center gap-3 pl-4 border-l border-gray-700/50">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                      summaryStats.onlineRate >= 80
                        ? 'bg-green-500/10 border border-green-500/30'
                        : summaryStats.onlineRate >= 50
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                      <span className={`w-2 h-2 rounded-full animate-pulse ${
                        summaryStats.onlineRate >= 80 ? 'bg-green-500' :
                        summaryStats.onlineRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className={`text-sm font-bold ${
                        summaryStats.onlineRate >= 80 ? 'text-green-400' :
                        summaryStats.onlineRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {summaryStats.onlineCount}/{filteredConfigs.length} 在线
                      </span>
                    </div>

                    {refreshing && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm font-medium text-blue-400">刷新中</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧：操作按钮组 */}
              <div className="flex items-center gap-3">
                {/* 自动刷新开关 */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 rounded-xl border border-gray-700/50">
                  <span className="text-xs text-gray-400">自动刷新</span>
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`relative w-11 h-6 rounded-full transition-all ${
                      autoRefresh ? 'bg-yellow-500' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-all ${
                      autoRefresh ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                  {autoRefresh && <span className="text-xs text-yellow-400/70">30s</span>}
                </div>

                {/* 排序选择 */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-yellow-500/50 cursor-pointer"
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
                  className="p-2.5 bg-gray-800/60 text-gray-300 rounded-xl hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50 border border-gray-700/50"
                  title="刷新数据"
                >
                  <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* 全部测试按钮 */}
                <button
                  onClick={handleTestAll}
                  disabled={testingAll}
                  className="px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-yellow-500 transition-all disabled:opacity-50 shadow-lg shadow-yellow-500/20 flex items-center gap-2"
                >
                  {testingAll ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
          </div>
        </div>

        {/* ==================== 核心指标概览 ==================== */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-6 gap-4">
            {/* 配置总数 */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800/80 rounded-2xl p-5 hover:border-yellow-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">配置总数</span>
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                  <svg className="w-4 h-4 text-yellow-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
              </div>
              <div className="text-4xl font-black text-white">{filteredConfigs.length}</div>
              <div className="text-xs text-gray-600 mt-1">个服务商配置</div>
            </div>

            {/* 在线状态 */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800/80 rounded-2xl p-5 hover:border-green-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">在线状态</span>
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <svg className="w-4 h-4 text-green-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-green-400">{summaryStats.onlineCount}</span>
                <span className="text-lg text-gray-600">/ {filteredConfigs.length}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      summaryStats.onlineRate >= 80 ? 'bg-green-500' :
                      summaryStats.onlineRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${summaryStats.onlineRate}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${
                  summaryStats.onlineRate >= 80 ? 'text-green-400' :
                  summaryStats.onlineRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>{summaryStats.onlineRate}%</span>
              </div>
            </div>

            {/* 平均延迟 */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800/80 rounded-2xl p-5 hover:border-blue-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">平均延迟</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <svg className="w-4 h-4 text-blue-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black ${
                  summaryStats.avgLatency === null ? 'text-gray-500' :
                  summaryStats.avgLatency < 200 ? 'text-green-400' :
                  summaryStats.avgLatency < 500 ? 'text-blue-400' :
                  summaryStats.avgLatency < 1000 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {summaryStats.avgLatency ?? '-'}
                </span>
                {summaryStats.avgLatency !== null && <span className="text-lg text-gray-500">ms</span>}
              </div>
              <div className="text-xs text-gray-600 mt-1">连通性测试平均</div>
            </div>

            {/* 成功率 */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800/80 rounded-2xl p-5 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">测试成功率</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <svg className="w-4 h-4 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black ${
                  summaryStats.avgSuccessRate >= 95 ? 'text-green-400' :
                  summaryStats.avgSuccessRate >= 80 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {summaryStats.avgSuccessRate}
                </span>
                <span className="text-lg text-gray-500">%</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">共 {summaryStats.totalTests} 次测试</div>
            </div>

            {/* 稳定性分布 */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800/80 rounded-2xl p-5 hover:border-purple-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">稳定性分布</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <svg className="w-4 h-4 text-purple-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {summaryStats.stabilityDist.excellent > 0 && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                    {summaryStats.stabilityDist.excellent} 优
                  </span>
                )}
                {summaryStats.stabilityDist.good > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30">
                    {summaryStats.stabilityDist.good} 良
                  </span>
                )}
                {summaryStats.stabilityDist.fair > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30">
                    {summaryStats.stabilityDist.fair} 中
                  </span>
                )}
                {summaryStats.stabilityDist.poor > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30">
                    {summaryStats.stabilityDist.poor} 差
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-2">基于延迟和成功率评估</div>
            </div>

            {/* 实际请求 */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-black border border-gray-800/80 rounded-2xl p-5 hover:border-cyan-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">实际请求</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                  <svg className="w-4 h-4 text-cyan-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="text-4xl font-black text-cyan-400">{summaryStats.totalRequests}</div>
              <div className="text-xs text-gray-600 mt-1">代理转发请求总数</div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 配置列表区域 ==================== */}
      <div className="px-6 pb-6">

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
