/**
 * 设置页面
 * 应用设置和环境变量管理
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnvironmentVariableManager } from '../components/EnvironmentVariableManager';
import { useLanguage } from '../hooks/useLanguage';
import { AppLayout } from '../components/AppLayout';

type SettingsTab = 'general' | 'environment';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>('environment');

  return (
    <AppLayout title={t('nav.settings')} subtitle={t('settings.subtitle')}>
      {/* 标签页 */}
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'general'
              ? 'bg-amber-500 text-black font-medium'
              : 'bg-transparent text-gray-300 hover:bg-gray-800'
          }`}
        >
          ⚙️ {t('settings.general')}
        </button>
        <button
          onClick={() => setActiveTab('environment')}
          className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'environment'
              ? 'bg-amber-500 text-black font-medium'
              : 'bg-transparent text-gray-300 hover:bg-gray-800'
          }`}
        >
          🌍 {t('settings.environment')}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="mt-6">
        {activeTab === 'general' && (
          <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-amber-400 mb-4">{t('settings.general')}</h2>
            </div>

            {/* 语言设置 */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-300">{t('settings.language')}</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => changeLanguage('zh-CN')}
                  className={`px-6 py-3 rounded-lg transition-colors ${
                    currentLanguage === 'zh-CN'
                      ? 'bg-amber-500 text-black font-medium'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  }`}
                >
                  {t('settings.languageZhCN')}
                </button>
                <button
                  onClick={() => changeLanguage('en-US')}
                  className={`px-6 py-3 rounded-lg transition-colors ${
                    currentLanguage === 'en-US'
                      ? 'bg-amber-500 text-black font-medium'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  }`}
                >
                  {t('settings.languageEnUS')}
                </button>
              </div>
            </div>

            {/* 其他设置 */}
            <div className="border-t border-gray-800 pt-6">
              <h3 className="text-lg font-medium text-gray-300 mb-2">{t('settings.theme')}</h3>
              <p className="text-gray-400">
                {t('settings.comingSoon')}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'environment' && <EnvironmentVariableManager />}
      </div>
    </AppLayout>
  );
};

export default Settings;
