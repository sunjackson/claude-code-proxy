/**
 * Claude Code 集成页面
 * 管理 Claude Code 配置备份
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClaudeCodePathDetector } from '../components/ClaudeCodePathDetector';
import { BackupList } from '../components/BackupList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CompactLayout } from '../components/CompactLayout';
import type { ClaudeCodePath, ConfigBackup } from '../types/tauri';

export const ClaudeCodeIntegration: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [claudeCodePath, setClaudeCodePath] = useState<ClaudeCodePath | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'default' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    onConfirm: () => {},
  });

  const handlePathDetected = (path: ClaudeCodePath) => {
    setClaudeCodePath(path);
  };

  const handleShowBackupConfirm = (
    action: 'restore' | 'delete' | 'clear',
    backup: ConfigBackup | null,
    callback: () => void
  ) => {
    if (action === 'restore' && backup) {
      setConfirmDialog({
        isOpen: true,
        title: t('claudeCode.restoreBackup'),
        message: t('claudeCode.restoreBackupConfirm', {
          reason: backup.reason,
          time: new Date(backup.backup_time).toLocaleString()
        }),
        variant: 'default',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    } else if (action === 'delete' && backup) {
      setConfirmDialog({
        isOpen: true,
        title: t('claudeCode.deleteBackup'),
        message: t('claudeCode.deleteBackupConfirm', { reason: backup.reason }),
        variant: 'danger',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    } else if (action === 'clear') {
      setConfirmDialog({
        isOpen: true,
        title: t('claudeCode.clearAllBackups'),
        message: t('claudeCode.clearAllBackupsConfirm'),
        variant: 'danger',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    }
  };

  const handleCancelConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <CompactLayout>
      {/* 主要内容区域 */}
      <div className="space-y-6">
          {/* 路径检测器 */}
          <ClaudeCodePathDetector onPathDetected={handlePathDetected} />

          {/* 代理配置提示 */}
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 shadow-lg shadow-yellow-500/5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl flex items-center justify-center border border-yellow-500/30 shadow-inner">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-yellow-400 mb-2 tracking-wide">{t('claudeCode.configureProxyTitle')}</h3>
                <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                  {t('claudeCode.configureProxyDesc')}
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {t('claudeCode.goToDashboard')}
                </button>
              </div>
            </div>
          </div>

          {/* 权限警告 */}
          {claudeCodePath && !claudeCodePath.readable && (
            <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-red-500/50 rounded-xl p-6 shadow-lg shadow-red-500/10">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                  <svg
                    className="w-6 h-6 text-red-400"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-400 mb-2">
                    {t('claudeCode.permissionDenied')}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {t('claudeCode.permissionDeniedDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 备份列表 */}
          <BackupList
            onRestored={() => {
              console.log('配置已恢复');
            }}
            onDeleted={() => {
              console.log('备份已删除');
            }}
            onShowConfirm={handleShowBackupConfirm}
          />

          {/* 使用说明 */}
          <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 shadow-lg shadow-yellow-500/5">
            <h3 className="text-lg font-bold text-yellow-400 mb-5 tracking-wide flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('claudeCode.usageGuide')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 bg-yellow-500/5 rounded-lg p-4 border border-yellow-500/20">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/30 to-yellow-600/30 text-yellow-400 flex items-center justify-center text-sm font-bold border border-yellow-500/30">
                  1
                </span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  <strong className="text-yellow-400 font-semibold">{t('claudeCode.guideStep1Title')}</strong> {t('claudeCode.guideStep1Desc')}
                </p>
              </div>
              <div className="flex items-start gap-4 bg-yellow-500/5 rounded-lg p-4 border border-yellow-500/20">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/30 to-yellow-600/30 text-yellow-400 flex items-center justify-center text-sm font-bold border border-yellow-500/30">
                  2
                </span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  <strong className="text-yellow-400 font-semibold">{t('claudeCode.guideStep2Title')}</strong> {t('claudeCode.guideStep2Desc')}
                </p>
              </div>
              <div className="flex items-start gap-4 bg-yellow-500/5 rounded-lg p-4 border border-yellow-500/20">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/30 to-yellow-600/30 text-yellow-400 flex items-center justify-center text-sm font-bold border border-yellow-500/30">
                  3
                </span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  <strong className="text-yellow-400 font-semibold">{t('claudeCode.guideStep3Title')}</strong> {t('claudeCode.guideStep3Desc')}
                </p>
              </div>
            </div>
          </div>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={handleCancelConfirm}
      />
    </CompactLayout>
  );
};

export default ClaudeCodeIntegration;
