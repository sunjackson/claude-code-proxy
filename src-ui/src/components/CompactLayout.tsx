/**
 * 紧凑布局组件 - 方案A
 * 无侧边栏，顶部导航 + 状态栏
 */

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import * as proxyApi from '../api/proxy';
import type { ProxyService } from '../types/tauri';

interface CompactLayoutProps {
  children: React.ReactNode;
}

export const CompactLayout: React.FC<CompactLayoutProps> = ({ children }) => {
  const { currentLanguage, toggleLanguage } = useLanguage();
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);

  // 加载代理状态
  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
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
        return '运行中';
      case 'stopped':
        return '已停止';
      case 'starting':
        return '启动中';
      case 'stopping':
        return '停止中';
      case 'error':
        return '错误';
      default:
        return '离线';
    }
  };

  const navItems = [
    { path: '/', label: '仪表盘', icon: '🏠' },
    { path: '/configs', label: '配置', icon: '⚙️' },
    { path: '/claude-code', label: '集成', icon: '🔗' },
    { path: '/settings', label: '设置', icon: '🛠️' },
  ];

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* 顶部栏：品牌 + 导航 + 状态 */}
      <header className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-black via-gray-950 to-black border-b border-yellow-500/30 shadow-lg shadow-yellow-500/5">
        {/* 左侧：品牌 + 导航 */}
        <div className="flex items-center gap-8">
          {/* 品牌 Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/30">
              <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              Claude Router
            </span>
          </div>

          {/* 导航标签 */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/40'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-yellow-400'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* 右侧：状态 + 配置 + 语言 */}
        <div className="flex items-center gap-4">
          {/* 状态指示 */}
          {proxyStatus && (
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/50 border border-yellow-500/30 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(proxyStatus.status)} ${proxyStatus.status === 'running' ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-semibold text-gray-200">
                {getStatusText(proxyStatus.status)}
              </span>
              {proxyStatus.active_config_name && (
                <>
                  <div className="w-px h-4 bg-gray-700" />
                  <span className="text-sm text-yellow-400 font-medium">
                    {proxyStatus.active_config_name}
                  </span>
                </>
              )}
              {proxyStatus.status === 'running' && (
                <>
                  <div className="w-px h-4 bg-gray-700" />
                  <span className="text-xs text-gray-400 font-mono">
                    {proxyStatus.listen_host}:{proxyStatus.listen_port}
                  </span>
                </>
              )}
            </div>
          )}

          {/* 语言切换 */}
          <button
            onClick={toggleLanguage}
            className="px-3 py-2 bg-gray-900/50 border border-yellow-500/30 rounded-lg hover:border-yellow-500/50 transition-all text-sm font-medium text-gray-200 hover:text-yellow-400"
            title="切换语言"
          >
            {currentLanguage === 'zh-CN' ? '中文' : 'EN'}
          </button>

          {/* 帮助 */}
          <button
            className="px-3 py-2 bg-gray-900/50 border border-yellow-500/30 rounded-lg hover:border-yellow-500/50 transition-all text-sm font-medium text-gray-200 hover:text-yellow-400"
            title="帮助"
          >
            ❓
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
