/**
 * 切换日志表格组件
 * 显示自动切换历史记录
 */

import React, { useRef, useEffect } from 'react';
import type { SwitchLog, SwitchReason } from '../types/tauri';

interface SwitchLogTableProps {
  /** 日志列表 */
  logs: SwitchLog[];
  /** 加载更多回调 */
  onLoadMore: () => void;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 是否正在加载 */
  loading?: boolean;
}

export const SwitchLogTable: React.FC<SwitchLogTableProps> = ({
  logs,
  onLoadMore,
  hasMore,
  loading = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 获取原因标签样式
  const getReasonStyle = (reason: SwitchReason): { bg: string; text: string; label: string } => {
    switch (reason) {
      case 'connection_failed':
        return { bg: 'bg-red-500/20', text: 'text-red-400', label: '连接失败' };
      case 'timeout':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '超时' };
      case 'quota_exceeded':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '配额耗尽' };
      case 'high_latency':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', label: '高延迟' };
      case 'manual':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '手动' };
      default:
        return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '未知' };
    }
  };

  // 格式化时间
  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 小于1分钟
    if (diff < 60 * 1000) {
      return '刚刚';
    }
    // 小于1小时
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}分钟前`;
    }
    // 小于24小时
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}小时前`;
    }
    // 显示完整日期
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化延迟变化
  const formatLatencyChange = (before: number | null, after: number | null): React.ReactNode => {
    if (before === null || after === null) {
      return <span className="text-gray-500">-</span>;
    }

    const change = after - before;
    const isImproved = change < 0;

    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-300">{before}ms</span>
        <span className="text-gray-500">→</span>
        <span className={isImproved ? 'text-green-400' : 'text-red-400'}>
          {after}ms
        </span>
        <span className={`text-xs ${isImproved ? 'text-green-400' : 'text-red-400'}`}>
          ({isImproved ? '↓' : '↑'}{Math.abs(change)}ms)
        </span>
      </div>
    );
  };

  // 滚动监听,到底部时加载更多
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom && hasMore && !loading) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, onLoadMore]);

  return (
    <div className="bg-gray-900 border border-amber-500/30 rounded-lg overflow-hidden">
      {/* 表头 */}
      <div className="bg-gray-800 px-4 py-3 border-b border-amber-500/30">
        <h3 className="text-lg font-semibold text-amber-400">切换日志</h3>
      </div>

      {/* 表格容器 */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight: '500px' }}
      >
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无切换日志
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">原因</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">源配置</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">目标配置</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">分组</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">延迟变化</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map((log) => {
                const reasonStyle = getReasonStyle(log.reason);
                return (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                      {formatTime(log.switch_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded ${reasonStyle.bg} ${reasonStyle.text} font-medium`}
                      >
                        {reasonStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {log.source_config_name ? (
                        <div className="truncate max-w-[200px]" title={log.source_config_name}>
                          {log.source_config_name}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">已删除</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-amber-400 font-medium">
                      <div className="truncate max-w-[200px]" title={log.target_config_name}>
                        {log.target_config_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div className="truncate max-w-[150px]" title={log.group_name}>
                        {log.group_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatLatencyChange(log.latency_before_ms, log.latency_after_ms)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 加载更多指示器 */}
        {loading && (
          <div className="p-4 text-center text-gray-500">
            <span className="inline-block animate-spin">⏳</span> 加载中...
          </div>
        )}

        {/* 无更多数据提示 */}
        {!hasMore && logs.length > 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            已加载全部日志
          </div>
        )}
      </div>
    </div>
  );
};
