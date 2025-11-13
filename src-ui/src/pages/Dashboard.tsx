/**
 * Dashboard 页面
 * 显示代理服务状态和快捷操作
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProxyService, ConfigGroup, ApiConfig, SwitchLog, ProxyConfig } from '../types/tauri';
import * as proxyApi from '../api/proxy';
import * as configApi from '../api/config';
import * as claudeCodeApi from '../api/claude-code';
import { AppLayout } from '../components/AppLayout';
import { ProxyStatusCard } from '../components/ProxyStatusCard';
import { QuickActionsPanel } from '../components/QuickActionsPanel';
import { SwitchLogTable } from '../components/SwitchLogTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAutoSwitch } from '../hooks/useAutoSwitch';
import { showSuccess, showError } from '../services/toast';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
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

  if (loading) {
    return (
      <AppLayout title={t('nav.dashboard')}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">{t('common.loading')}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('nav.dashboard')} subtitle={t('dashboard.subtitle')}>
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

      {/* 代理状态卡片 */}
      <ProxyStatusCard
        proxyStatus={proxyStatus}
        onStart={handleStartProxy}
        onStop={handleStopProxy}
        onRefresh={handleRefreshStatus}
        actionLoading={actionLoading}
      />

      {/* Claude Code 配置状态条 */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-700 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-purple-500/10 rounded-lg">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-semibold text-gray-200">Claude Code 集成</span>
                {claudeCodeProxyConfig ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-xs text-green-400 font-medium">已连接</span>
                    <span className="text-xs text-gray-500 font-mono">
                      {claudeCodeProxyConfig.host}:{claudeCodeProxyConfig.port}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-gray-500/10 border border-gray-600 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span className="text-xs text-gray-400 font-medium">未连接</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {claudeCodeProxyConfig
                  ? '代理服务已自动配置到 Claude Code，请求将通过本地代理转发'
                  : '启动代理服务后将自动配置到 Claude Code'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/claude-code')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-purple-500/50 rounded-lg transition-all"
              title="查看备份和详细设置"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>详细设置</span>
            </button>
          </div>
        </div>
      </div>

      {/* 快捷操作面板 */}
      <QuickActionsPanel
        proxyStatus={proxyStatus}
        groups={groups}
        configs={configs}
        onSwitchGroup={handleSwitchGroup}
        onSwitchConfig={handleSwitchConfig}
        onToggleAutoSwitch={handleToggleAutoSwitch}
        actionLoading={actionLoading}
      />

      {/* 最近切换日志 */}
      {recentLogs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-amber-400">切换历史</h2>
                <p className="text-xs text-gray-400">最近 5 条切换记录</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearLogsDialog(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600/20 border border-red-600/30 text-red-400 hover:bg-red-600/30 hover:border-red-600/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>清空历史</span>
              </button>
            </div>
          </div>
          <SwitchLogTable
            logs={recentLogs}
            onLoadMore={() => {}}
            hasMore={false}
            loading={false}
          />
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
    </AppLayout>
  );
};

export default Dashboard;
