/**
 * 斜杠命令 (Slash Commands) 管理组件
 * 适配 Claude Code 新版命令管理机制
 *
 * 路径规范:
 * - 用户级命令: ~/.claude/commands/
 * - 项目级命令: .claude/commands/
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { SlashCommandInfo, SlashCommandInput, CommandScope } from '../types/tauri';
import * as slashCommandsApi from '../api/slashCommands';
import { ConfirmDialog } from './ui/Dialog';

// ============================================
// 常量
// ============================================

const SCOPE_LABELS: Record<CommandScope, string> = {
  user: '用户级',
  project: '项目级',
};

const SCOPE_DESCRIPTIONS: Record<CommandScope, string> = {
  user: '~/.claude/commands/ - 所有项目可用',
  project: '.claude/commands/ - 仅当前项目',
};

// ============================================
// 命令编辑器组件
// ============================================

interface CommandEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: SlashCommandInput) => Promise<void>;
  editingCommand?: SlashCommandInfo | null;
  initialBody?: string;
}

const CommandEditor: React.FC<CommandEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCommand,
  initialBody,
}) => {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CommandScope>('user');
  const [description, setDescription] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [argumentHint, setArgumentHint] = useState('');
  const [model, setModel] = useState<string>('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingCommand) {
      setName(editingCommand.name);
      setScope(editingCommand.scope);
      setDescription(editingCommand.description);
      setArgumentHint(editingCommand.argumentHint || '');
      setModel(editingCommand.model || '');
      setBody(initialBody || '');
      // 工具列表需要从完整命令获取
      setAllowedTools([]);
    } else {
      setName('');
      setScope('user');
      setDescription('');
      setAllowedTools([]);
      setArgumentHint('');
      setModel('');
      setBody('');
    }
  }, [editingCommand, initialBody, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        scope,
        description: description.trim(),
        allowedTools,
        argumentHint: argumentHint.trim() || undefined,
        model: model || undefined,
        body: body.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToolToggle = (tool: string) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const isValid =
    name.trim() &&
    description.trim() &&
    body.trim() &&
    /^[a-z][a-z0-9:-]{0,63}$/.test(name.trim());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-amber-400">
            {editingCommand ? '编辑命令' : '创建斜杠命令'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 text-2xl">
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* 命令名称和作用域 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                命令名称 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                disabled={!!editingCommand}
                placeholder="例如: my-command 或 zcf:feature"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                调用方式: <code className="text-amber-400">/{name || 'command-name'}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">作用域</label>
              <div className="space-y-2">
                {(['user', 'project'] as CommandScope[]).map((s) => (
                  <label
                    key={s}
                    className={`flex items-center p-2 rounded-lg cursor-pointer border transition-colors ${
                      scope === s
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    } ${editingCommand ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={s}
                      checked={scope === s}
                      onChange={() => setScope(s)}
                      disabled={!!editingCommand}
                      className="mr-2"
                    />
                    <div>
                      <div className="text-gray-200 text-sm">{SCOPE_LABELS[s]}</div>
                      <div className="text-gray-500 text-xs">{SCOPE_DESCRIPTIONS[s]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              描述 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述命令的用途"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 参数提示和模型 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">参数提示</label>
              <input
                type="text"
                value={argumentHint}
                onChange={(e) => setArgumentHint(e.target.value)}
                placeholder="例如: [file-path] [options]"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">使用默认模型</option>
                {slashCommandsApi.AVAILABLE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} - {m.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 允许的工具 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">允许使用的工具</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
              {slashCommandsApi.COMMON_TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => handleToolToggle(tool)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    allowedTools.includes(tool)
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              选择命令可以使用的工具。留空则继承项目设置。
            </p>
          </div>

          {/* 命令主体 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              命令主体 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`# 命令标题\n\n描述命令的用途和使用方式...\n\n## 步骤\n1. ...\n2. ...\n\n使用 $ARGUMENTS 获取用户传入的参数。`}
              rows={12}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              支持 Markdown 格式。使用 <code className="text-amber-400">$ARGUMENTS</code>{' '}
              接收用户参数。
            </p>
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
            disabled={!isValid || saving}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : editingCommand ? '更新' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 命令预览组件
// ============================================

interface CommandPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  command: SlashCommandInfo | null;
  content: string;
}

const CommandPreview: React.FC<CommandPreviewProps> = ({ isOpen, onClose, command, content }) => {
  if (!isOpen || !command) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-amber-400">{command.fullCommand}</h3>
              <span
                className={`px-2 py-0.5 text-xs rounded ${
                  command.scope === 'user'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}
              >
                {SCOPE_LABELS[command.scope]}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">{command.description}</p>
            {command.argumentHint && (
              <p className="text-gray-500 text-xs mt-1">
                参数: <code>{command.argumentHint}</code>
              </p>
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

// ============================================
// 主组件
// ============================================

export const SlashCommandsManager: React.FC = () => {
  const [commands, setCommands] = useState<SlashCommandInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SlashCommandInfo | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [previewCommand, setPreviewCommand] = useState<SlashCommandInfo | null>(null);
  const [previewContent, setPreviewContent] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [commandToDelete, setCommandToDelete] = useState<SlashCommandInfo | null>(null);

  const [migrateConfirmOpen, setMigrateConfirmOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const [filterScope, setFilterScope] = useState<CommandScope | 'all'>('all');

  // 加载命令列表
  const loadCommands = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await slashCommandsApi.listSlashCommands();
      setCommands(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载命令列表失败');
      console.error('Failed to load commands:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  // 创建命令
  const handleCreateCommand = () => {
    setEditingCommand(null);
    setEditingBody('');
    setIsEditorOpen(true);
  };

  // 编辑命令
  const handleEditCommand = async (command: SlashCommandInfo) => {
    try {
      const body = await slashCommandsApi.readSlashCommandBody(command.name, command.scope);
      setEditingCommand(command);
      setEditingBody(body);
      setIsEditorOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取命令内容失败');
    }
  };

  // 预览命令
  const handlePreviewCommand = async (command: SlashCommandInfo) => {
    try {
      const body = await slashCommandsApi.readSlashCommandBody(command.name, command.scope);
      setPreviewCommand(command);
      setPreviewContent(body);
      setIsPreviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取命令内容失败');
    }
  };

  // 保存命令
  const handleSaveCommand = async (input: SlashCommandInput) => {
    try {
      setError(null);
      if (editingCommand) {
        await slashCommandsApi.updateSlashCommand(input);
        showSuccess('命令已更新');
      } else {
        await slashCommandsApi.createSlashCommand(input);
        showSuccess('命令已创建');
      }
      setIsEditorOpen(false);
      await loadCommands();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存命令失败');
    }
  };

  // 删除命令
  const handleDeleteCommand = (command: SlashCommandInfo) => {
    setCommandToDelete(command);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteCommand = async () => {
    if (!commandToDelete) return;

    try {
      setError(null);
      await slashCommandsApi.deleteSlashCommand(commandToDelete.name, commandToDelete.scope);
      showSuccess('命令已删除');
      await loadCommands();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除命令失败');
    } finally {
      setDeleteConfirmOpen(false);
      setCommandToDelete(null);
    }
  };

  // 迁移旧版技能
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const migrated = await slashCommandsApi.migrateSkillsToCommands();
      if (migrated.length > 0) {
        showSuccess(`成功迁移 ${migrated.length} 个技能: ${migrated.join(', ')}`);
        await loadCommands();
      } else {
        showSuccess('没有需要迁移的技能');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '迁移失败');
    } finally {
      setMigrating(false);
      setMigrateConfirmOpen(false);
    }
  };

  // 过滤命令
  const filteredCommands =
    filterScope === 'all' ? commands : commands.filter((c) => c.scope === filterScope);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">斜杠命令</h2>
          <p className="text-gray-400 text-sm mt-1">
            管理 Claude Code 的自定义斜杠命令 (新版规范)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMigrateConfirmOpen(true)}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            从旧版迁移
          </button>
          <button
            onClick={handleCreateCommand}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            创建命令
          </button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-2 mb-4">
        {(['all', 'user', 'project'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterScope(s)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filterScope === s
                ? 'bg-amber-500 text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? '全部' : SCOPE_LABELS[s]}
            {s !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({commands.filter((c) => c.scope === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 错误/成功提示 */}
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

      {/* 命令列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">加载中...</div>
        </div>
      ) : filteredCommands.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            {filterScope === 'all' ? '暂无斜杠命令' : `暂无${SCOPE_LABELS[filterScope]}命令`}
          </div>
          <p className="text-gray-500 text-sm mb-4">
            斜杠命令是预定义的工作流，可通过 /<span className="text-amber-400">命令名</span>{' '}
            快速调用
          </p>
          <button
            onClick={handleCreateCommand}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            创建第一个命令
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCommands.map((command) => (
            <div
              key={`${command.scope}:${command.name}`}
              className="p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-amber-400">{command.fullCommand}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        command.scope === 'user'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {SCOPE_LABELS[command.scope]}
                    </span>
                    {command.model && (
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                        {command.model}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{command.description}</p>
                  {command.argumentHint && (
                    <div className="text-xs text-gray-500">
                      参数: <code className="text-amber-400/70">{command.argumentHint}</code>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handlePreviewCommand(command)}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm"
                  >
                    预览
                  </button>
                  <button
                    onClick={() => handleEditCommand(command)}
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeleteCommand(command)}
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

      {/* 编辑器 */}
      <CommandEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveCommand}
        editingCommand={editingCommand}
        initialBody={editingBody}
      />

      {/* 预览 */}
      <CommandPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        command={previewCommand}
        content={previewContent}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        type="danger"
        title="删除命令"
        subtitle="此操作不可撤销"
        content={
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-300">
              确定要删除命令{' '}
              <span className="text-amber-400 font-medium">
                "{commandToDelete?.fullCommand}"
              </span>{' '}
              吗？
            </p>
          </div>
        }
        confirmText="确认删除"
        onConfirm={confirmDeleteCommand}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setCommandToDelete(null);
        }}
      />

      {/* 迁移确认 */}
      <ConfirmDialog
        isOpen={migrateConfirmOpen}
        type="info"
        title="迁移旧版技能"
        subtitle="将旧版 skills 迁移到新版 commands"
        content={
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-300 mb-2">此操作将:</p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
              <li>扫描 ~/.claude/skills/ 目录</li>
              <li>将 SKILL.md 文件复制到 ~/.claude/commands/</li>
              <li>保留原有文件不删除</li>
            </ul>
          </div>
        }
        confirmText={migrating ? '迁移中...' : '开始迁移'}
        onConfirm={handleMigrate}
        onCancel={() => setMigrateConfirmOpen(false)}
      />
    </div>
  );
};
