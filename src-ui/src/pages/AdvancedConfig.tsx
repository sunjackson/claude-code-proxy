/**
 * Claude Code 高级配置页面
 * 整合 MCP、Permissions、Skills 配置管理
 */

import React from 'react';
import { AdvancedConfigPage } from '../components/AdvancedConfigPage';
import { CompactLayout } from '../components/CompactLayout';

export const AdvancedConfig: React.FC = () => {
  return (
    <CompactLayout>
      <AdvancedConfigPage />
    </CompactLayout>
  );
};

export default AdvancedConfig;
