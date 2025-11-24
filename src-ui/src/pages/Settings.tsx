/**
 * 设置页面
 * 应用设置和环境变量管理
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnvironmentVariableManager } from '../components/EnvironmentVariableManager';
import { useLanguage } from '../hooks/useLanguage';
import { CompactLayout } from '../components/CompactLayout';

type SettingsTab = 'general' | 'environment';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>('environment');

  return (
    <CompactLayout>
      {/* 标签页 */}
      <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-2 flex gap-2 shadow-lg shadow-yellow-500/5">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 px-5 py-3 text-sm rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'general'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
              : 'bg-transparent text-gray-300 hover:bg-gray-900 hover:text-white border border-transparent hover:border-gray-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t('settings.general')}
        </button>
        <button
          onClick={() => setActiveTab('environment')}
          className={`flex-1 px-5 py-3 text-sm rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'environment'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
              : 'bg-transparent text-gray-300 hover:bg-gray-900 hover:text-white border border-transparent hover:border-gray-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('settings.environment')}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="mt-6">
        {activeTab === 'general' && (
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 shadow-lg shadow-yellow-500/5 space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-yellow-400 tracking-wide">{t('settings.general')}</h2>
            </div>

            {/* 语言设置 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <h3 className="text-lg font-bold text-gray-200">{t('settings.language')}</h3>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => changeLanguage('zh-CN')}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 font-semibold flex items-center gap-2 ${
                    currentLanguage === 'zh-CN'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105'
                      : 'bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {t('settings.languageZhCN')}
                </button>
                <button
                  onClick={() => changeLanguage('en-US')}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 font-semibold flex items-center gap-2 ${
                    currentLanguage === 'en-US'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105'
                      : 'bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {t('settings.languageEnUS')}
                </button>
              </div>
            </div>

            {/* 其他设置 */}
            <div className="border-t border-gray-800 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <h3 className="text-lg font-bold text-gray-200">{t('settings.theme')}</h3>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-gray-300 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {t('settings.comingSoon')}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'environment' && <EnvironmentVariableManager />}
      </div>
    </CompactLayout>
  );
};

export default Settings;
