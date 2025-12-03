/**
 * 开发者日志页面
 * 开发者模式下的详细请求日志查看
 */

import { Link } from 'react-router-dom';
import DevLogPanel from '../components/DevLogPanel';

export default function DevLogs() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black">
      {/* 头部导航 */}
      <header className="bg-gray-900/80 border-b border-amber-500/30 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm">返回主页</span>
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h1 className="text-lg font-semibold text-amber-400">开发者日志</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>仅开发模式可见</span>
          </div>
        </div>
      </header>

      {/* 日志面板 */}
      <main className="h-[calc(100vh-57px)]">
        <DevLogPanel />
      </main>
    </div>
  );
}
