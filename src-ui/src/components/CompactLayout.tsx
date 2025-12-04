/**
 * 紧凑布局组件 - 方案A
 * 无侧边栏，顶部导航 + 状态栏
 */

import React, { useEffect, useState, useCallback } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useLanguage } from '../hooks/useLanguage';
import { useAutoSwitch } from '../hooks/useAutoSwitch';
import * as proxyApi from '../api/proxy';
import type { ProxyService } from '../types/tauri';

interface CompactLayoutProps {
  children: React.ReactNode;
}

export const CompactLayout: React.FC<CompactLayoutProps> = ({ children }) => {
  const { currentLanguage, toggleLanguage } = useLanguage();
  const [proxyStatus, setProxyStatus] = useState<ProxyService | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await proxyApi.getProxyStatus();
      setProxyStatus(status);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }, []);

  // 监听自动切换事件，实时更新状态
  useAutoSwitch(() => {
    // 延迟200ms后刷新，确保后端状态已更新
    setTimeout(loadStatus, 200);
  });

  // 监听 proxy-status-changed 事件实时更新
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<ProxyService>('proxy-status-changed', (event) => {
          console.log('[CompactLayout] Received proxy-status-changed:', event.payload);
          setProxyStatus(event.payload);
        });
      } catch (err) {
        console.error('Failed to setup proxy-status-changed listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 初始加载
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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
    { path: '/', title: '仪表盘' },
    { path: '/claude-code-setup', title: 'CC配置' },
    { path: '/recommendations', title: '推荐服务商' },
    { path: '/settings', title: '系统设置' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden text-white bg-black">
      {/* 顶部栏：紧凑设计 */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-gradient-to-r from-black via-gray-950 to-black border-yellow-500/30">
        {/* 左侧：品牌Logo（小尺寸） */}
        <div className="flex items-center flex-shrink-0 gap-2">
          <div className="flex items-center justify-center rounded w-7 h-7 bg-gradient-to-br from-yellow-500 to-yellow-600">
            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 whitespace-nowrap">
            CCProxy
          </span>
        </div>

        {/* 中间：导航标签（文字显示） */}
        <nav className="flex items-center flex-shrink-0 gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `relative px-4 py-1.5 rounded text-sm font-medium ${
                  isActive
                    ? 'bg-yellow-500 text-black'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-yellow-400'
                }`
              }
              style={{
                transition: 'color 0.15s ease-in-out, background-color 0.15s ease-in-out',
              }}
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        {/* 右侧：状态（紧凑显示） */}
        <div className="flex items-center flex-shrink-0 gap-2">
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
            className="flex items-center justify-center transition-all border rounded w-9 h-9 bg-gray-900/50 border-yellow-500/30 hover:border-yellow-500/50"
            title="切换语言"
          >
            <span className="text-xs text-gray-300">{currentLanguage === 'zh-CN' ? '中' : 'EN'}</span>
          </button>

          {/* 开发者日志入口 */}
          <Link
            to="/dev-logs"
            className="flex items-center justify-center transition-all border rounded w-9 h-9 bg-gray-900/50 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10 group"
            title="开发者日志"
          >
            <svg className="w-4 h-4 text-amber-400 group-hover:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </Link>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="p-6 mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
};
