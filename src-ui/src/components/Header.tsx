/**
 * 页面头部组件
 * 显示页面标题、代理状态、余额信息和语言切换器
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import * as proxyApi from '../api/proxy';
import type { ProxyService } from '../types/tauri';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { t } = useTranslation();
  const { currentLanguage, toggleLanguage } = useLanguage();
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);

  // 加载代理状态
  useEffect(() => {
    loadStatus();
    // 每10秒刷新一次状态
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      // 加载代理状态
      const status = await proxyApi.getProxyStatus();
      setProxyStatus(status);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-gray-500';
      case 'starting':
      case 'stopping':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return t('status.running');
      case 'stopped':
        return t('status.stopped');
      case 'starting':
      case 'stopping':
        return t('common.loading');
      case 'error':
        return t('common.error');
      default:
        return t('status.offline');
    }
  };

  return (
    <header className="bg-gradient-to-r from-black via-gray-950 to-black border-b border-yellow-500/30 px-6 py-4 shadow-lg shadow-yellow-500/5">
      <div className="flex items-center justify-between">
        {/* 左侧: 页面标题 */}
        <div>
          {title && (
            <>
              <h2 className="text-2xl font-bold text-yellow-400 tracking-wide">{title}</h2>
              {subtitle && <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{subtitle}</p>}
            </>
          )}
        </div>

        {/* 右侧: 状态和操作 */}
        <div className="flex items-center gap-3">
          {/* 代理状态指示器 */}
          {proxyStatus && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg border border-yellow-500/30 shadow-lg hover:border-yellow-500/50 transition-all duration-200">
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(proxyStatus.status)} shadow-lg ${proxyStatus.status === 'running' ? 'animate-pulse shadow-green-500/50' : ''}`} />
              <span className="text-sm font-semibold text-gray-200">
                {getStatusText(proxyStatus.status)}
              </span>
            </div>
          )}

          {/* 语言切换器 */}
          <button
            onClick={toggleLanguage}
            className="px-4 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 border border-yellow-500/30 rounded-lg hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/20 transition-all duration-200 text-sm font-semibold text-gray-200 hover:text-yellow-400 flex items-center gap-2"
            title={t('settings.language')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {currentLanguage === 'zh-CN' ? '中文' : 'English'}
          </button>
        </div>
      </div>
    </header>
  );
};
