/**
 * Dashboard 页面
 * 显示代理服务状态和快捷操作
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProxyService, ConfigGroup, ApiConfig, SwitchLog, ProxyConfig } from '../types/tauri';
import * as proxyApi from '../api/proxy';
import * as configApi from '../api/config';
import * as claudeCodeApi from '../api/claude-code';
import { CompactLayout } from '../components/CompactLayout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAutoSwitch } from '../hooks/useAutoSwitch';
import { showSuccess, showError } from '../services/toast';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // 状态管理
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [recentLogs, setRecentLogs] = useState<SwitchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Claude Code 配置状态
  const [claudeCodeProxyConfig, setClaudeCodeProxyConfig] = useState<ProxyConfig | null>(null);

  // 清空日志确认对话框状态
  const [showClearLogsDialog, setShowClearLogsDialog] = useState(false);

  // 监听自动切换事件
  useAutoSwitch((event) => {
    // 当发生自动切换时,重新加载数据以更新UI
    console.log('Auto-switch event received:', event);
    loadData();
  });

  // 加载数据
  useEffect(() => {
    loadData();
    loadClaudeCodeConfig();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行加载代理状态、分组、配置和最近日志
      const [status, groupsList, configsList, logs] = await Promise.all([
        proxyApi.getProxyStatus(),
        configApi.listConfigGroups(),
        configApi.listApiConfigs(null),
        proxyApi.getSwitchLogs(undefined, 5, 0), // 获取最近5条日志
      ]);

      setProxyStatus(status);
      setGroups(groupsList);
      setConfigs(configsList);
      setRecentLogs(logs);

      // 如果没有活跃的分组，自动选择第一个有配置的分组
      // 注意: active_group_id 可能是 0（未分组），需要明确检查 null/undefined
      if ((status.active_group_id === null || status.active_group_id === undefined) && groupsList.length > 0 && configsList.length > 0) {
        // 找到第一个有配置的分组
        const firstGroupWithConfigs = groupsList.find(group =>
          configsList.some(config => config.group_id === group.id)
        );

        if (firstGroupWithConfigs) {
          console.log('自动选择第一个有配置的分组:', firstGroupWithConfigs.name);
          // 自动切换到该分组
          try {
            const newStatus = await proxyApi.switchProxyGroup(firstGroupWithConfigs.id);
            setProxyStatus(newStatus);
          } catch (err) {
            console.error('自动选择分组失败:', err);
            // 失败不影响页面显示，只记录日志
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载Claude Code配置
  const loadClaudeCodeConfig = async () => {
    try {
      const config = await claudeCodeApi.getClaudeCodeProxy();
      setClaudeCodeProxyConfig(config);
    } catch (err) {
      // Claude Code未配置是正常情况，不需要报错
      console.log('Claude Code proxy not configured:', err);
      setClaudeCodeProxyConfig(null);
    }
  };

  // 启动代理服务并自动配置 Claude Code
  const handleStartProxy = async () => {
    try {
      setActionLoading(true);
      setError(null);

      // 1. 启动代理服务
      const status = await proxyApi.startProxyService();
      setProxyStatus(status);

      // 2. 自动配置 Claude Code 代理
      try {
        const host = status.listen_host || '127.0.0.1';
        const port = status.listen_port || 25341;
        await claudeCodeApi.enableClaudeCodeProxy(host, port);
        await loadClaudeCodeConfig();
        showSuccess(`代理服务已启动并配置到 Claude Code (${host}:${port})`);
      } catch (claudeErr) {
        // Claude Code 配置失败不影响代理服务运行
        console.warn('Failed to configure Claude Code proxy:', claudeErr);
        showSuccess('代理服务已启动，但 Claude Code 配置失败，请手动配置');
      }
    } catch (err: any) {
      console.error('Failed to start proxy:', err);

      // 解析错误信息
      let errorMessage = '启动代理服务失败';

      if (err && typeof err === 'object') {
        if (err.error === 'NoConfigAvailable') {
          errorMessage = '当前分组中没有可用的配置。请先在"配置管理"页面添加或启用配置。';
        } else if (err.error === 'EmptyGroup') {
          errorMessage = '当前分组为空。请先在"配置管理"页面添加配置。';
        } else if (err.error === 'PortInUse') {
          errorMessage = '代理端口已被占用。请检查是否有其他程序使用了该端口，或修改代理配置的端口号。';
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // 停止代理服务并恢复 Claude Code 配置
  const handleStopProxy = async () => {
    try {
      setActionLoading(true);
      setError(null);

      // 1. 如果 Claude Code 配置了代理，先移除配置
      if (claudeCodeProxyConfig) {
        try {
          await claudeCodeApi.disableClaudeCodeProxy();
          await loadClaudeCodeConfig();
        } catch (claudeErr) {
          // 恢复配置失败不影响代理服务停止
          console.warn('Failed to disable Claude Code proxy:', claudeErr);
        }
      }

      // 2. 停止代理服务
      const status = await proxyApi.stopProxyService();
      setProxyStatus(status);
      showSuccess('代理服务已停止，Claude Code 配置已恢复');
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止代理服务失败');
      console.error('Failed to stop proxy:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 切换分组
  const handleSwitchGroup = async (groupId: number) => {
    try {
      setActionLoading(true);
      setError(null);
      const status = await proxyApi.switchProxyGroup(groupId);
      setProxyStatus(status);
    } catch (err: any) {
      console.error('Failed to switch group:', err);

      // 解析错误信息
      let errorMessage = '切换分组失败';

      if (err && typeof err === 'object') {
        if (err.error === 'NoConfigAvailable') {
          errorMessage = '该分组中没有可用的配置。请先在"配置管理"页面添加或启用配置。';
        } else if (err.error === 'EmptyGroup') {
          errorMessage = '该分组为空。请先在"配置管理"页面添加配置。';
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // 切换配置
  const handleSwitchConfig = async (configId: number) => {
    try {
      setActionLoading(true);
      setError(null);
      const status = await proxyApi.switchProxyConfig(configId);
      setProxyStatus(status);
    } catch (err: any) {
      console.error('Failed to switch config:', err);

      // 解析错误信息
      let errorMessage = '切换配置失败';

      if (err && typeof err === 'object') {
        if (err.error === 'ConfigUnavailable') {
          errorMessage = '该配置不可用。请先在"配置管理"页面启用该配置。';
        } else if (err.error === 'ConfigNotInGroup') {
          errorMessage = '该配置不属于当前分组。请先切换到对应的分组。';
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // 刷新状态
  const handleRefreshStatus = async () => {
    try {
      setActionLoading(true);
      const status = await proxyApi.getProxyStatus();
      setProxyStatus(status);
    } catch (err) {
      console.error('Failed to refresh status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 切换自动切换
  const handleToggleAutoSwitch = async (groupId: number, enabled: boolean) => {
    try {
      setActionLoading(true);
      setError(null);
      await proxyApi.toggleAutoSwitch(groupId, enabled);
      // 重新加载数据以更新UI
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换自动切换失败');
      console.error('Failed to toggle auto switch:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 清空切换日志
  const handleClearLogs = async () => {
    try {
      setActionLoading(true);
      setShowClearLogsDialog(false);
      const deletedCount = await proxyApi.clearSwitchLogs();
      showSuccess(`已清空 ${deletedCount} 条切换日志`);
      // 重新加载数据以更新UI
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : '清空日志失败';
      showError(message);
      console.error('Failed to clear logs:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 获取当前分组的配置列表
  const currentGroupConfigs = configs.filter(
    config => config.group_id === proxyStatus?.active_group_id
  );

  // 获取当前分组
  const currentGroup = groups.find(g => g.id === proxyStatus?.active_group_id);

  // 获取信号图标和颜色（基于延迟）
  const getSignalIcon = (latency?: number | null): { icon: JSX.Element; color: string; label: string } => {
    if (!latency || latency <= 0) {
      // 离线
      return {
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
          </svg>
        ),
        color: 'text-gray-500',
        label: '离线'
      };
    }

    if (latency < 1000) {
      // 蓝色 - 低延迟 (满信号)
      return {
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
          </svg>
        ),
        color: 'text-blue-400',
        label: '优秀'
      };
    }

    if (latency < 3000) {
      // 橙色 - 中等延迟 (中等信号)
      return {
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" opacity="0.3"/>
            <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13zm4 4l3 3 3-3c-1.65-1.66-4.34-1.66-6 0z"/>
          </svg>
        ),
        color: 'text-orange-400',
        label: '一般'
      };
    }

    // 红色 - 高延迟 (弱信号)
    return {
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" opacity="0.15"/>
          <path d="M9 17l3 3 3-3c-1.65-1.66-4.34-1.66-6 0z"/>
        </svg>
      ),
      color: 'text-red-400',
      label: '较差'
    };
  };

  if (loading) {
    return (
      <CompactLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">加载中...</div>
        </div>
      </CompactLayout>
    );
  }

  return (
    <CompactLayout>
      <div className="space-y-6">
        {/* 错误提示 */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-400 mb-1">操作失败</p>
                <p className="text-sm text-red-400/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 服务状态卡片 - 简洁版 */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-5 shadow-lg shadow-yellow-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                proxyStatus?.status === 'running'
                  ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50'
                  : 'bg-gray-500'
              }`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-yellow-400">
                    {proxyStatus?.status === 'running' ? '运行中' : '已停止'}
                  </span>
                  {proxyStatus?.active_config_name && proxyStatus?.status === 'running' && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-sm text-gray-300">{proxyStatus.active_config_name}</span>
                    </>
                  )}
                </div>
                {proxyStatus?.status === 'running' && (
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">
                    {proxyStatus.listen_host}:{proxyStatus.listen_port}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshStatus}
                disabled={actionLoading}
                className="w-9 h-9 flex items-center justify-center bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-yellow-500/50 hover:text-yellow-400 disabled:opacity-50 rounded transition-all"
                title="刷新"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {proxyStatus?.status === 'running' ? (
                <button
                  onClick={handleStopProxy}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 hover:border-red-600/50 disabled:opacity-50 rounded transition-all font-medium text-sm"
                >
                  停止
                </button>
              ) : (
                <button
                  onClick={handleStartProxy}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold rounded transition-all shadow-lg shadow-yellow-500/30 disabled:opacity-50 text-sm"
                >
                  启动
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 快速切换区域 - 紧凑版 */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/5">
          <div className="grid grid-cols-2 gap-3">
            {/* 分组选择 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">分组</label>
              <select
                value={proxyStatus?.active_group_id ?? ''}
                onChange={(e) => handleSwitchGroup(Number(e.target.value))}
                disabled={actionLoading}
                className="w-full px-3 py-2 bg-black border border-gray-700 text-gray-200 rounded text-sm focus:outline-none focus:border-yellow-500 disabled:opacity-50"
              >
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 配置选择 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">配置</label>
              <select
                value={proxyStatus?.active_config_id ?? ''}
                onChange={(e) => handleSwitchConfig(Number(e.target.value))}
                disabled={actionLoading || currentGroupConfigs.length === 0}
                className="w-full px-3 py-2 bg-black border border-gray-700 text-gray-200 rounded text-sm focus:outline-none focus:border-yellow-500 disabled:opacity-50"
              >
                {currentGroupConfigs.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 自动切换开关 */}
          {currentGroup && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
              <span className="text-xs text-gray-400">自动切换</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentGroup.auto_switch_enabled}
                  onChange={(e) => handleToggleAutoSwitch(currentGroup.id, e.target.checked)}
                  disabled={actionLoading}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>
          )}
        </div>

        {/* 配置列表 */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-5 shadow-lg shadow-yellow-500/5">
          <h3 className="text-sm font-bold text-yellow-400 mb-3">配置列表</h3>

          {currentGroupConfigs.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              当前分组没有配置
            </div>
          ) : (
            <div className="space-y-2">
              {currentGroupConfigs.map(config => {
                const signal = getSignalIcon(config.last_latency_ms);
                const isActive = config.id === proxyStatus?.active_config_id;

                return (
                  <div
                    key={config.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-yellow-500/10 border-yellow-500/50 shadow-md'
                        : 'bg-black/30 border-gray-700 hover:border-yellow-500/30 hover:bg-gray-800/30'
                    }`}
                    onClick={() => !isActive && handleSwitchConfig(config.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* 信号图标 */}
                      <div className={signal.color}>
                        {signal.icon}
                      </div>

                      {/* 配置名称 */}
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${
                            isActive ? 'text-yellow-400' : 'text-gray-200'
                          }`}>
                            {config.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-xs text-yellow-400 flex-shrink-0">
                              活跃
                            </span>
                          )}
                        </div>
                        <span className={`text-xs ${signal.color}`}>
                          {signal.label} {config.last_latency_ms ? `· ${config.last_latency_ms}ms` : ''}
                        </span>
                      </div>
                    </div>

                    {/* 可用状态指示 */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      config.is_available ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>共 {currentGroupConfigs.length} 个配置</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>{currentGroupConfigs.filter(c => c.is_available).length} 可用</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span>{currentGroupConfigs.filter(c => !c.is_available).length} 离线</span>
              </div>
            </div>
          </div>
        </div>

        {/* Claude Code 集成状态 - 简洁版 */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Claude Code:</span>
              {claudeCodeProxyConfig ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-xs text-green-400 font-medium">已连接</span>
                  <span className="text-xs text-gray-600 font-mono">
                    {claudeCodeProxyConfig.host}:{claudeCodeProxyConfig.port}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-500">未连接</span>
              )}
            </div>
            <button
              onClick={() => navigate('/claude-code')}
              className="px-2.5 py-1 text-xs bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-yellow-500/30 hover:text-gray-300 rounded transition-all"
            >
              管理
            </button>
          </div>
        </div>

        {/* 切换历史 - 简洁版 */}
        {recentLogs.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-5 shadow-lg shadow-yellow-500/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-yellow-400">最近切换</h3>
              <button
                onClick={() => setShowClearLogsDialog(true)}
                disabled={actionLoading}
                className="px-2.5 py-1 text-xs bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 hover:border-red-600/40 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-all"
              >
                清空
              </button>
            </div>

            <div className="space-y-1.5">
              {recentLogs.map(log => (
                <div
                  key={log.id}
                  className="p-2.5 bg-black/20 border border-gray-800/50 rounded hover:border-gray-700 transition-all"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-gray-600 font-mono shrink-0">
                        {new Date(log.switch_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-gray-400 truncate">
                        {log.source_config_name || '未知'} → {log.target_config_name}
                      </span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 ml-2 ${
                      log.reason === 'manual'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : log.reason === 'high_latency'
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {log.reason === 'manual' ? '手动' :
                       log.reason === 'high_latency' ? '延迟' :
                       log.reason === 'connection_failed' ? '失败' :
                       log.reason === 'timeout' ? '超时' :
                       log.reason === 'quota_exceeded' ? '配额' :
                       log.reason === 'retry_failed' ? '重试' :
                       log.reason === 'unrecoverable_error' ? '错误' : '限流'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 清空日志确认对话框 */}
      <ConfirmDialog
        isOpen={showClearLogsDialog}
        title="确认清空日志"
        message="此操作将清空所有切换日志，此操作不可恢复。确定要继续吗？"
        confirmText="清空"
        cancelText="取消"
        variant="danger"
        onConfirm={handleClearLogs}
        onCancel={() => setShowClearLogsDialog(false)}
      />
    </CompactLayout>
  );
};

export default Dashboard;
