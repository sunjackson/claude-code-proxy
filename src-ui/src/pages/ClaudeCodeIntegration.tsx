/**
 * Claude Code 集成页面
 * 管理 Claude Code 的本地代理配置
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClaudeCodePathDetector } from '../components/ClaudeCodePathDetector';
import { ProxyEnableToggle } from '../components/ProxyEnableToggle';
import { BackupList } from '../components/BackupList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AppLayout } from '../components/AppLayout';
import type { ClaudeCodePath, ConfigBackup } from '../types/tauri';

export const ClaudeCodeIntegration: React.FC = () => {
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

  const handleShowProxyConfirm = (
    action: 'enable' | 'disable',
    callback: () => void
  ) => {
    if (action === 'enable') {
      setConfirmDialog({
        isOpen: true,
        title: '启用本地代理',
        message:
          '此操作将修改 Claude Code 配置文件,将其代理设置为本地代理服务器 (127.0.0.1:25341)。修改前会自动创建配置备份,您可以随时恢复。',
        variant: 'default',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    } else {
      setConfirmDialog({
        isOpen: true,
        title: '禁用本地代理',
        message:
          '此操作将从 Claude Code 配置中移除代理设置,Claude Code 将恢复直连模式。修改前会自动创建配置备份。',
        variant: 'default',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    }
  };

  const handleShowBackupConfirm = (
    action: 'restore' | 'delete' | 'clear',
    backup: ConfigBackup | null,
    callback: () => void
  ) => {
    if (action === 'restore' && backup) {
      setConfirmDialog({
        isOpen: true,
        title: '恢复配置备份',
        message: `确定要恢复到备份 "${backup.reason}" (${new Date(
          backup.backup_time
        ).toLocaleString('zh-CN')}) 吗?当前配置将被覆盖。`,
        variant: 'default',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    } else if (action === 'delete' && backup) {
      setConfirmDialog({
        isOpen: true,
        title: '删除配置备份',
        message: `确定要删除备份 "${backup.reason}" 吗?此操作无法撤销。`,
        variant: 'danger',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          callback();
        },
      });
    } else if (action === 'clear') {
      setConfirmDialog({
        isOpen: true,
        title: '清空所有备份',
        message: '确定要删除所有配置备份吗?此操作将删除所有历史备份，且无法撤销。',
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

  const canEnableProxy =
    claudeCodePath &&
    (claudeCodePath.exists ? claudeCodePath.readable && claudeCodePath.writable : true);

  return (
    <AppLayout title={t('nav.claudeCode')} subtitle={t('claudeCode.subtitle')}>
      {/* 主要内容区域 */}
      <div className="space-y-6">
          {/* 路径检测器 */}
          <ClaudeCodePathDetector onPathDetected={handlePathDetected} />

          {/* 代理开关 - 仅在路径有效时显示 */}
          {canEnableProxy && (
            <ProxyEnableToggle
              onEnabled={() => {
                // 刷新备份列表
                window.location.reload();
              }}
              onDisabled={() => {
                // 刷新备份列表
                window.location.reload();
              }}
              onShowConfirm={handleShowProxyConfirm}
            />
          )}

          {/* 权限警告 */}
          {claudeCodePath && !canEnableProxy && (
            <div className="bg-black border border-red-900 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-6 h-6 text-red-500 mt-0.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-500 mb-2">
                    无法启用代理
                  </h3>
                  <p className="text-gray-400 mb-3">
                    Claude Code 配置文件权限不足,无法修改配置。请检查以下问题:
                  </p>
                  <ul className="space-y-1 text-sm text-gray-400 list-disc list-inside">
                    {!claudeCodePath.readable && (
                      <li>配置文件不可读,请检查文件权限</li>
                    )}
                    {!claudeCodePath.writable && (
                      <li>配置文件不可写,请检查文件权限</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 备份列表 */}
          <BackupList
            onRestored={() => {
              // 可以在这里添加成功提示
              console.log('配置已恢复');
            }}
            onDeleted={() => {
              // 可以在这里添加成功提示
              console.log('备份已删除');
            }}
            onShowConfirm={handleShowBackupConfirm}
          />

          {/* 使用说明 */}
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-500 mb-4">
              使用说明
            </h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <p>
                  <strong className="text-white">检测路径:</strong> 自动检测
                  Claude Code 配置文件路径和权限状态
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <p>
                  <strong className="text-white">启用代理:</strong> 修改 Claude
                  Code 配置,使其通过本地代理服务器 (127.0.0.1:25341) 连接 API
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <p>
                  <strong className="text-white">自动备份:</strong>{' '}
                  每次修改配置前会自动创建备份,可随时恢复
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <p>
                  <strong className="text-white">管理备份:</strong>{' '}
                  查看历史备份,随时恢复或删除
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
    </AppLayout>
  );
};

export default ClaudeCodeIntegration;
