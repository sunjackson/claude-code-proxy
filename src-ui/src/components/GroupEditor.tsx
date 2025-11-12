/**
 * 配置分组编辑器对话框
 * 用于新建和编辑配置分组
 */

import React, { useState, useEffect } from 'react';
import type { ConfigGroup } from '../types/tauri';

interface GroupEditorProps {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 编辑模式(null: 新建, ConfigGroup: 编辑) */
  group: ConfigGroup | null;
  /** 保存回调 */
  onSave: (data: {
    name: string;
    description: string | null;
    autoSwitchEnabled: boolean;
    latencyThresholdMs: number;
  }) => void;
  /** 取消回调 */
  onCancel: () => void;
}

export const GroupEditor: React.FC<GroupEditorProps> = ({
  isOpen,
  group,
  onSave,
  onCancel,
}) => {
  // 表单状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false);
  const [latencyThresholdMs, setLatencyThresholdMs] = useState(3000);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 编辑模式时加载分组数据
  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || '');
      setAutoSwitchEnabled(group.auto_switch_enabled);
      setLatencyThresholdMs(group.latency_threshold_ms);
    } else {
      // 新建模式重置表单
      setName('');
      setDescription('');
      setAutoSwitchEnabled(false);
      setLatencyThresholdMs(3000);
    }
    setErrors({});
  }, [group, isOpen]);

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '分组名称不能为空';
    } else if (name.length > 100) {
      newErrors.name = '分组名称不能超过 100 个字符';
    }

    if (latencyThresholdMs < 100 || latencyThresholdMs > 30000) {
      newErrors.latencyThresholdMs = '延迟阈值必须在 100-30000 毫秒范围内';
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

    onSave({
      name: name.trim(),
      description: description.trim() || null,
      autoSwitchEnabled,
      latencyThresholdMs,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-black border border-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4">
        {/* 标题 */}
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-2xl font-bold text-yellow-500">
            {group ? '编辑配置分组' : '新建配置分组'}
          </h2>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 分组名称 */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              分组名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2 bg-gray-900 border ${
                errors.name ? 'border-red-500' : 'border-gray-700'
              } rounded text-white focus:outline-none focus:border-yellow-500 transition-colors`}
              placeholder="例如: 工作配置"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* 分组描述 */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              分组描述
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              placeholder="可选的分组描述..."
            />
          </div>

          {/* 自动切换设置 */}
          <div className="border border-gray-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-yellow-500">
              自动切换设置
            </h3>

            {/* 启用自动切换 */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="autoSwitchEnabled"
                checked={autoSwitchEnabled}
                onChange={(e) => setAutoSwitchEnabled(e.target.checked)}
                className="mt-1 w-4 h-4 bg-gray-900 border-gray-700 rounded text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0"
              />
              <div className="flex-1">
                <label
                  htmlFor="autoSwitchEnabled"
                  className="text-sm font-medium text-gray-300 cursor-pointer"
                >
                  启用自动切换
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  当配置不可用或延迟过高时,自动切换到下一个可用配置
                </p>
              </div>
            </div>

            {/* 延迟阈值 */}
            <div>
              <label
                htmlFor="latencyThresholdMs"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                延迟阈值 (毫秒) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="latencyThresholdMs"
                value={latencyThresholdMs}
                onChange={(e) =>
                  setLatencyThresholdMs(parseInt(e.target.value) || 3000)
                }
                min="100"
                max="30000"
                step="100"
                className={`w-full px-4 py-2 bg-gray-900 border ${
                  errors.latencyThresholdMs
                    ? 'border-red-500'
                    : 'border-gray-700'
                } rounded text-white focus:outline-none focus:border-yellow-500 transition-colors`}
                disabled={!autoSwitchEnabled}
              />
              {errors.latencyThresholdMs && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.latencyThresholdMs}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                当配置延迟超过此值时,将触发自动切换
              </p>
            </div>
          </div>

          {/* 提示信息 */}
          {group?.id === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p className="text-sm text-yellow-500">
                  "未分组" 是系统默认分组,部分属性可能无法修改
                </p>
              </div>
            </div>
          )}

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
              {group ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupEditor;
