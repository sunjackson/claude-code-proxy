/**
 * 确认对话框组件
 * 用于确认重要操作
 */

import React from 'react';

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
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      ></div>

      {/* 对话框内容 */}
      <div className="relative bg-black border-2 border-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* 图标 */}
        <div className="flex items-center justify-center mb-4">
          {isDanger ? (
            <div className="w-12 h-12 rounded-full bg-red-900/30 border-2 border-red-900 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-yellow-900/30 border-2 border-yellow-900 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          )}
        </div>

        {/* 标题 */}
        <h3 className="text-xl font-bold text-center mb-3 text-white">
          {title}
        </h3>

        {/* 消息内容 */}
        <p className="text-center text-gray-400 mb-6 leading-relaxed">
          {message}
        </p>

        {/* 按钮组 */}
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black font-semibold focus:ring-yellow-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}} />
    </div>
  );
};
