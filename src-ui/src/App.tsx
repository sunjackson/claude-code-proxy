/**
 * 应用主组件
 * 配置路由、错误边界和全局 Toast
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './services/toast';

// 页面组件
import Dashboard from './pages/Dashboard';
import ClaudeCodeIntegration from './pages/ClaudeCodeIntegration';
import Recommendations from './pages/Recommendations';
import Settings from './pages/Settings';
import TestApi from './pages/TestApi';

/**
 * App 主组件
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* 主要路由 */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/claude-code" element={<ClaudeCodeIntegration />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/test-api" element={<TestApi />} />

          {/* 旧路由兼容 - 重定向到首页 */}
          <Route path="/configs" element={<Navigate to="/" replace />} />

          {/* 404 重定向到首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* 全局 Toast 通知 */}
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
