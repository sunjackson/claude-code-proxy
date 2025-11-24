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

  const navItems = [
    { path: '/', icon: '🏠', title: '仪表盘' },
    { path: '/configs', icon: '⚙️', title: '配置' },
    { path: '/claude-code', icon: '🔗', title: '集成' },
    { path: '/settings', icon: '🛠️', title: '设置' },
  ];

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* 顶部栏：紧凑设计 */}
      <header className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-black via-gray-950 to-black border-b border-yellow-500/30">
        {/* 左侧：品牌Logo（小尺寸） */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 whitespace-nowrap">
            Claude Router
          </span>
        </div>

        {/* 中间：导航标签（图标为主） */}
        <nav className="flex items-center gap-1 flex-shrink-0">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.title}
              className={({ isActive }) =>
                `flex items-center justify-center w-9 h-9 rounded transition-all ${
                  isActive
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/40'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-yellow-400'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
            </NavLink>
          ))}
        </nav>

        {/* 右侧：状态（紧凑显示） */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {proxyStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border border-yellow-500/30 rounded">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(proxyStatus.status)} ${proxyStatus.status === 'running' ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-gray-300 whitespace-nowrap">
                {proxyStatus.status === 'running' ? '运行' : '停止'}
              </span>
              {proxyStatus.active_config_name && proxyStatus.status === 'running' && (
                <>
                  <div className="w-px h-3 bg-gray-700" />
                  <span className="text-xs text-yellow-400 whitespace-nowrap max-w-[120px] truncate">
                    {proxyStatus.active_config_name}
                  </span>
                </>
              )}
            </div>
          )}

          <button
            onClick={toggleLanguage}
            className="w-9 h-9 flex items-center justify-center bg-gray-900/50 border border-yellow-500/30 rounded hover:border-yellow-500/50 transition-all"
            title="切换语言"
          >
            <span className="text-xs text-gray-300">{currentLanguage === 'zh-CN' ? '中' : 'EN'}</span>
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
