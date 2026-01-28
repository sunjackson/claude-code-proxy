/**
 * MemoryEditorDialog Component
 *
 * 用于编辑/新增项目记忆的对话框
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Brain, Save, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { readMemoryContent, saveMemoryContent, deleteMemory } from '../../api/projectContext';
import type { MemoryInfo, MemoryScope } from '../../types/tauri';

interface MemoryEditorDialogProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 项目路径 */
  projectPath: string;
  /** 要编辑的记忆 (null 表示新建) */
  memory: MemoryInfo | null;
  /** 默认作用域 */
  defaultScope?: MemoryScope;
  /** 保存成功回调 */
  onSaved?: () => void;
}

/**
 * 记忆编辑对话框
 */
export const MemoryEditorDialog: React.FC<MemoryEditorDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  memory,
  defaultScope = 'project',
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<MemoryScope>(defaultScope);
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditMode = memory !== null;

  // 加载内容
  const loadContent = useCallback(async () => {
    if (!memory) {
      setName('');
      setContent('');
      setOriginalContent('');
      setScope(defaultScope);
      return;
    }

    setIsLoading(true);
    setName(memory.name);
    setScope(memory.scope);

    try {
      const result = await readMemoryContent(
        memory.name,
        memory.scope,
        memory.scope === 'project' ? projectPath : undefined
      );
      setContent(result);
      setOriginalContent(result);
    } catch (error) {
      console.error('加载记忆内容失败:', error);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [memory, projectPath, defaultScope]);

  // 打开时加载内容
  useEffect(() => {
    if (isOpen) {
      loadContent();
      setShowDeleteConfirm(false);
    }
  }, [isOpen, loadContent]);

  // 保存内容
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入记忆名称');
      return;
    }

    setIsSaving(true);
    try {
      await saveMemoryContent(
        name.trim(),
        scope,
        content,
        scope === 'project' ? projectPath : undefined
      );
      toast.success(isEditMode ? '更新成功' : '创建成功');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('保存记忆失败:', error);
      toast.error(`保存失败: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 删除记忆
  const handleDelete = async () => {
    if (!memory) return;

    setIsDeleting(true);
    try {
      await deleteMemory(
        memory.name,
        memory.scope,
        memory.scope === 'project' ? projectPath : undefined
      );
      toast.success('删除成功');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('删除记忆失败:', error);
      toast.error(`删除失败: ${error}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 检测是否有修改
  const hasChanges = isEditMode
    ? content !== originalContent
    : name.trim() !== '' || content !== '';

  // 按键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
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
      <div className="bg-gray-900 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditMode ? '编辑记忆' : '新建记忆'}
              </h2>
              <p className="text-xs text-gray-500">
                {scope === 'project' ? '项目级记忆' : '用户级记忆'}
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
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* 名称输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  记忆名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isEditMode}
                  placeholder="例如: project-architecture"
                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  只能包含字母、数字和连字符，不需要 .md 后缀
                </p>
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
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      项目级
                    </button>
                    <button
                      onClick={() => setScope('user')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        scope === 'user'
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      用户级
                    </button>
                  </div>
                </div>
              )}

              {/* 内容编辑 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  内容
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="在这里编写记忆内容..."
                  className="w-full h-[250px] px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 placeholder-gray-500"
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
              disabled={!hasChanges || isSaving || (!name.trim() && !isEditMode)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
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

export default MemoryEditorDialog;
