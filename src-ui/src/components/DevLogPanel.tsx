/**
 * 开发者日志面板组件
 * 用于在开发者模式下查看代理请求的详细日志
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAllProxyRequestLogs,
  getProxyRequestLogDetail,
  getProxyRequestLogStats,
  cleanupProxyRequestLogs,
  getProxyRequestLogCount,
} from '../api/proxy';
import type { ProxyRequestLog, ProxyRequestLogDetail, LogStats } from '../types/tauri';
import { showError } from '../services/toast';

/** 格式化字节大小 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** 格式化时间 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 格式化日期时间 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** HTTP 状态码颜色 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-400';
  if (status >= 400 && status < 500) return 'text-orange-400';
  return 'text-red-400';
}

/** HTTP 方法颜色 */
function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'bg-blue-600';
    case 'POST': return 'bg-green-600';
    case 'PUT': return 'bg-yellow-600';
    case 'DELETE': return 'bg-red-600';
    case 'PATCH': return 'bg-purple-600';
    default: return 'bg-gray-600';
  }
}

/** JSON 格式化显示 */
function JsonViewer({ content, title }: { content: string | null; title: string }) {
  const [collapsed, setCollapsed] = useState(true);

  if (!content) {
    return (
      <div className="text-gray-500 text-sm italic">无 {title}</div>
    );
  }

  let formatted: string;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    formatted = content;
  }

  const lines = formatted.split('\n');
  const preview = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;

  return (
    <div className="bg-gray-900 rounded p-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-xs font-medium">{title}</span>
        {hasMore && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            {collapsed ? '展开' : '收起'}
          </button>
        )}
      </div>
      <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
        {collapsed && hasMore ? preview + '\n...' : formatted}
      </pre>
    </div>
  );
}

/** 日志详情面板 */
function LogDetailPanel({
  log,
  onClose,
}: {
  log: ProxyRequestLogDetail;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getMethodColor(log.method)}`}>
              {log.method}
            </span>
            <span className={`font-mono ${getStatusColor(log.status_code)}`}>
              {log.status_code}
            </span>
            <span className="text-gray-300 font-mono text-sm truncate max-w-md">
              {log.uri}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">请求时间</div>
              <div className="text-gray-300 text-sm">{formatDateTime(log.request_at)}</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">总耗时</div>
              <div className="text-amber-400 text-sm font-mono">{log.latency_ms} ms</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">首字节时间</div>
              <div className="text-gray-300 text-sm font-mono">
                {log.time_to_first_byte_ms ? `${log.time_to_first_byte_ms} ms` : '-'}
              </div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">流式响应</div>
              <div className="text-gray-300 text-sm">
                {log.is_streaming ? (
                  <span className="text-green-400">是 ({log.stream_chunk_count} chunks)</span>
                ) : (
                  <span className="text-gray-500">否</span>
                )}
              </div>
            </div>
          </div>

          {/* 更多信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">配置名称</div>
              <div className="text-gray-300 text-sm truncate">{log.config_name || '-'}</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">模型</div>
              <div className="text-purple-400 text-sm font-mono">{log.model || '-'}</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">请求大小</div>
              <div className="text-gray-300 text-sm">{formatBytes(log.request_body_size)}</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">响应大小</div>
              <div className="text-gray-300 text-sm">{formatBytes(log.response_body_size)}</div>
            </div>
          </div>

          {/* 目标 URL */}
          <div className="bg-gray-900 rounded p-3">
            <div className="text-gray-500 text-xs mb-1">目标 URL</div>
            <div className="text-gray-300 text-sm font-mono break-all">{log.target_url}</div>
          </div>

          {/* 客户端信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">客户端地址</div>
              <div className="text-gray-300 text-sm font-mono">{log.remote_addr || '-'}</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-gray-500 text-xs mb-1">User-Agent</div>
              <div className="text-gray-300 text-sm truncate">{log.user_agent || '-'}</div>
            </div>
          </div>

          {/* 错误信息 */}
          {log.error_message && (
            <div className="bg-red-900/30 border border-red-600/50 rounded p-3">
              <div className="text-red-400 text-xs mb-1">错误信息</div>
              <div className="text-red-300 text-sm">{log.error_message}</div>
            </div>
          )}

          {/* 请求头 */}
          <JsonViewer content={log.request_headers} title="请求头" />

          {/* 请求体 */}
          <JsonViewer content={log.request_body} title="请求体" />

          {/* 响应头 */}
          <JsonViewer content={log.response_headers} title="响应头" />

          {/* 响应体 */}
          <JsonViewer content={log.response_body} title="响应体" />
        </div>
      </div>
    </div>
  );
}

/** 清理确认弹窗 */
function CleanupConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl max-w-md w-full shadow-2xl border border-amber-500/20 overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 px-6 py-4 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-400">清理日志确认</h3>
              <p className="text-gray-400 text-sm">此操作不可撤销</p>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="text-gray-300 mb-2">即将执行以下操作：</p>
                <ul className="text-gray-400 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    保留最近 <span className="text-amber-400 font-medium">100</span> 条日志记录
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    删除其余所有历史日志数据
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                    释放数据库存储空间
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-900/30 border-t border-gray-700/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                清理中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                确认清理
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 清理结果弹窗 */
function CleanupResultDialog({
  isOpen,
  deletedCount,
  onClose,
}: {
  isOpen: boolean;
  deletedCount: number;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const isNoData = deletedCount === 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl max-w-sm w-full shadow-2xl border border-green-500/20 overflow-hidden">
        {/* 头部图标 */}
        <div className="pt-8 pb-4 flex justify-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isNoData ? 'bg-blue-500/20' : 'bg-green-500/20'
          }`}>
            {isNoData ? (
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 pb-6 text-center">
          <h3 className={`text-xl font-semibold mb-2 ${isNoData ? 'text-blue-400' : 'text-green-400'}`}>
            {isNoData ? '无需清理' : '清理完成'}
          </h3>
          {isNoData ? (
            <p className="text-gray-400">
              当前日志数量未超过保留限制，无需清理
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-300">
                已成功清理 <span className="text-amber-400 font-bold text-2xl">{deletedCount.toLocaleString()}</span> 条
              </p>
              <p className="text-gray-500 text-sm">历史日志记录</p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-900/30 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className={`w-full px-4 py-2.5 text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
              isNoData
                ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

/** 开发者日志面板主组件 */
export default function DevLogPanel() {
  const [logs, setLogs] = useState<ProxyRequestLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLogDetail, setSelectedLogDetail] = useState<ProxyRequestLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // 清理弹窗状态
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showCleanupResult, setShowCleanupResult] = useState(false);
  const [cleanupDeletedCount, setCleanupDeletedCount] = useState(0);

  // 加载日志列表
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [logsData, statsData, count] = await Promise.all([
        getAllProxyRequestLogs(pageSize, page * pageSize),
        getProxyRequestLogStats(24),
        getProxyRequestLogCount(),
      ]);
      setLogs(logsData);
      setStats(statsData);
      setTotalCount(count);
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // 加载日志详情
  const loadLogDetail = async (logId: number) => {
    try {
      const detail = await getProxyRequestLogDetail(logId);
      setSelectedLogDetail(detail);
    } catch (error) {
      console.error('加载日志详情失败:', error);
    }
  };

  // 清理日志
  const handleCleanup = async () => {
    setShowCleanupConfirm(true);
  };

  // 执行清理操作
  const performCleanup = async () => {
    try {
      setCleanupLoading(true);
      const deleted = await cleanupProxyRequestLogs(100);
      setCleanupDeletedCount(deleted);
      setShowCleanupConfirm(false);
      setShowCleanupResult(true);
      loadLogs();
    } catch (error) {
      console.error('清理日志失败:', error);
      showError('清理日志失败');
      setShowCleanupConfirm(false);
    } finally {
      setCleanupLoading(false);
    }
  };

  // 初始加载和自动刷新
  useEffect(() => {
    loadLogs();

    if (autoRefresh) {
      const interval = setInterval(loadLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [loadLogs, autoRefresh]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* 头部统计 */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-amber-400 font-semibold">开发者日志</h2>
            <span className="text-gray-500 text-sm">({totalCount} 条记录)</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-500"
              />
              自动刷新
            </label>
            <button
              onClick={loadLogs}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
            >
              {loading ? '加载中...' : '刷新'}
            </button>
            <button
              onClick={handleCleanup}
              className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
            >
              清理
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs">24h 请求</div>
              <div className="text-white text-lg font-bold">{stats.total_count}</div>
              <div className="text-xs mt-1">
                <span className="text-green-400">{stats.success_count} 成功</span>
                {stats.error_count > 0 && (
                  <span className="text-red-400 ml-2">{stats.error_count} 失败</span>
                )}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs">平均延迟</div>
              <div className="text-amber-400 text-lg font-bold font-mono">
                {stats.avg_latency_ms.toFixed(0)} ms
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs">延迟范围</div>
              <div className="text-gray-300 text-sm font-mono">
                {stats.min_latency_ms} - {stats.max_latency_ms} ms
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs">数据传输</div>
              <div className="text-gray-300 text-sm">
                ↑ {formatBytes(stats.total_request_size)}
              </div>
              <div className="text-gray-300 text-sm">
                ↓ {formatBytes(stats.total_response_size)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 sticky top-0">
            <tr className="text-left text-gray-400">
              <th className="px-4 py-2 w-24">时间</th>
              <th className="px-4 py-2 w-16">方法</th>
              <th className="px-4 py-2">URI</th>
              <th className="px-4 py-2 w-16">状态</th>
              <th className="px-4 py-2 w-20">延迟</th>
              <th className="px-4 py-2 w-24">大小</th>
              <th className="px-4 py-2 w-28">配置</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => loadLogDetail(log.id)}
                className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                  !log.is_success ? 'bg-red-900/10' : ''
                }`}
              >
                <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                  {formatTime(log.request_at)}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold text-white ${getMethodColor(log.method)}`}>
                    {log.method}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-300 font-mono text-xs truncate max-w-xs">
                  {log.uri}
                </td>
                <td className={`px-4 py-2 font-mono ${getStatusColor(log.status_code)}`}>
                  {log.status_code}
                </td>
                <td className="px-4 py-2 text-gray-300 font-mono text-xs">
                  {log.latency_ms} ms
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  <div>↑ {formatBytes(log.request_body_size)}</div>
                  <div>↓ {formatBytes(log.response_body_size)}</div>
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-[100px]">
                  {log.config_name || '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  暂无日志记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-gray-700 flex items-center justify-between">
          <span className="text-gray-500 text-sm">
            第 {page + 1} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedLogDetail && (
        <LogDetailPanel
          log={selectedLogDetail}
          onClose={() => setSelectedLogDetail(null)}
        />
      )}

      {/* 清理确认弹窗 */}
      <CleanupConfirmDialog
        isOpen={showCleanupConfirm}
        onConfirm={performCleanup}
        onCancel={() => setShowCleanupConfirm(false)}
        isLoading={cleanupLoading}
      />

      {/* 清理结果弹窗 */}
      <CleanupResultDialog
        isOpen={showCleanupResult}
        deletedCount={cleanupDeletedCount}
        onClose={() => setShowCleanupResult(false)}
      />
    </div>
  );
}
