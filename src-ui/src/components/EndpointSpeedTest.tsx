/**
 * 端点测速组件
 * 用于测试多个端点的延迟并选择最快的端点
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Zap, Loader2, Plus, X, AlertCircle } from 'lucide-react';
import { testApiEndpoints, type EndpointTestResult } from '../api/test';
import toast from 'react-hot-toast';

// 端点测速超时配置（毫秒）
const ENDPOINT_TIMEOUT_MS = 8000;

interface EndpointEntry extends EndpointTestResult {
  id: string;
  isCustom: boolean;
}

interface EndpointSpeedTestProps {
  /** 当前选中的 URL */
  value: string;
  /** URL 变化回调 */
  onChange: (url: string) => void;
  /** 初始端点列表（来自预设） */
  initialEndpoints?: string[];
  /** 是否显示对话框 */
  visible?: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

const randomId = () => `ep_${Math.random().toString(36).slice(2, 9)}`;

const normalizeEndpointUrl = (url: string): string =>
  url.trim().replace(/\/+$/, '');

const buildInitialEntries = (
  candidates: string[],
  selected: string,
): EndpointEntry[] => {
  const map = new Map<string, EndpointEntry>();

  const addCandidate = (url: string, isCustom: boolean = false) => {
    const sanitized = normalizeEndpointUrl(url);
    if (!sanitized || map.has(sanitized)) return;

    map.set(sanitized, {
      id: randomId(),
      url: sanitized,
      success: false,
      latency_ms: null,
      error: null,
      isCustom,
    });
  };

  // 添加预设端点
  candidates.forEach((url) => addCandidate(url, false));

  // 添加当前选中的 URL（如果不在列表中）
  const selectedUrl = normalizeEndpointUrl(selected);
  if (selectedUrl && !map.has(selectedUrl)) {
    addCandidate(selectedUrl, true);
  }

  return Array.from(map.values());
};

export const EndpointSpeedTest: React.FC<EndpointSpeedTestProps> = ({
  value,
  onChange,
  initialEndpoints = [],
  visible = true,
  onClose,
}) => {
  const [entries, setEntries] = useState<EndpointEntry[]>(() =>
    buildInitialEntries(initialEndpoints, value),
  );
  const [customUrl, setCustomUrl] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [autoSelect, setAutoSelect] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  const normalizedSelected = normalizeEndpointUrl(value);
  const hasEndpoints = entries.length > 0;

  // 同步初始端点列表
  useEffect(() => {
    setEntries((prev) => {
      const map = new Map<string, EndpointEntry>();

      // 保留现有端点（包括测速结果）
      prev.forEach((entry) => {
        map.set(entry.url, entry);
      });

      // 合并初始端点
      let changed = false;
      initialEndpoints.forEach((url) => {
        const sanitized = normalizeEndpointUrl(url);
        if (sanitized && !map.has(sanitized)) {
          map.set(sanitized, {
            id: randomId(),
            url: sanitized,
            success: false,
            latency_ms: null,
            error: null,
            isCustom: false,
          });
          changed = true;
        }
      });

      // 确保当前选中的 URL 在列表中
      if (normalizedSelected && !map.has(normalizedSelected)) {
        map.set(normalizedSelected, {
          id: randomId(),
          url: normalizedSelected,
          success: false,
          latency_ms: null,
          error: null,
          isCustom: true,
        });
        changed = true;
      }

      return changed ? Array.from(map.values()) : prev;
    });
  }, [initialEndpoints, normalizedSelected]);

  // 按延迟排序端点
  const sortedEntries = useMemo(() => {
    return entries.slice().sort((a, b) => {
      const aLatency = a.latency_ms ?? Number.POSITIVE_INFINITY;
      const bLatency = b.latency_ms ?? Number.POSITIVE_INFINITY;
      if (aLatency === bLatency) {
        return a.url.localeCompare(b.url);
      }
      return aLatency - bLatency;
    });
  }, [entries]);

  // 添加自定义端点
  const handleAddEndpoint = useCallback(() => {
    const candidate = customUrl.trim();
    let errorMsg: string | null = null;

    if (!candidate) {
      errorMsg = '请输入有效的 URL';
    }

    let parsed: URL | null = null;
    if (!errorMsg) {
      try {
        parsed = new URL(candidate);
      } catch {
        errorMsg = 'URL 格式无效';
      }
    }

    // 只允许 http 和 https
    const allowedProtocols = ['http:', 'https:'];
    if (!errorMsg && parsed && !allowedProtocols.includes(parsed.protocol)) {
      errorMsg = '仅支持 HTTP/HTTPS 协议';
    }

    let sanitized = '';
    if (!errorMsg && parsed) {
      sanitized = normalizeEndpointUrl(parsed.toString());
      // 检查重复
      const isDuplicate = entries.some((entry) => entry.url === sanitized);
      if (isDuplicate) {
        errorMsg = '该端点已存在';
      }
    }

    if (errorMsg) {
      setAddError(errorMsg);
      return;
    }

    setAddError(null);

    // 添加新端点
    setEntries((prev) => {
      if (prev.some((e) => e.url === sanitized)) return prev;
      return [
        ...prev,
        {
          id: randomId(),
          url: sanitized,
          success: false,
          latency_ms: null,
          error: null,
          isCustom: true,
        },
      ];
    });

    // 如果当前没有选中的 URL，自动选中新添加的
    if (!normalizedSelected) {
      onChange(sanitized);
    }

    setCustomUrl('');
  }, [customUrl, entries, normalizedSelected, onChange]);

  // 删除端点
  const handleRemoveEndpoint = useCallback(
    (entry: EndpointEntry) => {
      setEntries((prev) => {
        const next = prev.filter((item) => item.id !== entry.id);

        // 如果删除的是当前选中的，切换到第一个可用端点
        if (entry.url === normalizedSelected) {
          const fallback = next[0];
          onChange(fallback ? fallback.url : '');
        }

        return next;
      });
    },
    [normalizedSelected, onChange],
  );

  // 运行测速
  const runSpeedTest = useCallback(async () => {
    const urls = entries.map((entry) => entry.url);
    if (urls.length === 0) {
      toast.error('请至少添加一个端点');
      return;
    }

    setIsTesting(true);

    // 清空所有延迟数据，显示 loading 状态
    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        latency_ms: null,
        success: false,
        error: null,
      })),
    );

    try {
      const results = await testApiEndpoints(urls, ENDPOINT_TIMEOUT_MS);

      const resultMap = new Map(
        results.map((item) => [normalizeEndpointUrl(item.url), item]),
      );

      setEntries((prev) =>
        prev.map((entry) => {
          const match = resultMap.get(entry.url);
          if (!match) {
            return {
              ...entry,
              latency_ms: null,
              success: false,
              error: '未返回结果',
            };
          }
          return {
            ...entry,
            latency_ms: match.latency_ms,
            success: match.success,
            error: match.error,
          };
        }),
      );

      // 自动选择最快的端点
      if (autoSelect) {
        const successful = results
          .filter((item) => item.success && item.latency_ms !== null)
          .sort((a, b) => (a.latency_ms! || 0) - (b.latency_ms! || 0));

        const best = successful[0];
        if (best && best.url && best.url !== normalizedSelected) {
          onChange(best.url);
          toast.success(`已切换到最快端点 (${best.latency_ms}ms)`);
        }
      }

      toast.success('测速完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`测速失败: ${message}`);
    } finally {
      setIsTesting(false);
    }
  }, [entries, autoSelect, normalizedSelected, onChange]);

  // 选择端点
  const handleSelect = useCallback(
    (url: string) => {
      if (!url || url === normalizedSelected) return;
      onChange(url);
    },
    [normalizedSelected, onChange],
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框内容 */}
      <div className="relative bg-black border-2 border-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-scale-in">
        {/* 头部 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800">
          <h3 className="text-xl font-bold text-yellow-500">
            端点测速
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            测试多个端点的延迟并选择最快的端点
          </p>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* 测速控制栏 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              {entries.length} 个端点
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSelect}
                  onChange={(e) => setAutoSelect(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-2 focus:ring-yellow-500"
                />
                自动选择最快
              </label>
              <button
                type="button"
                onClick={runSpeedTest}
                disabled={isTesting || !hasEndpoints}
                className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-lg transition-colors text-sm flex items-center gap-1.5"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    测速中...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    开始测速
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 添加输入 */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                placeholder="https://api.example.com"
                onChange={(e) => setCustomUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEndpoint();
                  }
                }}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                type="button"
                onClick={handleAddEndpoint}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {addError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {addError}
              </div>
            )}
          </div>

          {/* 端点列表 */}
          {hasEndpoints ? (
            <div className="space-y-2">
              {sortedEntries.map((entry) => {
                const isSelected = normalizedSelected === entry.url;
                const latency = entry.latency_ms;
                const hasResult = latency !== null;

                return (
                  <div
                    key={entry.id}
                    onClick={() => handleSelect(entry.url)}
                    className={`group flex cursor-pointer items-center justify-between px-3 py-2.5 rounded-lg border transition ${
                      isSelected
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {/* 选择指示器 */}
                      <div
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full transition ${
                          isSelected ? 'bg-yellow-500' : 'bg-gray-600'
                        }`}
                      />

                      {/* 内容 */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-white">
                          {entry.url}
                        </div>
                        {entry.error && (
                          <div className="text-xs text-red-400 mt-0.5">
                            {entry.error}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧信息 */}
                    <div className="flex items-center gap-2">
                      {hasResult ? (
                        <div className="text-right">
                          <div
                            className={`font-mono text-sm font-medium ${
                              latency < 300
                                ? 'text-green-400'
                                : latency < 500
                                  ? 'text-yellow-400'
                                  : latency < 800
                                    ? 'text-orange-400'
                                    : 'text-red-400'
                            }`}
                          >
                            {latency}ms
                          </div>
                        </div>
                      ) : isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : entry.error ? (
                        <div className="text-xs text-gray-500">失败</div>
                      ) : (
                        <div className="text-xs text-gray-500">—</div>
                      )}

                      {entry.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveEndpoint(entry);
                          }}
                          className="opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900 py-8 text-center text-sm text-gray-500">
              暂无端点，请添加端点进行测速
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors"
          >
            完成
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
