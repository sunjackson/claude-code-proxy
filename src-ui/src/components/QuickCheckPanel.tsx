/**
 * 快速检测面板
 * - 仅做“可读/可解析/统计”级别检测（skills + MCP）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as mcpApi from '../api/mcp';
import * as slashCommandsApi from '../api/slashCommands';
import type { McpServerInfo, SlashCommandInfo } from '../types/tauri';

export const QuickCheckPanel: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);
  const [slashCommands, setSlashCommands] = useState<SlashCommandInfo[]>([]);
  const [projectRoot, setProjectRoot] = useState<string>('');

  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  const getErrorMessage = (err: unknown): string => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
      return (err as any).message as string;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return t('common.error');
    }
  };

  const counts = useMemo(() => {
    const userCommands = slashCommands.filter((c) => c.scope === 'user').length;
    const projectCommands = slashCommands.filter((c) => c.scope === 'project').length;
    return {
      mcp: mcpServers.length,
      userCommands,
      projectCommands,
      totalCommands: slashCommands.length,
    };
  }, [mcpServers, slashCommands]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMcpError(null);
    setSkillsError(null);
    try {
      const servers = await mcpApi.listMcpServers().catch((err) => {
        setMcpError(getErrorMessage(err));
        return [] as McpServerInfo[];
      });

      const commands = await slashCommandsApi
        .listSlashCommands(projectRoot.trim() ? projectRoot.trim() : undefined)
        .catch((err) => {
          setSkillsError(getErrorMessage(err));
          return [] as SlashCommandInfo[];
        });

      setMcpServers(servers);
      setSlashCommands(commands);
      setLastUpdatedAt(new Date().toLocaleString());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectRoot, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      {/* 顶部说明 */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-yellow-400">快速检测</h2>
            <p className="text-xs text-gray-400 mt-1">
              仅做“可读/可解析/统计”检测：skills（Slash Commands）与 MCP 配置。
            </p>
            {lastUpdatedAt && (
              <p className="text-[10px] text-gray-500 mt-1">更新时间：{lastUpdatedAt}</p>
            )}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 text-xs font-semibold"
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* 快照统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
          <p className="text-xs text-gray-500">MCP 服务器</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.mcp}</p>
          <p className="text-[10px] text-gray-500 mt-1">来源：~/.claude.json</p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
          <p className="text-xs text-gray-500">skills（用户级）</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.userCommands}</p>
          <p className="text-[10px] text-gray-500 mt-1">~/.claude/commands/*.md</p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
          <p className="text-xs text-gray-500">skills（项目级）</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.projectCommands}</p>
          <p className="text-[10px] text-gray-500 mt-1">.claude/commands/*.md</p>
        </div>
      </div>

      {/* 项目路径输入 */}
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-300">项目路径（可选）</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              填写后会同时扫描该项目的 `.claude/commands/`（用于统计项目级 skills）。
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={projectRoot}
            onChange={(e) => setProjectRoot(e.target.value)}
            placeholder="例如：/path/to/your/project"
            className="flex-1 px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50"
          />
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 bg-gray-800/60 hover:bg-gray-800 text-gray-200 rounded-lg border border-gray-700 disabled:opacity-50 text-xs font-semibold"
          >
            应用
          </button>
        </div>
      </div>

      {/* 列表预览 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-yellow-400">MCP 服务器（预览）</p>
            <p className="text-[10px] text-gray-500">最多展示 10 条</p>
          </div>
          {mcpError && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-[10px]">{mcpError}</p>
            </div>
          )}
          {mcpServers.length === 0 ? (
            <p className="text-xs text-gray-500 mt-3">未检测到 MCP 服务器配置</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {mcpServers.slice(0, 10).map((s) => (
                <li key={s.name} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200 font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {s.command} {Array.isArray(s.args) ? s.args.join(' ') : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    {s.enabled ? 'enabled' : 'invalid'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-yellow-400">skills（预览）</p>
            <p className="text-[10px] text-gray-500">最多展示 10 条</p>
          </div>
          {skillsError && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-[10px]">{skillsError}</p>
            </div>
          )}
          {slashCommands.length === 0 ? (
            <p className="text-xs text-gray-500 mt-3">未检测到 skills（Slash Commands）</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {slashCommands.slice(0, 10).map((c) => (
                <li key={`${c.scope}-${c.name}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200 font-semibold truncate">{c.fullCommand}</p>
                    <p className="text-[10px] text-gray-500 truncate">{c.description || '—'}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{c.scope}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
