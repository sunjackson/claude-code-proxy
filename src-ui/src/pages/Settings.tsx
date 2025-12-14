/**
 * 设置页面
 * 应用设置、环境变量管理和配置备份
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EnvironmentVariableManager } from '../components/EnvironmentVariableManager';
import { ClaudeCodePathDetector } from '../components/ClaudeCodePathDetector';
import { BackupList } from '../components/BackupList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ModelMappingManager } from '../components/ModelMappingManager';
import { useLanguage } from '../hooks/useLanguage';
import { CompactLayout } from '../components/CompactLayout';
import type { ClaudeCodePath, ConfigBackup } from '../types/tauri';

type SettingsTab = 'general' | 'environment' | 'backup' | 'modelMapping';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
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
      const backupTime = new Date(backup.backup_time).toLocaleString(
        currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US'
      );
      setConfirmDialog({
        isOpen: true,
        title: t('settings.restoreBackup'),
        message: t('settings.restoreBackupConfirm', {
          reason: backup.reason,
          time: backupTime,
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
        title: t('settings.deleteBackup'),
        message: t('settings.deleteBackupConfirm', { reason: backup.reason }),
        variant: 'danger',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    } else if (action === 'clear') {
      setConfirmDialog({
        isOpen: true,
        title: t('settings.clearAllBackups'),
        message: t('settings.clearAllBackupsConfirm'),
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
      {/* 标签页 */}
      <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-2 flex gap-2 shadow-lg shadow-yellow-500/5">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'general'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
          style={{
            transition: 'color 0.15s ease-in-out, background-color 0.15s ease-in-out',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t('settings.general')}
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'backup'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
          style={{
            transition: 'color 0.15s ease-in-out, background-color 0.15s ease-in-out',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          {t('settings.backup')}
        </button>
        <button
          onClick={() => setActiveTab('environment')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'environment'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
          style={{
            transition: 'color 0.15s ease-in-out, background-color 0.15s ease-in-out',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('settings.environment')}
        </button>
        <button
          onClick={() => setActiveTab('modelMapping')}
          className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 ${
            activeTab === 'modelMapping'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
              : 'bg-transparent text-gray-300 hover:bg-gray-900/50 hover:text-white border border-transparent'
          }`}
          style={{
            transition: 'color 0.15s ease-in-out, background-color 0.15s ease-in-out',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {t('modelMapping.title')}
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
              <div className="flex items-center gap-3">
                {/* 中文选项 */}
                <button
                  onClick={() => changeLanguage('zh-CN')}
                  className={`relative px-6 py-3 rounded-xl transition-all duration-300 font-semibold flex items-center gap-3 group ${
                    currentLanguage === 'zh-CN'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/40 scale-105'
                      : 'bg-gray-900/80 text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700 hover:border-yellow-500/50 hover:scale-102'
                  }`}
                >
                  <span className="text-xl">🇨🇳</span>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold">简体中文</span>
                    <span className={`text-xs ${currentLanguage === 'zh-CN' ? 'text-black/70' : 'text-gray-500'}`}>Chinese (Simplified)</span>
                  </div>
                  {currentLanguage === 'zh-CN' && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* 英文选项 */}
                <button
                  onClick={() => changeLanguage('en-US')}
                  className={`relative px-6 py-3 rounded-xl transition-all duration-300 font-semibold flex items-center gap-3 group ${
                    currentLanguage === 'en-US'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/40 scale-105'
                      : 'bg-gray-900/80 text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700 hover:border-yellow-500/50 hover:scale-102'
                  }`}
                >
                  <span className="text-xl">🇺🇸</span>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold">English</span>
                    <span className={`text-xs ${currentLanguage === 'en-US' ? 'text-black/70' : 'text-gray-500'}`}>English (US)</span>
                  </div>
                  {currentLanguage === 'en-US' && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('settings.languageHint')}
              </p>
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

        {activeTab === 'backup' && (
          <div className="space-y-6">
            {/* 使用说明 - 优化后的版本 */}
            <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-yellow-500/40 rounded-xl p-6 shadow-2xl shadow-yellow-500/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl flex items-center justify-center border-2 border-yellow-500/40">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-yellow-400 tracking-wide">{t('settings.usageGuide')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 步骤 1 */}
                <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-black flex items-center justify-center text-lg font-bold shadow-lg shadow-yellow-500/30">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2">{t('settings.step1Title')}</h4>
                      <p
                        className="text-xs text-gray-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: t('settings.step1Desc') }}
                      />
                    </div>
                  </div>
                </div>

                {/* 步骤 2 */}
                <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-black flex items-center justify-center text-lg font-bold shadow-lg shadow-yellow-500/30">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2">{t('settings.step2Title')}</h4>
                      <p
                        className="text-xs text-gray-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: t('settings.step2Desc') }}
                      />
                    </div>
                  </div>
                </div>

                {/* 步骤 3 */}
                <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-black flex items-center justify-center text-lg font-bold shadow-lg shadow-yellow-500/30">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2">{t('settings.step3Title')}</h4>
                      <p
                        className="text-xs text-gray-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: t('settings.step3Desc') }}
                      />
                    </div>
                  </div>
                </div>

                {/* 步骤 4 */}
                <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-black flex items-center justify-center text-lg font-bold shadow-lg shadow-yellow-500/30">
                      4
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2">{t('settings.step4Title')}</h4>
                      <p
                        className="text-xs text-gray-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: t('settings.step4Desc') }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 快捷操作 */}
              <div className="mt-6 pt-6 border-t border-yellow-500/20">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold rounded-lg transition-all shadow-lg shadow-yellow-500/40 hover:shadow-yellow-500/60 flex items-center gap-2 hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {t('settings.goToDashboard')}
                </button>
              </div>
            </div>

            {/* 路径检测器 */}
            <ClaudeCodePathDetector onPathDetected={handlePathDetected} />

            {/* 权限警告 */}
            {claudeCodePath && !claudeCodePath.readable && (
              <div className="bg-gradient-to-br from-black via-gray-950 to-black border-2 border-red-500/50 rounded-xl p-6 shadow-lg shadow-red-500/20">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center border-2 border-red-500/40">
                    <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-400 mb-2">{t('settings.permissionDenied')}</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {t('settings.permissionDeniedDesc')}
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
          </div>
        )}

        {activeTab === 'environment' && <EnvironmentVariableManager />}

        {activeTab === 'modelMapping' && <ModelMappingManager />}
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

export default Settings;
