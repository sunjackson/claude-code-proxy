/**
 * 应用主组件
 * 配置路由、错误边界和全局 Toast
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './services/toast';
import { SetupWizard } from './components/SetupWizard';
import { isFirstRun, markSetupCompleted, skipSetup } from './utils/setupState';

// 页面组件
import Dashboard from './pages/Dashboard';
import Recommendations from './pages/Recommendations';
import Settings from './pages/Settings';
import TestApi from './pages/TestApi';
import { EnvironmentSetup } from './pages/EnvironmentSetup';

/**
 * App 主组件
 */
const App: React.FC = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);

  useEffect(() => {
    // 检查是否需要显示首次启动向导
    const shouldShowWizard = isFirstRun();
    setShowWizard(shouldShowWizard);
    setWizardChecked(true);
  }, []);

  const handleWizardComplete = () => {
    markSetupCompleted();
    setShowWizard(false);
  };

  const handleWizardSkip = () => {
    skipSetup();
    setShowWizard(false);
  };

  // 等待检查完成
  if (!wizardChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-400">正在加载...</p>
        </div>
      </div>
    );
  }

  // 显示首次启动向导
  if (showWizard) {
    return (
      <ErrorBoundary>
        <SetupWizard onComplete={handleWizardComplete} onSkip={handleWizardSkip} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* 主要路由 */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/test-api" element={<TestApi />} />
          <Route path="/environment-setup" element={<EnvironmentSetup />} />

          {/* 旧路由兼容 - 重定向 */}
          <Route path="/configs" element={<Navigate to="/" replace />} />
          <Route path="/claude-code" element={<Navigate to="/settings" replace />} />

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
