/**
 * 快捷操作面板组件
 * 提供快速切换分组和配置的功能
 */

import React from 'react';
import type { ProxyService, ConfigGroup, ApiConfig } from '../types/tauri';
import { formatDisplayUrl } from '../utils/url';

interface QuickActionsPanelProps {
  /** 代理服务状态 */
  proxyStatus: ProxyService | null;
  /** 分组列表 */
  groups: ConfigGroup[];
  /** 配置列表 */
  configs: ApiConfig[];
  /** 切换分组回调 */
  onSwitchGroup: (groupId: number) => void;
  /** 切换配置回调 */
  onSwitchConfig: (configId: number) => void;
  /** 切换自动切换回调 */
  onToggleAutoSwitch?: (groupId: number, enabled: boolean) => void;
  /** 是否正在执行操作 */
  actionLoading?: boolean;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  proxyStatus,
  groups,
  configs,
  onSwitchGroup,
  onSwitchConfig,
  onToggleAutoSwitch,
  actionLoading = false,
}) => {
  // 处理自动切换开关
  const handleAutoSwitchToggle = (e: React.MouseEvent, groupId: number, currentState: boolean) => {
    e.stopPropagation(); // 防止触发分组切换
    if (onToggleAutoSwitch) {
      onToggleAutoSwitch(groupId, !currentState);
    }
  };
  // 过滤当前分组的配置
  // 注意: active_group_id 可能是 0（未分组），不能用 truthy 判断
  const currentGroupConfigs = proxyStatus && proxyStatus.active_group_id !== null && proxyStatus.active_group_id !== undefined
    ? configs.filter((c) => c.group_id === proxyStatus.active_group_id)
    : [];

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 切换分组 */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-amber-500/30 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-500/10 rounded-lg">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-400">分组管理</h3>
              <p className="text-xs text-gray-400">快速切换配置分组</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            <span className="text-xs font-medium text-gray-400">{groups.length} 个</span>
          </div>
        </div>

        <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar">
          {groups.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-gray-400 text-sm font-medium mb-1">暂无分组</p>
              <p className="text-gray-500 text-xs">
                请在"配置管理"页面创建分组
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const isActive = proxyStatus?.active_group_id === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => onSwitchGroup(group.id)}
                  disabled={actionLoading || isActive}
                  className={`w-full px-4 py-3.5 text-left rounded-lg border transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-gradient-to-br from-gray-800 to-gray-800/50 border-gray-700 hover:from-gray-700 hover:to-gray-700/50 hover:border-amber-500/50 hover:shadow-md'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {group.auto_switch_enabled && (
                        <div className="flex items-center justify-center w-6 h-6 bg-yellow-400/20 rounded" title="自动切换已启用">
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <span className={`font-semibold ${isActive ? 'text-amber-400' : 'text-gray-200'}`}>
                        {group.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="text-xs bg-amber-500 text-black px-2.5 py-0.5 rounded-full font-medium">
                          活跃
                        </span>
                      )}
                    </div>
                  </div>
                  {group.description && (
                    <div className={`text-xs mb-2 line-clamp-2 ${isActive ? 'text-amber-400/70' : 'text-gray-400'}`}>
                      {group.description}
                    </div>
                  )}
                  {/* 自动切换开关 */}
                  {onToggleAutoSwitch && (
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium text-gray-400">智能切换</span>
                      </div>
                      <label
                        className="relative inline-flex items-center cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={group.auto_switch_enabled}
                          onChange={(e) => handleAutoSwitchToggle(e as any, group.id, group.auto_switch_enabled)}
                          className="sr-only peer"
                          disabled={actionLoading}
                        />
                        <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-green-400"></div>
                      </label>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 切换配置 */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-amber-500/30 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-500/10 rounded-lg">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-400">配置切换</h3>
              <p className="text-xs text-gray-400">选择API配置端点</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-gray-400">{currentGroupConfigs.length} 个</span>
          </div>
        </div>

        <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar">
          {!proxyStatus || proxyStatus.active_group_id === null || proxyStatus.active_group_id === undefined ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-sm font-medium mb-1">请先选择分组</p>
              <p className="text-gray-500 text-xs">
                在左侧选择一个配置分组
              </p>
            </div>
          ) : currentGroupConfigs.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-gray-400 text-sm font-medium mb-1">当前分组无配置</p>
              <p className="text-gray-500 text-xs">
                请在"配置管理"页面添加配置
              </p>
            </div>
          ) : (
            currentGroupConfigs.map((config) => {
              const isActive = proxyStatus?.active_config_id === config.id;
              const latencyColor = config.last_latency_ms !== null
                ? config.last_latency_ms < 100
                  ? 'text-green-400'
                  : config.last_latency_ms < 300
                  ? 'text-yellow-400'
                  : 'text-red-400'
                : 'text-gray-500';

              return (
                <button
                  key={config.id}
                  onClick={() => onSwitchConfig(config.id)}
                  disabled={
                    actionLoading ||
                    !config.is_available ||
                    isActive
                  }
                  className={`w-full px-4 py-3.5 text-left rounded-lg border transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                      : config.is_available
                      ? 'bg-gradient-to-br from-gray-800 to-gray-800/50 border-gray-700 hover:from-gray-700 hover:to-gray-700/50 hover:border-amber-500/50 hover:shadow-md'
                      : 'bg-gradient-to-br from-gray-800/30 to-gray-800/20 border-gray-700/50 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-semibold truncate ${isActive ? 'text-amber-400' : config.is_available ? 'text-gray-200' : 'text-gray-500'}`}>
                      {config.name}
                    </span>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {isActive && (
                        <span className="text-xs bg-amber-500 text-black px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                          活跃
                        </span>
                      )}
                      {config.is_available ? (
                        <div className="flex items-center gap-1 text-xs text-green-400 whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>可用</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-red-400 whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span>不可用</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-xs font-mono truncate mb-2 flex items-center gap-2 ${isActive ? 'text-amber-400/70' : 'text-gray-400'}`}>
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="truncate">{formatDisplayUrl(config.server_url)}</span>
                  </div>
                  {config.last_latency_ms !== null && (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-700/50">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className={`text-xs font-medium ${latencyColor}`}>
                          {config.last_latency_ms}ms
                        </span>
                      </div>
                      {config.last_test_at && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs text-gray-500">
                            {new Date(config.last_test_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
