/**
 * 配置分组编辑器对话框
 * 用于新建和编辑配置分组
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    healthCheckEnabled: boolean;
    healthCheckIntervalSec: number;
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
  const { t } = useTranslation();
  // 表单状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false);
  const [latencyThresholdMs, setLatencyThresholdMs] = useState(100000);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);
  const [healthCheckIntervalSec, setHealthCheckIntervalSec] = useState(300);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 编辑模式时加载分组数据
  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || '');
      setAutoSwitchEnabled(group.auto_switch_enabled);
      setLatencyThresholdMs(group.latency_threshold_ms);
      setHealthCheckEnabled(group.health_check_enabled || false);
      setHealthCheckIntervalSec(group.health_check_interval_sec || 300);
    } else {
      // 新建模式重置表单
      setName('');
      setDescription('');
      setAutoSwitchEnabled(false);
      setLatencyThresholdMs(100000);
      setHealthCheckEnabled(false);
      setHealthCheckIntervalSec(300);
    }
    setErrors({});
  }, [group, isOpen]);

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('groupEditor.groupNameRequired');
    } else if (name.length > 100) {
      newErrors.name = t('groupEditor.groupNameTooLong');
    }

    if (latencyThresholdMs < 100 || latencyThresholdMs > 100000) {
      newErrors.latencyThresholdMs = t('groupEditor.latencyThresholdError');
    }

    if (healthCheckIntervalSec < 60 || healthCheckIntervalSec > 3600) {
      newErrors.healthCheckIntervalSec = t('groupEditor.checkIntervalError');
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
      healthCheckEnabled,
      healthCheckIntervalSec,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/40 rounded-xl shadow-2xl shadow-yellow-500/20 max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 标题 */}
        <div className="border-b border-gray-800 px-6 py-5 bg-gradient-to-r from-yellow-500/5 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-yellow-400 tracking-wide">
              {group ? t('groupEditor.editConfigGroup') : t('groupEditor.newConfigGroup')}
            </h2>
          </div>
        </div>

        {/* 表单 - 可滚动区域 */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 分组名称 */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              {t('config.groupName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2 bg-gray-900 border ${
                errors.name ? 'border-red-500' : 'border-gray-700'
              } rounded text-white focus:outline-none focus:border-yellow-500 transition-colors`}
              placeholder={t('groupEditor.groupNamePlaceholder')}
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
              {t('config.groupDescription')}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              placeholder={t('groupEditor.groupDescPlaceholder')}
            />
          </div>

          {/* 自动切换设置 */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-yellow-500/30 rounded-lg p-5 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <h3 className="text-sm font-bold text-yellow-400 tracking-wide">
                {t('groupEditor.autoSwitchSettings')}
              </h3>
            </div>

            {/* 启用自动切换 */}
            <div className="flex items-start justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <div className="flex-1">
                <label
                  htmlFor="autoSwitchEnabled"
                  className="text-sm font-semibold text-gray-200 cursor-pointer block mb-1"
                >
                  {t('groupEditor.enableAutoSwitch')}
                </label>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {t('groupEditor.autoSwitchHint')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  id="autoSwitchEnabled"
                  checked={autoSwitchEnabled}
                  onChange={(e) => setAutoSwitchEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>

            {/* 延迟阈值 */}
            <div className={`p-4 rounded-lg border transition-all ${
              autoSwitchEnabled
                ? 'bg-gray-900/50 border-gray-800'
                : 'bg-gray-900/30 border-gray-800/50 opacity-60'
            }`}>
              <label
                htmlFor="latencyThresholdMs"
                className="block text-sm font-semibold text-gray-200 mb-2"
              >
                {t('groupEditor.latencyThreshold')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="latencyThresholdMs"
                value={latencyThresholdMs}
                onChange={(e) =>
                  setLatencyThresholdMs(parseInt(e.target.value) || 100000)
                }
                min="100"
                max="100000"
                step="100"
                className={`w-full px-4 py-2.5 bg-black border ${
                  errors.latencyThresholdMs
                    ? 'border-red-500'
                    : 'border-gray-700'
                } rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={!autoSwitchEnabled}
              />
              {errors.latencyThresholdMs && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.latencyThresholdMs}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {t('groupEditor.latencyThresholdHint')}
              </p>
            </div>
          </div>

          {/* 健康检查设置 */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-yellow-500/30 rounded-lg p-5 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-bold text-yellow-400 tracking-wide">
                {t('groupEditor.autoHealthCheck')}
              </h3>
            </div>

            {/* 启用健康检查 */}
            <div className="flex items-start justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <div className="flex-1">
                <label
                  htmlFor="healthCheckEnabled"
                  className="text-sm font-semibold text-gray-200 cursor-pointer block mb-1"
                >
                  {t('groupEditor.enableAutoDetection')}
                </label>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {t('groupEditor.healthCheckHint')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  id="healthCheckEnabled"
                  checked={healthCheckEnabled}
                  onChange={(e) => setHealthCheckEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>

            {/* 检查间隔 */}
            <div className={`p-4 rounded-lg border transition-all ${
              healthCheckEnabled
                ? 'bg-gray-900/50 border-gray-800'
                : 'bg-gray-900/30 border-gray-800/50 opacity-60'
            }`}>
              <label
                htmlFor="healthCheckIntervalSec"
                className="block text-sm font-semibold text-gray-200 mb-2"
              >
                {t('groupEditor.checkIntervalLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="healthCheckIntervalSec"
                value={healthCheckIntervalSec}
                onChange={(e) =>
                  setHealthCheckIntervalSec(parseInt(e.target.value) || 300)
                }
                min="60"
                max="3600"
                step="60"
                className={`w-full px-4 py-2.5 bg-black border ${
                  errors.healthCheckIntervalSec
                    ? 'border-red-500'
                    : 'border-gray-700'
                } rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={!healthCheckEnabled}
              />
              {errors.healthCheckIntervalSec && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.healthCheckIntervalSec}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {t('groupEditor.checkIntervalHint')}
              </p>
            </div>
          </div>

          {/* 提示信息 */}
          {group?.id === 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/40 rounded-lg p-4 shadow-lg shadow-blue-500/5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <svg
                    className="w-4 h-4 text-blue-400"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <p className="text-sm text-blue-300 leading-relaxed">
                  {t('groupEditor.defaultGroupHint')}
                </p>
              </div>
            </div>
          )}

            {/* 按钮 */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-800">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 bg-gray-900 text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-all duration-200 font-semibold border border-gray-800 hover:border-gray-700"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black rounded-lg transition-all duration-200 font-bold shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105 flex items-center gap-2"
              >
                {group ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('common.save')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('common.create')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GroupEditor;
