/**
 * 配置备份列表组件
 * 显示备份列表和恢复按钮
 */

import React, { useEffect, useState } from 'react';
import {
  listClaudeCodeBackups,
  deleteClaudeCodeBackup,
  restoreClaudeCodeBackup,
  previewClaudeCodeBackup,
  clearAllClaudeCodeBackups,
} from '../api/claude-code';
import type { ConfigBackup } from '../types/tauri';

interface BackupListProps {
  /** 恢复成功回调 */
  onRestored?: () => void;
  /** 删除成功回调 */
  onDeleted?: () => void;
  /** 显示确认对话框 */
  onShowConfirm?: (action: 'restore' | 'delete' | 'clear', backup: ConfigBackup | null, callback: () => void) => void;
}

export const BackupList: React.FC<BackupListProps> = ({
  onRestored,
  onDeleted,
  onShowConfirm,
}) => {
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingId, setOperatingId] = useState<number | null>(null);
  const [previewBackup, setPreviewBackup] = useState<{ backup: ConfigBackup; content: string } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listClaudeCodeBackups();
      setBackups(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (backup: ConfigBackup) => {
    if (onShowConfirm) {
      onShowConfirm('restore', backup, () => doRestore(backup));
    } else {
      doRestore(backup);
    }
  };

  const doRestore = async (backup: ConfigBackup) => {
    try {
      setOperatingId(backup.id);
      setError(null);
      await restoreClaudeCodeBackup(backup.file_name);
      onRestored?.();
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复备份失败');
    } finally {
      setOperatingId(null);
    }
  };

  const handleDelete = (backup: ConfigBackup) => {
    if (onShowConfirm) {
      onShowConfirm('delete', backup, () => doDelete(backup));
    } else {
      doDelete(backup);
    }
  };

  const doDelete = async (backup: ConfigBackup) => {
    try {
      setOperatingId(backup.id);
      setError(null);
      await deleteClaudeCodeBackup(backup.file_name);
      onDeleted?.();
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除备份失败');
    } finally {
      setOperatingId(null);
    }
  };

  const handlePreview = async (backup: ConfigBackup) => {
    try {
      setError(null);
      const content = await previewClaudeCodeBackup(backup.file_name);
      setPreviewBackup({ backup, content });
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览备份失败');
    }
  };

  const handleClearAll = () => {
    if (onShowConfirm) {
      onShowConfirm('clear', null, () => doClearAll());
    } else {
      doClearAll();
    }
  };

  const doClearAll = async () => {
    try {
      setClearing(true);
      setError(null);
      const deletedCount = await clearAllClaudeCodeBackups();
      onDeleted?.();
      await loadBackups();
      // 可以添加成功提示
      console.log(`已删除 ${deletedCount} 个备份`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空备份失败');
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="bg-black border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-500 mb-4">配置备份</h3>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-500"></div>
          <span className="text-gray-400">加载备份列表...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-black border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-yellow-500">配置备份</h3>
          <div className="flex items-center space-x-2">
            {backups.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing || loading}
                className="text-sm px-3 py-1 bg-red-900/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded transition-colors disabled:opacity-50"
              >
                {clearing ? '清空中...' : '清空所有'}
              </button>
            )}
            <button
              onClick={loadBackups}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
            >
              刷新
            </button>
          </div>
        </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-900 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p className="text-sm text-red-400 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}

      {backups.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 text-gray-600 mx-auto mb-3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <p className="text-gray-400 text-sm">暂无配置备份</p>
          <p className="text-gray-500 text-xs mt-1">
            启用或禁用代理时会自动创建备份
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-white font-medium">{backup.reason}</span>
                    <span className="text-xs text-gray-500">
                      {formatFileSize(backup.file_size)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {formatDate(backup.backup_time)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                    {backup.file_name}
                  </p>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handlePreview(backup)}
                    className="p-1.5 hover:bg-blue-900/20 text-gray-400 hover:text-blue-400 rounded-lg transition-colors"
                    title="预览配置"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRestore(backup)}
                    disabled={operatingId === backup.id}
                    className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="恢复此备份"
                  >
                    {operatingId === backup.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                    ) : (
                      '恢复'
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(backup)}
                    disabled={operatingId === backup.id}
                    className="p-1.5 hover:bg-red-900/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="删除此备份"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* 预览对话框 */}
      {previewBackup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-yellow-500">配置预览</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {previewBackup.backup.reason} - {formatDate(previewBackup.backup.backup_time)}
                </p>
              </div>
              <button
                onClick={() => setPreviewBackup(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-gray-300 font-mono bg-black p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(JSON.parse(previewBackup.content), null, 2)}
              </pre>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-700">
              <button
                onClick={() => setPreviewBackup(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  handleRestore(previewBackup.backup);
                  setPreviewBackup(null);
                }}
                className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg transition-colors"
              >
                恢复此备份
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
