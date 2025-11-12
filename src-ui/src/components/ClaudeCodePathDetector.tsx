/**
 * Claude Code 路径检测器组件
 * 显示检测到的配置路径和平台信息
 */

import React, { useEffect, useState } from 'react';
import { detectClaudeCodePath, getClaudeCodeSettings } from '../api/claude-code';
import type { ClaudeCodePath } from '../types/tauri';

interface ClaudeCodePathDetectorProps {
  /** 路径检测完成回调 */
  onPathDetected?: (path: ClaudeCodePath) => void;
}

export const ClaudeCodePathDetector: React.FC<ClaudeCodePathDetectorProps> = ({
  onPathDetected,
}) => {
  const [path, setPath] = useState<ClaudeCodePath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configContent, setConfigContent] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    loadPath();
  }, []);

  const loadPath = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await detectClaudeCodePath();
      setPath(result);
      onPathDetected?.(result);
      // 如果配置文件存在，自动加载配置内容
      if (result.exists) {
        loadConfig();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '检测路径失败');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setLoadingConfig(true);
      const content = await getClaudeCodeSettings();
      setConfigContent(content);
    } catch (err) {
      console.error('Failed to load config:', err);
      setConfigContent(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-black border border-gray-800 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-500"></div>
          <span className="text-gray-400">正在检测 Claude Code 配置路径...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black border border-red-900 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-red-400">{error}</span>
          </div>
          <button
            onClick={loadPath}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-yellow-500 rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!path) {
    return null;
  }

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-yellow-500">配置路径检测</h3>
        <button
          onClick={loadPath}
          className="text-sm text-gray-400 hover:text-yellow-500 transition-colors"
        >
          刷新
        </button>
      </div>

      <div className="space-y-3">
        {/* 平台信息 */}
        <div className="flex items-center space-x-3">
          <span className="text-gray-400 w-24">平台:</span>
          <span className="text-white font-mono">{path.platform}</span>
        </div>

        {/* 配置文件路径 */}
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <span className="text-gray-400 w-24">配置文件:</span>
            <span className="text-white font-mono text-sm break-all">
              {path.settings_path}
            </span>
          </div>
          <div className="flex items-center space-x-2 ml-24">
            <StatusBadge
              label="存在"
              status={path.exists}
            />
            <StatusBadge
              label="可读"
              status={path.readable}
            />
            <StatusBadge
              label="可写"
              status={path.writable}
            />
          </div>
        </div>

        {/* 配置目录 */}
        <div className="flex items-center space-x-3">
          <span className="text-gray-400 w-24">配置目录:</span>
          <span className="text-white font-mono text-sm break-all">
            {path.config_dir}
          </span>
        </div>
      </div>

      {/* 当前配置预览 */}
      {path.exists && configContent && (
        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={() => setConfigExpanded(!configExpanded)}
            className="flex items-center justify-between w-full text-left hover:bg-gray-900/50 px-3 py-2 rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-2">
              <svg
                className={`w-5 h-5 text-yellow-500 transition-transform ${
                  configExpanded ? 'transform rotate-90' : ''
                }`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 5l7 7-7 7"></path>
              </svg>
              <span className="text-white font-semibold">当前配置预览</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadConfig();
              }}
              disabled={loadingConfig}
              className="text-sm text-gray-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
            >
              {loadingConfig ? '刷新中...' : '刷新'}
            </button>
          </button>

          {configExpanded && (
            <div className="mt-3 bg-black border border-gray-700 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300 font-mono">
                {JSON.stringify(JSON.parse(configContent), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 警告信息 */}
      {!path.exists && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-yellow-500 mt-0.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <div className="flex-1">
              <p className="text-sm text-yellow-500 font-semibold">配置文件不存在</p>
              <p className="text-sm text-gray-400 mt-1">
                Claude Code 配置文件尚未创建。启用代理时将自动创建配置文件。
              </p>
            </div>
          </div>
        </div>
      )}

      {(!path.readable || !path.writable) && path.exists && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-900 rounded-lg">
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
              <p className="text-sm text-red-500 font-semibold">权限不足</p>
              <p className="text-sm text-gray-400 mt-1">
                配置文件权限不足,无法{!path.readable ? '读取' : ''}
                {!path.readable && !path.writable ? '和' : ''}
                {!path.writable ? '写入' : ''}。请检查文件权限。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 状态徽章组件
 */
const StatusBadge: React.FC<{ label: string; status: boolean }> = ({
  label,
  status,
}) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
        status
          ? 'bg-green-900/30 text-green-400 border border-green-900'
          : 'bg-red-900/30 text-red-400 border border-red-900'
      }`}
    >
      {status ? '✓' : '✗'} {label}
    </span>
  );
};
