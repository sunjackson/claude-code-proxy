/**
 * 应用入口文件
 * 初始化 React 应用、国际化、路由和全局状态
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './services/i18n';
import './utils/diagnostics';

// 确保在开发环境下启用严格模式
const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
