/**
 * ClaudeMdEditorDialog Component
 *
 * 用于编辑项目 CLAUDE.md 文件的对话框
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { readProjectClaudeMd, saveProjectClaudeMd } from '../../api/projectContext';

interface ClaudeMdEditorDialogProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 项目路径 */
  projectPath: string;
  /** 保存成功回调 */
  onSaved?: () => void;
}

/**
 * CLAUDE.md 编辑对话框
 */
export const ClaudeMdEditorDialog: React.FC<ClaudeMdEditorDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  onSaved,
}) => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 加载内容
  const loadContent = useCallback(async () => {
    if (!projectPath) return;

    setIsLoading(true);
    try {
      const result = await readProjectClaudeMd(projectPath);
      const text = result || '';
      setContent(text);
      setOriginalContent(text);
    } catch (error) {
      console.error('加载 CLAUDE.md 失败:', error);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  // 打开时加载内容
  useEffect(() => {
    if (isOpen && projectPath) {
      loadContent();
    }
  }, [isOpen, projectPath, loadContent]);

  // 保存内容
  const handleSave = async () => {
    if (!projectPath) return;

    setIsSaving(true);
    try {
      await saveProjectClaudeMd(projectPath, content);
      setOriginalContent(content);
      toast.success('保存成功');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('保存 CLAUDE.md 失败:', error);
      toast.error(`保存失败: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 检测是否有修改
  const hasChanges = content !== originalContent;

  // 按键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
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
      <div className="bg-gray-900 rounded-xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">编辑 CLAUDE.md</h2>
              <p className="text-xs text-gray-500 truncate max-w-[500px]">{projectPath}</p>
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
        <div className="flex-1 overflow-hidden p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# 项目说明\n\n在这里编写项目的 CLAUDE.md 文档..."
              className="w-full h-[400px] px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 placeholder-gray-500"
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/50">
          <div className="text-xs text-gray-500">
            {hasChanges && <span className="text-yellow-400">● 未保存的更改</span>}
            <span className="ml-4">Ctrl+S 保存</span>
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
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-medium rounded-lg transition-colors"
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

export default ClaudeMdEditorDialog;
