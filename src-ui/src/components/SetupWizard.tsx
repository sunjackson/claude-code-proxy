/**
 * Zero-Config Code Flow 首次启动向导
 * 回归项目本质：快速代理转发 + 配置/skills/MCP 快速检测
 */

import React, { useCallback, useEffect, useState } from 'react';
import * as mcpApi from '../api/mcp';
import * as slashCommandsApi from '../api/slashCommands';

type WizardStep = 'welcome' | 'ready';

interface SetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpCount, setMcpCount] = useState<number>(0);
  const [skillsCount, setSkillsCount] = useState<number>(0);

  const loadQuickStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [servers, commands] = await Promise.all([
        mcpApi.listMcpServers(),
        slashCommandsApi.listSlashCommands(),
      ]);
      setMcpCount(servers.length);
      setSkillsCount(commands.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleComplete = () => {
    onComplete();
  };

  const handleSkipSetup = () => {
    onSkip();
  };

  useEffect(() => {
    void loadQuickStats();
  }, [loadQuickStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* 欢迎步骤 */}
        {currentStep === 'welcome' && (
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-4">
                欢迎使用 ClaudeCodeProxy
              </h1>
              <p className="text-gray-300 text-lg mb-2">
                专注 Claude Code 快速代理转发
              </p>
              <p className="text-gray-400 text-sm">
                本向导仅做 skills/MCP 配置快速检测，不包含安装/更新/验证功能
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 mb-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-yellow-400">快速检测</p>
                <button
                  onClick={loadQuickStats}
                  disabled={loading}
                  className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 text-xs font-semibold"
                >
                  {loading ? '刷新中…' : '刷新'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-black/30 rounded-lg p-3 border border-gray-800">
                  <p className="text-[10px] text-gray-500">MCP 服务器（~/.claude.json）</p>
                  <p className="text-xl font-bold text-white mt-1">{mcpCount}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-gray-800">
                  <p className="text-[10px] text-gray-500">skills（~/.claude/commands）</p>
                  <p className="text-xl font-bold text-white mt-1">{skillsCount}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setCurrentStep('ready')}
                className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg shadow-yellow-500/30 text-lg"
              >
                继续 →
              </button>
              <button
                onClick={handleSkipSetup}
                className="w-full px-6 py-4 bg-gray-800/50 text-gray-300 font-semibold rounded-lg hover:bg-gray-700/50 transition-all border border-gray-700"
              >
                跳过向导
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800">
              <h3 className="text-yellow-400 font-semibold mb-3 text-sm">本应用提供:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">✓</span>
                  <span>Claude Code 请求快速代理转发</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">✓</span>
                  <span>skills 与 MCP 配置快速检测</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* 完成步骤 */}
        {currentStep === 'ready' && (
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-green-500/50 animate-bounce">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 mb-4">
                🎉 可以开始使用
              </h2>
              <p className="text-gray-300 text-lg">
                进入控制面板后即可启动代理并查看配置检测
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 font-semibold mb-2">💡 建议下一步</p>
              <p className="text-sm text-gray-300">
                打开“Claude Code”页面查看“快速检测”，确认 skills 与 MCP 配置可读
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleComplete}
                className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg shadow-yellow-500/30 text-lg"
              >
                进入控制面板 →
              </button>

              <button
                onClick={handleSkipSetup}
                className="w-full px-6 py-3 bg-gray-800/50 text-gray-300 font-semibold rounded-lg hover:bg-gray-700/50 transition-all border border-gray-700"
              >
                稍后手动配置
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
