/**
 * 语言切换 Hook
 * 管理应用的语言设置
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SupportedLanguage = 'zh-CN' | 'en-US';

export function useLanguage() {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'zh-CN'
  );

  useEffect(() => {
    // 从 localStorage 加载保存的语言设置
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage && (savedLanguage === 'zh-CN' || savedLanguage === 'en-US')) {
      changeLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = async (language: SupportedLanguage) => {
    try {
      await i18n.changeLanguage(language);
      setCurrentLanguage(language);

      // 持久化语言设置到 localStorage
      localStorage.setItem('app-language', language);

      // TODO: 可以通过 Tauri 命令调用 update_app_settings 持久化到后端配置
      // await invoke('update_app_settings', { language });
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const toggleLanguage = () => {
    const newLanguage = currentLanguage === 'zh-CN' ? 'en-US' : 'zh-CN';
    changeLanguage(newLanguage);
  };

  return {
    currentLanguage,
    changeLanguage,
    toggleLanguage,
    isZhCN: currentLanguage === 'zh-CN',
    isEnUS: currentLanguage === 'en-US',
  };
}
