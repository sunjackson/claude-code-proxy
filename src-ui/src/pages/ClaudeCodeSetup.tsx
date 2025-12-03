/**
 * Claude Code 配置页面
 * 环境检测、MCP服务器、权限和技能管理
 */

import React, { useState, useEffect } from 'react';
import { CompactLayout } from '../components/CompactLayout';
import { McpServerManager } from '../components/McpServerManager';
import { PermissionsManager } from '../components/PermissionsManager';
import { SkillsManager } from '../components/SkillsManager';
import type { EnvironmentStatus, InstallOptions, InstallProgress, InstallMethod } from '../types/tauri';
import {
  detectEnvironment,
  installClaudeCode,
  runClaudeDoctor,
  getClaudeVersion,
  verifyClaudeInstallation,
  checkCanInstall,
} from '../api/setup';

type MainTab = 'environment' | 'mcp' | 'permissions' | 'skills';
type EnvSubTab = 'detection' | 'install' | 'verify';

interface TabConfig {
  id: MainTab;
  label: string;
  icon: React.ReactNode;
}

const mainTabs: TabConfig[] = [
  {
    id: 'environment',
    label: '环境检测',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'mcp',
    label: 'MCP 服务',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    )
  },
  {
    id: 'permissions',
    label: '权限管理',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    )
  },
  {
    id: 'skills',
    label: '技能配置',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
];

export const ClaudeCodeSetup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>('environment');
  const [envSubTab, setEnvSubTab] = useState<EnvSubTab>('detection');

  // 环境检测状态
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 安装相关状态
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installMethod, setInstallMethod] = useState<InstallMethod>('Native');
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);

  // 验证相关状态
  const [verifying, setVerifying] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string>('');
  const [claudeVersion, setClaudeVersion] = useState<string>('');

  useEffect(() => {
    loadEnvironmentStatus();
  }, []);

  const loadEnvironmentStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await detectEnvironment();
      setEnvStatus(status);

      const [can, missing] = await checkCanInstall();
      setCanInstall(can);
      setMissingDeps(missing);

      if (status.claude_installed) {
        // 已安装时获取版本信息，但不自动跳转标签
        try {
          const version = await getClaudeVersion();
          setClaudeVersion(version);
        } catch (err) {
          console.error('Failed to get Claude version:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '环境检测失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!canInstall) {
      setError('环境不满足安装条件,请先安装缺失的依赖');
      return;
    }

    setInstalling(true);
    setError(null);
    setInstallProgress(null);

    const options: InstallOptions = {
      method: installMethod,
      auto_configure: true,
      auto_backup: true,
      auto_test: true,
      auto_start_proxy: false,
    };

    try {
      await installClaudeCode(options, (progress) => {
        setInstallProgress(progress);
      });
      await loadEnvironmentStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装失败');
    } finally {
      setInstalling(false);
    }
  };

  const handleRunDoctor = async () => {
    setVerifying(true);
    setError(null);
    try {
      const output = await runClaudeDoctor();
      setDoctorOutput(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行 claude doctor 失败');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyInstallation = async () => {
    setVerifying(true);
    setError(null);
    try {
      const isInstalled = await verifyClaudeInstallation();
      if (isInstalled) {
        const version = await getClaudeVersion();
        setClaudeVersion(version);
        setDoctorOutput('✅ Claude Code 已正确安装');
      } else {
        setError('Claude Code 未安装或安装不完整');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusIcon = (installed: boolean) => {
    return installed ? (
      <span className="text-green-400">✅</span>
    ) : (
      <span className="text-red-400">❌</span>
    );
  };

  const getProgressBarColor = (stage: string) => {
    if (stage === 'Failed') return 'bg-red-500';
    if (stage === 'Complete') return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const renderEnvironmentContent = () => (
    <div className="space-y-4">
      {/* 环境子标签 */}
      <div className="flex gap-1 bg-gray-800/30 p-1 rounded-lg">
        {[
          { id: 'detection' as EnvSubTab, label: '环境检测', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )},
          { id: 'install' as EnvSubTab, label: '安装', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )},
          { id: 'verify' as EnvSubTab, label: '验证', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )},
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setEnvSubTab(tab.id)}
            className={`flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
              envSubTab === tab.id
                ? 'bg-yellow-500/20 text-yellow-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 环境检测 */}
      {envSubTab === 'detection' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-yellow-400">系统环境</h3>
            <button
              onClick={loadEnvironmentStatus}
              disabled={loading}
              className="px-2.5 py-1 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-md border border-yellow-500/30 disabled:opacity-50 flex items-center gap-1"
            >
              {loading ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {loading ? '检测中' : '刷新'}
            </button>
          </div>

          {envStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 系统信息 */}
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">系统信息</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">操作系统</span>
                    <span className="text-white font-medium">{envStatus.os_type} {envStatus.os_version}</span>
                  </div>
                  {envStatus.shell && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shell</span>
                      <span className="text-white font-medium">{envStatus.shell}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">网络</span>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(envStatus.network_available)}
                      <span className={envStatus.network_available ? 'text-green-400' : 'text-red-400'}>
                        {envStatus.network_available ? '正常' : '异常'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Claude Code 状态 */}
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Claude Code</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">状态</span>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(envStatus.claude_installed)}
                      <span className={envStatus.claude_installed ? 'text-green-400' : 'text-red-400'}>
                        {envStatus.claude_installed ? '已安装' : '未安装'}
                      </span>
                    </span>
                  </div>
                  {envStatus.claude_version && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">版本</span>
                      <span className="text-white font-mono">{envStatus.claude_version}</span>
                    </div>
                  )}
                  {envStatus.claude_path && (
                    <div className="flex justify-between items-start">
                      <span className="text-gray-500 flex-shrink-0">路径</span>
                      <span className="text-gray-300 text-[10px] font-mono break-all ml-2 text-right max-w-[180px]">{envStatus.claude_path}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 依赖检测 */}
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800 md:col-span-2">
                <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">依赖组件</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1.5">
                    {getStatusIcon(envStatus.node_installed)}
                    <span className="text-gray-300">Node.js {envStatus.node_version || ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1.5">
                    {getStatusIcon(envStatus.ripgrep_installed)}
                    <span className="text-gray-300">ripgrep</span>
                  </div>
                  {envStatus.os_type === 'macos' && (
                    <div className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1.5">
                      {getStatusIcon(envStatus.homebrew_installed)}
                      <span className="text-gray-300">Homebrew</span>
                    </div>
                  )}
                  {envStatus.os_type === 'windows' && (
                    <>
                      <div className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1.5">
                        {getStatusIcon(envStatus.wsl_installed)}
                        <span className="text-gray-300">WSL</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1.5">
                        {getStatusIcon(envStatus.git_bash_installed)}
                        <span className="text-gray-300">Git Bash</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 安装检查结果 */}
              <div className={`md:col-span-2 rounded-lg p-3 border ${
                canInstall ? 'bg-green-500/5 border-green-500/30' : 'bg-yellow-500/5 border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  {canInstall ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <div>
                    <p className={`text-xs font-semibold ${canInstall ? 'text-green-400' : 'text-yellow-400'}`}>
                      {canInstall ? '环境检查通过' : '环境检查未通过'}
                    </p>
                    {missingDeps.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        缺失: {missingDeps.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 安装 */}
      {envSubTab === 'install' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-yellow-400">安装 Claude Code</h3>

          {envStatus?.claude_installed ? (
            <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-green-400 text-xs font-semibold">Claude Code 已安装</p>
                  <p className="text-gray-400 text-[10px]">版本: {envStatus.claude_version || '未知'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 安装方式选择 */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setInstallMethod('Native')}
                  disabled={installing}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    installMethod === 'Native'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                  } disabled:opacity-50`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <div className="font-semibold text-xs">官方脚本</div>
                  <div className="text-[10px] mt-0.5 opacity-70">推荐</div>
                </button>
                {envStatus?.os_type === 'macos' && (
                  <button
                    onClick={() => setInstallMethod('Homebrew')}
                    disabled={installing || !envStatus.homebrew_installed}
                    className={`p-3 rounded-lg border transition-all text-center ${
                      installMethod === 'Homebrew'
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                        : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                    } disabled:opacity-50`}
                  >
                    <div className="text-lg mb-1">🍺</div>
                    <div className="font-semibold text-xs">Homebrew</div>
                    <div className="text-[10px] mt-0.5 opacity-70">macOS</div>
                  </button>
                )}
                <button
                  onClick={() => setInstallMethod('NPM')}
                  disabled={installing || !envStatus?.node_installed}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    installMethod === 'NPM'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                  } disabled:opacity-50`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <div className="font-semibold text-xs">NPM</div>
                  <div className="text-[10px] mt-0.5 opacity-70">需 Node.js</div>
                </button>
              </div>

              {/* 安装进度 */}
              {installProgress && (
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-yellow-400">{installProgress.stage}</span>
                    <span className="text-gray-400">{Math.round(installProgress.progress * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getProgressBarColor(installProgress.stage)}`}
                      style={{ width: `${installProgress.progress * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">{installProgress.message}</p>
                </div>
              )}

              {/* 安装按钮 */}
              <button
                onClick={handleInstall}
                disabled={installing || !canInstall}
                className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-xs font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {installing ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    安装中...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    开始安装
                  </>
                )}
              </button>

              {!canInstall && missingDeps.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">安装前需要:</p>
                  {missingDeps.map((dep, idx) => (
                    <p key={idx} className="text-[10px] text-gray-400 ml-3">• {dep}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 验证 */}
      {envSubTab === 'verify' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-yellow-400">验证安装</h3>

          {claudeVersion && (
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Claude Code 版本</span>
                <span className="text-white font-mono">{claudeVersion}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleVerifyInstallation}
              disabled={verifying}
              className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              {verifying ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              验证安装
            </button>
            <button
              onClick={handleRunDoctor}
              disabled={verifying}
              className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              {verifying ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              )}
              运行诊断
            </button>
          </div>

          {doctorOutput && (
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">诊断输出</h4>
              <pre className="text-[10px] text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto max-h-40 overflow-y-auto">
                {doctorOutput}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'environment':
        return renderEnvironmentContent();
      case 'mcp':
        return <McpServerManager />;
      case 'permissions':
        return <PermissionsManager />;
      case 'skills':
        return <SkillsManager />;
      default:
        return null;
    }
  };

  return (
    <CompactLayout>
      {/* 页面标题 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Claude Code 配置
        </h1>
        <p className="text-gray-500 text-xs mt-1">
          环境检测 · MCP服务 · 权限管理 · 技能配置
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 主标签栏 */}
      <div className="bg-gray-900/50 rounded-xl border border-yellow-500/20 overflow-hidden">
        <div className="border-b border-yellow-500/20 bg-black/30">
          <div className="flex">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {tab.icon}
                  <span>{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-4">
          {renderContent()}
        </div>
      </div>
    </CompactLayout>
  );
};

export default ClaudeCodeSetup;
