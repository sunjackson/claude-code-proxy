/**
 * 服务卡片组件
 * 显示推荐服务信息和链接
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RecommendedService } from '../types/tauri';

interface ServiceCardProps {
  /** 推荐服务 */
  service: RecommendedService;
  /** 点击回调 */
  onClick: (url: string) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  const { t } = useTranslation();

  return (
    <div
      onClick={() => onClick(service.promotion_url)}
      className="group relative bg-black border border-gray-800 rounded-xl p-6 cursor-pointer transition-all hover:border-yellow-500/50 hover:shadow-xl hover:shadow-yellow-500/10 hover:-translate-y-1"
    >
      {/* 推荐角标 */}
      {service.is_recommended && (
        <div className="absolute -top-3 -right-3">
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {t('service.recommended')}
          </div>
        </div>
      )}

      {/* 服务名称 */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-yellow-400 transition-colors" title={service.site_name}>
          {service.site_name}
        </h3>
        <div className="h-0.5 w-12 bg-gradient-to-r from-yellow-500 to-transparent rounded-full group-hover:w-20 transition-all"></div>
      </div>

      {/* 地区标签 */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            service.region === 'domestic'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30 group-hover:bg-green-500/20 group-hover:border-green-500/50'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30 group-hover:bg-blue-500/20 group-hover:border-blue-500/50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
              clipRule="evenodd"
            />
          </svg>
          {service.region === 'domestic' ? t('service.domestic') : t('service.foreign')}
        </span>
      </div>

      {/* 服务商简介 */}
      <div className="mb-5 min-h-[4.5rem]">
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-3" title={service.description}>
          {service.description}
        </p>
      </div>

      {/* 访问按钮 */}
      <div className="flex items-center justify-center pt-4 border-t border-gray-800 group-hover:border-yellow-500/30 transition-colors">
        <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-yellow-400 transition-colors">
          <span className="font-medium">{t('service.visitNow')}</span>
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>

      {/* 悬停发光效果 */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/5 group-hover:via-yellow-500/0 group-hover:to-transparent transition-all pointer-events-none"></div>
    </div>
  );
};
