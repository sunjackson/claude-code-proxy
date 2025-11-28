/**
 * MCP (Model Context Protocol) 服务器管理组件
 * 管理 Claude Code 的 MCP 服务器配置
 */

import React, { useState, useEffect } from 'react';
import type { McpServerInfo, McpServerConfig, McpServerTemplate } from '../types/tauri';
import * as mcpApi from '../api/mcp';

interface McpServerEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, config: McpServerConfig) => void;
  editingServer?: McpServerInfo | null;
}

const McpServerEditor: React.FC<McpServerEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  editingServer,
}) => {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [envVars, setEnvVars] = useState('');

  useEffect(() => {
    if (editingServer) {
      setName(editingServer.name);
      setCommand(editingServer.command);
      setArgs(editingServer.args.join(' '));
      setEnvVars(
        editingServer.env
          ? Object.entries(editingServer.env)
              .map(([k, v]) => `${k}=${v}`)
              .join('\n')
          : ''
      );
    } else {
      setName('');
      setCommand('');
      setArgs('');
      setEnvVars('');
    }
  }, [editingServer, isOpen]);

  const handleSave = () => {
    // 解析参数
    const parsedArgs = args
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0);

    // 解析环境变量
    const parsedEnv: Record<string, string> = {};
    if (envVars.trim()) {
      envVars.split('\n').forEach((line) => {
        const [key, ...valueParts] = line.trim().split('=');
        if (key) {
          parsedEnv[key] = valueParts.join('=');
        }
      });
    }

    const config: McpServerConfig = {
      command: command.trim(),
      args: parsedArgs,
      env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined,
    };

    onSave(name.trim(), config);
  };

  const isValid = name.trim() && command.trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-amber-400">
            {editingServer ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 text-2xl">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              服务器名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!editingServer}
              placeholder="例如: brave-search"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              启动命令 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例如: npx 或 python"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              命令参数(用空格分隔)
            </label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="例如: -m mcp_server_brave"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              环境变量(每行一个,格式: KEY=VALUE)
            </label>
            <textarea
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder="BRAVE_API_KEY=your_api_key"
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 font-mono text-sm"
            />
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
            {editingServer ? '更新' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: McpServerTemplate[];
  onSelectTemplate: (template: McpServerTemplate) => void;
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({
  isOpen,
  onClose,
  templates,
  onSelectTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = React.useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  const filteredTemplates = React.useMemo(() => {
    if (selectedCategory === 'all') return templates;
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-amber-400">从模板添加服务器</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 text-2xl">
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {cat === 'all' ? '全部' : cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTemplates.map((template) => (
            <button
              key={template.name}
              onClick={() => onSelectTemplate(template)}
              className="p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-500/50 transition-colors text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-medium">
                      {template.display_name}
                    </span>
                    {template.recommended && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                        推荐
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{template.description}</div>
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-gray-400">该分类下暂无模板</div>
        )}
      </div>
    </div>
  );
};

interface TemplateConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: McpServerTemplate | null;
  onConfirm: (serverName: string, envValues: Record<string, string>) => void;
}

const TemplateConfigDialog: React.FC<TemplateConfigDialogProps> = ({
  isOpen,
  onClose,
  template,
  onConfirm,
}) => {
  const [serverName, setServerName] = useState('');
  const [envValues, setEnvValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setServerName(template.name);
      const initialEnv: Record<string, string> = {};
      (template.required_env_vars || []).forEach((key) => {
        initialEnv[key] = '';
      });
      setEnvValues(initialEnv);
    }
  }, [template]);

  const handleConfirm = () => {
    onConfirm(serverName, envValues);
  };

  const isValid = serverName.trim() && (template?.required_env_vars || []).every((key) => envValues[key]);

  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-amber-400">配置 {template.display_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 text-2xl">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">服务器名称</label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {template.required_env_vars && template.required_env_vars.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                环境变量配置
              </label>
              <div className="space-y-3">
                {template.required_env_vars.map((key) => (
                  <div key={key}>
                    <label className="block text-sm text-gray-400 mb-1">
                      {key}
                      {template.env_var_descriptions && template.env_var_descriptions[key] && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({template.env_var_descriptions[key]})
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={envValues[key] || ''}
                      onChange={(e) =>
                        setEnvValues({ ...envValues, [key]: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-amber-500"
                      placeholder={`输入 ${key} 的值`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
};

export const McpServerManager: React.FC = () => {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [templates, setTemplates] = useState<McpServerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isTemplateConfigOpen, setIsTemplateConfigOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerInfo | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<McpServerTemplate | null>(null);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mcpApi.listMcpServers();
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 MCP 服务器列表失败');
      console.error('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await mcpApi.getMcpTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load MCP templates:', err);
    }
  };

  useEffect(() => {
    loadServers();
    loadTemplates();
  }, []);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleAddServer = () => {
    setEditingServer(null);
    setIsEditorOpen(true);
  };

  const handleEditServer = (server: McpServerInfo) => {
    setEditingServer(server);
    setIsEditorOpen(true);
  };

  const handleSaveServer = async (name: string, config: McpServerConfig) => {
    try {
      setError(null);
      if (editingServer) {
        await mcpApi.updateMcpServer(name, config);
        showSuccess('服务器已更新');
      } else {
        await mcpApi.addMcpServer(name, config);
        showSuccess('服务器已添加');
      }
      setIsEditorOpen(false);
      await loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存服务器配置失败');
      console.error('Failed to save MCP server:', err);
    }
  };

  const handleRemoveServer = async (name: string) => {
    if (!window.confirm(`确定要删除服务器 "${name}" 吗?`)) {
      return;
    }

    try {
      setError(null);
      await mcpApi.removeMcpServer(name);
      showSuccess('服务器已删除');
      await loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除服务器失败');
      console.error('Failed to remove MCP server:', err);
    }
  };

  const handleTestServer = async (name: string) => {
    try {
      setError(null);
      const result = await mcpApi.testMcpServer(name);
      alert(`测试结果:\n${result}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试服务器失败');
      console.error('Failed to test MCP server:', err);
    }
  };

  const handleSelectTemplate = (template: McpServerTemplate) => {
    setSelectedTemplate(template);
    setIsTemplateDialogOpen(false);
    setIsTemplateConfigOpen(true);
  };

  const handleConfirmTemplate = async (
    serverName: string,
    envValues: Record<string, string>
  ) => {
    if (!selectedTemplate) return;

    try {
      setError(null);
      await mcpApi.addMcpServerFromTemplate(selectedTemplate.name, serverName, envValues);
      showSuccess(`已从模板添加服务器 "${serverName}"`);
      setIsTemplateConfigOpen(false);
      setSelectedTemplate(null);
      await loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '从模板添加服务器失败');
      console.error('Failed to add MCP server from template:', err);
    }
  };

  const handleExport = async () => {
    try {
      const configs = await mcpApi.exportMcpServers();
      const json = JSON.stringify(configs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mcp-servers-export.json';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('配置已导出');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出配置失败');
      console.error('Failed to export MCP servers:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const configs = JSON.parse(text);
      await mcpApi.importMcpServers(configs);
      showSuccess('配置已导入');
      await loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入配置失败');
      console.error('Failed to import MCP servers:', err);
    }
    event.target.value = '';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">MCP 服务器管理</h2>
          <p className="text-gray-400 text-sm mt-1">
            管理 Claude Code 的 Model Context Protocol 扩展服务器
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
            onClick={() => setIsTemplateDialogOpen(true)}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            从模板添加
          </button>
          <button
            onClick={handleAddServer}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            手动添加服务器
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
      ) : servers.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">暂无 MCP 服务器配置</div>
          <button
            onClick={() => setIsTemplateDialogOpen(true)}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            从模板快速添加
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div
              key={server.name}
              className="p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-amber-400">{server.name}</h3>
                    {server.enabled && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                        已启用
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-gray-500">命令:</span>
                      <span className="text-gray-300 font-mono">{server.command}</span>
                    </div>
                    {server.args.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-gray-500">参数:</span>
                        <span className="text-gray-300 font-mono">
                          {server.args.join(' ')}
                        </span>
                      </div>
                    )}
                    {server.env && Object.keys(server.env).length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-gray-500">环境变量:</span>
                        <span className="text-gray-400 text-xs">
                          {Object.keys(server.env).length} 个
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleTestServer(server.name)}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm"
                  >
                    测试
                  </button>
                  <button
                    onClick={() => handleEditServer(server)}
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleRemoveServer(server.name)}
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

      <McpServerEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveServer}
        editingServer={editingServer}
      />

      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        templates={templates}
        onSelectTemplate={handleSelectTemplate}
      />

      <TemplateConfigDialog
        isOpen={isTemplateConfigOpen}
        onClose={() => {
          setIsTemplateConfigOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        onConfirm={handleConfirmTemplate}
      />
    </div>
  );
};
