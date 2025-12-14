/**
 * 模型映射管理组件
 * 用于管理 Claude ↔ OpenAI ↔ Gemini 模型映射配置
 * 按单向方向分组显示
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listModelMappings,
  createModelMapping,
  updateModelMapping,
  deleteModelMapping,
  exportModelMappings,
  importModelMappings,
  resetToDefaultMappings,
} from '../api/modelMapping';
import type { ModelMapping, MappingDirection, ModelProvider } from '../types/tauri';
import { toast } from '../services/toast';
import { ConfirmDialog } from './ConfirmDialog';

// 单向分组配置
interface DirectionGroup {
  direction: MappingDirection;
  labelKey: string;
  icon: string;
  sourceLabel: string;
  targetLabel: string;
  gradient: string;
  accent: string;
  border: string;
  sourceProvider: ModelProvider;
  targetProvider: ModelProvider;
}

const DIRECTION_GROUPS: DirectionGroup[] = [
  {
    direction: 'claude_to_openai',
    labelKey: 'modelMapping.directions.claudeToOpenai',
    icon: '🔶',
    sourceLabel: 'Claude',
    targetLabel: 'OpenAI',
    gradient: 'from-amber-500/20 to-emerald-500/20',
    accent: 'text-amber-400',
    border: 'border-amber-500/30',
    sourceProvider: 'Claude',
    targetProvider: 'OpenAI',
  },
  {
    direction: 'openai_to_claude',
    labelKey: 'modelMapping.directions.openaiToClaude',
    icon: '🟢',
    sourceLabel: 'OpenAI',
    targetLabel: 'Claude',
    gradient: 'from-emerald-500/20 to-amber-500/20',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/30',
    sourceProvider: 'OpenAI',
    targetProvider: 'Claude',
  },
  {
    direction: 'claude_to_gemini',
    labelKey: 'modelMapping.directions.claudeToGemini',
    icon: '💎',
    sourceLabel: 'Claude',
    targetLabel: 'Gemini',
    gradient: 'from-amber-500/20 to-blue-500/20',
    accent: 'text-blue-400',
    border: 'border-blue-500/30',
    sourceProvider: 'Claude',
    targetProvider: 'Gemini',
  },
  {
    direction: 'gemini_to_claude',
    labelKey: 'modelMapping.directions.geminiToClaude',
    icon: '🔷',
    sourceLabel: 'Gemini',
    targetLabel: 'Claude',
    gradient: 'from-blue-500/20 to-amber-500/20',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/30',
    sourceProvider: 'Gemini',
    targetProvider: 'Claude',
  },
  {
    direction: 'openai_to_gemini',
    labelKey: 'modelMapping.directions.openaiToGemini',
    icon: '🌐',
    sourceLabel: 'OpenAI',
    targetLabel: 'Gemini',
    gradient: 'from-emerald-500/20 to-blue-500/20',
    accent: 'text-teal-400',
    border: 'border-teal-500/30',
    sourceProvider: 'OpenAI',
    targetProvider: 'Gemini',
  },
  {
    direction: 'gemini_to_openai',
    labelKey: 'modelMapping.directions.geminiToOpenai',
    icon: '🔄',
    sourceLabel: 'Gemini',
    targetLabel: 'OpenAI',
    gradient: 'from-blue-500/20 to-emerald-500/20',
    accent: 'text-indigo-400',
    border: 'border-indigo-500/30',
    sourceProvider: 'Gemini',
    targetProvider: 'OpenAI',
  },
];

// 提供商选项
const PROVIDER_OPTIONS: { value: ModelProvider; label: string }[] = [
  { value: 'Claude', label: 'Claude' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Gemini', label: 'Gemini' },
];

interface ModelMappingFormData {
  sourceModel: string;
  targetModel: string;
  direction: MappingDirection;
  sourceProvider: ModelProvider | '';
  targetProvider: ModelProvider | '';
  priority: number;
  description: string;
  notes: string;
  isEnabled: boolean;
}

const defaultFormData: ModelMappingFormData = {
  sourceModel: '',
  targetModel: '',
  direction: 'claude_to_openai',
  sourceProvider: 'Claude',
  targetProvider: 'OpenAI',
  priority: 50,
  description: '',
  notes: '',
  isEnabled: true,
};

export const ModelMappingManager: React.FC = () => {
  const { t } = useTranslation();
  const [mappings, setMappings] = useState<ModelMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingIsBuiltin, setEditingIsBuiltin] = useState(false);
  const [formData, setFormData] = useState<ModelMappingFormData>(defaultFormData);
  const [filter, setFilter] = useState<'all' | 'builtin' | 'custom'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<MappingDirection>>(
    new Set(DIRECTION_GROUPS.map(g => g.direction))
  );
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

  // 加载映射列表
  const loadMappings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listModelMappings({
        isCustom: filter === 'all' ? undefined : filter === 'custom',
      });
      setMappings(data);
    } catch (error) {
      console.error('加载模型映射失败:', error);
      toast.error(t('modelMapping.loadError'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  // 过滤映射
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      // 排除双向映射（不在单向分组中显示）
      if (m.direction === 'bidirectional') return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        m.source_model.toLowerCase().includes(term) ||
        m.target_model.toLowerCase().includes(term) ||
        (m.description && m.description.toLowerCase().includes(term))
      );
    });
  }, [mappings, searchTerm]);

  // 按方向分组映射
  const groupedMappings = useMemo(() => {
    const groups: Record<MappingDirection, ModelMapping[]> = {} as Record<MappingDirection, ModelMapping[]>;

    DIRECTION_GROUPS.forEach(g => {
      groups[g.direction] = [];
    });

    filteredMappings.forEach((mapping) => {
      if (groups[mapping.direction]) {
        groups[mapping.direction].push(mapping);
      }
    });

    // 每个分组内按优先级排序
    Object.keys(groups).forEach((key) => {
      groups[key as MappingDirection].sort((a, b) => b.priority - a.priority);
    });

    return groups;
  }, [filteredMappings]);

  // 切换分组展开状态
  const toggleGroup = (direction: MappingDirection) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) {
        next.delete(direction);
      } else {
        next.add(direction);
      }
      return next;
    });
  };

  // 展开/收起所有分组
  const toggleAllGroups = (expand: boolean) => {
    if (expand) {
      setExpandedGroups(new Set(DIRECTION_GROUPS.map(g => g.direction)));
    } else {
      setExpandedGroups(new Set());
    }
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sourceModel.trim() || !formData.targetModel.trim()) {
      toast.error(t('modelMapping.requiredFieldsError'));
      return;
    }

    try {
      if (editingId) {
        await updateModelMapping(editingId, {
          targetModel: formData.targetModel,
          priority: formData.priority,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
          isEnabled: formData.isEnabled,
        });
        toast.success(t('modelMapping.updateSuccess'));
      } else {
        await createModelMapping({
          sourceModel: formData.sourceModel,
          targetModel: formData.targetModel,
          direction: formData.direction,
          sourceProvider: formData.sourceProvider || undefined,
          targetProvider: formData.targetProvider || undefined,
          priority: formData.priority,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
          isEnabled: formData.isEnabled,
        });
        toast.success(t('modelMapping.createSuccess'));
      }
      setShowForm(false);
      setEditingId(null);
      setEditingIsBuiltin(false);
      setFormData(defaultFormData);
      loadMappings();
    } catch (error: unknown) {
      console.error('保存模型映射失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(errorMessage || t('modelMapping.saveError'));
    }
  };

  // 编辑映射
  const handleEdit = (mapping: ModelMapping) => {
    setEditingId(mapping.id);
    setEditingIsBuiltin(!mapping.is_custom);
    setFormData({
      sourceModel: mapping.source_model,
      targetModel: mapping.target_model,
      direction: mapping.direction,
      sourceProvider: mapping.source_provider || '',
      targetProvider: mapping.target_provider || '',
      priority: mapping.priority,
      description: mapping.description || '',
      notes: mapping.notes || '',
      isEnabled: mapping.is_enabled,
    });
    setShowForm(true);
  };

  // 删除映射
  const handleDelete = (mapping: ModelMapping) => {
    setConfirmDialog({
      isOpen: true,
      title: t('modelMapping.deleteTitle'),
      message: t('modelMapping.deleteConfirm', { model: mapping.source_model }),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteModelMapping(mapping.id);
          toast.success(t('modelMapping.deleteSuccess'));
          loadMappings();
        } catch (error) {
          console.error('删除模型映射失败:', error);
          toast.error(t('modelMapping.deleteError'));
        }
      },
    });
  };

  // 切换启用状态
  const handleToggleEnabled = async (mapping: ModelMapping) => {
    try {
      await updateModelMapping(mapping.id, { isEnabled: !mapping.is_enabled });
      loadMappings();
    } catch (error) {
      console.error('更新状态失败:', error);
      toast.error(t('modelMapping.toggleError'));
    }
  };

  // 导出配置
  const handleExport = async (includeBuiltin: boolean) => {
    try {
      const data = await exportModelMappings(includeBuiltin);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model-mappings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('modelMapping.exportSuccess'));
    } catch (error) {
      console.error('导出失败:', error);
      toast.error(t('modelMapping.exportError'));
    }
  };

  // 导入配置
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const [imported, skipped] = await importModelMappings(text, false);
        toast.success(t('modelMapping.importSuccess', { imported, skipped }));
        loadMappings();
      } catch (error) {
        console.error('导入失败:', error);
        toast.error(t('modelMapping.importError'));
      }
    };
    input.click();
  };

  // 重置为默认
  const handleReset = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('modelMapping.resetTitle'),
      message: t('modelMapping.resetConfirm'),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const count = await resetToDefaultMappings();
          toast.success(t('modelMapping.resetSuccess', { count }));
          loadMappings();
        } catch (error) {
          console.error('重置失败:', error);
          toast.error(t('modelMapping.resetError'));
        }
      },
    });
  };

  // 根据方向自动设置提供商
  const handleDirectionChange = (direction: MappingDirection) => {
    const group = DIRECTION_GROUPS.find(g => g.direction === direction);
    setFormData({
      ...formData,
      direction,
      sourceProvider: group?.sourceProvider || '',
      targetProvider: group?.targetProvider || '',
    });
  };

  // 快速添加到指定方向
  const handleQuickAdd = (group: DirectionGroup) => {
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      direction: group.direction,
      sourceProvider: group.sourceProvider,
      targetProvider: group.targetProvider,
    });
    setShowForm(true);
  };

  // 渲染单个映射项（紧凑列表样式）
  const renderMappingItem = (mapping: ModelMapping, group: DirectionGroup) => (
    <div
      key={mapping.id}
      className={`
        group flex items-center gap-3 px-4 py-2.5 rounded-lg
        transition-all duration-200 hover:bg-gray-800/50
        ${mapping.is_enabled ? '' : 'opacity-50'}
        ${mapping.is_custom ? 'border-l-2 border-yellow-500/50' : 'border-l-2 border-gray-700/50'}
      `}
    >
      {/* 状态指示器 */}
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          mapping.is_enabled ? 'bg-green-400 shadow-green-400/50 shadow-sm' : 'bg-gray-600'
        }`}
      />

      {/* 源模型 */}
      <code className="flex-1 px-2 py-1 text-xs font-mono bg-black/40 text-yellow-300 rounded truncate border border-gray-800 min-w-0">
        {mapping.source_model}
      </code>

      {/* 箭头 */}
      <svg className={`w-4 h-4 flex-shrink-0 ${group.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>

      {/* 目标模型 */}
      <code className="flex-1 px-2 py-1 text-xs font-mono bg-black/40 text-emerald-300 rounded truncate border border-gray-800 min-w-0">
        {mapping.target_model}
      </code>

      {/* 优先级 */}
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
        mapping.priority >= 80 ? 'bg-yellow-500/20 text-yellow-400' :
        mapping.priority >= 50 ? 'bg-gray-700/50 text-gray-300' :
        'bg-gray-800/50 text-gray-500'
      }`}>
        P{mapping.priority}
      </span>

      {/* 类型标签 */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
        mapping.is_custom ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700/50 text-gray-400'
      }`}>
        {mapping.is_custom ? '自定义' : '内置'}
      </span>

      {/* 操作按钮 - 始终显示 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {/* 启用/禁用按钮 */}
        <button
          onClick={() => handleToggleEnabled(mapping)}
          className={`p-1 rounded transition-colors ${
            mapping.is_enabled ? 'text-green-400 hover:bg-green-500/20' : 'text-gray-500 hover:bg-gray-700'
          }`}
          title={mapping.is_enabled ? '禁用' : '启用'}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mapping.is_enabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
        </button>
        {/* 编辑按钮 - 所有映射都可编辑 */}
        <button
          onClick={() => handleEdit(mapping)}
          className="p-1 text-gray-400 hover:text-yellow-400 rounded hover:bg-yellow-500/20 transition-colors"
          title={mapping.is_custom ? '编辑' : '编辑（修改后将转为自定义映射）'}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {/* 删除按钮 - 仅自定义映射可删除 */}
        <button
          onClick={() => mapping.is_custom && handleDelete(mapping)}
          className={`p-1 rounded transition-colors ${
            mapping.is_custom
              ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title={mapping.is_custom ? '删除' : '内置映射不可删除'}
          disabled={!mapping.is_custom}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* 左侧 - 筛选和搜索 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 筛选标签 */}
          <div className="flex items-center bg-gray-900/50 rounded-lg p-0.5 border border-gray-800">
            {(['all', 'builtin', 'custom'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filter === f
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {t(`modelMapping.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('modelMapping.searchPlaceholder')}
              className="w-48 px-3 py-1.5 pl-8 text-xs bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-all"
            />
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* 展开/收起 */}
          <div className="flex items-center gap-0.5 bg-gray-900/50 rounded-lg p-0.5 border border-gray-800">
            <button
              onClick={() => toggleAllGroups(true)}
              className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
              title="展开全部"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => toggleAllGroups(false)}
              className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
              title="收起全部"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 右侧 - 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="px-2.5 py-1.5 text-xs bg-gray-800/50 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-all flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {t('modelMapping.import')}
          </button>
          <button
            onClick={() => handleExport(false)}
            className="px-2.5 py-1.5 text-xs bg-gray-800/50 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-all flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('modelMapping.export')}
          </button>
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 text-xs bg-red-950/30 hover:bg-red-900/40 text-red-400 rounded-lg border border-red-900/30 transition-all flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('modelMapping.reset')}
          </button>
        </div>
      </div>

      {/* 分组映射显示 */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-400 bg-gray-900/30 border border-gray-800 rounded-xl">
            <svg className="w-8 h-8 animate-spin mx-auto mb-2 text-yellow-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t('common.loading')}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {DIRECTION_GROUPS.map((group) => {
              const groupMappings = groupedMappings[group.direction] || [];
              const isExpanded = expandedGroups.has(group.direction);

              return (
                <div
                  key={group.direction}
                  className={`rounded-xl overflow-hidden border transition-all ${group.border} bg-gray-950/50`}
                >
                  {/* 分组头部 */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${group.gradient} cursor-pointer`}
                    onClick={() => toggleGroup(group.direction)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{group.icon}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-200">{group.sourceLabel}</span>
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-200">{group.targetLabel}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-black/30 px-1.5 py-0.5 rounded-full ml-1">
                        {groupMappings.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* 快速添加按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(group);
                        }}
                        className="p-1 text-gray-400 hover:text-yellow-400 rounded hover:bg-yellow-500/20 transition-colors"
                        title="添加映射"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 分组内容 */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-800/50">
                      {groupMappings.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-500 text-xs">
                          暂无映射配置
                        </div>
                      ) : (
                        groupMappings.map((mapping) => renderMappingItem(mapping, group))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 创建/编辑表单模态框 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black border border-yellow-500/30 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 模态框头部 */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-yellow-400">
                {editingId ? t('modelMapping.editTitle') : t('modelMapping.addTitle')}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setEditingIsBuiltin(false);
                  setFormData(defaultFormData);
                }}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 模态框内容 */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* 内置映射编辑提示 */}
              {editingId && editingIsBuiltin && (
                <div className="mb-4 p-3 bg-blue-950/30 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-blue-300">
                      <p className="font-medium">编辑内置映射</p>
                      <p className="text-blue-400/80 mt-0.5">修改后此映射将转为自定义映射，可通过"重置为默认"恢复。</p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 映射方向 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    映射方向 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.direction}
                    onChange={(e) => handleDirectionChange(e.target.value as MappingDirection)}
                    disabled={!!editingId}
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-yellow-500/50 disabled:opacity-50 transition-all"
                  >
                    {DIRECTION_GROUPS.map((g) => (
                      <option key={g.direction} value={g.direction}>
                        {g.icon} {g.sourceLabel} → {g.targetLabel}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 模型输入 */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      源模型 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.sourceModel}
                      onChange={(e) => setFormData({ ...formData, sourceModel: e.target.value })}
                      disabled={!!editingId}
                      placeholder="例如: claude-3-5-sonnet-20241022"
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 disabled:opacity-50 transition-all"
                    />
                  </div>

                  <div className="flex justify-center">
                    <div className="px-3 py-1 bg-gray-900/50 rounded border border-gray-700">
                      <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      目标模型 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.targetModel}
                      onChange={(e) => setFormData({ ...formData, targetModel: e.target.value })}
                      placeholder="例如: gpt-4o"
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* 提供商（只读显示） */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">源提供商</label>
                    <select
                      value={formData.sourceProvider}
                      onChange={(e) => setFormData({ ...formData, sourceProvider: e.target.value as ModelProvider | '' })}
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-all"
                    >
                      <option value="">选择提供商</option>
                      {PROVIDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">目标提供商</label>
                    <select
                      value={formData.targetProvider}
                      onChange={(e) => setFormData({ ...formData, targetProvider: e.target.value as ModelProvider | '' })}
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-all"
                    >
                      <option value="">选择提供商</option>
                      {PROVIDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 优先级 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    优先级
                    <span className="ml-2 text-yellow-400 font-bold">{formData.priority}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-gray-800 rounded appearance-none cursor-pointer accent-yellow-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                    <span>低</span>
                    <span>高</span>
                  </div>
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="可选描述"
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-all"
                  />
                </div>

                {/* 启用状态 */}
                <div className="flex items-center gap-2 p-2.5 bg-gray-900/30 rounded-lg border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${formData.isEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.isEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <label className="text-xs text-gray-300 cursor-pointer" onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}>
                    启用此映射
                  </label>
                </div>

                {/* 按钮 */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setEditingIsBuiltin(false);
                      setFormData(defaultFormData);
                    }}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold rounded-lg transition-all shadow-lg shadow-yellow-500/20"
                  >
                    {editingId ? t('common.save') : t('common.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ModelMappingManager;
