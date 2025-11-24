/**
 * 推荐服务页面
 * 显示推荐的 Claude API 中转服务
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import type { RecommendedService } from '../types/tauri';
import * as recommendationApi from '../api/recommendation';
import { ServiceCard } from '../components/ServiceCard';
import { FilterBar } from '../components/FilterBar';
import { CompactLayout } from '../components/CompactLayout';

export const Recommendations: React.FC = () => {
  const { t } = useTranslation();
  // 状态管理
  const [services, setServices] = useState<RecommendedService[]>([]);
  const [filter, setFilter] = useState<'all' | 'recommended'>('all');
  const [sortBy, setSortBy] = useState<'hotness' | 'name'>('hotness');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载推荐服务
  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recommendationApi.loadRecommendedServices();
      setServices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载推荐服务失败');
      console.error('Failed to load recommended services:', err);
    } finally {
      setLoading(false);
    }
  };

  // 刷新服务
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recommendationApi.refreshRecommendedServices();
      setServices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新推荐服务失败');
      console.error('Failed to refresh recommended services:', err);
    } finally {
      setLoading(false);
    }
  };

  // 打开推广链接
  const handleOpenLink = async (url: string) => {
    try {
      // 使用 Tauri shell API 在默认浏览器中打开
      await open(url);
    } catch (err) {
      console.error('Failed to open URL:', err);
      // 如果 Tauri API 失败，回退到 window.open
      window.open(url, '_blank');
    }
  };

  // 筛选和排序服务
  const filteredAndSortedServices = React.useMemo(() => {
    // 筛选
    let filtered = services;
    if (filter === 'recommended') {
      filtered = services.filter((s) => s.is_recommended);
    }

    // 排序
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'hotness') {
        return b.hotness_score - a.hotness_score;
      } else {
        return a.site_name.localeCompare(b.site_name);
      }
    });

    return sorted;
  }, [services, filter, sortBy]);

  if (loading && services.length === 0) {
    return (
      <CompactLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-800 border-t-yellow-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="mt-6 text-gray-400 font-medium">{t('common.loading')}</p>
          <p className="mt-2 text-sm text-gray-500">正在加载推荐服务...</p>
        </div>
      </CompactLayout>
    );
  }

  return (
    <CompactLayout>
      <div className="space-y-6">
        {/* 错误提示 */}
        {error && (
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-red-500/50 rounded-xl p-5 flex items-start gap-4 shadow-lg shadow-red-500/10">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-red-400 font-bold mb-1 tracking-wide">加载失败</h4>
              <p className="text-gray-300 text-sm leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors p-1 hover:bg-gray-800 rounded-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* 筛选栏 */}
        <FilterBar
          filter={filter}
          sortBy={sortBy}
          onFilterChange={setFilter}
          onSortChange={setSortBy}
          onRefresh={handleRefresh}
          loading={loading}
        />

        {/* 服务列表 */}
        {filteredAndSortedServices.length === 0 ? (
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-gray-800 rounded-xl py-20 text-center shadow-lg">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-900 to-black rounded-2xl flex items-center justify-center mb-6 border border-gray-800 shadow-inner">
                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-400 mb-2">
                {filter === 'recommended' ? '暂无推荐服务' : '暂无服务'}
              </h3>
              <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                {filter === 'recommended'
                  ? '当前没有标记为推荐的服务，请切换到"全部"查看所有服务'
                  : '服务列表为空，请点击刷新按钮或联系管理员'}
              </p>
              {filter === 'recommended' && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-8 px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black rounded-lg font-bold transition-all duration-200 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105"
                >
                  查看全部服务
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 统计信息 */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {filteredAndSortedServices.length}
                </span>
                <span className="text-sm text-gray-500">
                  个服务
                  {filter === 'recommended' && ` / 共 ${services.length} 个`}
                </span>
              </div>
              {services.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    更新于 {new Date(services[0].loaded_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* 服务卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAndSortedServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onClick={handleOpenLink}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </CompactLayout>
  );
};

export default Recommendations;
