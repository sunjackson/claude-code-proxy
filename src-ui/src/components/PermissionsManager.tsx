/**
 * Permissions 配置管理组件
 * 管理 Claude Code 的工具权限配置
 * 基于 ~/.claude/settings.json 中的 permissions 字段
 */

import React, { useState, useEffect } from 'react';
import type { PermissionsConfig, McpServerInfo } from '../types/tauri';
import * as permissionsApi from '../api/permissions';
import * as mcpApi from '../api/mcp';
import { ConfirmDialog } from './ui/Dialog';

// Claude Code 内置工具列表
const BUILTIN_TOOLS = [
  { name: 'Bash', description: '执行 shell 命令', category: 'system' },
  { name: 'BashOutput', description: '获取 Bash 输出', category: 'system' },
  { name: 'Read', description: '读取文件内容', category: 'file' },
  { name: 'Write', description: '写入文件', category: 'file' },
  { name: 'Edit', description: '编辑文件', category: 'file' },
  { name: 'Glob', description: '文件模式匹配', category: 'file' },
  { name: 'Grep', description: '搜索文件内容', category: 'file' },
  { name: 'NotebookEdit', description: '编辑 Jupyter Notebook', category: 'file' },
  { name: 'WebFetch', description: '获取网页内容', category: 'network' },
  { name: 'WebSearch', description: '网页搜索', category: 'network' },
  { name: 'Task', description: '启动子任务代理', category: 'agent' },
  { name: 'TodoWrite', description: '管理待办事项', category: 'agent' },
  { name: 'KillShell', description: '终止 shell 进程', category: 'system' },
  { name: 'SlashCommand', description: '执行斜杠命令', category: 'agent' },
];

// 工具分类
const CATEGORIES = {
  file: { label: '文件操作', icon: '📁', color: 'yellow' },
  system: { label: '系统命令', icon: '💻', color: 'red' },
  network: { label: '网络访问', icon: '🌐', color: 'blue' },
  agent: { label: '代理功能', icon: '🤖', color: 'green' },
  mcp: { label: 'MCP 服务器', icon: '🔌', color: 'purple' },
};

export const PermissionsManager: React.FC = () => {
  const [config, setConfig] = useState<PermissionsConfig>({ allow: [], deny: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [newMcpTool, setNewMcpTool] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);
  const [selectedMcpServer, setSelectedMcpServer] = useState<string>('');

  // 重置确认弹窗状态
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await permissionsApi.getPermissionsConfig();
      setConfig(data || { allow: [], deny: [] });
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载权限配置失败');
      console.error('Failed to load permissions config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMcpServers = async () => {
    try {
      const servers = await mcpApi.listMcpServers();
      setMcpServers(servers.filter(s => s.enabled)); // 只显示已启用的服务器
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    }
  };

  useEffect(() => {
    loadConfig();
    loadMcpServers();
  }, []);

  const showSuccessMessage = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await permissionsApi.updatePermissionsConfig(config);
      showSuccessMessage('权限配置已保存');
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存权限配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetConfirmOpen(true);
  };

  const confirmReset = async () => {
    try {
      setError(null);
      await permissionsApi.clearPermissionsConfig();
      setConfig({ allow: [], deny: [] });
      showSuccessMessage('权限配置已重置');
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置权限配置失败');
    } finally {
      setResetConfirmOpen(false);
    }
  };

  // 检查工具是否在允许列表中
  const isAllowed = (toolName: string) => config?.allow?.includes(toolName) ?? false;

  // 检查工具是否在禁止列表中
  const isDenied = (toolName: string) => config?.deny?.includes(toolName) ?? false;

  // 切换工具权限状态
  const toggleTool = (toolName: string, targetList: 'allow' | 'deny') => {
    if (!config) return;

    const newConfig = { ...config };

    // 从两个列表中移除
    newConfig.allow = (newConfig.allow || []).filter(t => t !== toolName);
    newConfig.deny = (newConfig.deny || []).filter(t => t !== toolName);

    // 添加到目标列表
    if (targetList === 'allow' && !isAllowed(toolName)) {
      newConfig.allow.push(toolName);
    } else if (targetList === 'deny' && !isDenied(toolName)) {
      newConfig.deny.push(toolName);
    }

    setConfig(newConfig);
    setHasChanges(true);
  };

  // 移除工具权限（恢复默认）
  const removeTool = (toolName: string) => {
    if (!config) return;

    const newConfig = {
      allow: (config.allow || []).filter(t => t !== toolName),
      deny: (config.deny || []).filter(t => t !== toolName),
    };
    setConfig(newConfig);
    setHasChanges(true);
  };

  // 添加 MCP 工具
  const addMcpTool = () => {
    if (!config) return;

    // 优先使用下拉选择的服务器
    const toolName = selectedMcpServer || newMcpTool.trim();
    if (!toolName) return;

    // 确保格式正确
    const formattedName = toolName.startsWith('mcp__') ? toolName : `mcp__${toolName}`;

    if (!(config.allow || []).includes(formattedName)) {
      setConfig({
        ...config,
        allow: [...(config.allow || []), formattedName],
      });
      setHasChanges(true);
    }
    setNewMcpTool('');
    setSelectedMcpServer('');
  };

  // 获取 MCP 工具列表（带服务器信息）
  const getMcpTools = () => {
    if (!config) return [];

    const mcpTools = new Set<string>();
    (config.allow || []).filter(t => t.startsWith('mcp__')).forEach(t => mcpTools.add(t));
    (config.deny || []).filter(t => t.startsWith('mcp__')).forEach(t => mcpTools.add(t));
    return Array.from(mcpTools);
  };

  // 获取 MCP 工具的服务器信息
  const getMcpServerInfo = (toolName: string) => {
    // 从 mcp__server_name 中提取 server_name
    const serverName = toolName.replace(/^mcp__/, '');
    return mcpServers.find(s => s.name === serverName);
  };

  // 过滤工具
  const filterTools = (tools: typeof BUILTIN_TOOLS) => {
    if (!searchTerm) return tools;
    const term = searchTerm.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term)
    );
  };

  // 按分类分组工具
  const groupedTools = Object.entries(CATEGORIES).map(([categoryId, categoryInfo]) => ({
    ...categoryInfo,
    id: categoryId,
    tools: filterTools(BUILTIN_TOOLS.filter(t => t.category === categoryId)),
  })).filter(g => g.tools.length > 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索工具..."
            className="w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-yellow-500 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/30"
          >
            重置
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 text-sm bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* 统计信息 */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-gray-400">允许: {config?.allow?.length ?? 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-gray-400">禁止: {config?.deny?.length ?? 0}</span>
        </div>
      </div>

      {/* 内置工具分类 */}
      {groupedTools.map((group) => (
        <div key={group.id} className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
              <span>{group.icon}</span>
              <span>{group.label}</span>
              <span className="text-gray-500 font-normal">({group.tools.length})</span>
            </h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {group.tools.map((tool) => (
                <div
                  key={tool.name}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isAllowed(tool.name)
                      ? 'bg-green-500/10 border-green-500/30'
                      : isDenied(tool.name)
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-gray-200">{tool.name}</div>
                    <div className="text-xs text-gray-500 truncate">{tool.description}</div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => toggleTool(tool.name, 'allow')}
                      className={`p-1.5 rounded transition-colors ${
                        isAllowed(tool.name)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-green-500/30 hover:text-green-400'
                      }`}
                      title="允许"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleTool(tool.name, 'deny')}
                      className={`p-1.5 rounded transition-colors ${
                        isDenied(tool.name)
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-red-500/30 hover:text-red-400'
                      }`}
                      title="禁止"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {(isAllowed(tool.name) || isDenied(tool.name)) && (
                      <button
                        onClick={() => removeTool(tool.name)}
                        className="p-1.5 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                        title="恢复默认"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* MCP 工具 */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
            <span>🔌</span>
            <span>MCP 服务器工具</span>
          </h3>
        </div>
        <div className="p-3 space-y-3">
          {/* 添加 MCP 工具 */}
          <div className="space-y-2">
            {mcpServers.length > 0 ? (
              <>
                <label className="block text-xs text-gray-400">从已配置的 MCP 服务器中选择：</label>
                <div className="flex gap-2">
                  <select
                    value={selectedMcpServer}
                    onChange={(e) => setSelectedMcpServer(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-yellow-500 text-sm"
                  >
                    <option value="">-- 选择 MCP 服务器 --</option>
                    {mcpServers.map((server) => (
                      <option key={server.name} value={server.name}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addMcpTool}
                    disabled={!selectedMcpServer}
                    className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    添加到允许
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500 p-2 bg-gray-800/30 rounded border border-gray-800">
                暂无已配置的 MCP 服务器，请先在设置页面配置 MCP 服务器
              </div>
            )}

            {/* 手动输入选项 */}
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-400 hover:text-yellow-400 transition-colors">
                或手动输入自定义 MCP 工具名称
              </summary>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newMcpTool}
                  onChange={(e) => setNewMcpTool(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addMcpTool()}
                  placeholder="输入工具名称 (如: mcp__exa 或 exa)"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-yellow-500 text-sm font-mono"
                />
                <button
                  onClick={addMcpTool}
                  disabled={!newMcpTool.trim()}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加
                </button>
              </div>
            </details>
          </div>

          {/* MCP 工具列表 */}
          {getMcpTools().length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {getMcpTools().map((tool) => {
                const serverInfo = getMcpServerInfo(tool);
                return (
                  <div
                    key={tool}
                    className={`flex flex-col p-3 rounded-lg border transition-colors ${
                      isAllowed(tool)
                        ? 'bg-green-500/10 border-green-500/30'
                        : isDenied(tool)
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-gray-800/50 border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-200 truncate">{tool}</div>
                        {serverInfo ? (
                          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600">命令:</span>
                              <span className="truncate">{serverInfo.command}</span>
                            </div>
                            {serverInfo.args.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600">参数:</span>
                                <span className="truncate">{serverInfo.args.join(' ')}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-yellow-500/70 mt-1">未找到对应的 MCP 服务器配置</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleTool(tool, 'allow')}
                          className={`p-1.5 rounded transition-colors ${
                            isAllowed(tool)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-green-500/30 hover:text-green-400'
                          }`}
                          title="允许"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleTool(tool, 'deny')}
                          className={`p-1.5 rounded transition-colors ${
                            isDenied(tool)
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-red-500/30 hover:text-red-400'
                          }`}
                          title="禁止"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeTool(tool)}
                          className="p-1.5 rounded bg-gray-700 text-gray-400 hover:bg-red-500/30 hover:text-red-400 transition-colors"
                          title="移除"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              暂无 MCP 工具配置
            </div>
          )}
        </div>
      </div>

      {/* 未保存提示 */}
      {hasChanges && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>您有未保存的更改</span>
        </div>
      )}

      {/* 说明 */}
      <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-800 text-sm text-gray-500">
        <p className="mb-2"><strong className="text-gray-400">说明:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-green-400">✓ 允许</span> - 工具可以在无需确认的情况下执行</li>
          <li><span className="text-red-400">✕ 禁止</span> - 工具被完全禁用</li>
          <li><span className="text-gray-400">默认</span> - 工具执行时会请求用户确认</li>
        </ul>
      </div>

      {/* 重置确认弹窗 */}
      <ConfirmDialog
        isOpen={resetConfirmOpen}
        type="warning"
        title="重置权限配置"
        subtitle="此操作不可撤销"
        content={
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-300">确定要重置权限配置吗？</p>
            <p className="text-gray-500 text-sm mt-2">这将清除所有自定义权限设置，恢复为默认状态。</p>
          </div>
        }
        confirmText="确认重置"
        onConfirm={confirmReset}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
};
