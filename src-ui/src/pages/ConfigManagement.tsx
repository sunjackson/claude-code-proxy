/**
 * 配置管理页面
 * 管理 API 配置和配置分组
 */

import React, { useState, useEffect } from 'react';
import type { ConfigGroup, ApiConfig } from '../types/tauri';
import * as configApi from '../api/config';
import * as testApi from '../api/test';
import * as balanceApi from '../api/balance';
import { ConfigEditor } from '../components/ConfigEditor';
import { GroupEditor } from '../components/GroupEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MessageDialog } from '../components/ui/Dialog';
import { TestResultPanel } from '../components/TestResultPanel';
import { CompactLayout } from '../components/CompactLayout';
import { categoryLabels, categoryColors, type ProviderCategory } from '../config/providerPresets';
import { formatDisplayUrl } from '../utils/url';

export const ConfigManagement: React.FC = () => {
  // 状态管理
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'test'>('list');
  const [testingConfigId, setTestingConfigId] = useState<number | null>(null);
  const [queryingBalanceId, setQueryingBalanceId] = useState<number | null>(null);

  // 对话框状态
  const [configEditorOpen, setConfigEditorOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ConfigGroup | null>(null);
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

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 加载所有分组
      const groupsData = await configApi.listConfigGroups();
      setGroups(groupsData);

      // 加载所有配置
      const configsData = await configApi.listApiConfigs();
      setConfigs(configsData);

      setLoading(false);
    } catch (err) {
      console.error('加载数据失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
      setLoading(false);
    }
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
        // 更新配置
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
        // 创建配置（创建时apiKey必须提供）
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
      // 设置测试中状态
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
      // 清除测试中状态
      setTestingConfigId(null);
    }
  };

  const handleQueryBalance = async (config: ApiConfig) => {
    try {
      // 设置查询中状态
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
            <span className="text-amber-400 font-medium">{balanceText}</span>
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
      // 清除查询中状态
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
        // 更新分组
        await configApi.updateConfigGroup(
          editingGroup.id,
          data.name,
          data.description,
          data.autoSwitchEnabled,
          data.latencyThresholdMs
        );
      } else {
        // 创建分组
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
          await configApi.deleteConfigGroup(group.id, true); // 移动配置到未分组
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err) {
          console.error('删除分组失败:', err);
          showMessage('error', '删除分组失败', err instanceof Error ? err.message : '未知错误');
        }
      },
    });
  };

  return (
    <CompactLayout>
      {/* 错误提示 */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-900 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
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
                    const groupConfigCount = configs.filter(
                      (c) => c.group_id === group.id
                    ).length;
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
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
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
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
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
                        : groups.find((g) => g.id === selectedGroupId)?.name ||
                          '配置列表'}
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
                    <svg
                      className="mx-auto h-12 w-12 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-400">
                      暂无配置
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      点击"新建配置"按钮开始添加 API 配置
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sortedConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-6 hover:border-yellow-500/60 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10 hover:scale-[1.01]"
                      >
                        {/* 标题栏：配置名 + 标签 + 操作按钮 */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-white">
                              {config.name}
                            </h3>
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

                          {/* 模型配置信息（如果有的话） */}
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
            </div>
        </div>
      )}

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

      <MessageDialog
        isOpen={messageDialogOpen}
        type={messageDialogType}
        title={messageDialogTitle}
        content={messageDialogContent}
        onClose={() => setMessageDialogOpen(false)}
      />
    </CompactLayout>
  );
};

export default ConfigManagement;
