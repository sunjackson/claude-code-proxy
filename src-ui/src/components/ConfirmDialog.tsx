/**
 * 确认对话框组件
 * 用于确认重要操作
 * 符合项目黑金风格设计
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 标题 */
  title: string;
  /** 描述信息 */
  message: string;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 危险操作样式 */
  variant?: 'default' | 'danger';
  /** 是否加载中 */
  isLoading?: boolean;
  /** 加载中文本 */
  loadingText?: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '',
  cancelText = '',
  variant = 'default',
  isLoading = false,
  loadingText = '',
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  // 使用翻译值作为默认值
  const finalConfirmText = confirmText || t('dialog.confirm');
  const finalCancelText = cancelText || t('dialog.cancel');
  const finalLoadingText = loadingText || t('common.loading');

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={isLoading ? undefined : onCancel}
      ></div>

      {/* 对话框内容 */}
      <div className={`relative bg-gradient-to-br from-gray-800 to-gray-900 border rounded-xl shadow-2xl max-w-md w-full overflow-hidden ${
        isDanger ? 'border-red-500/20' : 'border-amber-500/20'
      }`}>
        {/* 头部 */}
        <div className={`px-6 py-4 border-b ${isDanger ? 'border-red-500/20' : 'border-amber-500/20'}`}>
          <div className="flex items-center gap-3">
            {/* 图标 */}
            {isDanger ? (
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-300">{message}</p>
          </div>
        </div>

        {/* 按钮组 */}
        <div className="px-6 py-4 bg-gray-900/30 border-t border-gray-700/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {finalCancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg ${
              isDanger
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/20'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {finalLoadingText}
              </>
            ) : (
              finalConfirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
