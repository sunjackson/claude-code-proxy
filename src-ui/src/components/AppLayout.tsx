/**
 * 应用布局组件
 * 提供统一的应用布局: Sidebar + Header + Content
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 */}
        <Header title={title} subtitle={subtitle} />

        {/* 内容区域 */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 via-black to-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
};
