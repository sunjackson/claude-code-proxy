/**
 * 筛选栏组件
 * 提供推荐服务的筛选和排序功能
 */

import React from 'react';

interface FilterBarProps {
  /** 当前筛选类型 */
  filter: 'all' | 'recommended';
  /** 当前排序方式 */
  sortBy: 'hotness' | 'name';
  /** 筛选变化回调 */
  onFilterChange: (filter: 'all' | 'recommended') => void;
  /** 排序变化回调 */
  onSortChange: (sortBy: 'hotness' | 'name') => void;
  /** 刷新回调 */
  onRefresh: () => void;
  /** 是否正在加载 */
  loading?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  sortBy,
  onFilterChange,
  onSortChange,
  onRefresh,
  loading = false,
}) => {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* 左侧：筛选和排序 */}
        <div className="flex items-center gap-6 flex-wrap">
          {/* 筛选按钮组 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">筛选</span>
            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
              <button
                onClick={() => onFilterChange('all')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                  filter === 'all'
                    ? 'bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => onFilterChange('recommended')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                  filter === 'recommended'
                    ? 'bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                推荐
              </button>
            </div>
          </div>

          {/* 排序按钮组 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">排序</span>
            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
              <button
                onClick={() => onSortChange('hotness')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                  sortBy === 'hotness'
                    ? 'bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                热度
              </button>
              <button
                onClick={() => onSortChange('name')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                  sortBy === 'name'
                    ? 'bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                名称
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：刷新按钮 */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          title="刷新服务列表"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="font-medium">{loading ? '刷新中' : '刷新'}</span>
        </button>
      </div>
    </div>
  );
};
