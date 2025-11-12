/**
 * Dashboard 页面
 * 显示代理服务状态和快捷操作
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProxyService, ConfigGroup, ApiConfig, SwitchLog } from '../types/tauri';
import * as proxyApi from '../api/proxy';
import * as configApi from '../api/config';
import { AppLayout } from '../components/AppLayout';
import { ProxyStatusCard } from '../components/ProxyStatusCard';
import { QuickActionsPanel } from '../components/QuickActionsPanel';
import { SwitchLogTable } from '../components/SwitchLogTable';
import { useAutoSwitch } from '../hooks/useAutoSwitch';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  // 状态管理
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [recentLogs, setRecentLogs] = useState<SwitchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 监听自动切换事件
  useAutoSwitch((event) => {
    // 当发生自动切换时,重新加载数据以更新UI
    console.log('Auto-switch event received:', event);
    loadData();
  });

  // 加载数据
  useEffect(() => {
    loadData();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 启动代理服务
  const handleStartProxy = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const status = await proxyApi.startProxyService();
      setProxyStatus(status);
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

  // 停止代理服务
  const handleStopProxy = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const status = await proxyApi.stopProxyService();
      setProxyStatus(status);
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
      <div className="p-6 space-y-6">

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-amber-400">最近切换记录</h2>
            <span className="text-sm text-gray-400">显示最近 5 条</span>
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
    </AppLayout>
  );
};

export default Dashboard;
