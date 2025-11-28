/**
 * 页面头部组件
 * 显示页面标题、代理状态、余额信息和语言切换器
 */

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import * as proxyApi from '../api/proxy';
import * as configApi from '../api/config';
import type { ProxyService, ApiConfig } from '../types/tauri';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { t } = useTranslation();
  const { currentLanguage, toggleLanguage } = useLanguage();
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 加载代理状态
  useEffect(() => {
    loadStatus();
    loadConfigs();
    // 每10秒刷新一次状态
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowConfigMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const loadConfigs = async () => {
    try {
      const configList = await configApi.listApiConfigs();
      setConfigs(configList);
    } catch (err) {
      console.error('Failed to load configs:', err);
    }
  };


  const handleSwitchConfig = async (configId: number) => {
    if (switching) return;
    try {
      setSwitching(true);
      await proxyApi.switchProxyConfig(configId);
      await loadStatus();
      setShowConfigMenu(false);
    } catch (err) {
      console.error('Failed to switch config:', err);
    } finally {
      setSwitching(false);
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

  // 获取当前分组的配置列表
  const getCurrentGroupConfigs = () => {
    if (!proxyStatus || proxyStatus.active_group_id === null) return [];
    return configs.filter(c => c.group_id === proxyStatus.active_group_id);
  };

  const currentGroupConfigs = getCurrentGroupConfigs();
  const availableConfigs = currentGroupConfigs.filter(c => c.is_available);

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
          {/* 当前活跃配置信息 + 快速切换 */}
          {proxyStatus && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowConfigMenu(!showConfigMenu)}
                className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg border border-yellow-500/30 shadow-lg hover:border-yellow-500/50 hover:shadow-yellow-500/20 transition-all duration-200 group"
              >
                {/* 配置信息 */}
                <div className="flex flex-col items-start">
                  {proxyStatus.active_group_name && (
                    <span className="text-xs text-gray-500 leading-tight">
                      {proxyStatus.active_group_name}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-yellow-400 group-hover:text-yellow-300 transition-colors leading-tight">
                    {proxyStatus.active_config_name || '选择配置'}
                  </span>
                </div>

                {/* 下拉箭头 */}
                <svg
                  className={`w-4 h-4 text-gray-400 group-hover:text-yellow-400 transition-all duration-200 ${showConfigMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 快速切换下拉菜单 */}
              {showConfigMenu && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-yellow-500/30 rounded-lg shadow-2xl shadow-yellow-500/10 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-yellow-500/10 to-transparent">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <h3 className="text-sm font-bold text-yellow-400">快速切换配置</h3>
                    </div>
                    {proxyStatus.active_group_name && (
                      <p className="text-xs text-gray-500">
                        当前分组: {proxyStatus.active_group_name}
                      </p>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {availableConfigs.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <svg className="w-10 h-10 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-400">当前分组无可用配置</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {availableConfigs.map(config => {
                          const isActive = config.id === proxyStatus.active_config_id;
                          return (
                            <button
                              key={config.id}
                              onClick={() => handleSwitchConfig(config.id)}
                              disabled={isActive || switching}
                              className={`w-full px-4 py-3 text-left transition-all ${
                                isActive
                                  ? 'bg-yellow-500/20 cursor-default'
                                  : 'hover:bg-gray-800/50'
                              } disabled:opacity-50`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-semibold text-sm truncate ${
                                      isActive ? 'text-yellow-400' : 'text-gray-200'
                                    }`}>
                                      {config.name}
                                    </span>
                                    {isActive && (
                                      <span className="flex-shrink-0 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded">
                                        使用中
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 font-mono truncate">
                                    {config.server_url}
                                  </p>
                                  {config.last_latency_ms !== null && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      <span className={`text-xs font-medium ${
                                        config.last_latency_ms < 100 ? 'text-green-400' :
                                        config.last_latency_ms < 300 ? 'text-yellow-400' : 'text-red-400'
                                      }`}>
                                        {config.last_latency_ms}ms
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 底部提示 */}
                  <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50">
                    <p className="text-xs text-gray-500 text-center">
                      共 {availableConfigs.length} 个可用配置
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 代理状态指示器 - 只显示图标 */}
          {proxyStatus && (
            <div
              className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg border border-yellow-500/30 shadow-lg hover:border-yellow-500/50 transition-all duration-200 group relative"
              title={getStatusText(proxyStatus.status)}
            >
              <div className={`w-4 h-4 rounded-full ${getStatusColor(proxyStatus.status)} shadow-lg ${proxyStatus.status === 'running' ? 'animate-pulse shadow-green-500/50' : ''}`} />

              {/* 悬停提示 */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block">
                <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap border border-yellow-500/30">
                  {getStatusText(proxyStatus.status)}
                </div>
              </div>
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
