/**
 * Zero-Config Code Flow 首次启动向导
 * 自动检测环境,引导用户一键安装 Claude Code
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EnvironmentStatus, InstallOptions, InstallProgress, InstallMethod } from '../types/tauri';
import {
  detectEnvironment,
  installClaudeCode,
  checkCanInstall,
  verifyClaudeInstallation,
} from '../api/setup';
import { enableClaudeCodeProxy } from '../api/claude-code';
import { startProxyService } from '../api/proxy';

type WizardStep = 'welcome' | 'detecting' | 'install' | 'configure' | 'complete';

interface SetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onSkip }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // 自动检测环境
  useEffect(() => {
    if (currentStep === 'detecting') {
      performDetection();
    }
  }, [currentStep]);

  const performDetection = async () => {
    try {
      const status = await detectEnvironment();
      setEnvStatus(status);

      // 检查是否可以安装
      const [can, missing] = await checkCanInstall();
      setCanInstall(can);
      setMissingDeps(missing);

      // 如果已安装,直接跳到配置步骤
      if (status.claude_installed) {
        setCurrentStep('configure');
      } else {
        setCurrentStep('install');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '环境检测失败');
      setCurrentStep('welcome');
    }
  };

  const handleStartSetup = () => {
    setCurrentStep('detecting');
  };

  const getRecommendedInstallMethod = (): InstallMethod => {
    if (!envStatus) return 'Native';

    if (envStatus.os_type === 'macos' && envStatus.homebrew_installed) {
      return 'Homebrew';
    }

    if (envStatus.node_installed) {
      return 'NPM';
    }

    return 'Native';
  };

  const handleAutoInstall = async () => {
    if (!canInstall) {
      setError('环境不满足安装条件');
      return;
    }

    setInstalling(true);
    setError(null);

    const method = getRecommendedInstallMethod();
    const options: InstallOptions = {
      method,
      auto_configure: true,
      auto_backup: true,
      auto_test: true,
      auto_start_proxy: false, // 稍后在配置步骤启动
    };

    try {
      await installClaudeCode(options, (progress) => {
        setInstallProgress(progress);
      });

      // 安装完成,进入配置步骤
      setCurrentStep('configure');
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装失败');
    } finally {
      setInstalling(false);
    }
  };

  const handleAutoConfigure = async () => {
    try {
      // 1. 启用代理配置
      await enableClaudeCodeProxy('127.0.0.1', 3000);

      // 2. 启动代理服务
      await startProxyService();

      // 3. 验证安装
      const isInstalled = await verifyClaudeInstallation();

      if (isInstalled) {
        setCurrentStep('complete');
      } else {
        setError('配置验证失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动配置失败');
    }
  };

  const handleComplete = () => {
    onComplete();
    navigate('/');
  };

  const handleSkipSetup = () => {
    onSkip();
  };

  const getProgressBarColor = (stage: string) => {
    if (stage === 'Failed') return 'bg-red-500';
    if (stage === 'Complete') return 'bg-green-500';
    return 'bg-yellow-500';
  };

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
                欢迎使用 Claude Code Router
              </h1>
              <p className="text-gray-300 text-lg mb-2">
                让我们快速设置您的 Claude Code 环境
              </p>
              <p className="text-gray-400 text-sm">
                这个向导将帮助您自动检测系统环境并安装必要的组件
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleStartSetup}
                className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg shadow-yellow-500/30 text-lg"
              >
                🚀 开始自动设置
              </button>
              <button
                onClick={handleSkipSetup}
                className="w-full px-6 py-4 bg-gray-800/50 text-gray-300 font-semibold rounded-lg hover:bg-gray-700/50 transition-all border border-gray-700"
              >
                跳过向导
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800">
              <h3 className="text-yellow-400 font-semibold mb-3 text-sm">自动设置包括:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">✓</span>
                  <span>检测系统环境和依赖</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">✓</span>
                  <span>自动安装 Claude Code CLI</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">✓</span>
                  <span>配置代理服务器</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">✓</span>
                  <span>验证安装和配置</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* 检测步骤 */}
        {currentStep === 'detecting' && (
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-yellow-400 mb-2">正在检测系统环境</h2>
              <p className="text-gray-400">请稍候,这可能需要几秒钟...</p>
            </div>
          </div>
        )}

        {/* 安装步骤 */}
        {currentStep === 'install' && envStatus && (
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6">安装 Claude Code</h2>

            {!canInstall ? (
              <div className="space-y-6">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold mb-2">⚠️ 环境检查未通过</p>
                  <p className="text-sm text-gray-300 mb-3">安装前需要:</p>
                  {missingDeps.map((dep, idx) => (
                    <p key={idx} className="text-sm text-gray-300 ml-4">• {dep}</p>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/environment-setup')}
                    className="flex-1 px-6 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 font-semibold"
                  >
                    📋 查看详细信息
                  </button>
                  <button
                    onClick={handleSkipSetup}
                    className="flex-1 px-6 py-3 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 border border-gray-700 font-semibold"
                  >
                    跳过
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-semibold text-yellow-400 mb-3">推荐安装方式</h3>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 font-semibold">
                      {getRecommendedInstallMethod()}
                    </div>
                    <p className="text-sm text-gray-400">
                      {getRecommendedInstallMethod() === 'Homebrew' && '使用 Homebrew 安装 (macOS 推荐)'}
                      {getRecommendedInstallMethod() === 'NPM' && '使用 NPM 全局安装'}
                      {getRecommendedInstallMethod() === 'Native' && '使用官方安装脚本'}
                    </p>
                  </div>
                </div>

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

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleAutoInstall}
                  disabled={installing}
                  className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/30 text-lg"
                >
                  {installing ? '安装中...' : '🚀 开始自动安装'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 配置步骤 */}
        {currentStep === 'configure' && (
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6">配置代理服务</h2>

            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-green-400 text-xl">✅</span>
                  <div className="flex-1">
                    <p className="text-green-400 font-semibold mb-1">Claude Code 已安装</p>
                    <p className="text-sm text-gray-300">
                      版本: {envStatus?.claude_version || '未知'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-yellow-400 mb-3">即将配置:</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>启用 Claude Code 代理配置</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>启动代理服务 (127.0.0.1:3000)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>验证配置和连接</span>
                  </li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleAutoConfigure}
                className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg shadow-yellow-500/30 text-lg"
              >
                ⚙️ 自动配置
              </button>
            </div>
          </div>
        )}

        {/* 完成步骤 */}
        {currentStep === 'complete' && (
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-green-500/50 animate-bounce">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 mb-4">
                🎉 设置完成!
              </h2>
              <p className="text-gray-300 text-lg">
                您的 Claude Code 环境已经准备就绪
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800 mb-6">
              <h3 className="text-yellow-400 font-semibold mb-4">✅ 已完成:</h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Claude Code CLI 已安装</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>代理服务已配置并启动</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>配置已验证</span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 font-semibold mb-2">💡 下一步</p>
              <p className="text-sm text-gray-300">
                您可以在控制面板中添加 API 配置并开始使用代理服务
              </p>
            </div>

            <button
              onClick={handleComplete}
              className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg shadow-yellow-500/30 text-lg"
            >
              进入控制面板 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
