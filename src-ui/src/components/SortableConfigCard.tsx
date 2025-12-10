/**
 * 可拖拽排序的配置卡片组件
 * 重新设计：左侧明显的拖拽区域 + 右侧配置信息
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApiConfig, ConfigGroup } from '../types/tauri';
import { categoryLabels, categoryColors, type ProviderCategory } from '../config/providerPresets';
import { formatDisplayUrl } from '../utils/url';

interface SortableConfigCardProps {
  config: ApiConfig;
  groups: ConfigGroup[];
  displayOrder: number;
  isActive: boolean;
  isProxyRunning: boolean;
  isJustSwitchedTarget: boolean;
  isJustSwitchedSource: boolean;
  switchReason: string | null;
  testingConfigId: number | null;
  queryingBalanceId: number | null;
  actionLoading: boolean;
  togglingEnabledId: number | null;
  onSwitchConfig: (configId: number) => void;
  onTestConfig: (config: ApiConfig) => void;
  onQueryBalance: (config: ApiConfig) => void;
  onEditConfig: (config: ApiConfig) => void;
  onDeleteConfig: (config: ApiConfig) => void;
  onToggleEnabled: (config: ApiConfig, enabled: boolean) => void;
}

/**
 * 获取切换原因的中文文本
 */
function getReasonText(reason: string): string {
  switch (reason) {
    case 'connection_failed':
      return '连接失败';
    case 'timeout':
      return '请求超时';
    case 'quota_exceeded':
      return 'API配额耗尽';
    case 'high_latency':
      return '高延迟';
    case 'manual':
      return '手动切换';
    case 'retry_failed':
      return '重试失败';
    case 'unrecoverable_error':
      return '不可恢复错误';
    case 'rate_limit_exceeded':
      return '限流超限';
    default:
      return '未知原因';
  }
}

export const SortableConfigCard: React.FC<SortableConfigCardProps> = ({
  config,
  groups,
  displayOrder,
  isActive,
  isProxyRunning,
  isJustSwitchedTarget,
  isJustSwitchedSource,
  switchReason,
  testingConfigId,
  queryingBalanceId,
  actionLoading,
  togglingEnabledId,
  onSwitchConfig,
  onTestConfig,
  onQueryBalance,
  onEditConfig,
  onDeleteConfig,
  onToggleEnabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 判断是否可以点击切换：不是当前活跃配置、配置启用且在线、非加载状态
  const canClickToSwitch = !isActive && config.is_enabled && config.is_available && !actionLoading;

  // 判断配置是否处于禁用状态（用于视觉提示）
  const isDisabled = !config.is_enabled;

  // 处理卡片点击
  const handleCardClick = () => {
    if (canClickToSwitch) {
      onSwitchConfig(config.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex rounded-xl overflow-hidden transition-all duration-300 ${
        isDragging
          ? 'opacity-50 shadow-2xl shadow-yellow-500/30 scale-[1.02] z-50'
          : ''
      } ${
        isActive
          ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-black'
          : ''
      } ${
        isJustSwitchedTarget ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-black animate-pulse' : ''
      } ${
        isJustSwitchedSource ? 'opacity-60' : ''
      } ${
        isDisabled ? 'opacity-50' : ''
      }`}
    >
      {/* ========== 左侧内容区域 ========== */}
      <div
        onClick={handleCardClick}
        className={`flex-1 p-4 transition-colors ${
          isActive
            ? 'bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent border-y border-l border-yellow-500/40'
            : isJustSwitchedSource
            ? 'bg-gray-900/30 border-y border-l border-red-500/30'
            : 'bg-gray-900/50 border-y border-l border-gray-800 hover:bg-gray-900/70'
        } ${
          canClickToSwitch ? 'cursor-pointer' : ''
        }`}
        title={canClickToSwitch ? '点击切换到此配置' : (config.is_available ? '' : '配置离线，无法切换')}
      >
        {/* 切换状态指示器 */}
        {(isJustSwitchedTarget || isJustSwitchedSource) && (
          <div className="flex items-center gap-2 mb-3">
            {isJustSwitchedTarget && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
                <svg className="w-3.5 h-3.5 text-yellow-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-bold text-yellow-400">已切换至此</span>
                {switchReason && (
                  <span className="text-xs text-yellow-500/70">· {getReasonText(switchReason)}</span>
                )}
              </div>
            )}
            {isJustSwitchedSource && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-xs font-medium text-red-400">已切换离开</span>
              </div>
            )}
          </div>
        )}

        {/* 第一行：名称 + 状态标签 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 配置名称 */}
            <h3 className={`text-base font-bold ${
              isActive ? 'text-yellow-400' : isJustSwitchedSource ? 'text-gray-500' : 'text-white'
            }`}>
              {config.name}
            </h3>

            {/* 活跃标签 */}
            {isActive && (
              <span className={`px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full ${
                isJustSwitchedTarget ? 'animate-pulse' : ''
              }`}>
                当前使用
              </span>
            )}

            {/* 在线状态 */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              config.is_available
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                config.is_available ? 'bg-green-400' : 'bg-red-400'
              }`} />
              {config.is_available ? '在线' : '离线'}
            </div>

            {/* 启用/停用开关 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled(config, !config.is_enabled);
              }}
              disabled={togglingEnabledId === config.id || isActive}
              title={isActive ? '当前使用中的配置无法停用' : (config.is_enabled ? '点击停用此配置' : '点击启用此配置')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                togglingEnabledId === config.id ? 'opacity-50 cursor-wait' :
                isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${
                config.is_enabled
                  ? 'bg-green-500'
                  : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  config.is_enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>

            {/* 分类标签 */}
            {config.category && config.category !== 'custom' && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                categoryColors[config.category as ProviderCategory]?.bg || 'bg-gray-500/20'
              } ${categoryColors[config.category as ProviderCategory]?.text || 'text-gray-400'}`}>
                {categoryLabels[config.category as ProviderCategory] || config.category}
              </span>
            )}

            {/* 延迟显示 */}
            {config.last_latency_ms !== null && config.last_latency_ms !== undefined && (
              <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${
                config.last_latency_ms < 200 ? 'bg-green-500/20 text-green-400' :
                config.last_latency_ms < 500 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {config.last_latency_ms}ms
              </span>
            )}

            {/* 权重分数显示 */}
            {config.weight_score !== null && config.weight_score !== undefined && (
              <span
                className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${
                  config.weight_score >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' :
                  config.weight_score >= 0.4 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-rose-500/20 text-rose-400'
                }`}
                title={`权重分数：${(config.weight_score * 100).toFixed(1)}%\n连续失败：${config.consecutive_failures}次${config.last_success_time ? '\n上次成功：' + new Date(config.last_success_time).toLocaleString() : ''}`}
              >
                ⚖ {(config.weight_score * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* 操作按钮组 */}
          <div className="flex items-center gap-1.5">
            {/* 切换按钮 - 只在代理运行时且配置启用时显示 */}
            {isProxyRunning && !isActive && config.is_enabled && (
              <button
                className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-lg ${
                  config.is_available
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/20'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (config.is_available) {
                    onSwitchConfig(config.id);
                  }
                }}
                disabled={actionLoading || !config.is_available}
                title={!config.is_available ? '配置离线，无法切换' : '切换到此配置'}
              >
                切换到此
              </button>
            )}

            <button
              className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                testingConfigId === config.id
                  ? 'bg-blue-500/30 text-blue-300 cursor-wait'
                  : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onTestConfig(config);
              }}
              disabled={testingConfigId !== null}
            >
              {testingConfigId === config.id ? '测试中...' : '测试'}
            </button>

            {config.balance_query_url && config.auto_balance_check && (
              <button
                className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                  queryingBalanceId === config.id
                    ? 'bg-emerald-500/30 text-emerald-300 cursor-wait'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onQueryBalance(config);
                }}
                disabled={queryingBalanceId !== null}
              >
                {queryingBalanceId === config.id ? '查询中...' : '余额'}
              </button>
            )}

            <button
              className="px-2.5 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all text-xs font-semibold border border-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                onEditConfig(config);
              }}
            >
              编辑
            </button>

            <button
              className="px-2.5 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-xs font-semibold border border-red-500/30"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConfig(config);
              }}
            >
              删除
            </button>
          </div>
        </div>

        {/* 第二行：关键信息 */}
        <div className="flex items-center gap-4 text-xs">
          {/* 服务器地址 */}
          <div className="flex items-center gap-1.5 text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className="font-mono text-gray-400">{formatDisplayUrl(config.server_url)}</span>
          </div>

          {/* 分组 */}
          <div className="flex items-center gap-1.5 text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-gray-400">{groups.find((g) => g.id === config.group_id)?.name || '未分组'}</span>
          </div>

          {/* 余额 */}
          {config.last_balance !== null && config.last_balance !== undefined && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`font-mono font-bold ${
                config.last_balance >= 10 ? 'text-green-400' :
                config.last_balance >= 1 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {config.balance_currency === 'CNY' ? '¥' : config.balance_currency === 'USD' ? '$' : ''}
                {config.last_balance.toFixed(2)}
              </span>
            </div>
          )}

          {/* 默认模型 */}
          {config.default_model && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-purple-400">{config.default_model}</span>
            </div>
          )}

          {/* 连续失败次数警告 */}
          {config.consecutive_failures > 0 && (
            <div className={`flex items-center gap-1.5 ${
              config.consecutive_failures >= 3 ? 'text-red-400' : 'text-amber-400'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium text-xs">
                连续失败 {config.consecutive_failures} 次
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========== 右侧拖拽区域 ========== */}
      <div
        {...attributes}
        {...listeners}
        className={`flex flex-col items-center justify-center w-12 flex-shrink-0 cursor-grab active:cursor-grabbing select-none transition-colors ${
          isActive
            ? 'bg-yellow-500/30 hover:bg-yellow-500/40'
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
        title="拖拽调整优先级顺序"
      >
        {/* 排序序号 */}
        <span className={`text-lg font-black mb-1 ${
          isActive ? 'text-yellow-400' : 'text-gray-400'
        }`}>
          {displayOrder}
        </span>

        {/* 拖拽图标 */}
        <svg className={`w-5 h-5 ${isActive ? 'text-yellow-500/70' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
    </div>
  );
};
