/**
 * Toast 通知服务
 * 使用 react-hot-toast 提供统一的通知接口
 */

import toast, { Toaster, ToastOptions, Renderable, ValueOrFunction, Toast } from 'react-hot-toast';

// 默认配置
const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#1F2937', // gray-800
    color: '#D1D5DB', // gray-300
    border: '1px solid rgba(255, 215, 0, 0.3)', // amber border
    borderRadius: '0.5rem',
    padding: '1rem',
  },
};

/**
 * 成功通知
 */
export const showSuccess = (message: string, options?: ToastOptions) => {
  return toast.success(message, {
    ...defaultOptions,
    icon: '✅',
    style: {
      ...defaultOptions.style,
      borderColor: 'rgba(16, 185, 129, 0.5)', // green
    },
    ...options,
  });
};

/**
 * 错误通知
 */
export const showError = (message: string, options?: ToastOptions) => {
  return toast.error(message, {
    ...defaultOptions,
    icon: '❌',
    style: {
      ...defaultOptions.style,
      borderColor: 'rgba(239, 68, 68, 0.5)', // red
    },
    duration: 6000, // 错误消息显示更长时间
    ...options,
  });
};

/**
 * 警告通知
 */
export const showWarning = (message: string, options?: ToastOptions) => {
  return toast(message, {
    ...defaultOptions,
    icon: '⚠️',
    style: {
      ...defaultOptions.style,
      borderColor: 'rgba(245, 158, 11, 0.5)', // yellow
    },
    ...options,
  });
};

/**
 * 信息通知
 */
export const showInfo = (message: string, options?: ToastOptions) => {
  return toast(message, {
    ...defaultOptions,
    icon: 'ℹ️',
    style: {
      ...defaultOptions.style,
      borderColor: 'rgba(59, 130, 246, 0.5)', // blue
    },
    ...options,
  });
};

/**
 * 加载中通知
 */
export const showLoading = (message: string, options?: ToastOptions) => {
  return toast.loading(message, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * 更新 toast
 */
export const updateToast = (
  toastId: string,
  message: string,
  type: 'success' | 'error' | 'loading',
  options?: ToastOptions
) => {
  if (type === 'success') {
    toast.success(message, { id: toastId, ...defaultOptions, ...options });
  } else if (type === 'error') {
    toast.error(message, { id: toastId, ...defaultOptions, ...options });
  } else {
    toast.loading(message, { id: toastId, ...defaultOptions, ...options });
  }
};

/**
 * 关闭 toast
 */
export const dismissToast = (toastId?: string) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};

/**
 * Promise toast
 * 自动根据 Promise 状态显示不同消息
 */
export const showPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: any) => string);
  },
  options?: ToastOptions
) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    {
      ...defaultOptions,
      ...options,
    }
  );
};

/**
 * 自定义 toast
 */
export const showCustom = (
  render: ValueOrFunction<Renderable, Toast>,
  options?: ToastOptions
) => {
  return toast.custom(render, {
    ...defaultOptions,
    ...options,
  });
};

// 导出 Toaster 组件供 App.tsx 使用
export { Toaster };

// 导出原始 toast 对象,以便访问更多功能
export { toast };
