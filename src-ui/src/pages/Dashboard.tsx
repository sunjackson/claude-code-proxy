/**
 * 统一仪表盘页面
 * 整合服务控制、配置管理、分组管理等功能
 * 优化版本：突出核心功能和核心信息
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ProxyService, ConfigGroup, ApiConfig, SwitchLog, ProxyConfig } from '../types/tauri';
import * as proxyApi from '../api/proxy';
import * as configApi from '../api/config';
import * as claudeCodeApi from '../api/claude-code';
import * as testApi from '../api/test';
import * as balanceApi from '../api/balance';
import { DEFAULT_PROXY_PORT, DEFAULT_PROXY_HOST } from '../config/ports';
import { CompactLayout } from '../components/CompactLayout';
import { ConfigEditor } from '../components/ConfigEditor';
import { GroupEditor } from '../components/GroupEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MessageDialog } from '../components/ui/Dialog';
import { ProviderMonitor } from '../components/ProviderMonitor';
import { SortableConfigCard } from '../components/SortableConfigCard';
import { HealthMonitorPanel } from '../components/HealthMonitorPanel';
import { useAutoSwitch } from '../hooks/useAutoSwitch';
import { showSuccess, showError } from '../services/toast';
import { needsAutoConfig, markAutoConfigDone } from '../utils/setupState';
import { useAutoRefreshStore } from '../store/autoRefreshStore';

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
  const [viewMode, setViewMode] = useState<'list' | 'monitor'>('list');
  const [testingConfigId, setTestingConfigId] = useState<number | null>(null);
  const [queryingBalanceId, setQueryingBalanceId] = useState<number | null>(null);
  const [showSwitchHistory, setShowSwitchHistory] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);

  // Claude Code 配置状态
  const [claudeCodeProxyConfig, setClaudeCodeProxyConfig] = useState<ProxyConfig | null>(null);

  // 健康检查状态 - 使用全局 store，切换页面后不会丢失
  const {
    healthCheckStatus,
    setHealthCheckStatus,
    healthCheckInterval,
    setHealthCheckInterval,
  } = useAutoRefreshStore();
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

  // 消息弹窗状态
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogType, setMessageDialogType] = useState<'success' | 'error' | 'info'>('info');
  const [messageDialogTitle, setMessageDialogTitle] = useState('');
  const [messageDialogContent, setMessageDialogContent] = useState<React.ReactNode>(null);

  // 显示消息弹窗
  const showMessage = (type: 'success' | 'error' | 'info', title: string, content: React.ReactNode) => {
    setMessageDialogType(type);
    setMessageDialogTitle(title);
    setMessageDialogContent(content);
    setMessageDialogOpen(true);
  };

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

  // 监听自动切换事件，获取切换状态
  const switchState = useAutoSwitch((event) => {
    console.log('Auto-switch event received:', event);
    loadData();
  });

  // 加载数据
  useEffect(() => {
    loadData();
    loadClaudeCodeConfig();
  }, []);

  // 注意：不再在组件卸载时停止健康检查
  // 健康检查状态已移至全局 store，切换页面不应该停止健康检查
  // 只有用户手动关闭或应用退出时才停止

  // 首次进入时自动配置代理
  useEffect(() => {
    const performAutoConfig = async () => {
      if (!needsAutoConfig()) return;

      console.log('[Dashboard] 检测到需要自动配置，开始执行...');

      try {
        // 1. 启用代理配置
        console.log('[Dashboard] 步骤 1: 启用代理配置...');
        await claudeCodeApi.enableClaudeCodeProxy(DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT);
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

      const [status, groupsList, configsList, logs, healthStatus] = await Promise.all([
        proxyApi.getProxyStatus(),
        configApi.listConfigGroups(),
        configApi.listApiConfigs(null),
        proxyApi.getSwitchLogs(undefined, 5, 0),
        proxyApi.getHealthCheckStatus().catch(() => null), // 获取健康检查状态，失败时返回 null
      ]);

      setProxyStatus(status);
      setGroups(groupsList);
      setConfigs(configsList);

      // 同步健康检查状态到全局 store
      if (healthStatus) {
        setHealthCheckStatus(healthStatus);
      }

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
        const port = status.listen_port;
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
        const status = await proxyApi.toggleAutoHealthCheck(false);
        setHealthCheckStatus(status);
        showSuccess('自动检测已关闭');
      } else {
        const status = await proxyApi.toggleAutoHealthCheck(true, healthCheckInterval);
        setHealthCheckStatus(status);
        const intervalText = healthCheckInterval >= 60
          ? `${Math.floor(healthCheckInterval / 60)}分钟`
          : `${healthCheckInterval}秒`;
        showSuccess(`自动检测已启动，每${intervalText}检测一次`);
      }
    } catch (err) {
      console.error('Failed to toggle health check:', err);
      showError('操作自动检测失败');
    } finally {
      setHealthCheckLoading(false);
    }
  };

  // 修改检测频率
  const handleIntervalChange = async (newInterval: number) => {
    setHealthCheckInterval(newInterval);
    // 如果正在运行，重新启动以应用新间隔
    if (healthCheckStatus?.running) {
      try {
        setHealthCheckLoading(true);
        const status = await proxyApi.toggleAutoHealthCheck(true, newInterval);
        setHealthCheckStatus(status);
        const intervalText = newInterval >= 60
          ? `${Math.floor(newInterval / 60)}分钟`
          : `${newInterval}秒`;
        showSuccess(`检测频率已更新为每${intervalText}`);
      } catch (err) {
        console.error('Failed to update interval:', err);
        showError('更新检测频率失败');
      } finally {
        setHealthCheckLoading(false);
      }
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
      // 只更新配置列表，不触发loading状态，避免页面跳转到顶部
      const [configsList, logs] = await Promise.all([
        configApi.listApiConfigs(null),
        proxyApi.getSwitchLogs(undefined, 5, 0),
      ]);
      setConfigs(configsList);
      setRecentLogs(logs);
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
      showMessage('error', '保存配置失败', err instanceof Error ? err.message : '未知错误');
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
          showMessage('error', '删除配置失败', err instanceof Error ? err.message : '未知错误');
        }
      },
    });
  };

  const handleTestConfig = async (config: ApiConfig) => {
    try {
      setTestingConfigId(config.id);
      const result = await testApi.testApiConfig(config.id);

      // 使用 is_available 判断可用性（与后端 TestResult::is_available() 保持一致）
      // 可用：成功响应，或客户端错误（认证、权限、限流等可修复问题）
      // 不可用：服务器错误（5xx）、server_error、负载过高、超时、连接失败等
      const errorMsg = result.error_message || '';
      const errorLower = errorMsg.toLowerCase();

      const isAvailable = result.status === 'success' || (
        result.status === 'failed' &&
        result.error_message &&
        // 服务器错误（5xx）
        !result.error_message.includes('HTTP 5') &&
        !result.error_message.includes('服务器错误') &&
        !result.error_message.includes('服务商错误') &&
        // server_error 类型错误
        !errorLower.includes('server_error') &&
        // 负载过高、过载
        !result.error_message.includes('负载过高') &&
        !result.error_message.includes('过载') &&
        !errorLower.includes('overloaded') &&
        !errorLower.includes('overload') &&
        // 连接问题
        !result.error_message.includes('连接失败') &&
        !result.error_message.includes('DNS解析失败') &&
        !result.error_message.includes('连接被拒绝') &&
        !result.error_message.includes('连接重置')
      );

      showMessage(
        isAvailable ? 'success' : 'error',
        '测试结果',
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">状态:</span>
            <span className={isAvailable ? 'text-green-400' : 'text-red-400'}>
              {isAvailable ? '✅ 可用' : '❌ 不可用'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">延迟:</span>
            <span className="text-gray-300">{result.latency_ms ? `${result.latency_ms} ms` : '-'}</span>
          </div>
          {result.error_message && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 shrink-0">原因:</span>
              <span className="text-red-400 break-all">{result.error_message}</span>
            </div>
          )}
        </div>
      );
      await loadData();
    } catch (err) {
      console.error('测试配置失败:', err);
      showMessage('error', '测试失败', err instanceof Error ? err.message : '未知错误');
    } finally {
      setTestingConfigId(null);
    }
  };

  const handleQueryBalance = async (config: ApiConfig) => {
    try {
      setQueryingBalanceId(config.id);
      const result = await balanceApi.queryBalance(config.id);

      const isSuccess = result.status === 'success';
      const balanceText = result.balance !== null
        ? `${result.currency === 'CNY' ? '¥' : result.currency === 'USD' ? '$' : result.currency || ''}${result.balance.toFixed(2)}`
        : '-';

      showMessage(
        isSuccess ? 'success' : 'error',
        '余额查询结果',
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">状态:</span>
            <span className={isSuccess ? 'text-green-400' : 'text-red-400'}>
              {isSuccess ? '✅ 成功' : '❌ 失败'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">余额:</span>
            <span className="font-medium text-amber-400">{balanceText}</span>
          </div>
          {result.error_message && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400">错误:</span>
              <span className="text-red-400">{result.error_message}</span>
            </div>
          )}
        </div>
      );
      await loadData();
    } catch (err) {
      console.error('查询余额失败:', err);
      showMessage('error', '查询余额失败', err instanceof Error ? err.message : '未知错误');
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
      showMessage('error', '保存分组失败', err instanceof Error ? err.message : '未知错误');
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
          showMessage('error', '删除分组失败', err instanceof Error ? err.message : '未知错误');
        }
      },
    });
  };

  // 筛选选中分组的配置
  const filteredConfigs = selectedGroupId !== null
    ? configs.filter(c => c.group_id === selectedGroupId)
    : configs;

  // 按 sort_order 排序（用于自动切换的优先级）
  const sortedConfigs = [...filteredConfigs].sort((a, b) => {
    // 同一分组内按 sort_order 排序
    if (a.group_id === b.group_id) {
      return a.sort_order - b.sort_order;
    }
    // 不同分组按 group_id 排序
    return (a.group_id || 0) - (b.group_id || 0);
  });

  // 拖拽排序传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖动8px后才开始拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);

    // 找到拖拽的配置和目标配置
    const activeConfig = sortedConfigs.find(c => c.id === activeId);
    const overConfig = sortedConfigs.find(c => c.id === overId);

    if (!activeConfig || !overConfig) {
      return;
    }

    // 只允许同一分组内拖拽
    if (activeConfig.group_id !== overConfig.group_id) {
      showError('只能在同一分组内调整顺序');
      return;
    }

    // 计算新的排序顺序
    const newSortOrder = overConfig.sort_order;

    try {
      // 调用后端更新排序
      await configApi.reorderApiConfig(activeId, newSortOrder);

      // 重新加载数据
      await loadData();
      showSuccess('配置顺序已更新');
    } catch (err) {
      console.error('更新配置顺序失败:', err);
      showError('更新配置顺序失败');
    }
  }, [sortedConfigs, loadData]);

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
        <div className="p-3 mb-4 border rounded-lg bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-2">
            <svg className="flex-shrink-0 w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="absolute w-48 h-48 rounded-full -top-24 -right-24 bg-green-500/10 blur-3xl animate-pulse" />
              <div className="absolute w-48 h-48 rounded-full -bottom-24 -left-24 bg-yellow-500/5 blur-3xl" />
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
                    <p className="text-sm text-gray-500">点击启动按钮开始代理服务</p>
                  )}
                </div>
              </div>

              {/* 右侧：控制按钮 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshStatus}
                  disabled={actionLoading}
                  className="flex items-center justify-center w-12 h-12 text-gray-400 transition-all border border-gray-700 bg-gray-800/80 hover:bg-gray-700 hover:border-yellow-500/50 hover:text-yellow-400 disabled:opacity-50 rounded-xl"
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
                      className="flex items-center justify-center w-12 h-12 text-gray-400 transition-all border border-gray-700 bg-gray-800/80 hover:bg-gray-700 hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-50 rounded-xl"
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
                    className="flex items-center h-12 gap-2 px-8 font-bold text-white transition-all shadow-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl shadow-red-600/30 hover:shadow-red-600/50 disabled:opacity-50"
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
                    className="flex items-center h-12 gap-2 px-8 font-bold text-black transition-all shadow-lg bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 rounded-xl shadow-yellow-500/40 hover:shadow-yellow-500/60 disabled:opacity-50"
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

      {/* ==================== 使用说明（服务未运行时显示） ==================== */}
      {proxyStatus?.status !== 'running' && (
        <div className="mb-6 overflow-hidden border bg-gradient-to-br from-yellow-500/5 via-black to-yellow-500/5 border-yellow-500/30 rounded-2xl">
          {/* 标题栏 */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-500/20">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-yellow-400">快速开始指南</h3>
                <p className="text-xs text-gray-500">按照以下步骤配置并开始使用</p>
              </div>
            </div>
          </div>

          {/* 步骤内容 */}
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* 步骤 1 */}
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-black text-black bg-yellow-500 rounded-full shadow-lg shadow-yellow-500/30">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <h4 className="mb-2 text-sm font-bold text-white">配置 API 服务商</h4>
                    <p className="text-xs leading-relaxed text-gray-400">
                      在下方配置列表中添加您的 API 服务商信息，包括 API Key 和服务器地址。支持添加多个服务商实现自动切换。
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-1 text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded">
                        已配置: {configs.length} 个
                      </span>
                      {configs.length === 0 && (
                        <span className="text-xs text-yellow-500">← 请先添加配置</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* 连接线 */}
                <div className="hidden md:block absolute top-4 left-full w-full h-0.5 bg-gradient-to-r from-yellow-500/50 to-transparent -translate-x-4" />
              </div>

              {/* 步骤 2 */}
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-lg ${
                    configs.length > 0 ? 'bg-yellow-500 text-black shadow-yellow-500/30' : 'bg-gray-700 text-gray-400'
                  }`}>
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <h4 className="mb-2 text-sm font-bold text-white">启动代理服务</h4>
                    <p className="text-xs leading-relaxed text-gray-400">
                      点击上方的「启动服务」按钮，启动本地代理服务器。服务启动后会自动配置 Claude Code 的代理设置。
                    </p>
                    <div className="mt-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400">默认监听 {DEFAULT_PROXY_HOST}:{DEFAULT_PROXY_PORT}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 连接线 */}
                <div className="hidden md:block absolute top-4 left-full w-full h-0.5 bg-gradient-to-r from-yellow-500/50 to-transparent -translate-x-4" />
              </div>

              {/* 步骤 3 */}
              <div>
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-lg ${
                    configs.length > 0 ? 'bg-yellow-500 text-black shadow-yellow-500/30' : 'bg-gray-700 text-gray-400'
                  }`}>
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <h4 className="mb-2 text-sm font-bold text-white">重启 Claude Code</h4>
                    <p className="text-xs leading-relaxed text-gray-400">
                      在终端中重新运行 <code className="px-1.5 py-0.5 bg-gray-800 rounded text-yellow-400 font-mono">claude</code> 命令启动 Claude Code，即可开始愉快的 AI 编程之旅！
                    </p>
                    <div className="mt-3 p-2.5 bg-gray-900/80 border border-gray-800 rounded-lg">
                      <code className="font-mono text-xs text-gray-300">
                        <span className="text-gray-500">$</span> claude
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部提示 */}
            <div className="pt-5 mt-6 border-t border-gray-800/50">
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>自动故障转移：服务异常时自动切换到备用服务商</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>健康检查：自动检测服务商可用性</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>服务商监控：实时查看各服务商状态和延迟</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 快速统计卡片 ==================== */}
      <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
        {/* 配置总数 */}
        <div className="p-4 transition-all border border-gray-800 bg-gradient-to-br from-gray-900 to-black rounded-xl hover:border-yellow-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">配置总数</span>
            <svg className="w-4 h-4 text-yellow-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <div className="mt-1 text-xs text-gray-600">{stats.groupCount} 个分组</div>
        </div>

        {/* 在线率 */}
        <div className="p-4 transition-all border border-gray-800 bg-gradient-to-br from-gray-900 to-black rounded-xl hover:border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">在线率</span>
            <svg className="w-4 h-4 text-green-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${stats.onlineRate >= 80 ? 'text-green-400' : stats.onlineRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.onlineRate}%
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-600">{stats.online}/{stats.total} 在线</div>
        </div>

        {/* 平均延迟 - 点击打开监控大屏 */}
        <div
          className="p-4 transition-all border border-gray-800 cursor-pointer bg-gradient-to-br from-gray-900 to-black rounded-xl hover:border-blue-500/30 group"
          onClick={() => setShowMonitor(true)}
          title="点击查看服务商监控大屏"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">平均延迟</span>
            <svg className="w-4 h-4 transition-colors text-blue-500/50 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {stats.avgLatency !== null && <span className="text-sm text-gray-500">ms</span>}
          </div>
          <div className="mt-1 text-xs text-gray-600 transition-colors group-hover:text-blue-400/70">点击查看监控</div>
        </div>

        {/* 切换历史 */}
        <div
          className="p-4 transition-all border border-gray-800 cursor-pointer bg-gradient-to-br from-gray-900 to-black rounded-xl hover:border-purple-500/30"
          onClick={() => setShowSwitchHistory(!showSwitchHistory)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">切换记录</span>
            <svg className={`w-4 h-4 text-purple-500/50 transition-transform ${showSwitchHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="text-2xl font-black text-white">{recentLogs.length}</div>
          <div className="mt-1 text-xs text-gray-600">点击展开</div>
        </div>
      </div>

      {/* ==================== 切换历史（可折叠） ==================== */}
      {showSwitchHistory && recentLogs.length > 0 && (
        <div className="p-4 mb-6 duration-200 border bg-gradient-to-br from-gray-900/80 to-black border-purple-500/30 rounded-xl animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-purple-400">最近切换记录</h3>
            <button
              onClick={() => setShowClearLogsDialog(true)}
              disabled={actionLoading}
              className="px-2 py-1 text-xs text-red-400 transition-all border rounded bg-red-600/10 border-red-600/30 hover:bg-red-600/20 disabled:opacity-50"
            >
              清空
            </button>
          </div>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2.5 bg-black/40 border border-gray-800/50 rounded-lg text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-12 font-mono text-gray-600">
                    {new Date(log.switch_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-gray-400">
                    {log.source_config_name || '未知'}
                  </span>
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="font-medium text-yellow-400">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* 左侧: 分组列表 */}
        <div className="lg:col-span-1">
          <div className="p-4 border bg-gradient-to-br from-black via-gray-950 to-black border-yellow-500/20 rounded-xl">
            <div className="flex items-center justify-between pb-2 mb-4 border-b border-yellow-500/20">
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
                        className="p-1 text-gray-400 transition-all rounded bg-gray-800/70 hover:bg-gray-700 hover:text-white"
                        title="编辑"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {group.id !== 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                          className="p-1 text-red-500 transition-all rounded bg-red-500/10 hover:bg-red-500/20"
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
          <div className="p-5 border bg-gradient-to-br from-black via-gray-950 to-black border-yellow-500/20 rounded-xl">
            {/* 标题栏 */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-yellow-500/20">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-yellow-500">
                  {selectedGroupId === null ? '全部配置' : groups.find((g) => g.id === selectedGroupId)?.name || '配置列表'}
                </h2>
                {/* 视图切换 */}
                <div className="flex overflow-hidden border border-gray-800 rounded-lg bg-gray-900/70">
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
                      viewMode === 'monitor' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setViewMode('monitor')}
                  >
                    监控
                  </button>
                </div>
              </div>

              {/* 右侧操作区 */}
              <div className="flex items-center gap-3">
                {/* 自动检测开关和频率选择 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleHealthCheck}
                    disabled={healthCheckLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      healthCheckStatus?.running
                        ? 'bg-cyan-500'
                        : 'bg-gray-700'
                    } ${healthCheckLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={healthCheckStatus?.running ? '自动检测运行中' : '点击启用自动检测'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        healthCheckStatus?.running ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-gray-400">自动检测</span>

                  {/* 频率选择下拉框 */}
                  <select
                    value={healthCheckInterval}
                    onChange={(e) => handleIntervalChange(Number(e.target.value))}
                    disabled={healthCheckLoading}
                    className="px-2 py-1 text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value={60}>1分钟</option>
                    <option value={180}>3分钟</option>
                    <option value={300}>5分钟</option>
                    <option value={600}>10分钟</option>
                    <option value={900}>15分钟</option>
                    <option value={1800}>30分钟</option>
                  </select>

                  {/* 问号提示 */}
                  <div className="relative group">
                    <svg className="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute z-20 invisible w-64 px-3 py-2 mb-2 text-xs text-gray-300 transition-all transform -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl opacity-0 bottom-full left-1/2 group-hover:opacity-100 group-hover:visible">
                      <div className="mb-1 font-medium text-cyan-400">自动检测说明</div>
                      <p>定时向服务商发送模拟 Claude Code 的请求，检查服务是否正常。</p>
                      <p className="mt-1 text-gray-500">如果服务异常，系统会按照列表顺序自动切换到下一个可用的服务商。</p>
                      {/* 小箭头 */}
                      <div className="absolute transform -translate-x-1/2 border-4 border-transparent top-full left-1/2 border-t-gray-700" />
                    </div>
                  </div>
                </div>

                {/* 分隔线 */}
                <div className="w-px h-6 bg-gray-700" />

                {/* 新建配置按钮 */}
                <button
                  className="px-4 py-2 text-sm font-bold text-black transition-all bg-yellow-500 rounded-lg hover:bg-yellow-400"
                  onClick={handleCreateConfig}
                >
                  + 新建配置
                </button>
              </div>
            </div>

            {/* 配置列表或监控视图 */}
            {viewMode === 'monitor' ? (
              <HealthMonitorPanel
                configs={sortedConfigs}
                groupId={selectedGroupId}
                onRefresh={loadData}
                checkIntervalSecs={healthCheckInterval}
              />
            ) : sortedConfigs.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-3 text-sm font-medium text-gray-400">暂无配置</h3>
                <p className="mt-1 text-xs text-gray-600">点击"新建配置"按钮开始添加</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedConfigs.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {/* 拖拽提示 */}
                  <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-gray-900/50 border border-gray-800 rounded-lg">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span className="text-xs text-gray-500">拖拽调整顺序 · 顺序决定自动切换优先级（序号小的优先）</span>
                  </div>

                  <div className="space-y-3">
                    {sortedConfigs.map((config, index) => {
                      const isActive = proxyStatus?.active_config_id === config.id;
                      const isProxyRunning = proxyStatus?.status === 'running';
                      const isJustSwitchedTarget = switchState.justSwitched && switchState.targetConfigId === config.id;
                      const isJustSwitchedSource = switchState.justSwitched && switchState.sourceConfigId === config.id;

                      return (
                        <SortableConfigCard
                          key={config.id}
                          config={config}
                          groups={groups}
                          displayOrder={index + 1}
                          isActive={isActive}
                          isProxyRunning={isProxyRunning}
                          isJustSwitchedTarget={isJustSwitchedTarget}
                          isJustSwitchedSource={isJustSwitchedSource}
                          switchReason={switchState.reason}
                          testingConfigId={testingConfigId}
                          queryingBalanceId={queryingBalanceId}
                          actionLoading={actionLoading}
                          onSwitchConfig={handleSwitchConfig}
                          onTestConfig={handleTestConfig}
                          onQueryBalance={handleQueryBalance}
                          onEditConfig={handleEditConfig}
                          onDeleteConfig={handleDeleteConfig}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
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

      <MessageDialog
        isOpen={messageDialogOpen}
        type={messageDialogType}
        title={messageDialogTitle}
        content={messageDialogContent}
        onClose={() => setMessageDialogOpen(false)}
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
