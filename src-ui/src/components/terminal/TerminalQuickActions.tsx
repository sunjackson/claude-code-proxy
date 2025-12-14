/**
 * TerminalQuickActions Component
 *
 * Bottom quick action bar for terminal workspace.
 * Provides shortcuts for editing project memory, project paths, and other common actions.
 */

import React from 'react';
import { FolderOpen, Settings, BookOpen, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TerminalQuickActionsProps {
  sessionId: string | null;
  workDir?: string;
  onEditProjectPath: () => void;
  onEditProjectMemory: () => void;
  onOpenSettings: () => void;
  onShowInfo: () => void;
}

/**
 * TerminalQuickActions - Quick action bar at the bottom of terminal workspace
 */
export const TerminalQuickActions: React.FC<TerminalQuickActionsProps> = ({
  sessionId,
  workDir,
  onEditProjectPath,
  onEditProjectMemory,
  onOpenSettings,
  onShowInfo,
}) => {
  const { t } = useTranslation();

  // If no active session, show placeholder
  if (!sessionId) {
    return (
      <div className="h-14 bg-gray-900/50 border-t border-gray-800 flex items-center justify-center px-4">
        <p className="text-sm text-gray-500">{t('terminal.quickActions.noActiveSession')}</p>
      </div>
    );
  }

  return (
    <div className="h-14 bg-gray-900/50 border-t border-gray-800 flex items-center justify-between px-4 gap-4">
      {/* Left: Current working directory - 允许收缩但保持最小宽度 */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span
          className="text-sm text-gray-400 truncate"
          title={workDir || t('terminal.quickActions.noWorkDir')}
        >
          {workDir || t('terminal.quickActions.noWorkDir')}
        </span>
      </div>

      {/* Right: Quick action buttons - 不允许收缩，确保文字完整显示 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onEditProjectPath}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap"
          title={t('terminal.quickActions.editProjectPath')}
        >
          <FolderOpen className="w-4 h-4 flex-shrink-0" />
          <span className="inline-block">项目路径</span>
        </button>

        <button
          onClick={onEditProjectMemory}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap"
          title={t('terminal.quickActions.editProjectMemory')}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span className="inline-block">项目记忆</span>
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1 flex-shrink-0" />

        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          title={t('terminal.quickActions.settings')}
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onShowInfo}
          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          title={t('terminal.quickActions.sessionInfo')}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
