/**
 * 统一仪表盘页面
 * 整合服务控制、配置管理、分组管理等功能
 */

import React, { useState, useEffect } from 'react';
import type { ProxyService, ConfigGroup, ApiConfig, SwitchLog, ProxyConfig } from '../types/tauri';
import * as proxyApi from '../api/proxy';
import * as configApi from '../api/config';
import * as claudeCodeApi from '../api/claude-code';
import * as testApi from '../api/test';
import * as balanceApi from '../api/balance';
import { CompactLayout } from '../components/CompactLayout';
import { ConfigEditor } from '../components/ConfigEditor';
import { GroupEditor } from '../components/GroupEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TestResultPanel } from '../components/TestResultPanel';
import { useAutoSwitch } from '../hooks/useAutoSwitch';
import { showSuccess, showError } from '../services/toast';
import { categoryLabels, categoryColors, type ProviderCategory } from '../config/providerPresets';
import { formatDisplayUrl } from '../utils/url';

const Dashboard: React.FC = () => {
  // 状态管理
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [recentLogs, setRecentLogs] = useState<SwitchLog[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'test'>('list');
  const [testingConfigId, setTestingConfigId] = useState<number | null>(null);
  const [queryingBalanceId, setQueryingBalanceId] = useState<number | null>(null);

  // Claude Code 配置状态
  const [claudeCodeProxyConfig, setClaudeCodeProxyConfig] = useState<ProxyConfig | null>(null);

  // 对话框状态
  const [configEditorOpen, setConfigEditorOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ConfigGroup | null>(null);
  const [showClearLogsDialog, setShowClearLogsDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'default' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    onConfirm: () => {},
  });

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
      if ((status.active_group_id === null || status.active_group_id === undefined) && groupsList.length > 0 && configsList.length > 0) {
        const firstGroupWithConfigs = groupsList.find(group =>
          configsList.some(config => config.group_id === group.id)
        );

        if (firstGroupWithConfigs) {
          console.log('自动选择第一个有配置的分组:', firstGroupWithConfigs.name);
          try {
            const newStatus = await proxyApi.switchProxyGroup(firstGroupWithConfigs.id);
            setProxyStatus(newStatus);
          } catch (err) {
            console.error('自动选择分组失败:', err);
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
      console.log('Claude Code proxy not configured:', err);
      setClaudeCodeProxyConfig(null);
    }
  };

  // 启动代理服务
  const handleStartProxy = async () => {
    try {
      setActionLoading(true);
      setError(null);

      const status = await proxyApi.startProxyService();
      setProxyStatus(status);

      try {
        const host = status.listen_host || '127.0.0.1';
        const port = status.listen_port || 25341;
        await claudeCodeApi.enableClaudeCodeProxy(host, port);
        await loadClaudeCodeConfig();
        showSuccess(`代理服务已启动并配置到 Claude Code (${host}:${port})`);
      } catch (claudeErr) {
        console.warn('Failed to configure Claude Code proxy:', claudeErr);
        showSuccess('代理服务已启动，但 Claude Code 配置失败，请手动配置');
      }
    } catch (err: any) {
      console.error('Failed to start proxy:', err);

      let errorMessage = '启动代理服务失败';
      if (err && typeof err === 'object') {
        if (err.error === 'NoConfigAvailable') {
          errorMessage = '当前分组中没有可用的配置。请先在配置列表中添加或启用配置。';
        } else if (err.error === 'EmptyGroup') {
          errorMessage = '当前分组为空。请先添加配置。';
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

  // 停止代理服务
  const handleStopProxy = async () => {
    try {
      setActionLoading(true);
      setError(null);

      if (claudeCodeProxyConfig) {
        try {
          await claudeCodeApi.disableClaudeCodeProxy();
          await loadClaudeCodeConfig();
        } catch (claudeErr) {
          console.warn('Failed to disable Claude Code proxy:', claudeErr);
        }
      }

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

  // 切换配置
  const handleSwitchConfig = async (configId: number) => {
    try {
      setActionLoading(true);
      setError(null);
      const status = await proxyApi.switchProxyConfig(configId);
      setProxyStatus(status);
      showSuccess('配置已切换');
      await loadData(); // 重新加载以更新切换历史
    } catch (err: any) {
      console.error('Failed to switch config:', err);

      let errorMessage = '切换配置失败';
      if (err && typeof err === 'object') {
        if (err.error === 'ConfigUnavailable') {
          errorMessage = '该配置不可用。请先启用该配置。';
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

  // 清空切换日志
  const handleClearLogs = async () => {
    try {
      setActionLoading(true);
      setShowClearLogsDialog(false);
      const deletedCount = await proxyApi.clearSwitchLogs();
      showSuccess(`已清空 ${deletedCount} 条切换日志`);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : '清空日志失败';
      showError(message);
      console.error('Failed to clear logs:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== 配置管理处理函数 ====================

  const handleCreateConfig = () => {
    setEditingConfig(null);
    setConfigEditorOpen(true);
  };

  const handleEditConfig = (config: ApiConfig) => {
    setEditingConfig(config);
    setConfigEditorOpen(true);
  };

  const handleSaveConfig = async (data: {
    name: string;
    apiKey: string | undefined;
    serverUrl: string;
    serverPort: number;
    groupId: number | null;
    defaultModel?: string;
    haikuModel?: string;
    sonnetModel?: string;
    opusModel?: string;
    smallFastModel?: string;
    apiTimeoutMs?: number;
    maxOutputTokens?: number;
    balanceQueryUrl?: string;
    autoBalanceCheck?: boolean;
    balanceCheckIntervalSec?: number;
  }) => {
    try {
      if (editingConfig) {
        await configApi.updateApiConfig({
          id: editingConfig.id,
          name: data.name,
          api_key: data.apiKey || undefined,
          server_url: data.serverUrl,
          server_port: data.serverPort,
          group_id: data.groupId,
          default_model: data.defaultModel,
          haiku_model: data.haikuModel,
          sonnet_model: data.sonnetModel,
          opus_model: data.opusModel,
          small_fast_model: data.smallFastModel,
          api_timeout_ms: data.apiTimeoutMs,
          max_output_tokens: data.maxOutputTokens,
          balance_query_url: data.balanceQueryUrl,
          auto_balance_check: data.autoBalanceCheck,
          balance_check_interval_sec: data.balanceCheckIntervalSec,
        });
      } else {
        if (!data.apiKey) {
          throw new Error('API Key is required when creating a new configuration');
        }
        await configApi.createApiConfig({
          name: data.name,
          api_key: data.apiKey,
          server_url: data.serverUrl,
          server_port: data.serverPort,
          group_id: data.groupId,
          default_model: data.defaultModel,
          haiku_model: data.haikuModel,
          sonnet_model: data.sonnetModel,
          opus_model: data.opusModel,
          small_fast_model: data.smallFastModel,
          api_timeout_ms: data.apiTimeoutMs,
          max_output_tokens: data.maxOutputTokens,
          balance_query_url: data.balanceQueryUrl,
          auto_balance_check: data.autoBalanceCheck,
          balance_check_interval_sec: data.balanceCheckIntervalSec,
        });
      }

      setConfigEditorOpen(false);
      await loadData();
    } catch (err) {
      console.error('保存配置失败:', err);
      alert(`保存配置失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleDeleteConfig = (config: ApiConfig) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除配置',
      message: `确定要删除配置 "${config.name}" 吗?此操作无法撤销。`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await configApi.deleteApiConfig(config.id);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err) {
          console.error('删除配置失败:', err);
          alert(`删除配置失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      },
    });
  };

  const handleTestConfig = async (config: ApiConfig) => {
    try {
      setTestingConfigId(config.id);
      const result = await testApi.testApiConfig(config.id);

      const isAvailable = result.status === 'success' || (
        result.status === 'failed' &&
        result.error_message &&
        !result.error_message.includes('HTTP 5') &&
        !result.error_message.includes('服务器错误') &&
        !result.error_message.includes('连接失败') &&
        !result.error_message.includes('DNS解析失败') &&
        !result.error_message.includes('连接被拒绝') &&
        !result.error_message.includes('连接重置')
      );

      alert(
        `测试结果:\n状态: ${isAvailable ? '✅ 可用' : '❌ 不可用'}\n延迟: ${result.latency_ms ? result.latency_ms + ' ms' : '-'}`
      );
      await loadData();
    } catch (err) {
      console.error('测试配置失败:', err);
      alert(`测试失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setTestingConfigId(null);
    }
  };

  const handleQueryBalance = async (config: ApiConfig) => {
    try {
      setQueryingBalanceId(config.id);
      const result = await balanceApi.queryBalance(config.id);

      const statusText = result.status === 'success' ? '✅ 成功' : '❌ 失败';
      const balanceText = result.balance !== null
        ? `${result.currency === 'CNY' ? '¥' : result.currency === 'USD' ? '$' : result.currency || ''}${result.balance.toFixed(2)}`
        : '-';
      const errorText = result.error_message ? `\n错误: ${result.error_message}` : '';

      alert(
        `余额查询结果:\n状态: ${statusText}\n余额: ${balanceText}${errorText}`
      );
      await loadData();
    } catch (err) {
      console.error('查询余额失败:', err);
      alert(`查询余额失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setQueryingBalanceId(null);
    }
  };

  // ==================== 分组管理处理函数 ====================

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupEditorOpen(true);
  };

  const handleEditGroup = (group: ConfigGroup) => {
    setEditingGroup(group);
    setGroupEditorOpen(true);
  };

  const handleSaveGroup = async (data: {
    name: string;
    description: string | null;
    autoSwitchEnabled: boolean;
    latencyThresholdMs: number;
  }) => {
    try {
      if (editingGroup) {
        await configApi.updateConfigGroup(
          editingGroup.id,
          data.name,
          data.description,
          data.autoSwitchEnabled,
          data.latencyThresholdMs
        );
      } else {
        await configApi.createConfigGroup(
          data.name,
          data.description,
          data.autoSwitchEnabled,
          data.latencyThresholdMs
        );
      }

      setGroupEditorOpen(false);
      await loadData();
    } catch (err) {
      console.error('保存分组失败:', err);
      alert(`保存分组失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleDeleteGroup = (group: ConfigGroup) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除分组',
      message: `确定要删除分组 "${group.name}" 吗?\n\n请选择删除方式:\n- 确定: 将分组下的配置移到"未分组"\n- 取消后可选择同时删除配置`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await configApi.deleteConfigGroup(group.id, true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err) {
          console.error('删除分组失败:', err);
          alert(`删除分组失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      },
    });
  };

  // 筛选选中分组的配置
  const filteredConfigs = selectedGroupId !== null
    ? configs.filter(c => c.group_id === selectedGroupId)
    : configs;

  // 按分组和排序顺序排列
  const sortedConfigs = [...filteredConfigs].sort((a, b) => {
    if (a.group_id !== b.group_id) {
      return (a.group_id || 0) - (b.group_id || 0);
    }
    return a.sort_order - b.sort_order;
  });

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
      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl shadow-lg">
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

      {/* 服务控制面板 */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              proxyStatus?.status === 'running'
                ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50'
                : 'bg-gray-500'
            }`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-yellow-400">
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
                className="px-4 py-2 bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 hover:border-red-600/50 disabled:opacity-50 rounded transition-all font-medium text-sm"
              >
                停止
              </button>
            ) : (
              <button
                onClick={handleStartProxy}
                disabled={actionLoading}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold rounded transition-all shadow-lg shadow-yellow-500/30 disabled:opacity-50 text-sm"
              >
                启动
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主内容区域 - 分组和配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧: 分组列表 */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-4 shadow-lg shadow-yellow-500/5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-yellow-500/20">
              <h2 className="text-sm font-bold text-yellow-500 tracking-wide">
                配置分组
              </h2>
              <button
                className="p-1.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-md hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50"
                onClick={handleCreateGroup}
                title="新建分组"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {/* 全部配置 */}
              <button
                className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 ${
                  selectedGroupId === null
                    ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-400 border-2 border-yellow-500/60 shadow-lg shadow-yellow-500/10'
                    : 'bg-gray-900/50 text-gray-400 hover:bg-gray-900 border border-gray-800 hover:border-gray-700'
                }`}
                onClick={() => setSelectedGroupId(null)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">全部配置</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    selectedGroupId === null
                      ? 'bg-yellow-500/30 text-yellow-300'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    {configs.length}
                  </span>
                </div>
              </button>

              {/* 分组列表 */}
              {groups.map((group) => {
                const groupConfigCount = configs.filter((c) => c.group_id === group.id).length;
                const isSelected = selectedGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    className={`group w-full rounded-md transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/60 shadow-lg shadow-yellow-500/10'
                        : 'bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 hover:shadow-md'
                    }`}
                  >
                    {/* 主内容区域 - 可点击 */}
                    <div
                      className="px-3 py-2 cursor-pointer"
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm font-semibold leading-tight truncate flex-1 ${
                          isSelected ? 'text-yellow-400' : 'text-gray-300'
                        }`} title={group.name}>
                          {group.name}
                        </h3>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                          isSelected
                            ? 'bg-yellow-500/30 text-yellow-300'
                            : 'bg-gray-800 text-gray-500'
                        }`}>
                          {groupConfigCount}
                        </span>
                      </div>

                      {group.description && (
                        <p className={`text-xs mt-1 line-clamp-1 ${
                          isSelected ? 'text-yellow-500/70' : 'text-gray-500'
                        }`} title={group.description}>
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* 操作按钮区域 - 底部独立行 */}
                    <div className={`flex items-center gap-1 px-3 py-1.5 border-t ${
                      isSelected
                        ? 'border-yellow-500/30 bg-yellow-500/5'
                        : 'border-gray-800/50 bg-gray-900/30'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group);
                        }}
                        className={`p-1 rounded transition-all duration-200 ${
                          isSelected
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            : 'bg-gray-800/70 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                        }`}
                        title="编辑分组"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {group.id !== 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group);
                          }}
                          className="p-1 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
                          title="删除分组"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧: 配置列表 */}
        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 shadow-lg shadow-yellow-500/5">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-yellow-500/20">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-yellow-500 tracking-wide">
                  {selectedGroupId === null
                    ? '全部配置'
                    : groups.find((g) => g.id === selectedGroupId)?.name || '配置列表'}
                </h2>
                {/* 视图切换 */}
                <div className="flex bg-gray-900/70 border border-gray-800 rounded-lg overflow-hidden shadow-inner">
                  <button
                    className={`px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    onClick={() => setViewMode('list')}
                  >
                    列表视图
                  </button>
                  <button
                    className={`px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                      viewMode === 'test'
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    onClick={() => setViewMode('test')}
                  >
                    端点测速
                  </button>
                </div>
              </div>
              <button
                className="px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200 font-bold shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50"
                onClick={handleCreateConfig}
              >
                + 新建配置
              </button>
            </div>

            {/* 配置列表或测试视图 */}
            {viewMode === 'test' ? (
              <TestResultPanel
                configs={sortedConfigs}
                groupId={selectedGroupId}
                onRefresh={loadData}
              />
            ) : sortedConfigs.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-400">暂无配置</h3>
                <p className="mt-1 text-sm text-gray-500">点击"新建配置"按钮开始添加 API 配置</p>
              </div>
            ) : (
              <div className="space-y-5">
                {sortedConfigs.map((config) => (
                  <div
                    key={config.id}
                    className={`bg-gradient-to-br from-gray-900 via-gray-900 to-black rounded-xl p-6 transition-all duration-300 ${
                      proxyStatus?.active_config_id === config.id
                        ? 'border-2 border-yellow-500 shadow-xl shadow-yellow-500/20 ring-2 ring-yellow-500/30'
                        : 'border border-gray-800 hover:border-yellow-500/60 hover:shadow-xl hover:shadow-yellow-500/10 hover:scale-[1.01]'
                    }`}
                  >
                    {/* 标题栏：配置名 + 标签 + 操作按钮 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-lg font-semibold ${
                          proxyStatus?.active_config_id === config.id ? 'text-yellow-400' : 'text-white'
                        }`}>{config.name}</h3>

                        {/* 分类标签 */}
                        {config.category && config.category !== 'custom' && (
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${
                            categoryColors[config.category as ProviderCategory]?.bg || 'bg-gray-500/20'
                          } ${
                            categoryColors[config.category as ProviderCategory]?.text || 'text-gray-400'
                          } ${
                            categoryColors[config.category as ProviderCategory]?.border || 'border-gray-500'
                          }`}>
                            {categoryLabels[config.category as ProviderCategory] || config.category}
                          </span>
                        )}

                        {/* 合作伙伴标签 */}
                        {config.is_partner && (
                          <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-md border border-blue-500/50">
                            <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            合作伙伴
                          </span>
                        )}

                        {/* 活跃标签 - 当前正在使用的配置 */}
                        {proxyStatus?.active_config_id === config.id && (
                          <span className="px-2.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-md border border-yellow-500/50 shadow-lg shadow-yellow-500/20">
                            <span className="inline-block w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1.5 animate-pulse"></span>
                            活跃
                          </span>
                        )}

                        {/* 可用性标签 */}
                        {config.is_available ? (
                          <span className="px-2.5 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-md border border-green-500/50">
                            <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
                            在线
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-md border border-red-500/50">
                            <span className="inline-block w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5"></span>
                            离线
                          </span>
                        )}
                      </div>

                      {/* 操作按钮组 */}
                      <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
                        {/* 切换按钮 - 仅当代理运行中且不是当前配置时显示 */}
                        {proxyStatus?.status === 'running' && proxyStatus.active_config_id !== config.id && (
                          <button
                            className="px-3.5 py-2 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 text-yellow-400 rounded-lg hover:from-yellow-500/20 hover:to-yellow-600/20 transition-all duration-200 text-sm border border-yellow-500/40 hover:border-yellow-500/60 font-semibold hover:shadow-lg hover:shadow-yellow-500/20"
                            onClick={() => handleSwitchConfig(config.id)}
                            disabled={actionLoading}
                            title="切换到此配置"
                          >
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            切换
                          </button>
                        )}

                        <button
                          className={`px-3.5 py-2 rounded-lg transition-all duration-200 text-sm border flex items-center font-semibold ${
                            testingConfigId === config.id
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 cursor-wait shadow-lg shadow-blue-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/40 hover:bg-blue-500/20 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/20'
                          }`}
                          onClick={() => handleTestConfig(config)}
                          disabled={testingConfigId !== null}
                          title={testingConfigId === config.id ? '测试中...' : '测试连接'}
                        >
                          {testingConfigId === config.id ? (
                            <>
                              <svg className="animate-spin w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              测试中...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              测试
                            </>
                          )}
                        </button>

                        <button
                          className={`px-3.5 py-2 rounded-lg transition-all duration-200 text-sm border flex items-center font-semibold ${
                            queryingBalanceId === config.id
                              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 cursor-wait shadow-lg shadow-yellow-500/20'
                              : config.balance_query_url && config.auto_balance_check
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/20 hover:border-yellow-500/60 hover:shadow-lg hover:shadow-yellow-500/20'
                              : 'bg-gray-600/10 text-gray-500 border-gray-600/30 cursor-not-allowed'
                          }`}
                          onClick={() => handleQueryBalance(config)}
                          disabled={queryingBalanceId !== null || !config.balance_query_url || !config.auto_balance_check}
                          title={
                            !config.balance_query_url
                              ? '未配置余额查询URL'
                              : !config.auto_balance_check
                              ? '余额查询已禁用（查询失败后自动禁用，请在配置编辑中重新启用）'
                              : queryingBalanceId === config.id
                              ? '查询中...'
                              : '查询余额'
                          }
                        >
                          {queryingBalanceId === config.id ? (
                            <>
                              <svg className="animate-spin w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              查询中...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              余额
                            </>
                          )}
                        </button>

                        <button
                          className="px-3.5 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700 transition-all duration-200 text-sm border border-gray-700/50 hover:border-gray-600 font-semibold hover:shadow-lg hover:shadow-gray-700/20"
                          onClick={() => handleEditConfig(config)}
                          title="编辑配置"
                        >
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          编辑
                        </button>

                        <button
                          className="px-3.5 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all duration-200 text-sm border border-red-500/40 hover:border-red-500/60 font-semibold hover:shadow-lg hover:shadow-red-500/20"
                          onClick={() => handleDeleteConfig(config)}
                          title="删除配置"
                        >
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          删除
                        </button>
                      </div>
                    </div>

                    {/* 配置详情 */}
                    <div className="space-y-3 text-sm mt-4 pt-4 border-t border-gray-800/50">
                      {/* 服务器地址 */}
                      <div className="flex items-start">
                        <span className="text-gray-500 w-24 flex-shrink-0 font-semibold">服务器</span>
                        <span className="text-gray-300 break-all font-mono text-xs" title={config.server_url}>
                          {formatDisplayUrl(config.server_url)}
                        </span>
                      </div>

                      {/* 所属分组 */}
                      <div className="flex items-center">
                        <span className="text-gray-500 w-24 flex-shrink-0 font-semibold">所属分组</span>
                        <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 rounded-md border border-yellow-500/40 text-xs font-semibold">
                          {groups.find((g) => g.id === config.group_id)?.name || '未分组'}
                        </span>
                      </div>

                      {/* 测试信息 */}
                      {config.last_test_at && (
                        <div className="flex items-center pt-2 border-t border-gray-800/50">
                          <span className="text-gray-500 w-24 flex-shrink-0 font-semibold">最后测试</span>
                          <div className="flex items-center gap-3 text-gray-400">
                            <span className="text-xs">
                              {new Date(config.last_test_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {config.last_latency_ms && (
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                config.last_latency_ms < 200
                                  ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                  : config.last_latency_ms < 500
                                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                                  : 'bg-red-500/20 text-red-400 border-red-500/50'
                              }`}>
                                {config.last_latency_ms} ms
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 余额信息 */}
                      {config.last_balance !== null && config.last_balance !== undefined && (
                        <div className="flex items-center pt-2 border-t border-gray-800/50">
                          <span className="text-gray-500 w-24 flex-shrink-0 font-semibold">账户余额</span>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-md text-sm font-bold font-mono border ${
                              config.last_balance >= 10
                                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                : config.last_balance >= 1
                                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                                : 'bg-red-500/20 text-red-400 border-red-500/50'
                            }`}>
                              {(() => {
                                const currencySymbols: Record<string, string> = {
                                  'CNY': '¥',
                                  'USD': '$',
                                  'EUR': '€',
                                  'JPY': '¥',
                                };
                                const symbol = config.balance_currency ? currencySymbols[config.balance_currency] || config.balance_currency : '';
                                return `${symbol}${config.last_balance.toFixed(2)}`;
                              })()}
                            </span>
                            {config.last_balance_check_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(config.last_balance_check_at).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                            {!config.auto_balance_check && (
                              <span className="inline-block px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded border border-orange-500/50">
                                已禁用余额查询
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 模型配置信息 */}
                      {(config.default_model || config.sonnet_model || config.haiku_model || config.opus_model) && (
                        <div className="flex items-start pt-2 border-t border-gray-800/50">
                          <span className="text-gray-500 w-24 flex-shrink-0 font-semibold">模型配置</span>
                          <div className="flex flex-wrap gap-2">
                            {config.default_model && (
                              <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-md text-xs border border-purple-500/40 font-semibold">
                                默认: {config.default_model}
                              </span>
                            )}
                            {config.sonnet_model && (
                              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs border border-blue-500/40 font-semibold">
                                Sonnet: {config.sonnet_model}
                              </span>
                            )}
                            {config.haiku_model && (
                              <span className="px-2.5 py-1 bg-green-500/10 text-green-400 rounded-md text-xs border border-green-500/40 font-semibold">
                                Haiku: {config.haiku_model}
                              </span>
                            )}
                            {config.opus_model && (
                              <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 rounded-md text-xs border border-orange-500/40 font-semibold">
                                Opus: {config.opus_model}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 切换历史 - 放在右侧配置列表底部 */}
          {recentLogs.length > 0 && (
            <div className="mt-6 bg-gradient-to-br from-gray-900 to-gray-900/50 border border-yellow-500/30 rounded-lg p-5 shadow-lg shadow-yellow-500/5">
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
      </div>

      {/* 对话框组件 */}
      <ConfigEditor
        isOpen={configEditorOpen}
        config={editingConfig}
        groups={groups}
        onSave={handleSaveConfig}
        onCancel={() => setConfigEditorOpen(false)}
      />

      <GroupEditor
        isOpen={groupEditorOpen}
        group={editingGroup}
        onSave={handleSaveGroup}
        onCancel={() => setGroupEditorOpen(false)}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

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
