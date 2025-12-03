/**
 * 环境变量管理组件
 * 管理应用运行时的环境变量
 */

import React, { useState, useEffect } from 'react';
import type { EnvironmentVariable, ApiConfig } from '../types/tauri';
import * as envVarApi from '../api/env-var';
import * as apiConfigApi from '../api/config';
import { ConfirmDialog } from './ui/Dialog';

interface ConfigSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (configId: number) => void;
  configs: ApiConfig[];
}

const ConfigSelectorDialog: React.FC<ConfigSelectorDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  configs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-amber-400">选择 API 配置</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {configs.map((config) => (
            <button
              key={config.id}
              onClick={() => onSelect(config.id)}
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-500/50 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-amber-400 font-medium">{config.name}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {config.server_url}:{config.server_port}
                  </div>
                </div>
                {config.is_available && (
                  <span className="text-green-400 text-xs">✓ 可用</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {configs.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            暂无 API 配置,请先创建配置
          </div>
        )}
      </div>
    </div>
  );
};

export const EnvironmentVariableManager: React.FC = () => {
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [filter, setFilter] = useState<'all' | 'anthropic'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // 清除确认弹窗状态
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // 加载环境变量
  const loadVariables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await envVarApi.listEnvironmentVariables();
      setVariables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载环境变量失败');
      console.error('Failed to load environment variables:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载 API 配置列表
  const loadConfigs = async () => {
    try {
      const data = await apiConfigApi.listApiConfigs();
      setConfigs(data);
    } catch (err) {
      console.error('Failed to load API configs:', err);
    }
  };

  useEffect(() => {
    loadVariables();
    loadConfigs();
  }, []);

  // 刷新
  const handleRefresh = () => {
    loadVariables();
  };

  // 从配置应用
  const handleApplyFromConfig = async (configId: number) => {
    try {
      setError(null);
      await envVarApi.applyConfigToEnv(configId);
      setIsConfigDialogOpen(false);
      await loadVariables();
      // 可以显示成功提示
    } catch (err) {
      setError(err instanceof Error ? err.message : '应用配置失败');
      console.error('Failed to apply config to env:', err);
    }
  };

  // 清除 Anthropic 环境变量
  const handleClearAnthropicEnv = async () => {
    setClearConfirmOpen(true);
  };

  const confirmClearAnthropicEnv = async () => {
    try {
      setError(null);
      await envVarApi.clearAnthropicEnv();
      await loadVariables();
    } catch (err) {
      setError(err instanceof Error ? err.message : '清除环境变量失败');
      console.error('Failed to clear Anthropic env:', err);
    } finally {
      setClearConfirmOpen(false);
    }
  };

  // 筛选和搜索
  const filteredVariables = React.useMemo(() => {
    let filtered = variables;

    // 按类型筛选
    if (filter === 'anthropic') {
      filtered = filtered.filter((v) => v.is_anthropic);
    }

    // 按关键字搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.key.toLowerCase().includes(query) ||
          v.value.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [variables, filter, searchQuery]);

  if (loading && variables.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-amber-400">环境变量管理</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsConfigDialogOpen(true)}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors font-medium"
          >
            从配置应用
          </button>
          <button
            onClick={handleClearAnthropicEnv}
            className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            清除 Anthropic 变量
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 border border-amber-500/30 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '⏳ 刷新中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* 筛选和搜索栏 */}
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* 筛选按钮 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">筛选:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-amber-500 text-black font-medium'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('anthropic')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                filter === 'anthropic'
                  ? 'bg-amber-500 text-black font-medium'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Anthropic 变量
            </button>
          </div>

          {/* 搜索框 */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索变量名或值..."
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* 显示/隐藏值 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-400">显示变量值</span>
        </label>
      </div>

      {/* 变量列表 */}
      {filteredVariables.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            {searchQuery || filter === 'anthropic' ? '没有找到匹配的环境变量' : '暂无环境变量'}
          </p>
        </div>
      ) : (
        <>
          {/* 统计信息 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              显示 {filteredVariables.length} 个环境变量
              {filter === 'anthropic' && ` (共 ${variables.length} 个)`}
            </span>
          </div>

          {/* 表格 */}
          <div className="bg-gray-900 border border-amber-500/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    变量名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    变量值
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    类型
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredVariables.map((variable) => (
                  <tr key={variable.key} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-amber-400">
                        {variable.key}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300 font-mono">
                        {showValues ? variable.value : '••••••••'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {variable.is_anthropic && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                          Anthropic
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 配置选择对话框 */}
      <ConfigSelectorDialog
        isOpen={isConfigDialogOpen}
        onClose={() => setIsConfigDialogOpen(false)}
        onSelect={handleApplyFromConfig}
        configs={configs}
      />

      {/* 清除确认弹窗 */}
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        type="warning"
        title="清除环境变量"
        subtitle="此操作将影响当前运行环境"
        content={
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-300">
              确定要清除所有 <span className="text-amber-400 font-medium">Anthropic 相关</span> 的环境变量吗？
            </p>
            <p className="text-gray-500 text-sm mt-2">
              包括 ANTHROPIC_API_KEY、ANTHROPIC_BASE_URL 等变量
            </p>
          </div>
        }
        confirmText="确认清除"
        onConfirm={confirmClearAnthropicEnv}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
};
