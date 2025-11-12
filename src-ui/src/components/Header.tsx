/**
 * 页面头部组件
 * 显示页面标题、代理状态和语言切换器
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
    loadProxyStatus();
    // 每5秒刷新一次状态
    const interval = setInterval(loadProxyStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadProxyStatus = async () => {
    try {
      const status = await proxyApi.getProxyStatus();
      setProxyStatus(status);
    } catch (err) {
      console.error('Failed to load proxy status:', err);
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
    <header className="bg-gray-900 border-b border-amber-500/30 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 左侧: 页面标题 */}
        <div>
          {title && (
            <>
              <h2 className="text-xl font-semibold text-amber-400">{title}</h2>
              {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
            </>
          )}
        </div>

        {/* 右侧: 状态和操作 */}
        <div className="flex items-center gap-4">
          {/* 代理状态指示器 */}
          {proxyStatus && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(proxyStatus.status)} animate-pulse`} />
              <span className="text-sm text-gray-300">
                {t('dashboard.proxyStatus')}: {getStatusText(proxyStatus.status)}
              </span>
            </div>
          )}

          {/* 语言切换器 */}
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 bg-gray-800 border border-amber-500/30 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium text-gray-300 hover:text-amber-400"
            title={t('settings.language')}
          >
            {currentLanguage === 'zh-CN' ? '🇨🇳 中文' : '🇺🇸 English'}
          </button>
        </div>
      </div>
    </header>
  );
};
