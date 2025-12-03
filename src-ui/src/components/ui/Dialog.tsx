/**
 * 通用弹窗组件
 * 提供确认弹窗、消息弹窗等 UI 组件
 * 符合项目黑金风格设计
 */

import { ReactNode, useEffect, useState } from 'react';

/** 弹窗类型 */
export type DialogType = 'confirm' | 'warning' | 'danger' | 'success' | 'info' | 'error';

/** 弹窗图标配置 */
const iconConfig: Record<DialogType, { icon: ReactNode; bgColor: string; borderColor: string }> = {
  confirm: {
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/20',
  },
  warning: {
    icon: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/20',
  },
  danger: {
    icon: (
      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/20',
  },
  success: {
    icon: (
      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/20',
  },
  info: {
    icon: (
      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/20',
  },
  error: {
    icon: (
      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/20',
  },
};

/** 确认按钮样式配置 */
const confirmButtonConfig: Record<DialogType, string> = {
  confirm: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20',
  warning: 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-yellow-500/20',
  danger: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/20',
  success: 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-500/20',
  info: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-500/20',
  error: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/20',
};

/** 确认弹窗属性 */
export interface ConfirmDialogProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 弹窗类型 */
  type?: DialogType;
  /** 标题 */
  title: string;
  /** 副标题 */
  subtitle?: string;
  /** 内容 - 可以是字符串或 React 节点 */
  content?: ReactNode;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 加载中文本 */
  loadingText?: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

/** 确认弹窗组件 */
export function ConfirmDialog({
  isOpen,
  type = 'confirm',
  title,
  subtitle,
  content,
  confirmText = '确认',
  cancelText = '取消',
  showCancel = true,
  isLoading = false,
  loadingText = '处理中...',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  const config = iconConfig[type];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl max-w-md w-full shadow-2xl border ${config.borderColor} overflow-hidden`}>
        {/* 头部 */}
        <div className={`bg-gradient-to-r from-gray-800/50 to-gray-900/50 px-6 py-4 border-b ${config.borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
              {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
            </div>
          </div>
        </div>

        {/* 内容 */}
        {content && (
          <div className="px-6 py-5">
            {typeof content === 'string' ? (
              <p className="text-gray-300">{content}</p>
            ) : (
              content
            )}
          </div>
        )}

        {/* 底部按钮 */}
        <div className={`px-6 py-4 bg-gray-900/30 border-t border-gray-700/50 flex justify-end gap-3`}>
          {showCancel && (
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg ${confirmButtonConfig[type]}`}
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {loadingText}
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 消息弹窗属性 */
export interface MessageDialogProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 弹窗类型 */
  type?: DialogType;
  /** 标题 */
  title: string;
  /** 内容 - 可以是字符串或 React 节点 */
  content?: ReactNode;
  /** 按钮文本 */
  buttonText?: string;
  /** 关闭回调 */
  onClose: () => void;
}

/** 消息弹窗组件 */
export function MessageDialog({
  isOpen,
  type = 'info',
  title,
  content,
  buttonText = '我知道了',
  onClose,
}: MessageDialogProps) {
  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const config = iconConfig[type];

  // 根据类型设置标题颜色
  const titleColorMap: Record<DialogType, string> = {
    confirm: 'text-amber-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400',
    success: 'text-green-400',
    info: 'text-blue-400',
    error: 'text-red-400',
  };

  // 按钮样式
  const buttonStyleMap: Record<DialogType, string> = {
    confirm: 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400',
    warning: 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400',
    success: 'bg-green-600/20 hover:bg-green-600/30 text-green-400',
    info: 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400',
    error: 'bg-red-600/20 hover:bg-red-600/30 text-red-400',
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl max-w-sm w-full shadow-2xl border ${config.borderColor} overflow-hidden`}>
        {/* 头部图标 */}
        <div className="pt-8 pb-4 flex justify-center">
          <div className={`w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center`}>
            <div className="scale-150">
              {config.icon}
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 pb-6 text-center">
          <h3 className={`text-xl font-semibold mb-2 ${titleColorMap[type]}`}>
            {title}
          </h3>
          {content && (
            typeof content === 'string' ? (
              <p className="text-gray-400">{content}</p>
            ) : (
              content
            )
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-900/30 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className={`w-full px-4 py-2.5 text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${buttonStyleMap[type]}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 导出弹窗 hook，用于简化状态管理 */
export interface UseConfirmDialogReturn {
  isOpen: boolean;
  show: () => void;
  hide: () => void;
  props: {
    isOpen: boolean;
    onCancel: () => void;
  };
}

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    show: () => setIsOpen(true),
    hide: () => setIsOpen(false),
    props: {
      isOpen,
      onCancel: () => setIsOpen(false),
    },
  };
}

/** 导出消息弹窗 hook */
export interface UseMessageDialogReturn {
  isOpen: boolean;
  show: () => void;
  hide: () => void;
  props: {
    isOpen: boolean;
    onClose: () => void;
  };
}

export function useMessageDialog(): UseMessageDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    show: () => setIsOpen(true),
    hide: () => setIsOpen(false),
    props: {
      isOpen,
      onClose: () => setIsOpen(false),
    },
  };
}
