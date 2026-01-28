/**
 * 项目上下文面板
 * 显示当前项目的记忆、命令等信息，支持编辑和新增
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Brain,
  Command,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  User,
  FolderOpen,
  Clock,
  AlertCircle,
  Plus,
  Pencil,
} from 'lucide-react';
import { getProjectContext } from '../../api/projectContext';
import type { ProjectContextInfo, MemoryInfo, SlashCommandInfo, MemoryScope, CommandScope } from '../../types/tauri';
import { ClaudeMdEditorDialog } from './ClaudeMdEditorDialog';
import { MemoryEditorDialog } from './MemoryEditorDialog';
import { CommandEditorDialog } from './CommandEditorDialog';

interface ProjectContextPanelProps {
  /** 项目路径 */
  projectPath: string | null;
  /** 是否正在加载 */
  isLoading?: boolean;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export const ProjectContextPanel: React.FC<ProjectContextPanelProps> = ({
  projectPath,
  isLoading: externalLoading = false,
}) => {
  const [context, setContext] = useState<ProjectContextInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 展开状态
  const [expandedSections, setExpandedSections] = useState({
    claudeMd: true,
    memories: true,
    commands: true,
  });

  // 对话框状态
  const [claudeMdDialogOpen, setClaudeMdDialogOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryInfo | null>(null);
  const [editingCommand, setEditingCommand] = useState<SlashCommandInfo | null>(null);
  const [newItemScope, setNewItemScope] = useState<MemoryScope | CommandScope>('project');

  // 加载项目上下文
  const loadContext = useCallback(async () => {
    if (!projectPath) {
      setContext(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getProjectContext(projectPath);
      setContext(data);
    } catch (err) {
      console.error('加载项目上下文失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  // 项目路径变化时重新加载
  useEffect(() => {
    loadContext();
  }, [loadContext]);

  // 切换展开状态
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 打开新增记忆对话框
  const openNewMemoryDialog = (scope: MemoryScope = 'project') => {
    setEditingMemory(null);
    setNewItemScope(scope);
    setMemoryDialogOpen(true);
  };

  // 打开编辑记忆对话框
  const openEditMemoryDialog = (memory: MemoryInfo) => {
    setEditingMemory(memory);
    setMemoryDialogOpen(true);
  };

  // 打开新增命令对话框
  const openNewCommandDialog = (scope: CommandScope = 'project') => {
    setEditingCommand(null);
    setNewItemScope(scope);
    setCommandDialogOpen(true);
  };

  // 打开编辑命令对话框
  const openEditCommandDialog = (command: SlashCommandInfo) => {
    setEditingCommand(command);
    setCommandDialogOpen(true);
  };

  // 渲染加载状态
  if (loading || externalLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs">加载项目信息...</span>
        </div>
      </div>
    );
  }

  // 渲染空状态
  if (!projectPath) {
    return (
      <div className="p-4 text-center">
        <FolderOpen className="w-8 h-8 mx-auto text-gray-600 mb-2" />
        <p className="text-xs text-gray-500">请先启动终端会话</p>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs">加载失败</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{error}</p>
        <button
          onClick={loadContext}
          className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 刷新按钮 */}
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-xs text-gray-500 font-medium">项目上下文</span>
        <button
          onClick={loadContext}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-yellow-400 transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* CLAUDE.md 区块 */}
      <div className="px-4">
        <div className="flex items-center gap-2 w-full py-1.5">
          <button
            onClick={() => toggleSection('claudeMd')}
            className="flex items-center gap-2 flex-1 text-left"
          >
            {expandedSections.claudeMd ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
            <FileText className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-medium text-white">CLAUDE.md</span>
            {context?.hasClaudeMd && (
              <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
                已配置
              </span>
            )}
          </button>
          <button
            onClick={() => setClaudeMdDialogOpen(true)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-yellow-400 transition-colors"
            title={context?.hasClaudeMd ? '编辑' : '创建'}
          >
            {context?.hasClaudeMd ? (
              <Pencil className="w-3 h-3" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </button>
        </div>

        {expandedSections.claudeMd && (
          <div className="ml-5 mt-1">
            {context?.hasClaudeMd ? (
              <div
                className="bg-gray-800/50 rounded p-2 cursor-pointer hover:bg-gray-800/70 transition-colors"
                onClick={() => setClaudeMdDialogOpen(true)}
              >
                <p className="text-[10px] text-gray-400 line-clamp-3">
                  {context.claudeMdSummary || '(空文件)'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setClaudeMdDialogOpen(true)}
                className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                创建项目文档
              </button>
            )}
          </div>
        )}
      </div>

      {/* 项目记忆区块 */}
      <div className="px-4">
        <div className="flex items-center gap-2 w-full py-1.5">
          <button
            onClick={() => toggleSection('memories')}
            className="flex items-center gap-2 flex-1 text-left"
          >
            {expandedSections.memories ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-white">记忆</span>
            <span className="text-[10px] text-gray-500">
              {context?.memories.length || 0} 项目 / {context?.userMemoryCount || 0} 用户
            </span>
          </button>
          <button
            onClick={() => openNewMemoryDialog('project')}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-purple-400 transition-colors"
            title="新增记忆"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {expandedSections.memories && (
          <div className="ml-5 mt-1 space-y-1.5">
            {context?.memories && context.memories.length > 0 ? (
              context.memories.slice(0, 5).map((memory) => (
                <MemoryItem
                  key={memory.name}
                  memory={memory}
                  onEdit={() => openEditMemoryDialog(memory)}
                />
              ))
            ) : (
              <button
                onClick={() => openNewMemoryDialog('project')}
                className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加项目记忆
              </button>
            )}
            {context?.memories && context.memories.length > 5 && (
              <p className="text-[10px] text-gray-500">
                还有 {context.memories.length - 5} 条记忆...
              </p>
            )}
            {context?.userMemoryCount ? (
              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{context.userMemoryCount} 条用户级记忆</span>
                </div>
                <button
                  onClick={() => openNewMemoryDialog('user')}
                  className="text-purple-400 hover:text-purple-300"
                  title="添加用户级记忆"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => openNewMemoryDialog('user')}
                className="text-[10px] text-gray-500 hover:text-purple-400 flex items-center gap-1 pt-1"
              >
                <User className="w-3 h-3" />
                <Plus className="w-2.5 h-2.5" />
                <span>添加用户级记忆</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 项目命令区块 */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 w-full py-1.5">
          <button
            onClick={() => toggleSection('commands')}
            className="flex items-center gap-2 flex-1 text-left"
          >
            {expandedSections.commands ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
            <Command className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-white">命令</span>
            <span className="text-[10px] text-gray-500">
              {context?.commands.length || 0} 项目 / {context?.userCommandCount || 0} 用户
            </span>
          </button>
          <button
            onClick={() => openNewCommandDialog('project')}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors"
            title="新增命令"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {expandedSections.commands && (
          <div className="ml-5 mt-1 space-y-1.5">
            {context?.commands && context.commands.length > 0 ? (
              context.commands.slice(0, 5).map((cmd) => (
                <CommandItem
                  key={cmd.name}
                  command={cmd}
                  onEdit={() => openEditCommandDialog(cmd)}
                />
              ))
            ) : (
              <button
                onClick={() => openNewCommandDialog('project')}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加项目命令
              </button>
            )}
            {context?.commands && context.commands.length > 5 && (
              <p className="text-[10px] text-gray-500">
                还有 {context.commands.length - 5} 条命令...
              </p>
            )}
            {context?.userCommandCount ? (
              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{context.userCommandCount} 条用户级命令</span>
                </div>
                <button
                  onClick={() => openNewCommandDialog('user')}
                  className="text-blue-400 hover:text-blue-300"
                  title="添加用户级命令"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => openNewCommandDialog('user')}
                className="text-[10px] text-gray-500 hover:text-blue-400 flex items-center gap-1 pt-1"
              >
                <User className="w-3 h-3" />
                <Plus className="w-2.5 h-2.5" />
                <span>添加用户级命令</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 对话框 */}
      <ClaudeMdEditorDialog
        isOpen={claudeMdDialogOpen}
        onClose={() => setClaudeMdDialogOpen(false)}
        projectPath={projectPath}
        onSaved={loadContext}
      />

      <MemoryEditorDialog
        isOpen={memoryDialogOpen}
        onClose={() => {
          setMemoryDialogOpen(false);
          setEditingMemory(null);
        }}
        projectPath={projectPath}
        memory={editingMemory}
        defaultScope={newItemScope as MemoryScope}
        onSaved={loadContext}
      />

      <CommandEditorDialog
        isOpen={commandDialogOpen}
        onClose={() => {
          setCommandDialogOpen(false);
          setEditingCommand(null);
        }}
        projectPath={projectPath}
        command={editingCommand}
        defaultScope={newItemScope as CommandScope}
        onSaved={loadContext}
      />
    </div>
  );
};

/**
 * 记忆项组件
 */
const MemoryItem: React.FC<{ memory: MemoryInfo; onEdit: () => void }> = ({ memory, onEdit }) => {
  return (
    <div
      className="bg-gray-800/50 rounded p-2 group hover:bg-gray-800/70 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-medium text-purple-300 truncate flex-1">
          {memory.name}
        </span>
        <span className="text-[9px] text-gray-500">{formatFileSize(memory.size)}</span>
        <Pencil className="w-2.5 h-2.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-[10px] text-gray-400 line-clamp-2">{memory.summary}</p>
      <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500">
        <Clock className="w-2.5 h-2.5" />
        <span>{formatTime(memory.modifiedAt)}</span>
      </div>
    </div>
  );
};

/**
 * 命令项组件
 */
const CommandItem: React.FC<{ command: SlashCommandInfo; onEdit: () => void }> = ({ command, onEdit }) => {
  return (
    <div
      className="bg-gray-800/50 rounded p-2 group hover:bg-gray-800/70 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-medium text-blue-300 font-mono">
          /{command.name}
        </span>
        {command.model && (
          <span className="px-1 py-0.5 text-[9px] bg-gray-700 text-gray-300 rounded">
            {command.model}
          </span>
        )}
        <Pencil className="w-2.5 h-2.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
      </div>
      {command.description && (
        <p className="text-[10px] text-gray-400 line-clamp-2">{command.description}</p>
      )}
    </div>
  );
};

export default ProjectContextPanel;
