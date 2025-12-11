/**
 * 健康监控面板
 * 显示各服务商小时级别的连通性统计
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ApiConfig, ConfigHealthSummary, HealthCheckHourlyStats } from '../types/tauri';
import * as proxyApi from '../api/proxy';
import { showError } from '../services/toast';

interface HealthMonitorPanelProps {
  configs: ApiConfig[];
  groupId: number | null;
  onRefresh: () => void;
  /** 自动检测间隔（秒） */
  checkIntervalSecs: number;
}

// 获取当天0点到23点的时间标签
function getTodayHours(): string[] {
  const hours: string[] = [];
  for (let i = 0; i <= 23; i++) {
    hours.push(i.toString().padStart(2, '0') + ':00');
  }
  return hours;
}

// 计算可用性颜色
function getAvailabilityColor(rate: number): string {
  if (rate >= 95) return 'text-green-400';
  if (rate >= 80) return 'text-yellow-400';
  if (rate >= 50) return 'text-orange-400';
  return 'text-red-400';
}

// 计算单元格颜色
function getCellColor(stats: HealthCheckHourlyStats | undefined): string {
  if (!stats || stats.total_checks === 0) return 'bg-gray-800';

  const successRate = (stats.success_count / stats.total_checks) * 100;
  if (successRate >= 95) return 'bg-green-500';
  if (successRate >= 80) return 'bg-green-600';
  if (successRate >= 50) return 'bg-yellow-500';
  if (successRate > 0) return 'bg-orange-500';
  return 'bg-red-500';
}

// 计算延迟颜色
function getLatencyColor(latency: number | null): string {
  if (latency === null) return 'text-gray-500';
  if (latency < 200) return 'text-green-400';
  if (latency < 500) return 'text-yellow-400';
  if (latency < 1000) return 'text-orange-400';
  return 'text-red-400';
}

export const HealthMonitorPanel: React.FC<HealthMonitorPanelProps> = ({
  configs,
  groupId,
  onRefresh,
  checkIntervalSecs,
}) => {
  const [summaries, setSummaries] = useState<ConfigHealthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummaries = useCallback(async () => {
    try {
      const data = await proxyApi.getHealthCheckSummaries(24);
      setSummaries(data);
    } catch (err) {
      console.error('加载健康检查数据失败:', err);
      showError('加载健康检查数据失败');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSummaries().finally(() => setLoading(false));
  }, [loadSummaries]);

  // 按分组过滤
  const filteredConfigs = groupId !== null
    ? configs.filter(c => c.group_id === groupId)
    : configs;

  // 将摘要数据与配置匹配
  const configSummaryMap = new Map<number, ConfigHealthSummary>();
  summaries.forEach(s => configSummaryMap.set(s.config_id, s));

  const hours = getTodayHours();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 先执行一次健康检查
      await proxyApi.runHealthCheckNow();
      // 然后重新加载数据
      await loadSummaries();
      onRefresh();
    } catch (err) {
      console.error('刷新失败:', err);
      showError('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          加载中...
        </div>
      </div>
    );
  }

  if (filteredConfigs.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="mt-3 text-sm font-medium text-gray-400">暂无配置</h3>
        <p className="mt-1 text-xs text-gray-600">添加配置后启用自动检测即可查看监控数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            显示今日 (0:00 - 23:00) 的连通性统计
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          立即检测
        </button>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500" />
          正常 (&gt;95%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-500" />
          警告 (50-95%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500" />
          异常 (&lt;50%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-800" />
          无数据
        </span>
      </div>

      {/* 监控表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-500 font-medium sticky left-0 bg-black z-10 min-w-[140px]">
                服务商
              </th>
              <th className="text-center py-2 px-2 text-gray-500 font-medium min-w-[70px]">
                可用率
              </th>
              <th className="text-center py-2 px-2 text-gray-500 font-medium min-w-[70px]">
                平均延迟
              </th>
              {hours.map((hour, i) => (
                <th key={i} className="text-center py-2 px-0.5 text-gray-600 font-normal text-xs min-w-[20px]">
                  {i % 4 === 0 ? hour.split(':')[0] : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredConfigs.map((config) => {
              const summary = configSummaryMap.get(config.id);
              const availability = summary?.availability_24h ?? 0;
              const avgLatency = summary?.avg_latency_24h ?? null;

              // 构建小时统计映射
              const hourlyMap = new Map<string, HealthCheckHourlyStats>();
              summary?.hourly_stats.forEach(stat => {
                // 提取小时部分
                const hour = stat.hour.split(' ')[1]?.substring(0, 5) || stat.hour;
                hourlyMap.set(hour, stat);
              });

              return (
                <tr key={config.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  {/* 服务商名称 */}
                  <td className="py-2 px-3 sticky left-0 bg-black z-10">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${config.is_available ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <span className="text-gray-200 font-medium truncate max-w-[120px]" title={config.name}>
                        {config.name}
                      </span>
                    </div>
                  </td>

                  {/* 可用率 */}
                  <td className="text-center py-2 px-2">
                    <span className={`font-bold ${getAvailabilityColor(availability)}`}>
                      {summary ? `${availability.toFixed(1)}%` : '-'}
                    </span>
                  </td>

                  {/* 平均延迟 */}
                  <td className="text-center py-2 px-2">
                    <span className={`font-mono ${getLatencyColor(avgLatency)}`}>
                      {avgLatency !== null ? `${Math.round(avgLatency)}ms` : '-'}
                    </span>
                  </td>

                  {/* 小时级别热力图 */}
                  {hours.map((hour, i) => {
                    const stat = hourlyMap.get(hour);
                    const cellColor = getCellColor(stat);
                    const successRate = stat && stat.total_checks > 0
                      ? ((stat.success_count / stat.total_checks) * 100).toFixed(0)
                      : null;
                    const latency = stat?.avg_latency_ms;

                    return (
                      <td key={i} className="py-2 px-0.5">
                        <div
                          className={`w-4 h-4 rounded-sm ${cellColor} cursor-pointer transition-all hover:scale-125 hover:z-10`}
                          title={stat
                            ? `${hour}\n成功率: ${successRate}%\n检查次数: ${stat.total_checks}\n平均延迟: ${latency ? Math.round(latency) + 'ms' : '-'}`
                            : `${hour}\n无数据`
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 底部说明 */}
      <div className="flex items-center gap-2 text-xs text-gray-600 pt-2 border-t border-gray-800">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          启用自动检测后，系统每 {checkIntervalSecs >= 60 ? `${Math.floor(checkIntervalSecs / 60)} 分钟` : `${checkIntervalSecs} 秒`}模拟 Claude Code 请求检查服务商连通性
        </span>
      </div>
    </div>
  );
};
