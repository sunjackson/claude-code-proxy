/**
 * 代理状态卡片组件
 * 显示代理服务状态和控制按钮
 */

import React from 'react';
import type { ProxyService } from '../types/tauri';

interface ProxyStatusCardProps {
  /** 代理服务状态 */
  proxyStatus: ProxyService | null;
  /** 启动代理回调 */
  onStart: () => void;
  /** 停止代理回调 */
  onStop: () => void;
  /** 刷新状态回调 */
  onRefresh: () => void;
  /** 是否正在执行操作 */
  actionLoading?: boolean;
}

export const ProxyStatusCard: React.FC<ProxyStatusCardProps> = ({
  proxyStatus,
  onStart,
  onStop,
  onRefresh,
  actionLoading = false,
}) => {
  // 获取状态指示灯颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return 'text-green-400';
      case 'starting':
      case 'stopping':
        return 'text-yellow-400';
      case 'stopped':
        return 'text-gray-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'running':
        return '运行中';
      case 'starting':
        return '启动中';
      case 'stopping':
        return '停止中';
      case 'stopped':
        return '已停止';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  // 获取背景颜色根据状态
  const getStatusBgColor = (status: string): string => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10';
      case 'starting':
      case 'stopping':
        return 'bg-yellow-500/10';
      case 'stopped':
        return 'bg-gray-500/10';
      case 'error':
        return 'bg-red-500/10';
      default:
        return 'bg-gray-500/10';
    }
  };

  const status = proxyStatus?.status || 'stopped';
  const canStart = status === 'stopped' || status === 'error';
  const canStop = status === 'running' || status === 'starting';

  return (
    <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6">
      {/* 标题和状态指示器 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-amber-400">代理服务状态</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={actionLoading}
            className="px-3 py-1 text-sm bg-gray-800 border border-amber-500/30 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="刷新状态"
          >
            🔄 刷新
          </button>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusBgColor(status)}`}
          >
            <div
              className={`w-3 h-3 rounded-full ${getStatusColor(status)} ${
                status === 'running' || status === 'starting' ? 'animate-pulse' : ''
              }`}
            ></div>
            <span className="text-sm text-gray-300 font-medium">
              {getStatusText(status)}
            </span>
          </div>
        </div>
      </div>

      {/* 信息面板 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">监听地址</div>
          <div className="text-base font-mono text-amber-400">
            {proxyStatus?.listen_host || '127.0.0.1'}:{proxyStatus?.listen_port || 25341}
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">当前分组</div>
          <div className="text-base font-medium text-gray-200 truncate" title={proxyStatus?.active_group_name || '未选择'}>
            {proxyStatus?.active_group_name || (
              <span className="text-gray-500">未选择</span>
            )}
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">当前配置</div>
          <div className="text-base font-medium text-gray-200 truncate" title={proxyStatus?.active_config_name || '未选择'}>
            {proxyStatus?.active_config_name || (
              <span className="text-gray-500">未选择</span>
            )}
          </div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-4">
        {canStart ? (
          <button
            onClick={onStart}
            disabled={actionLoading || !proxyStatus?.active_config_id}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {actionLoading ? '处理中...' : '▶ 启动代理'}
          </button>
        ) : canStop ? (
          <button
            onClick={onStop}
            disabled={actionLoading || status === 'stopping'}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {actionLoading ? '处理中...' : '⏹ 停止代理'}
          </button>
        ) : (
          <button
            disabled
            className="flex-1 px-6 py-3 bg-gray-700 text-gray-500 cursor-not-allowed rounded-lg font-medium"
          >
            处理中...
          </button>
        )}
      </div>

      {/* 提示信息 */}
      {!proxyStatus?.active_config_id && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400">
            ⚠️ 请先选择一个分组和配置才能启动代理服务
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">
            ❌ 代理服务发生错误,请检查日志或重新启动
          </p>
        </div>
      )}
    </div>
  );
};
