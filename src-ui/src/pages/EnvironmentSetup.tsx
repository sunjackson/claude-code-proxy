/**
 * 环境设置页面
 * Claude Code 环境检测和自动安装
 */

import React, { useState, useEffect } from 'react';
import { CompactLayout } from '../components/CompactLayout';
import type { EnvironmentStatus, InstallOptions, InstallProgress, InstallMethod, VersionInfo } from '../types/tauri';
import {
  detectEnvironment,
  installClaudeCode,
  runClaudeDoctor,
  getClaudeVersion,
  verifyClaudeInstallation,
  checkCanInstall,
  checkForUpdates,
  updateClaudeCode,
} from '../api/setup';

type SetupTab = 'detection' | 'install' | 'verify';

export const EnvironmentSetup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SetupTab>('detection');
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
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadEnvironmentStatus();
  }, []);

  const loadEnvironmentStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await detectEnvironment();
      setEnvStatus(status);

      // 检查是否可以安装
      const [can, missing] = await checkCanInstall();
      setCanInstall(can);
      setMissingDeps(missing);

      // 如果已安装,获取版本信息但不自动切换标签
      if (status.claude_installed) {
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

      // 安装完成,重新检测环境
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
    setDoctorOutput(''); // 清空之前的输出
    try {
      console.log('开始运行 claude doctor...');
      const output = await runClaudeDoctor();
      console.log('claude doctor 输出:', output);
      setDoctorOutput(output || '✅ claude doctor 执行成功，但没有输出');
    } catch (err) {
      console.error('claude doctor 执行失败:', err);
      const errorMsg = err instanceof Error ? err.message : '运行 claude doctor 失败';
      setError(errorMsg);
      // 同时在 doctor 输出区域显示错误
      setDoctorOutput(`❌ 执行失败\n\n${errorMsg}`);
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
        // 验证成功后检查更新
        checkUpdates();
      } else {
        setError('Claude Code 未安装或安装不完整');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setVerifying(false);
    }
  };

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const info = await checkForUpdates();
      setVersionInfo(info);
    } catch (err) {
      console.error('Failed to check for updates:', err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    setInstallProgress(null);

    try {
      await updateClaudeCode(installMethod, (progress) => {
        setInstallProgress(progress);
      });

      // 更新完成,重新检测环境
      await loadEnvironmentStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setUpdating(false);
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

  return (
    <CompactLayout>
      {/* 标签页 */}
      <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-2 flex gap-2 shadow-lg shadow-yellow-500/5">
        <button
          onClick={() => setActiveTab('detection')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'detection'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
        >
          <span>🔍</span>
          环境检测
        </button>
        <button
          onClick={() => setActiveTab('install')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'install'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
        >
          <span>📦</span>
          安装 Claude Code
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'verify'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
        >
          <span>✅</span>
          验证安装
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-red-400 font-semibold">错误</p>
              <p className="text-gray-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 环境检测标签 */}
      {activeTab === 'detection' && (
        <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 mt-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-yellow-400">系统环境检测</h2>
            <button
              onClick={loadEnvironmentStatus}
              disabled={loading}
              className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50"
            >
              {loading ? '检测中...' : '🔄 重新检测'}
            </button>
          </div>

          {envStatus && (
            <div className="space-y-4">
              {/* 基础信息 */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-yellow-400 mb-3">系统信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">操作系统:</span>
                    <span className="text-white ml-2">{envStatus.os_type} {envStatus.os_version}</span>
                  </div>
                  {envStatus.shell && (
                    <div>
                      <span className="text-gray-400">Shell:</span>
                      <span className="text-white ml-2">{envStatus.shell}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">网络连接:</span>
                    <span className="text-white ml-2">
                      {getStatusIcon(envStatus.network_available)} {envStatus.network_available ? '正常' : '异常'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Claude Code */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-yellow-400 mb-3">Claude Code</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">安装状态:</span>
                    <span className="text-white">
                      {getStatusIcon(envStatus.claude_installed)} {envStatus.claude_installed ? '已安装' : '未安装'}
                    </span>
                  </div>
                  {envStatus.claude_version && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">版本:</span>
                      <span className="text-white">{envStatus.claude_version}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 依赖检测 */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-yellow-400 mb-3">依赖检测</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Node.js (≥18):</span>
                    <span className="text-white">
                      {getStatusIcon(envStatus.node_installed)} {envStatus.node_version || '未安装'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">ripgrep:</span>
                    <span className="text-white">
                      {getStatusIcon(envStatus.ripgrep_installed)} {envStatus.ripgrep_installed ? '已安装' : '未安装'}
                    </span>
                  </div>
                  {envStatus.os_type === 'macos' && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Homebrew:</span>
                      <span className="text-white">
                        {getStatusIcon(envStatus.homebrew_installed)} {envStatus.homebrew_installed ? '已安装' : '未安装'}
                      </span>
                    </div>
                  )}
                  {envStatus.os_type === 'windows' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">WSL:</span>
                        <span className="text-white">
                          {getStatusIcon(envStatus.wsl_installed)} {envStatus.wsl_installed ? '已安装' : '未安装'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Git Bash:</span>
                        <span className="text-white">
                          {getStatusIcon(envStatus.git_bash_installed)} {envStatus.git_bash_installed ? '已安装' : '未安装'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 安装检查结果 */}
              <div className={`rounded-lg p-4 border ${
                canInstall
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg">{canInstall ? '✅' : '⚠️'}</span>
                  <div className="flex-1">
                    <p className={`font-semibold ${canInstall ? 'text-green-400' : 'text-yellow-400'}`}>
                      {canInstall ? '环境检查通过' : '环境检查未通过'}
                    </p>
                    {missingDeps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-400">缺失的依赖:</p>
                        {missingDeps.map((dep, idx) => (
                          <p key={idx} className="text-sm text-gray-300 ml-4">• {dep}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 安装标签 */}
      {activeTab === 'install' && (
        <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 mt-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-6">安装 Claude Code</h2>

          {envStatus && envStatus.claude_installed ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-green-400 text-lg">✅</span>
                <div className="flex-1">
                  <p className="text-green-400 font-semibold">Claude Code 已安装</p>
                  <p className="text-gray-300 text-sm mt-1">
                    版本: {envStatus.claude_version || '未知'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 安装方式选择 */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-yellow-400">选择安装方式</label>
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
                  {envStatus && envStatus.os_type === 'macos' && (
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
                    disabled={installing || (envStatus ? !envStatus.node_installed : true)}
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
              </div>

              {/* 安装进度 */}
              {installProgress && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-yellow-400">
                      {installProgress.stage}
                    </span>
                    <span className="text-sm text-gray-400">
                      {Math.round(installProgress.progress * 100)}%
                    </span>
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

      {/* 验证标签 */}
      {activeTab === 'verify' && (
        <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 mt-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-6">验证安装</h2>

          <div className="space-y-4">
            {/* 版本信息 */}
            {claudeVersion && (
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">当前版本:</span>
                  <span className="text-white font-mono">{claudeVersion}</span>
                </div>

                {versionInfo && (
                  <>
                    {versionInfo.latest && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">最新版本:</span>
                        <span className="text-white font-mono">{versionInfo.latest}</span>
                      </div>
                    )}

                    {versionInfo.update_available && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-yellow-400 mb-2">
                          <span>🎉</span>
                          <span className="font-semibold">发现新版本！</span>
                        </div>
                        {versionInfo.changelog_url && (
                          <a
                            href={versionInfo.changelog_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 underline"
                          >
                            查看更新日志
                          </a>
                        )}
                      </div>
                    )}

                    {!versionInfo.update_available && versionInfo.latest && (
                      <div className="mt-2 text-sm text-green-400 flex items-center gap-2">
                        <span>✅</span>
                        <span>已是最新版本</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleVerifyInstallation}
                disabled={verifying || updating}
                className="px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 font-semibold transition-all"
              >
                {verifying ? '验证中...' : '🔍 验证安装'}
              </button>
              <button
                onClick={handleRunDoctor}
                disabled={verifying || updating}
                className="px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 font-semibold transition-all"
              >
                {verifying ? '运行中...' : '🏥 运行 Doctor'}
              </button>
              <button
                onClick={checkUpdates}
                disabled={checkingUpdate || updating}
                className="px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 disabled:opacity-50 font-semibold transition-all"
              >
                {checkingUpdate ? '检查中...' : '🔄 检查更新'}
              </button>
              {versionInfo?.update_available && (
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="px-4 py-3 bg-gradient-to-r from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 text-green-400 rounded-lg border border-green-500/30 disabled:opacity-50 font-semibold transition-all"
                >
                  {updating ? '更新中...' : '⬆️ 更新版本'}
                </button>
              )}
            </div>

            {/* 更新进度 */}
            {updating && installProgress && (
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-yellow-400">
                    {installProgress.stage}
                  </span>
                  <span className="text-sm text-gray-400">
                    {Math.round(installProgress.progress * 100)}%
                  </span>
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

            {/* Doctor 输出 */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">诊断输出</h3>
              {doctorOutput ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                  {doctorOutput}
                </pre>
              ) : (
                <div className="text-sm text-gray-500 italic py-4 text-center">
                  点击 "运行 Doctor" 按钮查看诊断信息
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CompactLayout>
  );
};
