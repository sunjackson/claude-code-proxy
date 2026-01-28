/**
 * 环境设置页面
 * Claude Code 环境检测和自动安装（支持多 Node 环境）
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactLayout } from '../components/CompactLayout';
import type {
  InstallOptions,
  InstallProgress,
  InstallMethod,
  VersionInfo,
} from '../types/tauri';
import {
  installClaudeCode,
  runClaudeDoctor,
  getClaudeVersion,
  verifyClaudeInstallation,
  checkForUpdates,
  updateClaudeCode,
} from '../api/setup';

type SetupTab = 'install' | 'verify';

export const EnvironmentSetup: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SetupTab>('install');
  const [error, setError] = useState<string | null>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  // 安装相关状态
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installMethod, setInstallMethod] = useState<InstallMethod>('Native');

  // 验证相关状态
  const [verifying, setVerifying] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string>('');
  const [claudeVersion, setClaudeVersion] = useState<string>('');
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleInstall = async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('env.install.failed'));
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
      setDoctorOutput(output || t('env.verify.doctorSuccess'));
    } catch (err) {
      console.error('claude doctor 执行失败:', err);
      const errorMsg = err instanceof Error ? err.message : t('env.verify.doctorFailed');
      setError(errorMsg);
      // 同时在 doctor 输出区域显示错误
      setDoctorOutput(`❌ ${t('env.verify.executionFailed')}\n\n${errorMsg}`);
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
        setDoctorOutput(t('env.verify.installedCorrectly'));
        // 验证成功后检查更新
        checkUpdates();
      } else {
        setError(t('env.verify.notInstalledOrIncomplete'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('env.verify.verifyFailed'));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('env.update.failed'));
    } finally {
      setUpdating(false);
    }
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
          onClick={() => setActiveTab('install')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'install'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
        >
          <span>📦</span>
          {t('env.tabs.install')}
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
          {t('env.tabs.verify')}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-red-400 font-semibold">{t('common.error')}</p>
              <p className="text-gray-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 安装标签 */}
      {activeTab === 'install' && (
        <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 mt-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-6">{t('env.install.title')}</h2>

          <div className="space-y-6">
            {/* 安装方式选择 */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-yellow-400">{t('env.install.selectMethod')}</label>
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
                  <div className="font-semibold text-sm">{t('env.install.officialScript')}</div>
                  <div className="text-xs mt-1 opacity-70">{t('env.install.recommended')}</div>
                </button>
                {isMac && (
                  <button
                    onClick={() => setInstallMethod('Homebrew')}
                    disabled={installing}
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
                  disabled={installing}
                  className={`p-4 rounded-lg border transition-all ${
                    installMethod === 'NPM'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-yellow-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="text-2xl mb-2">📦</div>
                  <div className="font-semibold text-sm">NPM</div>
                  <div className="text-xs mt-1 opacity-70">{t('env.install.requireNode')}</div>
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
                disabled={installing}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {installing ? t('env.install.installing') : `🚀 ${t('env.install.startInstall')}`}
              </button>
            </div>
        </div>
      )}

      {/* 验证标签 */}
      {activeTab === 'verify' && (
        <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 mt-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-6">{t('env.verify.title')}</h2>

          <div className="space-y-4">
            {/* 版本信息 */}
            {claudeVersion && (
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{t('env.verify.currentVersion')}:</span>
                  <span className="text-white font-mono">{claudeVersion}</span>
                </div>

                {versionInfo && (
                  <>
                    {versionInfo.latest && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t('env.verify.latestVersion')}:</span>
                        <span className="text-white font-mono">{versionInfo.latest}</span>
                      </div>
                    )}

                    {versionInfo.update_available && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-yellow-400 mb-2">
                          <span>🎉</span>
                          <span className="font-semibold">{t('env.verify.newVersionAvailable')}</span>
                        </div>
                        {versionInfo.changelog_url && (
                          <a
                            href={versionInfo.changelog_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 underline"
                          >
                            {t('env.verify.viewChangelog')}
                          </a>
                        )}
                      </div>
                    )}

                    {!versionInfo.update_available && versionInfo.latest && (
                      <div className="mt-2 text-sm text-green-400 flex items-center gap-2">
                        <span>✅</span>
                        <span>{t('env.verify.isLatestVersion')}</span>
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
                {verifying ? t('env.verify.verifying') : `🔍 ${t('env.verify.verifyInstall')}`}
              </button>
              <button
                onClick={handleRunDoctor}
                disabled={verifying || updating}
                className="px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 disabled:opacity-50 font-semibold transition-all"
              >
                {verifying ? t('env.verify.running') : `🏥 ${t('env.verify.runDoctor')}`}
              </button>
              <button
                onClick={checkUpdates}
                disabled={checkingUpdate || updating}
                className="px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 disabled:opacity-50 font-semibold transition-all"
              >
                {checkingUpdate ? t('env.verify.checking') : `🔄 ${t('env.verify.checkUpdate')}`}
              </button>
              {versionInfo?.update_available && (
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="px-4 py-3 bg-gradient-to-r from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 text-green-400 rounded-lg border border-green-500/30 disabled:opacity-50 font-semibold transition-all"
                >
                  {updating ? t('env.verify.updating') : `⬆️ ${t('env.verify.updateVersion')}`}
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
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">{t('env.verify.diagnosticOutput')}</h3>
              {doctorOutput ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                  {doctorOutput}
                </pre>
              ) : (
                <div className="text-sm text-gray-500 italic py-4 text-center">
                  {t('env.verify.runDoctorPrompt')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CompactLayout>
  );
};
