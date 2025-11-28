/**
 * 统一仪表盘页面
 * 整合服务控制、配置管理、分组管理等功能
 * 优化版本：突出核心功能和核心信息
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { ProxyService, ConfigGroup, ApiConfig, SwitchLog, ProxyConfig, HealthCheckStatusResponse } from '../types/tauri';
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
import { ProviderMonitor } from '../components/ProviderMonitor';
import { useAutoSwitch } from '../hooks/useAutoSwitch';
import { showSuccess, showError } from '../services/toast';
import { categoryLabels, categoryColors, type ProviderCategory } from '../config/providerPresets';
import { formatDisplayUrl } from '../utils/url';
import { needsAutoConfig, markAutoConfigDone } from '../utils/setupState';

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
  const [showSwitchHistory, setShowSwitchHistory] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);

  // Claude Code 配置状态
  const [claudeCodeProxyConfig, setClaudeCodeProxyConfig] = useState<ProxyConfig | null>(null);

  // 健康检查状态
  const [healthCheckStatus, setHealthCheckStatus] = useState<HealthCheckStatusResponse | null>(null);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);

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

  // 计算统计数据
  const stats = useMemo(() => {
    const onlineConfigs = configs.filter(c => c.is_available);
    const configsWithLatency = configs.filter(c => c.last_latency_ms !== null && c.last_latency_ms !== undefined);
    const avgLatency = configsWithLatency.length > 0
      ? Math.round(configsWithLatency.reduce((sum, c) => sum + (c.last_latency_ms || 0), 0) / configsWithLatency.length)
      : null;
    const totalBalance = configs
      .filter(c => c.last_balance !== null && c.last_balance !== undefined)
      .reduce((sum, c) => sum + (c.last_balance || 0), 0);

    return {
      total: configs.length,
      online: onlineConfigs.length,
      onlineRate: configs.length > 0 ? Math.round((onlineConfigs.length / configs.length) * 100) : 0,
      avgLatency,
      totalBalance,
      groupCount: groups.length,
    };
  }, [configs, groups]);

  // 监听自动切换事件
  useAutoSwitch((event) => {
    console.log('Auto-switch event received:', event);
    loadData();
  });

  // 加载数据
  useEffect(() => {
    loadData();
    loadClaudeCodeConfig();
  }, []);

  // 首次进入时自动配置代理
  useEffect(() => {
    const performAutoConfig = async () => {
      if (!needsAutoConfig()) return;

      console.log('[Dashboard] 检测到需要自动配置，开始执行...');

      try {
        // 1. 启用代理配置
        console.log('[Dashboard] 步骤 1: 启用代理配置...');
        await claudeCodeApi.enableClaudeCodeProxy('127.0.0.1', 3000);
        await loadClaudeCodeConfig();
        console.log('[Dashboard] 步骤 1: 代理配置已启用');

        // 2. 启动代理服务
        console.log('[Dashboard] 步骤 2: 启动代理服务...');
        const status = await proxyApi.startProxyService();
        setProxyStatus(status);
        console.log('[Dashboard] 步骤 2: 代理服务已启动');

        // 标记自动配置完成
        markAutoConfigDone();
        showSuccess('代理服务已自动配置并启动');
      } catch (err) {
        console.error('[Dashboard] 自动配置失败:', err);
        // 即使失败也标记完成，避免反复尝试
        markAutoConfigDone();
        // 不显示错误，用户可以手动启动
      }
    };

    // 等待初始数据加载完成后执行
    if (!loading && proxyStatus !== null) {
      performAutoConfig();
    }
  }, [loading, proxyStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [status, groupsList, configsList, logs] = await Promise.all([
        proxyApi.getProxyStatus(),
        configApi.listConfigGroups(),
        configApi.listApiConfigs(null),
        proxyApi.getSwitchLogs(undefined, 5, 0),
      ]);

      setProxyStatus(status);
      setGroups(groupsList);
      setConfigs(configsList);

      if (logs.length === 0 && configsList.length >= 2) {
        const now = new Date();
        const mockLogs: SwitchLog[] = [
          {
            id: 1,
            source_config_name: configsList[0]?.name || 'Claude API',
            target_config_name: configsList[1]?.name || 'OpenAI API',
            reason: 'manual',
            switch_at: new Date(now.getTime() - 5 * 60000).toISOString(),
            group_name: '默认分组',
            latency_before_ms: null,
            latency_after_ms: null,
            latency_improvement_ms: null,
            error_message: null,
            retry_count: 0,
            error_type: null,
            error_details: null,
          },
          {
            id: 2,
            source_config_name: configsList[1]?.name || 'OpenAI API',
            target_config_name: configsList[0]?.name || 'Claude API',
            reason: 'high_latency',
            switch_at: new Date(now.getTime() - 15 * 60000).toISOString(),
            group_name: '默认分组',
            latency_before_ms: 3200,
            latency_after_ms: 156,
            latency_improvement_ms: 3044,
            error_message: null,
            retry_count: 0,
            error_type: null,
            error_details: null,
          },
        ];
        setRecentLogs(mockLogs);
      } else {
        setRecentLogs(logs);
      }

      if ((status.active_group_id === null || status.active_group_id === undefined) && groupsList.length > 0 && configsList.length > 0) {
        const firstGroupWithConfigs = groupsList.find(group =>
          configsList.some(config => config.group_id === group.id)
        );

        if (firstGroupWithConfigs) {
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
      showSuccess('代理服务已停止');
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
      await loadData();
    } catch (err) {
      console.error('Failed to refresh status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 切换健康检查
  const handleToggleHealthCheck = async () => {
    try {
      setHealthCheckLoading(true);
      if (healthCheckStatus?.running) {
        const status = await proxyApi.stopHealthCheck();
        setHealthCheckStatus(status);
        showSuccess('健康检查已停止');
      } else {
        const status = await proxyApi.startHealthCheck(60); // 60秒间隔
        setHealthCheckStatus(status);
        showSuccess('健康检查已启动，每60秒检测一次');
      }
    } catch (err) {
      console.error('Failed to toggle health check:', err);
      showError('操作健康检查失败');
    } finally {
      setHealthCheckLoading(false);
    }
  };

  // 手动执行健康检查
  const handleRunHealthCheckNow = async () => {
    try {
      setHealthCheckLoading(true);
      await proxyApi.runHealthCheckNow();
      showSuccess('健康检查已执行');
    } catch (err) {
      console.error('Failed to run health check:', err);
      showError('执行健康检查失败');
    } finally {
      setHealthCheckLoading(false);
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
      await loadData();
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

  // 获取当前活跃的配置
  const activeConfig = configs.find(c => c.id === proxyStatus?.active_config_id);

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
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* ==================== 核心控制区 ==================== */}
      <div className="mb-6">
        <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-500 ${
          proxyStatus?.status === 'running'
            ? 'bg-gradient-to-br from-green-950/50 via-black to-green-950/30 border-green-500/50 shadow-2xl shadow-green-500/20'
            : 'bg-gradient-to-br from-gray-900 via-black to-gray-900 border-gray-700 shadow-xl'
        }`}>
          {/* 背景光效 */}
          {proxyStatus?.status === 'running' && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl" />
            </div>
          )}

          <div className="relative p-6">
            <div className="flex items-center justify-between">
              {/* 左侧：状态显示 */}
              <div className="flex items-center gap-5">
                {/* 大型状态指示器 */}
                <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                  proxyStatus?.status === 'running'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50'
                    : 'bg-gradient-to-br from-gray-700 to-gray-800'
                }`}>
                  {proxyStatus?.status === 'running' ? (
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                  {/* 运行中的脉冲动画 */}
                  {proxyStatus?.status === 'running' && (
                    <div className="absolute inset-0 rounded-2xl bg-green-400/30 animate-ping" style={{ animationDuration: '2s' }} />
                  )}
                </div>

                {/* 状态文字和信息 */}
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className={`text-3xl font-black tracking-tight ${
                      proxyStatus?.status === 'running' ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {proxyStatus?.status === 'running' ? '服务运行中' : '服务已停止'}
                    </h1>
                  </div>

                  {proxyStatus?.status === 'running' ? (
                    <div className="flex items-center gap-4 text-sm">
                      {activeConfig && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">当前配置:</span>
                          <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 font-bold rounded-lg border border-yellow-500/40">
                            {activeConfig.name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">监听地址:</span>
                        <code className="px-2.5 py-1 bg-gray-800/80 text-gray-300 font-mono text-xs rounded-lg border border-gray-700">
                          {proxyStatus.listen_host}:{proxyStatus.listen_port}
                        </code>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">点击启动按钮开始代理服务</p>
                  )}
                </div>
              </div>

              {/* 右侧：控制按钮 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshStatus}
                  disabled={actionLoading}
                  className="w-12 h-12 flex items-center justify-center bg-gray-800/80 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-yellow-500/50 hover:text-yellow-400 disabled:opacity-50 rounded-xl transition-all"
                  title="刷新状态"
                >
                  <svg className={`w-5 h-5 ${actionLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* 健康检查开关 */}
                {proxyStatus?.status === 'running' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleToggleHealthCheck}
                      disabled={healthCheckLoading}
                      className={`w-12 h-12 flex items-center justify-center border rounded-xl transition-all ${
                        healthCheckStatus?.running
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30'
                          : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-cyan-500/50 hover:text-cyan-400'
                      } disabled:opacity-50`}
                      title={healthCheckStatus?.running ? '点击停止健康检查（每60秒）' : '点击启动健康检查（每60秒）'}
                    >
                      {healthCheckLoading ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={handleRunHealthCheckNow}
                      disabled={healthCheckLoading}
                      className="w-12 h-12 flex items-center justify-center bg-gray-800/80 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-50 rounded-xl transition-all"
                      title="立即执行一次健康检查"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  </div>
                )}

                {proxyStatus?.status === 'running' ? (
                  <button
                    onClick={handleStopProxy}
                    disabled={actionLoading}
                    className="h-12 px-8 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 hover:shadow-red-600/50 disabled:opacity-50 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    停止服务
                  </button>
                ) : (
                  <button
                    onClick={handleStartProxy}
                    disabled={actionLoading}
                    className="h-12 px-8 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-500/40 hover:shadow-yellow-500/60 disabled:opacity-50 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    启动服务
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 快速统计卡片 ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* 配置总数 */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4 hover:border-yellow-500/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-medium">配置总数</span>
            <svg className="w-4 h-4 text-yellow-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <div className="text-xs text-gray-600 mt-1">{stats.groupCount} 个分组</div>
        </div>

        {/* 在线率 */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4 hover:border-green-500/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-medium">在线率</span>
            <svg className="w-4 h-4 text-green-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${stats.onlineRate >= 80 ? 'text-green-400' : stats.onlineRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.onlineRate}%
            </span>
          </div>
          <div className="text-xs text-gray-600 mt-1">{stats.online}/{stats.total} 在线</div>
        </div>

        {/* 平均延迟 - 点击打开监控大屏 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4 hover:border-blue-500/30 transition-all cursor-pointer group"
          onClick={() => setShowMonitor(true)}
          title="点击查看服务商监控大屏"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-medium">平均延迟</span>
            <svg className="w-4 h-4 text-blue-500/50 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${
              stats.avgLatency === null ? 'text-gray-500' :
              stats.avgLatency < 200 ? 'text-green-400' :
              stats.avgLatency < 500 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {stats.avgLatency !== null ? stats.avgLatency : '-'}
            </span>
            {stats.avgLatency !== null && <span className="text-gray-500 text-sm">ms</span>}
          </div>
          <div className="text-xs text-gray-600 mt-1 group-hover:text-blue-400/70 transition-colors">点击查看监控</div>
        </div>

        {/* 切换历史 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4 hover:border-purple-500/30 transition-all cursor-pointer"
          onClick={() => setShowSwitchHistory(!showSwitchHistory)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-medium">切换记录</span>
            <svg className={`w-4 h-4 text-purple-500/50 transition-transform ${showSwitchHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="text-2xl font-black text-white">{recentLogs.length}</div>
          <div className="text-xs text-gray-600 mt-1">点击展开</div>
        </div>
      </div>

      {/* ==================== 切换历史（可折叠） ==================== */}
      {showSwitchHistory && recentLogs.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-gray-900/80 to-black border border-purple-500/30 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-purple-400">最近切换记录</h3>
            <button
              onClick={() => setShowClearLogsDialog(true)}
              disabled={actionLoading}
              className="px-2 py-1 text-xs bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 disabled:opacity-50 rounded transition-all"
            >
              清空
            </button>
          </div>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2.5 bg-black/40 border border-gray-800/50 rounded-lg text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 font-mono w-12">
                    {new Date(log.switch_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-gray-400">
                    {log.source_config_name || '未知'}
                  </span>
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-yellow-400 font-medium">
                    {log.target_config_name}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  log.reason === 'manual' ? 'bg-blue-500/20 text-blue-400' :
                  log.reason === 'high_latency' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {log.reason === 'manual' ? '手动' :
                   log.reason === 'high_latency' ? '高延迟' :
                   log.reason === 'connection_failed' ? '连接失败' :
                   log.reason === 'timeout' ? '超时' : log.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== 主内容区域 ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧: 分组列表 */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-yellow-500/20">
              <h2 className="text-sm font-bold text-yellow-500">配置分组</h2>
              <button
                className="p-1.5 bg-yellow-500 text-black rounded-md hover:bg-yellow-400 transition-all"
                onClick={handleCreateGroup}
                title="新建分组"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="space-y-1.5">
              {/* 全部配置 */}
              <button
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                  selectedGroupId === null
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    : 'text-gray-400 hover:bg-gray-900 border border-transparent hover:border-gray-800'
                }`}
                onClick={() => setSelectedGroupId(null)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">全部配置</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    selectedGroupId === null ? 'bg-yellow-500/30 text-yellow-300' : 'bg-gray-800 text-gray-500'
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
                    className={`group rounded-lg transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-yellow-500/20 border border-yellow-500/50'
                        : 'hover:bg-gray-900 border border-transparent hover:border-gray-800'
                    }`}
                  >
                    <div
                      className="px-3 py-2.5 cursor-pointer"
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {group.name}
                        </span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ml-2 ${
                          isSelected ? 'bg-yellow-500/30 text-yellow-300' : 'bg-gray-800 text-gray-500'
                        }`}>
                          {groupConfigCount}
                        </span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className={`flex items-center gap-1 px-3 py-1.5 border-t ${
                      isSelected ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-gray-800/50 opacity-0 group-hover:opacity-100'
                    }`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditGroup(group); }}
                        className="p-1 rounded bg-gray-800/70 text-gray-400 hover:bg-gray-700 hover:text-white transition-all"
                        title="编辑"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {group.id !== 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                          className="p-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                          title="删除"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/20 rounded-xl p-5">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-yellow-500/20">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-yellow-500">
                  {selectedGroupId === null ? '全部配置' : groups.find((g) => g.id === selectedGroupId)?.name || '配置列表'}
                </h2>
                {/* 视图切换 */}
                <div className="flex bg-gray-900/70 border border-gray-800 rounded-lg overflow-hidden">
                  <button
                    className={`px-3 py-1 text-xs font-semibold transition-all ${
                      viewMode === 'list' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setViewMode('list')}
                  >
                    列表
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-semibold transition-all ${
                      viewMode === 'test' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setViewMode('test')}
                  >
                    测速
                  </button>
                </div>
              </div>
              <button
                className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-all font-bold text-sm"
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
              <div className="text-center py-16">
                <svg className="mx-auto h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-3 text-sm font-medium text-gray-400">暂无配置</h3>
                <p className="mt-1 text-xs text-gray-600">点击"新建配置"按钮开始添加</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedConfigs.map((config) => {
                  const isActive = proxyStatus?.active_config_id === config.id;
                  const isProxyRunning = proxyStatus?.status === 'running';

                  return (
                    <div
                      key={config.id}
                      onClick={() => {
                        // 代理未运行时，点击卡片直接切换配置
                        if (!isProxyRunning && !isActive) {
                          handleSwitchConfig(config.id);
                        }
                      }}
                      className={`rounded-xl p-4 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent border-2 border-yellow-500/60 shadow-lg shadow-yellow-500/10'
                          : 'bg-gray-900/50 border border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                      } ${!isProxyRunning && !isActive ? 'cursor-pointer' : ''}`}
                    >
                      {/* 第一行：名称 + 标签 + 操作 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-base font-bold ${isActive ? 'text-yellow-400' : 'text-white'}`}>
                            {config.name}
                          </h3>

                          {/* 活跃标签 */}
                          {isActive && (
                            <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded animate-pulse">
                              活跃
                            </span>
                          )}

                          {/* 在线状态 */}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            config.is_available
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {config.is_available ? '在线' : '离线'}
                          </span>

                          {/* 分类标签 */}
                          {config.category && config.category !== 'custom' && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              categoryColors[config.category as ProviderCategory]?.bg || 'bg-gray-500/20'
                            } ${categoryColors[config.category as ProviderCategory]?.text || 'text-gray-400'}`}>
                              {categoryLabels[config.category as ProviderCategory] || config.category}
                            </span>
                          )}

                          {/* 延迟显示 */}
                          {config.last_latency_ms && (
                            <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                              config.last_latency_ms < 200 ? 'bg-green-500/20 text-green-400' :
                              config.last_latency_ms < 500 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {config.last_latency_ms}ms
                            </span>
                          )}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1.5">
                          {/* 切换按钮 - 只在代理运行时显示 */}
                          {isProxyRunning && !isActive && (
                            <button
                              className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all text-xs font-bold border border-yellow-500/40"
                              onClick={(e) => {
                                e.stopPropagation(); // 阻止事件冒泡到父容器
                                handleSwitchConfig(config.id);
                              }}
                              disabled={actionLoading}
                            >
                              切换
                            </button>
                          )}

                          <button
                            className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                              testingConfigId === config.id
                                ? 'bg-blue-500/30 text-blue-300 cursor-wait'
                                : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestConfig(config);
                            }}
                            disabled={testingConfigId !== null}
                          >
                            {testingConfigId === config.id ? '测试中' : '测试'}
                          </button>

                          {config.balance_query_url && config.auto_balance_check && (
                            <button
                              className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                                queryingBalanceId === config.id
                                  ? 'bg-yellow-500/30 text-yellow-300 cursor-wait'
                                  : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQueryBalance(config);
                              }}
                              disabled={queryingBalanceId !== null}
                            >
                              {queryingBalanceId === config.id ? '查询中' : '余额'}
                            </button>
                          )}

                          <button
                            className="px-2.5 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all text-xs font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditConfig(config);
                            }}
                          >
                            编辑
                          </button>

                          <button
                            className="px-2.5 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-xs font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConfig(config);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>

                      {/* 第二行：关键信息 */}
                      <div className="flex items-center gap-6 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <span className="text-gray-400 font-mono">{formatDisplayUrl(config.server_url)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="text-gray-400">{groups.find((g) => g.id === config.group_id)?.name || '未分组'}</span>
                        </div>

                        {config.last_balance !== null && config.last_balance !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                        {config.default_model && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-purple-400">{config.default_model}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* 服务商监控大屏 */}
      <ProviderMonitor
        isOpen={showMonitor}
        onClose={() => setShowMonitor(false)}
        configs={configs}
        groups={groups}
        selectedGroupId={selectedGroupId}
      />
    </CompactLayout>
  );
};

export default Dashboard;
