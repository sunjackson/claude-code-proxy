/**
 * Claude Code 高级配置管理页面
 * 整合 MCP、Permissions、Skills 配置管理
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { McpServerManager } from './McpServerManager';
import { PermissionsManager } from './PermissionsManager';
import { SkillsManager } from './SkillsManager';

type ConfigTab = 'mcp' | 'permissions' | 'skills';

interface TabConfig {
  id: ConfigTab;
  labelKey: string;
  icon: string;
  descriptionKey: string;
}

export const AdvancedConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConfigTab>('mcp');

  const tabs: TabConfig[] = [
    {
      id: 'mcp',
      labelKey: 'advancedConfig.mcpServers',
      icon: '🔌',
      descriptionKey: 'advancedConfig.mcpServersDesc',
    },
    {
      id: 'permissions',
      labelKey: 'advancedConfig.permissions',
      icon: '🔒',
      descriptionKey: 'advancedConfig.permissionsDesc',
    },
    {
      id: 'skills',
      labelKey: 'advancedConfig.skills',
      icon: '✨',
      descriptionKey: 'advancedConfig.skillsDesc',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mcp':
        return <McpServerManager />;
      case 'permissions':
        return <PermissionsManager />;
      case 'skills':
        return <SkillsManager />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-xl border border-yellow-500/20 overflow-hidden">
      {/* 页面头部 */}
      <div className="border-b border-yellow-500/20 bg-black/30">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-bold text-yellow-400">{t('advancedConfig.title')}</h1>
          <p className="text-gray-400 mt-1 text-sm">{t('advancedConfig.description')}</p>
        </div>
      </div>

      {/* 标签栏 */}
      <div className="border-b border-yellow-500/20 bg-black/20">
        <div className="px-4">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{t(tab.labelKey)}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 当前标签描述 */}
      <div className="px-6 py-3 border-b border-gray-800/50 bg-gray-900/30">
        <p className="text-sm text-gray-500">
          {t(tabs.find(t => t.id === activeTab)?.descriptionKey || '')}
        </p>
      </div>

      {/* 内容区域 */}
      <div className="p-4">{renderTabContent()}</div>
    </div>
  );
};

/**
 * 紧凑版高级配置组件
 * 用于嵌入到其他页面或对话框中
 */
export const AdvancedConfigCompact: React.FC<{
  defaultTab?: ConfigTab;
  onClose?: () => void;
}> = ({ defaultTab = 'mcp', onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConfigTab>(defaultTab);

  const tabs: TabConfig[] = [
    {
      id: 'mcp',
      labelKey: 'advancedConfig.mcpServers',
      icon: '🔌',
      descriptionKey: 'advancedConfig.mcpServersDesc',
    },
    {
      id: 'permissions',
      labelKey: 'advancedConfig.permissions',
      icon: '🔒',
      descriptionKey: 'advancedConfig.permissionsDesc',
    },
    {
      id: 'skills',
      labelKey: 'advancedConfig.skills',
      icon: '✨',
      descriptionKey: 'advancedConfig.skillsDesc',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mcp':
        return <McpServerManager />;
      case 'permissions':
        return <PermissionsManager />;
      case 'skills':
        return <SkillsManager />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-amber-400">{t('advancedConfig.title')}</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            ✕
          </button>
        )}
      </div>

      {/* 标签栏 */}
      <div className="flex border-b border-gray-800 px-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.id ? 'text-amber-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-1">
              <span>{tab.icon}</span>
              <span>{t(tab.labelKey)}</span>
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="max-h-[60vh] overflow-y-auto">{renderTabContent()}</div>
    </div>
  );
};
