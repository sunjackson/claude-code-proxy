/**
 * Claude Code 设置页面
 * 融合环境检测、安装和高级配置（MCP、权限、技能）
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
  icon: string;
}

const mainTabs: TabConfig[] = [
  { id: 'environment', label: '环境与安装', icon: '🔧' },
  { id: 'mcp', label: 'MCP 服务器', icon: '🔌' },
  { id: 'permissions', label: '权限配置', icon: '🔒' },
  { id: 'skills', label: '技能管理', icon: '✨' },
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
        setEnvSubTab('verify');
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
      <div className="flex gap-2">
        {[
          { id: 'detection' as EnvSubTab, label: '🔍 环境检测' },
          { id: 'install' as EnvSubTab, label: '📦 安装' },
          { id: 'verify' as EnvSubTab, label: '✅ 验证' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setEnvSubTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              envSubTab === tab.id
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 环境检测 */}
      {envSubTab === 'detection' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-yellow-400">系统环境检测</h3>
            <button
              onClick={loadEnvironmentStatus}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50"
            >
              {loading ? '检测中...' : '🔄 重新检测'}
            </button>
          </div>

          {envStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 系统信息 */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h4 className="text-sm font-semibold text-yellow-400 mb-3">系统信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">操作系统:</span>
                    <span className="text-white">{envStatus.os_type} {envStatus.os_version}</span>
                  </div>
                  {envStatus.shell && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Shell:</span>
                      <span className="text-white">{envStatus.shell}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">网络:</span>
                    <span>{getStatusIcon(envStatus.network_available)} {envStatus.network_available ? '正常' : '异常'}</span>
                  </div>
                </div>
              </div>

              {/* Claude Code 状态 */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h4 className="text-sm font-semibold text-yellow-400 mb-3">Claude Code</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">安装状态:</span>
                    <span>{getStatusIcon(envStatus.claude_installed)} {envStatus.claude_installed ? '已安装' : '未安装'}</span>
                  </div>
                  {envStatus.claude_version && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">版本:</span>
                      <span className="text-white">{envStatus.claude_version}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 依赖检测 */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 md:col-span-2">
                <h4 className="text-sm font-semibold text-yellow-400 mb-3">依赖检测</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(envStatus.node_installed)}
                    <span className="text-gray-300">Node.js {envStatus.node_version || ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(envStatus.ripgrep_installed)}
                    <span className="text-gray-300">ripgrep</span>
                  </div>
                  {envStatus.os_type === 'macos' && (
                    <div className="flex items-center gap-2">
                      {getStatusIcon(envStatus.homebrew_installed)}
                      <span className="text-gray-300">Homebrew</span>
                    </div>
                  )}
                  {envStatus.os_type === 'windows' && (
                    <>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(envStatus.wsl_installed)}
                        <span className="text-gray-300">WSL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(envStatus.git_bash_installed)}
                        <span className="text-gray-300">Git Bash</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 安装检查结果 */}
              <div className={`md:col-span-2 rounded-lg p-4 border ${
                canInstall ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{canInstall ? '✅' : '⚠️'}</span>
                  <div>
                    <p className={`font-semibold ${canInstall ? 'text-green-400' : 'text-yellow-400'}`}>
                      {canInstall ? '环境检查通过，可以安装 Claude Code' : '环境检查未通过'}
                    </p>
                    {missingDeps.length > 0 && (
                      <p className="text-sm text-gray-400 mt-1">
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
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-yellow-400">安装 Claude Code</h3>

          {envStatus?.claude_installed ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-lg">✅</span>
                <div>
                  <p className="text-green-400 font-semibold">Claude Code 已安装</p>
                  <p className="text-gray-300 text-sm">版本: {envStatus.claude_version || '未知'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 安装方式选择 */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setInstallMethod('Native')}
                  disabled={installing}
                  className={`p-4 rounded-lg border transition-all ${
                    installMethod === 'Native'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="text-2xl mb-2">🌐</div>
                  <div className="font-semibold text-sm">官方脚本</div>
                  <div className="text-xs mt-1 opacity-70">推荐</div>
                </button>
                {envStatus?.os_type === 'macos' && (
                  <button
                    onClick={() => setInstallMethod('Homebrew')}
                    disabled={installing || !envStatus.homebrew_installed}
                    className={`p-4 rounded-lg border transition-all ${
                      installMethod === 'Homebrew'
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                        : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                    } disabled:opacity-50`}
                  >
                    <div className="text-2xl mb-2">🍺</div>
                    <div className="font-semibold text-sm">Homebrew</div>
                    <div className="text-xs mt-1 opacity-70">macOS</div>
                  </button>
                )}
                <button
                  onClick={() => setInstallMethod('NPM')}
                  disabled={installing || !envStatus?.node_installed}
                  className={`p-4 rounded-lg border transition-all ${
                    installMethod === 'NPM'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="text-2xl mb-2">📦</div>
                  <div className="font-semibold text-sm">NPM</div>
                  <div className="text-xs mt-1 opacity-70">需要 Node.js</div>
                </button>
              </div>

              {/* 安装进度 */}
              {installProgress && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-yellow-400">{installProgress.stage}</span>
                    <span className="text-sm text-gray-400">{Math.round(installProgress.progress * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getProgressBarColor(installProgress.stage)}`}
                      style={{ width: `${installProgress.progress * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-300">{installProgress.message}</p>
                </div>
              )}

              {/* 安装按钮 */}
              <button
                onClick={handleInstall}
                disabled={installing || !canInstall}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {installing ? '安装中...' : '🚀 开始安装'}
              </button>

              {!canInstall && missingDeps.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold mb-2">安装前需要:</p>
                  {missingDeps.map((dep, idx) => (
                    <p key={idx} className="text-sm text-gray-300 ml-4">• {dep}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 验证 */}
      {envSubTab === 'verify' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-yellow-400">验证安装</h3>

          {claudeVersion && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Claude Code 版本:</span>
                <span className="text-white font-mono">{claudeVersion}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleVerifyInstallation}
              disabled={verifying}
              className="flex-1 px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 font-semibold"
            >
              {verifying ? '验证中...' : '🔍 验证安装'}
            </button>
            <button
              onClick={handleRunDoctor}
              disabled={verifying}
              className="flex-1 px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 font-semibold"
            >
              {verifying ? '运行中...' : '🏥 运行 Doctor'}
            </button>
          </div>

          {doctorOutput && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">诊断输出</h4>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-yellow-400">Claude Code 设置</h1>
        <p className="text-gray-400 text-sm mt-1">
          环境检测、安装和高级配置管理
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400">⚠️</span>
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
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span>{tab.icon}</span>
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
        <div className="p-5">
          {renderContent()}
        </div>
      </div>
    </CompactLayout>
  );
};

export default ClaudeCodeSetup;
