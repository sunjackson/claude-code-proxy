/**
 * Node 多环境展示组件
 * 用于展示所有检测到的 Node 环境和 Claude Code 安装状态
 */

import React, { useState, useCallback } from 'react';
import type { NodeEnvironment, NodeVersionManager, EnhancedEnvironmentStatus } from '../types/tauri';
import { setDefaultNodeEnvironment } from '../api/setup';

interface NodeEnvironmentListProps {
  /** 增强的环境状态 */
  envStatus: EnhancedEnvironmentStatus;
  /** 刷新回调 */
  onRefresh?: () => void;
  /** 选择默认环境后的回调 */
  onDefaultChanged?: (envId: string) => void;
  /** 是否显示为紧凑模式 */
  compact?: boolean;
}

/**
 * 获取版本管理器的显示名称
 */
const getManagerDisplayName = (manager: NodeVersionManager): string => {
  const names: Record<NodeVersionManager, string> = {
    System: '系统',
    NVM: 'NVM',
    FNM: 'FNM',
    Volta: 'Volta',
    ASDF: 'asdf',
    N: 'n',
    NVMWindows: 'NVM-Win',
    Unknown: '未知',
  };
  return names[manager] || manager;
};

/**
 * 获取版本管理器的图标/徽章颜色
 */
const getManagerBadgeClass = (manager: NodeVersionManager): string => {
  const classes: Record<NodeVersionManager, string> = {
    System: 'bg-gray-600 text-gray-200',
    NVM: 'bg-green-600 text-green-100',
    FNM: 'bg-blue-600 text-blue-100',
    Volta: 'bg-purple-600 text-purple-100',
    ASDF: 'bg-orange-600 text-orange-100',
    N: 'bg-cyan-600 text-cyan-100',
    NVMWindows: 'bg-green-700 text-green-100',
    Unknown: 'bg-gray-700 text-gray-300',
  };
  return classes[manager] || 'bg-gray-600 text-gray-200';
};

export const NodeEnvironmentList: React.FC<NodeEnvironmentListProps> = ({
  envStatus,
  onRefresh,
  onDefaultChanged,
  compact = false,
}) => {
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const environments = envStatus.node_environments;
  const defaultEnvId = envStatus.default_environment_id;

  // 按版本管理器分组
  const groupedEnvs = environments.reduce((acc, env) => {
    const manager = env.manager;
    if (!acc[manager]) {
      acc[manager] = [];
    }
    acc[manager].push(env);
    return acc;
  }, {} as Record<NodeVersionManager, NodeEnvironment[]>);

  // 对每组内的环境按版本号降序排列
  Object.keys(groupedEnvs).forEach((manager) => {
    groupedEnvs[manager as NodeVersionManager].sort((a, b) => b.major_version - a.major_version);
  });

  // 处理设置默认环境
  const handleSetDefault = useCallback(async (env: NodeEnvironment) => {
    if (settingDefault) return;

    setSettingDefault(env.id);
    setError(null);

    try {
      await setDefaultNodeEnvironment(
        env.id,
        env.node_path,
        env.version,
        env.manager
      );
      onDefaultChanged?.(env.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置默认环境失败');
    } finally {
      setSettingDefault(null);
    }
  }, [settingDefault, onDefaultChanged]);

  // 统计信息
  const totalEnvs = environments.length;
  const claudeInstalledCount = environments.filter(e => e.claude_info).length;
  const meetsRequirementCount = environments.filter(e => e.meets_requirement).length;

  if (totalEnvs === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold">未检测到 Node.js 环境</p>
          <p className="text-sm mt-1">请安装 Node.js 或版本管理器 (NVM/FNM/Volta)</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg border border-yellow-500/30 transition-colors"
          >
            重新检测
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计摘要 */}
      <div className="flex items-center justify-between bg-gray-900/50 border border-gray-700 rounded-lg p-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            检测到 <span className="text-yellow-400 font-semibold">{totalEnvs}</span> 个环境
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">
            <span className="text-green-400 font-semibold">{claudeInstalledCount}</span> 个已安装 Claude
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">
            <span className="text-blue-400 font-semibold">{meetsRequirementCount}</span> 个满足要求
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors group"
            title="刷新检测"
          >
            <svg className="w-4 h-4 text-gray-400 group-hover:text-yellow-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 环境列表 - 按管理器分组 */}
      <div className="space-y-3">
        {Object.entries(groupedEnvs).map(([manager, envs]) => (
          <div key={manager} className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden">
            {/* 分组标题 */}
            <div className="bg-gray-800/50 px-4 py-2 flex items-center gap-2 border-b border-gray-800">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getManagerBadgeClass(manager as NodeVersionManager)}`}>
                {getManagerDisplayName(manager as NodeVersionManager)}
              </span>
              <span className="text-gray-500 text-xs">
                {envs.length} 个版本
              </span>
            </div>

            {/* 环境卡片列表 */}
            <div className={compact ? 'divide-y divide-gray-800' : 'p-2 space-y-2'}>
              {envs.map((env) => (
                <EnvironmentCard
                  key={env.id}
                  env={env}
                  isDefault={env.id === defaultEnvId}
                  isSettingDefault={settingDefault === env.id}
                  onSetDefault={() => handleSetDefault(env)}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 检测时间 */}
      <div className="text-xs text-gray-500 text-center">
        检测于 {new Date(envStatus.detected_at).toLocaleString()}
        <span className="text-gray-600 ml-2">
          (耗时 {envStatus.detection_duration_ms}ms)
        </span>
      </div>
    </div>
  );
};

// 单个环境卡片组件
interface EnvironmentCardProps {
  env: NodeEnvironment;
  isDefault: boolean;
  isSettingDefault: boolean;
  onSetDefault: () => void;
  compact?: boolean;
}

const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  env,
  isDefault,
  isSettingDefault,
  onSetDefault,
  compact = false,
}) => {
  const hasClaudeCode = !!env.claude_info;
  const meetsReq = env.meets_requirement;

  if (compact) {
    // 紧凑模式 - 单行显示
    return (
      <div className={`px-4 py-2 flex items-center gap-3 ${isDefault ? 'bg-yellow-500/10' : 'hover:bg-gray-800/50'} transition-colors`}>
        {/* 版本号 */}
        <span className={`font-mono font-semibold ${meetsReq ? 'text-white' : 'text-gray-500'}`}>
          v{env.version}
        </span>

        {/* 状态徽章 */}
        <div className="flex items-center gap-2">
          {!meetsReq && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded border border-red-500/30">
              Node &lt; 18
            </span>
          )}
          {hasClaudeCode && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
              Claude {env.claude_info?.version}
            </span>
          )}
          {isDefault && (
            <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
              默认
            </span>
          )}
        </div>

        {/* 设为默认按钮 */}
        <div className="ml-auto">
          {!isDefault && meetsReq && (
            <button
              onClick={onSetDefault}
              disabled={isSettingDefault}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50"
            >
              {isSettingDefault ? '...' : '设为默认'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 标准模式 - 卡片显示
  return (
    <div className={`p-3 rounded-lg border ${isDefault ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'} transition-colors`}>
      <div className="flex items-start justify-between">
        {/* 左侧：版本信息 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-lg font-bold ${meetsReq ? 'text-white' : 'text-gray-500'}`}>
              v{env.version}
            </span>
            {!meetsReq && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded border border-red-500/30">
                不满足要求 (Node &lt; 18)
              </span>
            )}
            {isDefault && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 font-semibold">
                默认环境
              </span>
            )}
          </div>

          {/* 路径信息 */}
          <p className="text-xs text-gray-500 font-mono truncate max-w-md" title={env.node_path}>
            {env.node_path}
          </p>

          {/* Claude Code 信息 */}
          {hasClaudeCode && (
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30">
                Claude Code v{env.claude_info?.version}
              </span>
              <span className="text-xs text-gray-500 font-mono truncate" title={env.claude_info?.path}>
                {env.claude_info?.path}
              </span>
            </div>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2 ml-3">
          {!isDefault && meetsReq && (
            <button
              onClick={onSetDefault}
              disabled={isSettingDefault}
              className="px-3 py-1.5 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg border border-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSettingDefault ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  设置中
                </span>
              ) : (
                '设为默认'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeEnvironmentList;
