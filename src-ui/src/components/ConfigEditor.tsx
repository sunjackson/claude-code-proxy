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
    apiKey: string;
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

  // 新增：UI 状态
  const [showPresets, setShowPresets] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>('official');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSpeedTest, setShowSpeedTest] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

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
    } else {
      // 新建模式重置表单
      setName('');
      setApiKey('');
      setServerUrl('https://');
      setGroupId(1); // 默认选择"默认分组"
      setDefaultModel('');
      setHaikuModel('');
      setSonnetModel('');
      setOpusModel('');
      setSmallFastModel('');
      setApiTimeoutMs(600000);
      setMaxOutputTokens(65000);
    }
    setErrors({});
    setShowApiKey(false);
    setShowPresets(false);
    setShowAdvanced(false);
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
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-black border border-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-2xl font-bold text-yellow-500">
            {config ? '编辑 API 配置' : '新建 API 配置'}
          </h2>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          {/* 预设选择器 */}
          {!config && (
            <div className="border-t border-gray-800 pt-6">
              <button
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-700 rounded hover:border-yellow-500 transition-colors"
              >
                <span className="text-gray-300 font-medium">
                  {showPresets ? '隐藏预设模板' : '使用预设模板快速配置'}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${showPresets ? 'rotate-180' : ''}`}
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

              {showPresets && (
                <div className="mt-4 border border-gray-800 rounded-lg p-4">
                  {/* 加载状态 */}
                  {loadingPresets ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                      <span className="ml-3 text-gray-400">加载预设列表...</span>
                    </div>
                  ) : providerPresets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      未找到预设配置，请检查配置文件
                    </div>
                  ) : (
                    <>
                      {/* 分类选择器 */}
                      <div className="flex gap-2 mb-4 overflow-x-auto">
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
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                            isSelected
                              ? `${colors.bg} ${colors.text} ${colors.border} border`
                              : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700'
                          }`}
                        >
                          {categoryLabels[cat]} ({presets.length})
                        </button>
                      );
                    })}
                  </div>

                  {/* 预设列表 */}
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {getPresetsByCategory(selectedCategory).map((preset) => {
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset.id)}
                          className="text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded hover:border-yellow-500 transition-colors group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white group-hover:text-yellow-500 transition-colors">
                                  {preset.name}
                                </span>
                                {preset.isRecommended && (
                                  <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs font-medium rounded border border-yellow-500">
                                    推荐
                                  </span>
                                )}
                                {preset.isPartner && (
                                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-500 text-xs font-medium rounded border border-blue-500">
                                    合作
                                  </span>
                                )}
                              </div>
                              {preset.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {preset.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-600 mt-1">
                                {preset.serverUrl}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 高级配置 */}
          <div className="border-t border-gray-800 pt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-700 rounded hover:border-yellow-500 transition-colors"
            >
              <span className="text-gray-300 font-medium">
                高级配置 (模型、超时等)
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
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
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 transition-colors font-medium"
            >
              {config ? '保存' : '创建'}
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
