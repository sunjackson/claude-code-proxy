/**
 * API 配置编辑器对话框
 * 用于新建和编辑 API 配置
 */

import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import type { ApiConfig, ConfigGroup } from '../types/tauri';
import {
  categoryLabels,
  categoryColors,
  type ProviderCategory,
} from '../config/providerPresets';
import type { ProviderPreset } from '../api/providerPreset';
import * as providerPresetApi from '../api/providerPreset';
import * as configApi from '../api/config';
import { EndpointSpeedTest } from './EndpointSpeedTest';

interface ConfigEditorProps {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 编辑模式(null: 新建, ApiConfig: 编辑) */
  config: ApiConfig | null;
  /** 所有分组列表 */
  groups: ConfigGroup[];
  /** 保存回调 */
  onSave: (data: {
    name: string;
    apiKey: string | undefined;
    serverUrl: string;
    serverPort: number;
    groupId: number | null;
    // 新增字段
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
  }) => void;
  /** 取消回调 */
  onCancel: () => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  isOpen,
  config,
  groups,
  onSave,
  onCancel,
}) => {
  // 表单状态
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('https://');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingApiKey, setLoadingApiKey] = useState(false);

  // 新增：模型配置状态
  const [defaultModel, setDefaultModel] = useState('');
  const [haikuModel, setHaikuModel] = useState('');
  const [sonnetModel, setSonnetModel] = useState('');
  const [opusModel, setOpusModel] = useState('');
  const [smallFastModel, setSmallFastModel] = useState('');

  // 新增：高级设置状态
  const [apiTimeoutMs, setApiTimeoutMs] = useState<number>(600000);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(65000);

  // 余额查询配置
  const [balanceQueryUrl, setBalanceQueryUrl] = useState('');
  const [autoBalanceCheck, setAutoBalanceCheck] = useState(true);
  const [balanceCheckIntervalSec, setBalanceCheckIntervalSec] = useState(3600);

  // 新增：UI 状态
  const [showPresets, setShowPresets] = useState(true); // 默认展开预设
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>('official');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSpeedTest, setShowSpeedTest] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [useManualConfig, setUseManualConfig] = useState(false); // 是否使用手动配置

  // 新增：预设列表状态
  const [providerPresets, setProviderPresets] = useState<ProviderPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  // 加载供应商预设列表
  useEffect(() => {
    const loadPresets = async () => {
      try {
        setLoadingPresets(true);
        const presets = await providerPresetApi.listProviderPresets();
        setProviderPresets(presets);
      } catch (err) {
        console.error('加载供应商预设失败:', err);
      } finally {
        setLoadingPresets(false);
      }
    };

    if (isOpen) {
      loadPresets();
    }
  }, [isOpen]);

  // 根据分类过滤预设
  const getPresetsByCategory = (category: ProviderCategory): ProviderPreset[] => {
    return providerPresets.filter((p) => p.category === category);
  };

  // 加载当前API密钥
  const loadCurrentApiKey = async () => {
    if (!config) return;

    try {
      setLoadingApiKey(true);
      const key = await configApi.getApiKey(config.id);
      setApiKey(key);
      setShowApiKey(true); // 加载后自动显示
    } catch (err) {
      console.error('Failed to load API key:', err);
      setErrors({ ...errors, apiKey: '加载API密钥失败' });
    } finally {
      setLoadingApiKey(false);
    }
  };

  // 编辑模式时加载配置数据
  useEffect(() => {
    if (config) {
      setName(config.name);
      setApiKey(''); // 编辑模式不显示原密钥
      setServerUrl(config.server_url);
      setGroupId(config.group_id);
      // 加载新字段
      setDefaultModel(config.default_model || '');
      setHaikuModel(config.haiku_model || '');
      setSonnetModel(config.sonnet_model || '');
      setOpusModel(config.opus_model || '');
      setSmallFastModel(config.small_fast_model || '');
      setApiTimeoutMs(config.api_timeout_ms || 600000);
      setMaxOutputTokens(config.max_output_tokens || 65000);
      setBalanceQueryUrl(config.balance_query_url || '');
      setAutoBalanceCheck(config.auto_balance_check);
      setBalanceCheckIntervalSec(config.balance_check_interval_sec || 3600);
    } else {
      // 新建模式重置表单
      setName('');
      setApiKey('');
      setServerUrl('https://');
      // 默认选择第一个可用分组（通常是ID=0的"未分组"）
      setGroupId(groups.length > 0 ? groups[0].id : null);
      setDefaultModel('');
      setHaikuModel('');
      setSonnetModel('');
      setOpusModel('');
      setSmallFastModel('');
      setApiTimeoutMs(600000);
      setMaxOutputTokens(65000);
      setBalanceQueryUrl('');
      setAutoBalanceCheck(true);
      setBalanceCheckIntervalSec(3600);
    }
    setErrors({});
    setShowApiKey(false);
    setShowPresets(!config); // 新建模式默认展开预设
    setShowAdvanced(false);
    setUseManualConfig(false);
    setSelectedPresetId(null);
  }, [config, isOpen]);

  // 应用预设配置
  const applyPreset = (presetId: string) => {
    const preset = providerPresets.find((p) => p.id === presetId);
    if (!preset) return;

    setName(preset.name);
    setServerUrl(preset.serverUrl);
    if (preset.defaultModel) setDefaultModel(preset.defaultModel);
    if (preset.haikuModel) setHaikuModel(preset.haikuModel);
    if (preset.sonnetModel) setSonnetModel(preset.sonnetModel);
    if (preset.opusModel) setOpusModel(preset.opusModel);
    if (preset.smallFastModel) setSmallFastModel(preset.smallFastModel);
    if (preset.apiTimeoutMs) setApiTimeoutMs(preset.apiTimeoutMs);
    if (preset.maxOutputTokens) setMaxOutputTokens(preset.maxOutputTokens);
    if (preset.balanceQueryUrl) setBalanceQueryUrl(preset.balanceQueryUrl);

    setSelectedPresetId(presetId);
    setShowPresets(false);
  };

  // 获取端点候选列表（用于测速）
  const getEndpointCandidates = (): string[] => {
    const candidates: string[] = [];

    // 当前输入的 URL
    if (serverUrl && serverUrl !== 'https://' && serverUrl !== 'http://') {
      candidates.push(serverUrl);
    }

    // 从选中的预设获取候选端点
    if (selectedPresetId) {
      const preset = providerPresets.find((p) => p.id === selectedPresetId);
      if (preset && preset.endpointCandidates) {
        candidates.push(...preset.endpointCandidates);
      }
    }

    // 去重
    return Array.from(new Set(candidates));
  };

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '配置名称不能为空';
    } else if (name.length > 100) {
      newErrors.name = '配置名称不能超过 100 个字符';
    }

    // 新建模式必须提供 API 密钥
    if (!config && !apiKey.trim()) {
      newErrors.apiKey = 'API 密钥不能为空';
    }

    if (!serverUrl.trim()) {
      newErrors.serverUrl = '服务器地址不能为空';
    } else if (
      !serverUrl.startsWith('http://') &&
      !serverUrl.startsWith('https://')
    ) {
      newErrors.serverUrl = '服务器地址必须以 http:// 或 https:// 开头';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // server_port 已弃用，设置为 0 表示从 URL 中提取端口
    const serverPort = 0;

    onSave({
      name: name.trim(),
      // 创建模式：必须提供 apiKey
      // 编辑模式：如果为空则传 undefined 表示不修改
      apiKey: config ? (apiKey.trim() || undefined) : apiKey.trim(),
      serverUrl: serverUrl.trim(),
      serverPort,
      groupId,
      // 新增字段（仅当非空时传递）
      defaultModel: defaultModel.trim() || undefined,
      haikuModel: haikuModel.trim() || undefined,
      sonnetModel: sonnetModel.trim() || undefined,
      opusModel: opusModel.trim() || undefined,
      smallFastModel: smallFastModel.trim() || undefined,
      apiTimeoutMs,
      maxOutputTokens,
      balanceQueryUrl: balanceQueryUrl.trim() || undefined,
      autoBalanceCheck,
      balanceCheckIntervalSec,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/40 rounded-xl shadow-2xl shadow-yellow-500/20 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="border-b border-gray-800 px-6 py-5 bg-gradient-to-r from-yellow-500/5 to-transparent sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-yellow-400 tracking-wide">
              {config ? '编辑 API 配置' : '新建 API 配置'}
            </h2>
          </div>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 新建模式：快速配置区域 */}
          {!config && (
            <>
              {/* 快速配置引导 */}
              <div className="bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-500 mb-1">快速开始</h3>
                    <p className="text-sm text-gray-400">选择下方预设模板快速创建配置,或者手动填写自定义配置</p>
                  </div>
                </div>
              </div>

              {/* 预设模板选择区域 */}
              {showPresets && !useManualConfig && (
                <div className="bg-gradient-to-br from-gray-900/50 via-gray-900/30 to-black/50 border border-yellow-500/30 rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-yellow-400">选择预设模板</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseManualConfig(true)}
                      className="text-sm text-gray-400 hover:text-yellow-500 transition-colors flex items-center gap-2 font-medium"
                    >
                      <span>手动配置</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* 加载状态 */}
                  {loadingPresets ? (
                    <div className="flex items-center justify-center py-12 bg-black/30 rounded-lg border border-gray-800">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"></div>
                      <span className="ml-3 text-gray-400">加载预设列表...</span>
                    </div>
                  ) : providerPresets.length === 0 ? (
                    <div className="text-center py-12 bg-black/30 rounded-lg border border-gray-800">
                      <p className="text-gray-500 mb-4">未找到预设配置</p>
                      <button
                        type="button"
                        onClick={() => setUseManualConfig(true)}
                        className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
                      >
                        使用手动配置
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 分类选择器 */}
                      <div className="flex gap-3 overflow-x-auto pb-2 px-0.5">
                        {(['official', 'cn_official', 'third_party', 'aggregator'] as ProviderCategory[]).map((cat) => {
                          const presets = getPresetsByCategory(cat);
                          if (presets.length === 0) return null;

                          const colors = categoryColors[cat];
                          const isSelected = selectedCategory === cat;

                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                                isSelected
                                  ? `${colors.bg} ${colors.text} ${colors.border} border-2 shadow-lg scale-105`
                                  : 'bg-black/40 text-gray-400 border-2 border-gray-800 hover:border-gray-700 hover:scale-105'
                              }`}
                            >
                              {categoryLabels[cat]}
                              <span className="ml-1.5 text-xs opacity-75">({presets.length})</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* 预设列表 - 大卡片网格布局 */}
                      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto px-1 custom-scrollbar">
                        {getPresetsByCategory(selectedCategory).map((preset) => {
                          const isSelected = selectedPresetId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyPreset(preset.id)}
                              className={`text-left p-4 rounded-lg border-2 transition-all group ${
                                isSelected
                                  ? 'bg-gradient-to-br from-yellow-500/15 to-yellow-500/5 border-yellow-500 shadow-lg shadow-yellow-500/20'
                                  : 'bg-gradient-to-br from-black/40 to-gray-900/40 border-gray-800 hover:border-yellow-500/50 hover:from-gray-900/60 hover:to-gray-900/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* 标题行 */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`font-semibold text-base transition-colors ${
                                      isSelected ? 'text-yellow-500' : 'text-white group-hover:text-yellow-500'
                                    }`}>
                                      {preset.name}
                                    </span>
                                    {preset.isRecommended && (
                                      <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-md">
                                        推荐
                                      </span>
                                    )}
                                    {preset.isPartner && (
                                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-md">
                                        合作
                                      </span>
                                    )}
                                  </div>

                                  {/* 描述 */}
                                  {preset.description && (
                                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                                      {preset.description}
                                    </p>
                                  )}

                                  {/* 服务器地址 */}
                                  <p className="text-xs text-gray-600 font-mono truncate">
                                    {preset.serverUrl}
                                  </p>
                                </div>

                                {/* 选中指示器 */}
                                {isSelected && (
                                  <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* 手动配置切换提示 */}
                      <div className="flex items-center justify-center pt-4 mt-2 border-t border-gray-800/50">
                        <button
                          type="button"
                          onClick={() => setUseManualConfig(true)}
                          className="text-sm text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-2 group"
                        >
                          <span className="group-hover:scale-110 transition-transform">找不到合适的预设?</span>
                          <span className="font-semibold text-yellow-500 group-hover:text-yellow-400">手动填写配置</span>
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 手动配置模式切换提示 */}
              {useManualConfig && (
                <div className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                  <span className="text-sm text-gray-400">当前模式: 手动配置</span>
                  <button
                    type="button"
                    onClick={() => setUseManualConfig(false)}
                    className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回预设模板
                  </button>
                </div>
              )}

              {/* 分隔线 */}
              {(useManualConfig || selectedPresetId) && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-black text-gray-500">
                      {useManualConfig ? '手动填写配置信息' : '完善配置信息'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 基础配置表单 - 仅在手动配置或编辑模式或已选择预设时显示 */}
          {(config || useManualConfig || selectedPresetId) && (
            <>
              {/* 配置名称 */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
              配置名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2 bg-gray-900 border ${
                errors.name ? 'border-red-500' : 'border-gray-700'
              } rounded text-white focus:outline-none focus:border-yellow-500 transition-colors`}
              placeholder="例如: 公司 API 1"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* API 密钥 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-300"
              >
                API 密钥 {!config && <span className="text-red-500">*</span>}
                {config && (
                  <span className="text-gray-500 text-xs ml-2">
                    (留空表示不修改)
                  </span>
                )}
              </label>
              {config && !apiKey && (
                <button
                  type="button"
                  onClick={loadCurrentApiKey}
                  disabled={loadingApiKey}
                  className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors disabled:opacity-50"
                >
                  {loadingApiKey ? '加载中...' : '显示当前密钥'}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={`w-full px-4 py-2 pr-12 bg-gray-900 border ${
                  errors.apiKey ? 'border-red-500' : 'border-gray-700'
                } rounded text-white focus:outline-none focus:border-yellow-500 transition-colors`}
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-yellow-500 transition-colors"
              >
                {showApiKey ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                  </svg>
                )}
              </button>
            </div>
            {errors.apiKey && (
              <p className="mt-1 text-sm text-red-500">{errors.apiKey}</p>
            )}
          </div>

          {/* 服务器地址 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="serverUrl"
                className="block text-sm font-medium text-gray-300"
              >
                服务器地址 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSpeedTest(true)}
                disabled={!serverUrl || serverUrl === 'https://' || serverUrl === 'http://'}
                className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                端点测速
              </button>
            </div>
            <input
              type="text"
              id="serverUrl"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className={`w-full px-4 py-2 bg-gray-900 border ${
                errors.serverUrl ? 'border-red-500' : 'border-gray-700'
              } rounded text-white focus:outline-none focus:border-yellow-500 transition-colors`}
              placeholder="https://api.example.com 或 https://api.example.com:8443"
            />
            {errors.serverUrl && (
              <p className="mt-1 text-sm text-red-500">{errors.serverUrl}</p>
            )}
          </div>

          {/* 所属分组 */}
          <div>
            <label
              htmlFor="groupId"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              所属分组
            </label>
            <select
              id="groupId"
              value={groupId === null ? 0 : groupId}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setGroupId(value);
              }}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
              </>
            )}

          {/* 高级配置 */}
          <div className="border-t border-gray-800 pt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-900 via-gray-900 to-black border border-yellow-500/30 rounded-lg hover:border-yellow-500/50 transition-all duration-200 shadow-lg hover:shadow-yellow-500/10"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span className="text-gray-200 font-semibold">
                  高级配置 (模型、超时等)
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-yellow-500 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 border border-gray-800 rounded-lg p-4">
                {/* 模型配置 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-yellow-500 border-b border-gray-800 pb-2">
                    模型配置
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      默认模型
                    </label>
                    <input
                      type="text"
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="claude-sonnet-4-5-20250929"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Haiku 模型 (快速、低成本)
                    </label>
                    <input
                      type="text"
                      value={haikuModel}
                      onChange={(e) => setHaikuModel(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="claude-haiku-4-5-20251001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sonnet 模型 (平衡)
                    </label>
                    <input
                      type="text"
                      value={sonnetModel}
                      onChange={(e) => setSonnetModel(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="claude-sonnet-4-5-20250929"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Opus 模型 (最强)
                    </label>
                    <input
                      type="text"
                      value={opusModel}
                      onChange={(e) => setOpusModel(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="claude-opus-4-20250514"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      小型快速模型
                    </label>
                    <input
                      type="text"
                      value={smallFastModel}
                      onChange={(e) => setSmallFastModel(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="claude-haiku-4-5-20251001"
                    />
                  </div>
                </div>

                {/* 余额查询配置 */}
                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-yellow-500 border-b border-gray-800 pb-2">
                    余额查询配置
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      余额查询 URL
                    </label>
                    <input
                      type="text"
                      value={balanceQueryUrl}
                      onChange={(e) => setBalanceQueryUrl(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="https://api.example.com/v1/balance"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      用于查询账户余额的API接口地址（支持标准格式和自定义格式）
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-gray-800">
                    <div>
                      <label className="text-sm font-medium text-gray-300 block">
                        启用余额查询
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        开启后可以查询和显示账户余额，失败后会自动禁用
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoBalanceCheck}
                        onChange={(e) => setAutoBalanceCheck(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      查询间隔（秒）
                    </label>
                    <input
                      type="number"
                      value={balanceCheckIntervalSec}
                      onChange={(e) => setBalanceCheckIntervalSec(parseInt(e.target.value) || 3600)}
                      min="60"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                      placeholder="3600"
                      disabled={!autoBalanceCheck}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      自动查询余额的时间间隔（最小60秒，默认3600秒即1小时）
                    </p>
                  </div>
                </div>

                {/* API 高级设置 */}
                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-yellow-500 border-b border-gray-800 pb-2">
                    API 高级设置
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      API 超时时间 (毫秒)
                    </label>
                    <input
                      type="number"
                      value={apiTimeoutMs}
                      onChange={(e) => setApiTimeoutMs(parseInt(e.target.value) || 600000)}
                      min="1000"
                      max="3600000"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      推荐值: 600000 (10分钟)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      最大输出令牌数
                    </label>
                    <input
                      type="number"
                      value={maxOutputTokens}
                      onChange={(e) => setMaxOutputTokens(parseInt(e.target.value) || 65000)}
                      min="1000"
                      max="200000"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      推荐值: 65000
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-800 sticky bottom-0 bg-gradient-to-t from-black via-black to-transparent pb-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 bg-gray-900 text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-all duration-200 font-semibold border border-gray-800 hover:border-gray-700"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black rounded-lg transition-all duration-200 font-bold shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105 flex items-center gap-2"
            >
              {config ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  保存
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  创建
                </>
              )}
            </button>
          </div>
        </form>

        {/* 端点测速对话框 */}
        {showSpeedTest && (
          <EndpointSpeedTest
            value={serverUrl}
            onChange={setServerUrl}
            initialEndpoints={getEndpointCandidates()}
            visible={showSpeedTest}
            onClose={() => setShowSpeedTest(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ConfigEditor;
