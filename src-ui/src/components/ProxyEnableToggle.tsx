/**
 * 代理启用/禁用开关组件
 */

import React, { useEffect, useState } from 'react';
import {
  enableClaudeCodeProxy,
  disableClaudeCodeProxy,
  getClaudeCodeProxy,
} from '../api/claude-code';
import * as proxyApi from '../api/proxy';
import { DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT } from '../config/ports';
import type { ProxyConfig, ProxyService } from '../types/tauri';

interface ProxyEnableToggleProps {
  /** 代理服务器地址 (默认: 127.0.0.1) */
  defaultHost?: string;
  /** 代理服务器端口 (开发环境: 15341, 生产环境: 25341) */
  defaultPort?: number;
  /** 启用成功回调 */
  onEnabled?: () => void;
  /** 禁用成功回调 */
  onDisabled?: () => void;
  /** 显示确认对话框 */
  onShowConfirm?: (action: 'enable' | 'disable', callback: () => void) => void;
}

export const ProxyEnableToggle: React.FC<ProxyEnableToggleProps> = ({
  defaultHost = DEFAULT_PROXY_HOST,
  defaultPort = DEFAULT_PROXY_PORT,
  onEnabled,
  onDisabled,
  onShowConfirm,
}) => {
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);

  useEffect(() => {
    loadProxyStatus();
    loadServiceStatus();
    // 定期刷新服务状态
    const interval = setInterval(loadServiceStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadProxyStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const config = await getClaudeCodeProxy();
      setProxyConfig(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取代理状态失败');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceStatus = async () => {
    try {
      const status = await proxyApi.getProxyStatus();
      setProxyStatus(status);
    } catch (err) {
      console.error('Failed to load proxy service status:', err);
    }
  };

  const handleToggle = () => {
    const action = proxyConfig ? 'disable' : 'enable';

    if (onShowConfirm) {
      onShowConfirm(action, () => {
        if (action === 'enable') {
          handleEnable();
        } else {
          handleDisable();
        }
      });
    } else {
      if (action === 'enable') {
        handleEnable();
      } else {
        handleDisable();
      }
    }
  };

  const handleEnable = async () => {
    try {
      setOperating(true);
      setError(null);
      await enableClaudeCodeProxy(defaultHost, defaultPort);
      setProxyConfig({ host: defaultHost, port: defaultPort });
      onEnabled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '启用代理失败');
    } finally {
      setOperating(false);
    }
  };

  const handleDisable = async () => {
    try {
      setOperating(true);
      setError(null);
      await disableClaudeCodeProxy();
      setProxyConfig(null);
      onDisabled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '禁用代理失败');
    } finally {
      setOperating(false);
    }
  };

  const isEnabled = !!proxyConfig;
  const isProcessing = loading || operating;

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-500">本地代理配置</h3>
          <p className="text-sm text-gray-400 mt-1">
            {isEnabled
              ? `已启用代理: ${proxyConfig.host}`
              : '代理未启用'}
          </p>
        </div>

        {/* 开关按钮 */}
        <button
          onClick={handleToggle}
          disabled={isProcessing}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed ${
            isEnabled ? 'bg-yellow-500' : 'bg-gray-700'
          }`}
          aria-label={isEnabled ? '禁用代理' : '启用代理'}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 代理配置详情 */}
      {isEnabled && proxyConfig && (
        <div className="pt-3 border-t border-gray-800">
          <div>
            <span className="text-sm text-gray-400">代理服务器</span>
            <p className="text-white font-mono mt-1">{proxyConfig.host}:{proxyConfig.port}</p>
          </div>
        </div>
      )}

      {/* 代理服务状态提示 */}
      {isEnabled && proxyStatus && (
        <div className={`p-3 rounded-lg border ${
          proxyStatus.status === 'running'
            ? 'bg-green-900/20 border-green-900'
            : 'bg-yellow-900/20 border-yellow-900'
        }`}>
          <div className="flex items-start space-x-2">
            {proxyStatus.status === 'running' ? (
              <svg
                className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            )}
            <div className="flex-1 text-sm">
              <p className={`font-semibold mb-1 ${
                proxyStatus.status === 'running' ? 'text-green-400' : 'text-yellow-500'
              }`}>
                {proxyStatus.status === 'running' ? '代理服务运行中' : '代理服务未启动'}
              </p>
              <p className="text-gray-400">
                {proxyStatus.status === 'running'
                  ? 'Claude Code 配置已启用，代理服务正在运行，可以正常使用'
                  : '虽然已启用代理配置，但代理服务未启动。请前往主页启动代理服务。'
                }
              </p>
              {proxyStatus.status !== 'running' && (
                <a
                  href="/"
                  className="inline-flex items-center mt-2 text-yellow-500 hover:text-yellow-400 font-semibold"
                >
                  前往主页启动服务
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 5l7 7-7 7"></path>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 帮助信息 */}
      {!isEnabled && (
        <div className="p-3 bg-gray-900/50 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1 text-sm text-gray-400">
              <p className="font-semibold text-white mb-1">启用代理配置后:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Claude Code 将通过本地代理 ({defaultHost}:{defaultPort}) 连接</li>
                <li>修改前会自动创建配置备份</li>
                <li className="text-yellow-500 font-semibold">注意: 还需要在主页启动代理服务才能正常使用</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-900 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 加载/操作中状态 */}
      {isProcessing && (
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
          <span>{loading ? '加载中...' : isEnabled ? '禁用中...' : '启用中...'}</span>
        </div>
      )}
    </div>
  );
};
