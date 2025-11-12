/**
 * 配置管理页面
 * 管理 API 配置和配置分组
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigGroup, ApiConfig } from '../types/tauri';
import * as configApi from '../api/config';
import * as testApi from '../api/test';
import { ConfigEditor } from '../components/ConfigEditor';
import { GroupEditor } from '../components/GroupEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TestResultPanel } from '../components/TestResultPanel';
import { AppLayout } from '../components/AppLayout';
import { categoryLabels, categoryColors, type ProviderCategory } from '../config/providerPresets';
import { formatDisplayUrl } from '../utils/url';

export const ConfigManagement: React.FC = () => {
  const { t } = useTranslation();
  // 状态管理
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'test'>('list');

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
    apiKey: string;
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
        });
      } else {
        // 创建配置
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
      const result = await testApi.testApiConfig(config.id);
      alert(
        `测试结果:\n延迟: ${result.latency_ms ? result.latency_ms + ' ms' : '-'}\n状态: ${result.is_success ? '可用' : '不可用'}${result.error_message ? '\n错误: ' + result.error_message : ''}`
      );
      await loadData();
    } catch (err) {
      console.error('测试配置失败:', err);
      alert(`测试配置失败: ${err instanceof Error ? err.message : '未知错误'}`);
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
          await configApi.deleteConfigGroup(group.id, true); // 移动配置到未分组
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err) {
          console.error('删除分组失败:', err);
          alert(`删除分组失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      },
    });
  };

  return (
    <AppLayout title={t('nav.configs')} subtitle={t('config.subtitle')}>
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
              <div className="bg-black border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-yellow-500">
                    配置分组
                  </h2>
                  <button
                    className="px-3 py-1 bg-yellow-500 text-black rounded hover:bg-yellow-600 transition-colors text-sm font-medium"
                    onClick={handleCreateGroup}
                  >
                    + 新建
                  </button>
                </div>

                <div className="space-y-2">
                  {/* 全部配置 */}
                  <button
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedGroupId === null
                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500'
                        : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
                    }`}
                    onClick={() => setSelectedGroupId(null)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">全部配置</span>
                      <span className="text-sm">{configs.length}</span>
                    </div>
                  </button>

                  {/* 分组列表 */}
                  {groups.map((group) => {
                    const groupConfigCount = configs.filter(
                      (c) => c.group_id === group.id
                    ).length;

                    return (
                      <div
                        key={group.id}
                        className={`relative group/item w-full px-3 py-2 rounded transition-colors ${
                          selectedGroupId === group.id
                            ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500'
                            : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
                        }`}
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => setSelectedGroupId(group.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">
                              {group.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{groupConfigCount}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditGroup(group);
                                }}
                                className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                                title="编辑分组"
                              >
                                <svg
                                  className="w-4 h-4"
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
                                  className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all text-red-500"
                                  title="删除分组"
                                >
                                  <svg
                                    className="w-4 h-4"
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
                          {group.description && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {group.description}
                            </p>
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
              <div className="bg-black border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-yellow-500">
                      {selectedGroupId === null
                        ? '全部配置'
                        : groups.find((g) => g.id === selectedGroupId)?.name ||
                          '配置列表'}
                    </h2>
                    {/* 视图切换 */}
                    <div className="flex bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                      <button
                        className={`px-3 py-1 text-sm transition-colors ${
                          viewMode === 'list'
                            ? 'bg-yellow-500 text-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setViewMode('list')}
                      >
                        列表视图
                      </button>
                      <button
                        className={`px-3 py-1 text-sm transition-colors ${
                          viewMode === 'test'
                            ? 'bg-yellow-500 text-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setViewMode('test')}
                      >
                        端点测速
                      </button>
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 transition-colors font-medium"
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
                  <div className="space-y-4">
                    {sortedConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-yellow-500/50 transition-all hover:shadow-lg hover:shadow-yellow-500/10"
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
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <button
                              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-md hover:bg-blue-500/20 transition-colors text-sm border border-blue-500/30 hover:border-blue-500/50"
                              onClick={() => handleTestConfig(config)}
                              title="测试连接"
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              测试
                            </button>
                            <button
                              className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 transition-colors text-sm border border-gray-700 hover:border-gray-600"
                              onClick={() => handleEditConfig(config)}
                              title="编辑配置"
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              编辑
                            </button>
                            <button
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors text-sm border border-red-500/30 hover:border-red-500/50"
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
                        <div className="space-y-2.5 text-sm">
                          {/* 服务器地址 */}
                          <div className="flex items-start">
                            <span className="text-gray-500 w-20 flex-shrink-0">服务器</span>
                            <span className="text-gray-300 break-all" title={config.server_url}>
                              {formatDisplayUrl(config.server_url)}
                            </span>
                          </div>

                          {/* 所属分组 */}
                          <div className="flex items-center">
                            <span className="text-gray-500 w-20 flex-shrink-0">所属分组</span>
                            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/30 text-xs">
                              {groups.find((g) => g.id === config.group_id)?.name || '未分组'}
                            </span>
                          </div>

                          {/* 测试信息 */}
                          {config.last_test_at && (
                            <div className="flex items-center pt-1 border-t border-gray-800">
                              <span className="text-gray-500 w-20 flex-shrink-0">最后测试</span>
                              <div className="flex items-center gap-4 text-gray-400">
                                <span>
                                  {new Date(config.last_test_at).toLocaleString('zh-CN', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {config.last_latency_ms && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    config.last_latency_ms < 200
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                      : config.last_latency_ms < 500
                                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                  }`}>
                                    {config.last_latency_ms} ms
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 模型配置信息（如果有的话） */}
                          {(config.default_model || config.sonnet_model || config.haiku_model || config.opus_model) && (
                            <div className="flex items-start pt-1 border-t border-gray-800">
                              <span className="text-gray-500 w-20 flex-shrink-0">模型配置</span>
                              <div className="flex flex-wrap gap-1.5">
                                {config.default_model && (
                                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs border border-purple-500/30">
                                    默认: {config.default_model}
                                  </span>
                                )}
                                {config.sonnet_model && (
                                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/30">
                                    Sonnet: {config.sonnet_model}
                                  </span>
                                )}
                                {config.haiku_model && (
                                  <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs border border-green-500/30">
                                    Haiku: {config.haiku_model}
                                  </span>
                                )}
                                {config.opus_model && (
                                  <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded text-xs border border-orange-500/30">
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
    </AppLayout>
  );
};

export default ConfigManagement;
