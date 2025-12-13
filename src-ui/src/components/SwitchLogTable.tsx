/**
 * 切换日志表格组件
 * 显示自动切换历史记录，包含详细的切换原因
 */

import React, { useRef, useEffect, useState } from 'react';
// TODO: 完成国际化迁移后启用
// import { useTranslation } from 'react-i18next';
import type { SwitchLog, SwitchReason, ErrorType } from '../types/tauri';

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

// 获取原因标签样式和描述
const getReasonInfo = (reason: SwitchReason): {
  bg: string;
  text: string;
  label: string;
  icon: string;
  description: string;
} => {
  switch (reason) {
    case 'connection_failed':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        label: '连接失败',
        icon: '🔌',
        description: '无法建立网络连接'
      };
    case 'timeout':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        label: '请求超时',
        icon: '⏱️',
        description: '请求响应时间超过限制'
      };
    case 'quota_exceeded':
      return {
        bg: 'bg-orange-500/20',
        text: 'text-orange-400',
        label: '配额耗尽',
        icon: '📊',
        description: 'API 调用配额已用尽'
      };
    case 'high_latency':
      return {
        bg: 'bg-purple-500/20',
        text: 'text-purple-400',
        label: '高延迟',
        icon: '🐌',
        description: '响应延迟超过阈值'
      };
    case 'manual':
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        label: '手动切换',
        icon: '👆',
        description: '用户手动触发切换'
      };
    case 'retry_failed':
      return {
        bg: 'bg-red-600/20',
        text: 'text-red-500',
        label: '重试失败',
        icon: '🔄',
        description: '多次重试后仍然失败'
      };
    case 'unrecoverable_error':
      return {
        bg: 'bg-red-700/20',
        text: 'text-red-600',
        label: '不可恢复',
        icon: '⛔',
        description: '遇到无法恢复的错误'
      };
    case 'rate_limit_exceeded':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        label: '频率限制',
        icon: '🚦',
        description: '请求频率超过限制'
      };
    default:
      return {
        bg: 'bg-gray-500/20',
        text: 'text-gray-400',
        label: '未知',
        icon: '❓',
        description: '未知的切换原因'
      };
  }
};

// 获取错误类型样式和描述
const getErrorTypeInfo = (errorType: ErrorType | null): {
  label: string;
  icon: string;
  color: string;
  description: string;
} | null => {
  if (!errorType) return null;

  switch (errorType) {
    case 'network':
      return {
        label: '网络错误',
        icon: '🌐',
        color: 'text-red-400',
        description: 'DNS 解析失败或 TCP 连接错误'
      };
    case 'timeout':
      return {
        label: '请求超时',
        icon: '⏱️',
        color: 'text-yellow-400',
        description: '服务器响应超时'
      };
    case 'authentication':
      return {
        label: '认证失败',
        icon: '🔐',
        color: 'text-orange-400',
        description: 'API Key 无效或已过期'
      };
    case 'insufficient_balance':
      return {
        label: '余额不足',
        icon: '💰',
        color: 'text-amber-400',
        description: '账户余额不足以继续调用'
      };
    case 'account_banned':
      return {
        label: '账号封禁',
        icon: '🚫',
        color: 'text-red-500',
        description: '账号已被服务商封禁'
      };
    case 'rate_limit':
      return {
        label: '频率限制',
        icon: '🚦',
        color: 'text-amber-400',
        description: '触发了 API 请求频率限制 (429)'
      };
    case 'server_error':
      return {
        label: '服务器错误',
        icon: '🖥️',
        color: 'text-red-400',
        description: '服务端返回 5xx 错误'
      };
    case 'unknown':
    default:
      return {
        label: '未知错误',
        icon: '❓',
        color: 'text-gray-400',
        description: '无法识别的错误类型'
      };
  }
};

// 生成详细的切换原因描述
const generateDetailedReason = (log: SwitchLog): string => {
  const parts: string[] = [];
  const reasonInfo = getReasonInfo(log.reason);

  switch (log.reason) {
    case 'high_latency':
      if (log.latency_before_ms !== null) {
        parts.push(`响应延迟达到 ${log.latency_before_ms}ms，超过设定阈值`);
      } else {
        parts.push('响应延迟超过设定阈值');
      }
      break;

    case 'retry_failed':
      parts.push(`已重试 ${log.retry_count} 次后仍然失败`);
      if (log.error_type) {
        const errorInfo = getErrorTypeInfo(log.error_type);
        if (errorInfo) {
          parts.push(`错误类型: ${errorInfo.label}`);
        }
      }
      break;

    case 'timeout':
      parts.push('请求超时');
      if (log.retry_count > 0) {
        parts.push(`重试 ${log.retry_count} 次后切换`);
      }
      break;

    case 'connection_failed':
      parts.push('无法建立连接');
      if (log.retry_count > 0) {
        parts.push(`重试 ${log.retry_count} 次后切换`);
      }
      break;

    case 'unrecoverable_error':
      if (log.error_type) {
        const errorInfo = getErrorTypeInfo(log.error_type);
        if (errorInfo) {
          parts.push(`${errorInfo.label}: ${errorInfo.description}`);
        }
      } else {
        parts.push('遇到不可恢复的错误');
      }
      break;

    case 'rate_limit_exceeded':
      parts.push('触发请求频率限制 (HTTP 429)');
      break;

    case 'quota_exceeded':
      parts.push('API 调用配额已耗尽');
      break;

    case 'manual':
      parts.push('用户手动触发切换');
      break;

    default:
      parts.push(reasonInfo.description);
  }

  // 添加错误消息
  if (log.error_message) {
    parts.push(`详情: ${log.error_message}`);
  }

  return parts.join('；');
};

export const SwitchLogTable: React.FC<SwitchLogTableProps> = ({
  logs,
  onLoadMore,
  hasMore,
  loading = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // 切换行展开状态
  const toggleRowExpanded = (id: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
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

  // 格式化完整时间
  const formatFullTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 格式化延迟变化
  const formatLatencyChange = (before: number | null, after: number | null): React.ReactNode => {
    if (before === null && after === null) {
      return <span className="text-gray-500">-</span>;
    }

    if (before === null) {
      return (
        <span className="text-gray-300">
          → {after}ms
        </span>
      );
    }

    if (after === null) {
      return (
        <span className="text-gray-300">
          {before}ms →
        </span>
      );
    }

    const change = after - before;
    const isImproved = change < 0;

    return (
      <div className="flex items-center gap-1 flex-wrap">
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

  // 渲染详情行
  const renderDetailRow = (log: SwitchLog) => {
    const reasonInfo = getReasonInfo(log.reason);
    const errorTypeInfo = getErrorTypeInfo(log.error_type);
    const detailedReason = generateDetailedReason(log);

    return (
      <tr className="bg-gray-800/50">
        <td colSpan={6} className="px-4 py-4">
          <div className="space-y-3">
            {/* 详细原因 */}
            <div className="flex items-start gap-2">
              <span className="text-gray-400 text-sm shrink-0">切换原因:</span>
              <div className="text-sm text-gray-200">
                <span className="mr-2">{reasonInfo.icon}</span>
                {detailedReason}
              </div>
            </div>

            {/* 错误类型 */}
            {errorTypeInfo && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400 text-sm shrink-0">错误类型:</span>
                <div className={`text-sm ${errorTypeInfo.color}`}>
                  <span className="mr-2">{errorTypeInfo.icon}</span>
                  <span className="font-medium">{errorTypeInfo.label}</span>
                  <span className="text-gray-400 ml-2">- {errorTypeInfo.description}</span>
                </div>
              </div>
            )}

            {/* 重试信息 */}
            {log.retry_count > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">重试次数:</span>
                <span className="text-sm text-amber-400 font-medium">
                  🔄 {log.retry_count} 次
                </span>
              </div>
            )}

            {/* 错误详情 */}
            {log.error_details && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400 text-sm shrink-0">错误详情:</span>
                <pre className="text-xs text-gray-300 bg-gray-900 p-2 rounded overflow-x-auto max-w-full">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.error_details), null, 2);
                    } catch {
                      return log.error_details;
                    }
                  })()}
                </pre>
              </div>
            )}

            {/* 延迟详情 */}
            {(log.latency_before_ms !== null || log.latency_after_ms !== null) && (
              <div className="flex items-center gap-4 text-sm">
                {log.latency_before_ms !== null && (
                  <div>
                    <span className="text-gray-400">切换前延迟: </span>
                    <span className="text-gray-200 font-mono">{log.latency_before_ms}ms</span>
                  </div>
                )}
                {log.latency_after_ms !== null && (
                  <div>
                    <span className="text-gray-400">切换后延迟: </span>
                    <span className="text-green-400 font-mono">{log.latency_after_ms}ms</span>
                  </div>
                )}
                {log.latency_improvement_ms !== null && (
                  <div>
                    <span className="text-gray-400">延迟改善: </span>
                    <span className={`font-mono ${log.latency_improvement_ms > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {log.latency_improvement_ms > 0 ? '+' : ''}{log.latency_improvement_ms}ms
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 完整时间 */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>切换时间:</span>
              <span>{formatFullTime(log.switch_at)}</span>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-gray-900 border border-amber-500/30 rounded-lg overflow-hidden">
      {/* 表头 */}
      <div className="bg-gray-800 px-4 py-3 border-b border-amber-500/30 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-amber-400">切换日志</h3>
        <span className="text-xs text-gray-500">点击行查看详情</span>
      </div>

      {/* 表格容器 */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight: '500px' }}
      >
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">📋</div>
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
                const reasonInfo = getReasonInfo(log.reason);
                const isExpanded = expandedRows.has(log.id);
                const hasDetails = log.error_message || log.error_details || log.retry_count > 0 || log.error_type;

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-800/20' : ''}`}
                      onClick={() => toggleRowExpanded(log.id)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                          {formatTime(log.switch_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${reasonInfo.bg} ${reasonInfo.text} font-medium w-fit`}
                          >
                            <span>{reasonInfo.icon}</span>
                            {reasonInfo.label}
                          </span>
                          {/* 简短描述 */}
                          {hasDetails && !isExpanded && (
                            <span className="text-xs text-gray-500 truncate max-w-[200px]">
                              {log.retry_count > 0 && `重试${log.retry_count}次 `}
                              {log.error_type && getErrorTypeInfo(log.error_type)?.label}
                              {log.latency_before_ms !== null && log.reason === 'high_latency' && ` ${log.latency_before_ms}ms`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.source_config_name ? (
                          <div className="truncate max-w-[180px]" title={log.source_config_name}>
                            {log.source_config_name}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">已删除</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-amber-400 font-medium">
                        <div className="truncate max-w-[180px]" title={log.target_config_name}>
                          {log.target_config_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        <div className="truncate max-w-[120px]" title={log.group_name}>
                          {log.group_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatLatencyChange(log.latency_before_ms, log.latency_after_ms)}
                      </td>
                    </tr>
                    {isExpanded && renderDetailRow(log)}
                  </React.Fragment>
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
