/**
 * 代理状态卡片组件
 * 显示代理服务状态和控制按钮
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PROXY_PORT } from '../config/ports';
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
  const { t } = useTranslation();

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
        return t('status.running');
      case 'starting':
        return t('status.starting');
      case 'stopping':
        return t('status.stopping');
      case 'stopped':
        return t('status.stopped');
      case 'error':
        return t('status.error');
      default:
        return t('common.unknown');
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
    <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-amber-500/30 rounded-xl p-6 shadow-lg">
      {/* 标题和状态指示器 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-amber-500/10 rounded-lg">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-amber-400">{t('proxy.service')}</h2>
            <p className="text-xs text-gray-400">{t('proxy.forwardRequests')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 border border-amber-500/30 rounded-lg hover:bg-gray-700 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title={t('proxy.refreshStatus')}
          >
            <svg className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{t('common.refresh')}</span>
          </button>
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${getStatusBgColor(status)} border ${
              status === 'running' ? 'border-green-500/30' :
              status === 'error' ? 'border-red-500/30' :
              'border-gray-700'
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)} ${
                (status === 'running' || status === 'starting') ? 'animate-pulse' : ''
              }`}
            ></div>
            <span className="text-sm font-medium" style={{ color: getStatusColor(status).replace('text-', '') }}>
              {getStatusText(status)}
            </span>
          </div>
        </div>
      </div>

      {/* 信息面板 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-4 rounded-lg border border-gray-700/50 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <div className="text-xs font-medium text-gray-400">{t('proxy.listenAddress')}</div>
          </div>
          <div className="text-lg font-mono font-semibold text-amber-400">
            {proxyStatus?.listen_host || '127.0.0.1'}:{proxyStatus?.listen_port || DEFAULT_PROXY_PORT}
          </div>
          {proxyStatus?.listen_port && proxyStatus.listen_port !== DEFAULT_PROXY_PORT && (
            <div className="flex items-center gap-1 text-xs text-yellow-400 mt-2 bg-yellow-500/10 px-2 py-1 rounded">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{t('proxy.portAutoSwitched')}</span>
            </div>
          )}
        </div>
        <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-4 rounded-lg border border-gray-700/50 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div className="text-xs font-medium text-gray-400">{t('proxy.activeGroup')}</div>
          </div>
          <div className="text-base font-semibold text-gray-200 truncate" title={proxyStatus?.active_group_name || t('proxy.noGroupSelected')}>
            {proxyStatus?.active_group_name || (
              <span className="text-gray-500 text-sm">{t('proxy.noGroupSelected')}</span>
            )}
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-800/40 p-4 rounded-lg border border-gray-700/50 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-xs font-medium text-gray-400">{t('proxy.activeConfig')}</div>
          </div>
          <div className="text-base font-semibold text-gray-200 truncate" title={proxyStatus?.active_config_name || t('proxy.noConfigSelected')}>
            {proxyStatus?.active_config_name || (
              <span className="text-gray-500 text-sm">{t('proxy.noConfigSelected')}</span>
            )}
          </div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-4">
        {canStart ? (
          <button
            onClick={onStart}
            disabled={actionLoading || !proxyStatus || proxyStatus.active_config_id === null || proxyStatus.active_config_id === undefined}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium shadow-lg hover:shadow-green-500/20 transition-all"
          >
            {actionLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{t('proxy.starting')}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                <span>{t('proxy.startProxyService')}</span>
              </>
            )}
          </button>
        ) : canStop ? (
          <button
            onClick={onStop}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium shadow-lg hover:shadow-red-500/20 transition-all"
          >
            {actionLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{t('proxy.stopping')}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                <span>{t('proxy.stopProxyService')}</span>
              </>
            )}
          </button>
        ) : (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 text-gray-500 cursor-not-allowed rounded-lg font-medium"
          >
            <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{t('proxy.processing')}</span>
          </button>
        )}
      </div>

      {/* 提示信息 */}
      {(!proxyStatus || proxyStatus.active_config_id === null || proxyStatus.active_config_id === undefined) && (
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-400">{t('proxy.pleaseCompleteConfig')}</p>
              <p className="text-xs text-yellow-400/80 mt-1">
                {t('proxy.selectGroupAndConfig')}
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-400">{t('proxy.serviceError')}</p>
              <p className="text-xs text-red-400/80 mt-1">
                {t('proxy.serviceErrorDesc')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
