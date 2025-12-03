/**
 * Skills 配置管理组件
 * 管理 Claude Code 的自定义技能
 */

import React, { useState, useEffect } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { SkillInfo } from '../types/tauri';
import * as skillsApi from '../api/skills';
import { ConfirmDialog } from './ui/Dialog';

interface SkillEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, promptContent: string, description?: string) => void;
  editingSkill?: SkillInfo | null;
  initialPromptContent?: string;
}

const SkillEditor: React.FC<SkillEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSkill,
  initialPromptContent,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptContent, setPromptContent] = useState('');

  useEffect(() => {
    if (editingSkill) {
      setName(editingSkill.name);
      setDescription(editingSkill.description || '');
      setPromptContent(initialPromptContent || '');
    } else {
      setName('');
      setDescription('');
      setPromptContent('');
    }
  }, [editingSkill, initialPromptContent, isOpen]);

  const handleSave = () => {
    onSave(name.trim(), promptContent, description.trim() || undefined);
  };

  const isValid = name.trim() && promptContent.trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-amber-400">
            {editingSkill ? '编辑技能' : '添加技能'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 text-2xl">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              技能名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!editingSkill}
              placeholder="例如: code-review"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              使用时通过 /skill:{name || 'name'} 调用
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">技能描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述这个技能的用途"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              提示词内容 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder={`# 技能名称\n\n## 用途\n描述这个技能的用途...\n\n## 指令\n1. 步骤一\n2. 步骤二\n...`}
              rows={15}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">支持 Markdown 格式</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingSkill ? '更新' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface SkillPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  skill: SkillInfo | null;
  content: string;
}

const SkillPreview: React.FC<SkillPreviewProps> = ({ isOpen, onClose, skill, content }) => {
  if (!isOpen || !skill) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-amber-400">{skill.name}</h3>
            {skill.description && (
              <p className="text-gray-400 text-sm mt-1">{skill.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 text-2xl">
            ✕
          </button>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <pre className="whitespace-pre-wrap text-gray-300 text-sm font-mono">{content}</pre>
        </div>
      </div>
    </div>
  );
};

export const SkillsManager: React.FC = () => {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillInfo | null>(null);
  const [editingPromptContent, setEditingPromptContent] = useState('');
  const [previewSkill, setPreviewSkill] = useState<SkillInfo | null>(null);
  const [previewContent, setPreviewContent] = useState('');

  // 删除确认弹窗状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await skillsApi.listSkills();
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载技能列表失败');
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleAddSkill = () => {
    setEditingSkill(null);
    setEditingPromptContent('');
    setIsEditorOpen(true);
  };

  const handleEditSkill = async (skill: SkillInfo) => {
    try {
      const content = await skillsApi.readSkillPrompt(skill.name);
      setEditingSkill(skill);
      setEditingPromptContent(content);
      setIsEditorOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取技能内容失败');
      console.error('Failed to read skill prompt:', err);
    }
  };

  const handlePreviewSkill = async (skill: SkillInfo) => {
    try {
      const content = await skillsApi.readSkillPrompt(skill.name);
      setPreviewSkill(skill);
      setPreviewContent(content);
      setIsPreviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取技能内容失败');
      console.error('Failed to read skill prompt:', err);
    }
  };

  const handleSaveSkill = async (name: string, promptContent: string, description?: string) => {
    try {
      setError(null);
      if (editingSkill) {
        await skillsApi.updateSkill(name, promptContent, description);
        showSuccess('技能已更新');
      } else {
        await skillsApi.addSkill(name, promptContent, description);
        showSuccess('技能已添加');
      }
      setIsEditorOpen(false);
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存技能失败');
      console.error('Failed to save skill:', err);
    }
  };

  const handleRemoveSkill = async (name: string) => {
    setSkillToDelete(name);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSkill = async () => {
    if (!skillToDelete) return;

    try {
      setError(null);
      await skillsApi.removeSkill(skillToDelete);
      showSuccess('技能已删除');
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除技能失败');
      console.error('Failed to remove skill:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setSkillToDelete(null);
    }
  };

  const handleToggleSkill = async (skill: SkillInfo) => {
    try {
      setError(null);
      await skillsApi.updateSkill(skill.name, undefined, undefined, !skill.enabled);
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换技能状态失败');
      console.error('Failed to toggle skill:', err);
    }
  };

  const handleExport = async () => {
    try {
      // 使用 Tauri 对话框让用户选择保存位置
      const filePath = await save({
        title: '导出技能配置',
        defaultPath: 'skills-export.json',
        filters: [
          { name: 'JSON', extensions: ['json'] }
        ]
      });

      if (!filePath) {
        // 用户取消了保存
        return;
      }

      const configs = await skillsApi.exportSkills();
      const json = JSON.stringify(configs, null, 2);

      // 写入文件
      await writeTextFile(filePath, json);
      showSuccess(`技能配置已导出到: ${filePath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出配置失败');
      console.error('Failed to export skills:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const configs = JSON.parse(text);
      await skillsApi.importSkills(configs);
      showSuccess('技能配置已导入');
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入配置失败');
      console.error('Failed to import skills:', err);
    }
    event.target.value = '';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">技能管理</h2>
          <p className="text-gray-400 text-sm mt-1">
            创建和管理 Claude Code 的自定义技能指令
          </p>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer">
            导入
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            导出
          </button>
          <button
            onClick={handleAddSkill}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            添加技能
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">加载中...</div>
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">暂无自定义技能</div>
          <p className="text-gray-500 text-sm mb-4">
            技能是预定义的提示词模板,可通过 /skill:名称 快速调用
          </p>
          <button
            onClick={handleAddSkill}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            创建第一个技能
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-amber-400">{skill.name}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        skill.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-600/20 text-gray-400'
                      }`}
                    >
                      {skill.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="text-gray-400 text-sm mb-2">{skill.description}</p>
                  )}
                  <div className="text-xs text-gray-500">
                    调用方式: <span className="font-mono text-amber-400/70">/skill:{skill.name}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handlePreviewSkill(skill)}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm"
                  >
                    预览
                  </button>
                  <button
                    onClick={() => handleToggleSkill(skill)}
                    className={`px-3 py-1.5 rounded transition-colors text-sm ${
                      skill.enabled
                        ? 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {skill.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleEditSkill(skill)}
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleRemoveSkill(skill.name)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SkillEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveSkill}
        editingSkill={editingSkill}
        initialPromptContent={editingPromptContent}
      />

      <SkillPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        skill={previewSkill}
        content={previewContent}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        type="danger"
        title="删除技能"
        subtitle="此操作不可撤销"
        content={
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-300">
              确定要删除技能 <span className="text-amber-400 font-medium">"{skillToDelete}"</span> 吗？
            </p>
          </div>
        }
        confirmText="确认删除"
        onConfirm={confirmDeleteSkill}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setSkillToDelete(null);
        }}
      />
    </div>
  );
};
