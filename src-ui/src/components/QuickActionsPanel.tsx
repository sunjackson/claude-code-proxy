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
  const currentGroupConfigs = proxyStatus?.active_group_id
    ? configs.filter((c) => c.group_id === proxyStatus.active_group_id)
    : [];

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 切换分组 */}
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-amber-400">切换分组</h3>
          <span className="text-xs text-gray-400">{groups.length} 个分组</span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {groups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">暂无分组</p>
              <p className="text-gray-500 text-xs mt-2">
                请在配置管理页面创建分组
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
                  className={`w-full px-4 py-3 text-left rounded-lg border transition-all ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-amber-500/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {group.auto_switch_enabled && (
                        <span className="text-yellow-400 text-base" title="自动切换已启用">⚡</span>
                      )}
                      <span className="font-medium">{group.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full">
                          当前
                        </span>
                      )}
                    </div>
                  </div>
                  {group.description && (
                    <div className="text-xs text-gray-400 mb-2 line-clamp-2">
                      {group.description}
                    </div>
                  )}
                  {/* 自动切换开关 */}
                  {onToggleAutoSwitch && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                      <span className="text-xs text-gray-400">自动切换</span>
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
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
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
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-amber-400">切换配置</h3>
          <span className="text-xs text-gray-400">
            {currentGroupConfigs.length} 个配置
          </span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {!proxyStatus?.active_group_id ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">请先选择分组</p>
            </div>
          ) : currentGroupConfigs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">当前分组无配置</p>
              <p className="text-gray-500 text-xs mt-2">
                请在配置管理页面添加配置
              </p>
            </div>
          ) : (
            currentGroupConfigs.map((config) => {
              const isActive = proxyStatus?.active_config_id === config.id;
              return (
                <button
                  key={config.id}
                  onClick={() => onSwitchConfig(config.id)}
                  disabled={
                    actionLoading ||
                    !config.is_available ||
                    isActive
                  }
                  className={`w-full px-4 py-3 text-left rounded-lg border transition-all ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg'
                      : config.is_available
                      ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-amber-500/50'
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{config.name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      {isActive && (
                        <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full whitespace-nowrap">
                          当前
                        </span>
                      )}
                      {config.is_available ? (
                        <span className="text-xs text-green-400 whitespace-nowrap">✓ 可用</span>
                      ) : (
                        <span className="text-xs text-red-400 whitespace-nowrap">✗ 不可用</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 font-mono truncate">
                    {formatDisplayUrl(config.server_url)}
                  </div>
                  {config.last_latency_ms !== null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs ${
                          config.last_latency_ms < 100
                            ? 'text-green-400'
                            : config.last_latency_ms < 300
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        延迟: {config.last_latency_ms}ms
                      </span>
                      {config.last_test_at && (
                        <span className="text-xs text-gray-500">
                          测试于 {new Date(config.last_test_at).toLocaleTimeString('zh-CN')}
                        </span>
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
