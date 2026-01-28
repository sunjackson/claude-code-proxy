/**
 * Claude Code 配置页面
 * 快速检测、MCP服务器、权限和技能管理
 *
 * 注意：安装/更新/验证/环境检测相关入口已下线（后端能力可保留以便回滚）
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactLayout } from '../components/CompactLayout';
import { QuickCheckPanel } from '../components/QuickCheckPanel';
import { McpServerManager } from '../components/McpServerManager';
import { PermissionsManager } from '../components/PermissionsManager';
import { SlashCommandsManager } from '../components/SlashCommandsManager';

type MainTab = 'quickCheck' | 'mcp' | 'permissions' | 'skills';

interface TabConfig {
  id: MainTab;
  label: string;
  icon: React.ReactNode;
}

export const ClaudeCodeSetup: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MainTab>('quickCheck');

  const mainTabs: TabConfig[] = [
    {
      id: 'quickCheck',
      label: t('setup.tabs.quickCheck'),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      id: 'mcp',
      label: t('setup.tabs.mcp'),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      ),
    },
    {
      id: 'permissions',
      label: t('setup.tabs.permissions'),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
    },
    {
      id: 'skills',
      label: t('setup.tabs.skills'),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'quickCheck':
        return <QuickCheckPanel />;
      case 'mcp':
        return <McpServerManager />;
      case 'permissions':
        return <PermissionsManager />;
      case 'skills':
        return <SlashCommandsManager />;
      default:
        return null;
    }
  };

  return (
    <CompactLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          {t('setup.title')}
        </h1>
        <p className="text-gray-500 text-xs mt-1">{t('setup.subtitle')}</p>
      </div>

      <div className="bg-gray-900/50 rounded-xl border border-yellow-500/20 overflow-hidden">
        <div className="border-b border-yellow-500/20 bg-black/30">
          <div className="flex">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {tab.icon}
                  <span>{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">{renderContent()}</div>
      </div>
    </CompactLayout>
  );
};

export default ClaudeCodeSetup;
