/**
 * 侧边栏导航组件
 * 应用主导航
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    {
      path: '/',
      label: t('nav.dashboard'),
      icon: '📊',
    },
    {
      path: '/configs',
      label: t('nav.configs'),
      icon: '⚙️',
    },
    {
      path: '/claude-code',
      label: t('nav.claudeCode'),
      icon: '💻',
    },
    {
      path: '/recommendations',
      label: t('nav.recommendations'),
      icon: '⭐',
    },
    {
      path: '/settings',
      label: t('nav.settings'),
      icon: '🔧',
    },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-gray-900 to-black border-r border-amber-500/30 flex flex-col">
      {/* Logo/品牌 */}
      <div className="p-6 border-b border-amber-500/30">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
          {t('app.name')}
        </h1>
        <p className="text-xs text-gray-400 mt-1">{t('app.description')}</p>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium shadow-lg shadow-amber-500/20'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-amber-400'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 版本信息 */}
      <div className="p-4 border-t border-amber-500/30">
        <p className="text-xs text-gray-500 text-center">
          Version 1.0.0
        </p>
      </div>
    </aside>
  );
};
