/**
 * CommandEditorDialog Component
 *
 * 用于编辑/新增斜杠命令的对话框
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Command, Save, Loader2, Trash2, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSlashCommand,
  createSlashCommand,
  updateSlashCommand,
  deleteSlashCommand,
  readSlashCommandBody,
  COMMON_TOOLS,
  AVAILABLE_MODELS,
} from '../../api/slashCommands';
import type { SlashCommandInfo, CommandScope, SlashCommandInput } from '../../types/tauri';

interface CommandEditorDialogProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 项目路径 */
  projectPath: string;
  /** 要编辑的命令 (null 表示新建) */
  command: SlashCommandInfo | null;
  /** 默认作用域 */
  defaultScope?: CommandScope;
  /** 保存成功回调 */
  onSaved?: () => void;
}

/**
 * 命令编辑对话框
 */
export const CommandEditorDialog: React.FC<CommandEditorDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  command,
  defaultScope = 'project',
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [argumentHint, setArgumentHint] = useState('');
  const [model, setModel] = useState<string>('');
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<CommandScope>(defaultScope);
  const [originalBody, setOriginalBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);

  const isEditMode = command !== null;

  // 加载内容
  const loadContent = useCallback(async () => {
    if (!command) {
      setName('');
      setDescription('');
      setArgumentHint('');
      setModel('');
      setAllowedTools([]);
      setBody('');
      setOriginalBody('');
      setScope(defaultScope);
      return;
    }

    setIsLoading(true);
    setName(command.name);
    setDescription(command.description || '');
    setArgumentHint(command.argumentHint || '');
    setModel(command.model || '');
    setScope(command.scope);

    try {
      // 获取完整命令信息
      const fullCommand = await getSlashCommand(
        command.name,
        command.scope,
        command.scope === 'project' ? projectPath : undefined
      );

      setAllowedTools(fullCommand.meta.allowedTools || []);

      // 读取命令内容
      const content = await readSlashCommandBody(
        command.name,
        command.scope,
        command.scope === 'project' ? projectPath : undefined
      );
      setBody(content);
      setOriginalBody(content);
    } catch (error) {
      console.error('加载命令内容失败:', error);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [command, projectPath, defaultScope]);

  // 打开时加载内容
  useEffect(() => {
    if (isOpen) {
      loadContent();
      setShowDeleteConfirm(false);
      setShowToolPicker(false);
    }
  }, [isOpen, loadContent]);

  // 保存内容
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入命令名称');
      return;
    }
    if (!description.trim()) {
      toast.error('请输入命令描述');
      return;
    }

    const input: SlashCommandInput = {
      name: name.trim(),
      scope,
      description: description.trim(),
      allowedTools,
      argumentHint: argumentHint.trim() || undefined,
      model: model || undefined,
      body: body,
    };

    setIsSaving(true);
    try {
      if (isEditMode) {
        await updateSlashCommand(input, scope === 'project' ? projectPath : undefined);
        toast.success('更新成功');
      } else {
        await createSlashCommand(input, scope === 'project' ? projectPath : undefined);
        toast.success('创建成功');
      }
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('保存命令失败:', error);
      toast.error(`保存失败: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 删除命令
  const handleDelete = async () => {
    if (!command) return;

    setIsDeleting(true);
    try {
      await deleteSlashCommand(
        command.name,
        command.scope,
        command.scope === 'project' ? projectPath : undefined
      );
      toast.success('删除成功');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('删除命令失败:', error);
      toast.error(`删除失败: ${error}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 切换工具选择
  const toggleTool = (tool: string) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  // 检测是否有修改
  const hasChanges = isEditMode
    ? body !== originalBody || description !== (command?.description || '')
    : name.trim() !== '' || body !== '';

  // 按键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else if (showToolPicker) {
        setShowToolPicker(false);
      } else {
        onClose();
      }
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (hasChanges) {
        handleSave();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gray-900 rounded-xl shadow-2xl w-[750px] max-h-[85vh] flex flex-col border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Command className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditMode ? '编辑命令' : '新建命令'}
              </h2>
              <p className="text-xs text-gray-500">
                {scope === 'project' ? '项目级命令' : '用户级命令'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* 基本信息行 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 名称输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    命令名称 *
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-gray-800 border border-r-0 border-gray-700 rounded-l-lg text-gray-500">
                      /
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isEditMode}
                      placeholder="my-command"
                      className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-r-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* 模型选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    模型
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  >
                    <option value="">默认模型</option>
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 描述输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  描述 *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="命令的简短描述"
                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              {/* 参数提示 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  参数提示
                </label>
                <input
                  type="text"
                  value={argumentHint}
                  onChange={(e) => setArgumentHint(e.target.value)}
                  placeholder="例如: <file-path>"
                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              {/* 作用域选择 (仅新建时可选) */}
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    作用域
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setScope('project')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        scope === 'project'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      项目级
                    </button>
                    <button
                      onClick={() => setScope('user')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        scope === 'user'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      用户级
                    </button>
                  </div>
                </div>
              )}

              {/* 允许的工具 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-400">
                    允许的工具
                  </label>
                  <button
                    onClick={() => setShowToolPicker(!showToolPicker)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Plus className="w-3 h-3" />
                    {showToolPicker ? '收起' : '添加工具'}
                  </button>
                </div>

                {/* 已选工具 */}
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {allowedTools.length === 0 ? (
                    <span className="text-xs text-gray-500">无限制（允许所有工具）</span>
                  ) : (
                    allowedTools.map((tool) => (
                      <span
                        key={tool}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded"
                      >
                        {tool}
                        <button
                          onClick={() => toggleTool(tool)}
                          className="hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* 工具选择器 */}
                {showToolPicker && (
                  <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <div className="grid grid-cols-4 gap-2">
                      {COMMON_TOOLS.map((tool) => (
                        <button
                          key={tool}
                          onClick={() => toggleTool(tool)}
                          className={`flex items-center justify-between px-2 py-1.5 text-xs rounded transition-colors ${
                            allowedTools.includes(tool)
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {tool}
                          {allowedTools.includes(tool) && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 命令内容 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  命令内容
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="在这里编写命令的提示词内容..."
                  className="w-full h-[180px] px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-500"
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {isEditMode && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">确定删除？</span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1 text-sm bg-red-500 hover:bg-red-400 text-white rounded transition-colors"
                >
                  {isDeleting ? '删除中...' : '确定'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !name.trim() || !description.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandEditorDialog;
