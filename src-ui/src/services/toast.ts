/**
 * Toast 通知服务
 * 使用 react-hot-toast 提供统一的通知接口
 * 黑金风格设计
 */

import toast, { Toaster, ToastOptions, Renderable, ValueOrFunction, Toast } from 'react-hot-toast';

// 默认配置 - 黑金风格
const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'top-right',
};

// 创建自定义 Toaster 配置
export const toasterConfig = {
  position: 'top-right' as const,
  toastOptions: {
    // 基础样式
    style: {
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
      color: '#e5e7eb',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 191, 36, 0.1)',
      backdropFilter: 'blur(10px)',
      fontSize: '14px',
      fontWeight: '500',
      maxWidth: '400px',
    },
    // 成功样式
    success: {
      style: {
        background: 'linear-gradient(135deg, #0f2922 0%, #134e3a 50%, #0f2922 100%)',
        border: '1px solid rgba(34, 197, 94, 0.4)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.15)',
      },
      iconTheme: {
        primary: '#22c55e',
        secondary: '#0f2922',
      },
    },
    // 错误样式
    error: {
      style: {
        background: 'linear-gradient(135deg, #2a1215 0%, #450a0a 50%, #2a1215 100%)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15)',
      },
      iconTheme: {
        primary: '#ef4444',
        secondary: '#2a1215',
      },
    },
  },
  // 全局配置
  gutter: 12,
  containerStyle: {
    top: 20,
    right: 20,
  },
};

/**
 * 成功通知
 */
export const showSuccess = (message: string, options?: ToastOptions) => {
  return toast.success(message, {
    ...defaultOptions,
    duration: 3000,
    style: {
      background: 'linear-gradient(135deg, #0f2922 0%, #134e3a 50%, #0f2922 100%)',
      color: '#d1fae5',
      border: '1px solid rgba(34, 197, 94, 0.4)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.15)',
      fontSize: '14px',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#22c55e',
      secondary: '#0f2922',
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
    duration: 6000, // 错误消息显示更长时间
    style: {
      background: 'linear-gradient(135deg, #2a1215 0%, #450a0a 50%, #2a1215 100%)',
      color: '#fecaca',
      border: '1px solid rgba(239, 68, 68, 0.4)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15)',
      fontSize: '14px',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#2a1215',
    },
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
      background: 'linear-gradient(135deg, #292211 0%, #422006 50%, #292211 100%)',
      color: '#fef3c7',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.15)',
      fontSize: '14px',
      fontWeight: '500',
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
      background: 'linear-gradient(135deg, #0c1929 0%, #1e3a5f 50%, #0c1929 100%)',
      color: '#bfdbfe',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.15)',
      fontSize: '14px',
      fontWeight: '500',
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
    style: {
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
      color: '#e5e7eb',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 191, 36, 0.1)',
      fontSize: '14px',
      fontWeight: '500',
    },
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
  const baseStyle = {
    borderRadius: '12px',
    padding: '14px 18px',
    fontSize: '14px',
    fontWeight: '500',
  };

  if (type === 'success') {
    toast.success(message, {
      id: toastId,
      ...defaultOptions,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, #0f2922 0%, #134e3a 50%, #0f2922 100%)',
        color: '#d1fae5',
        border: '1px solid rgba(34, 197, 94, 0.4)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.15)',
      },
      iconTheme: {
        primary: '#22c55e',
        secondary: '#0f2922',
      },
      ...options,
    });
  } else if (type === 'error') {
    toast.error(message, {
      id: toastId,
      ...defaultOptions,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, #2a1215 0%, #450a0a 50%, #2a1215 100%)',
        color: '#fecaca',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15)',
      },
      iconTheme: {
        primary: '#ef4444',
        secondary: '#2a1215',
      },
      ...options,
    });
  } else {
    toast.loading(message, {
      id: toastId,
      ...defaultOptions,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        color: '#e5e7eb',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 191, 36, 0.1)',
      },
      ...options,
    });
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
      style: {
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        color: '#e5e7eb',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 191, 36, 0.1)',
        fontSize: '14px',
        fontWeight: '500',
      },
      success: {
        style: {
          background: 'linear-gradient(135deg, #0f2922 0%, #134e3a 50%, #0f2922 100%)',
          color: '#d1fae5',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.15)',
        },
        iconTheme: {
          primary: '#22c55e',
          secondary: '#0f2922',
        },
      },
      error: {
        style: {
          background: 'linear-gradient(135deg, #2a1215 0%, #450a0a 50%, #2a1215 100%)',
          color: '#fecaca',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15)',
        },
        iconTheme: {
          primary: '#ef4444',
          secondary: '#2a1215',
        },
      },
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

// 导出 toasterConfig 供 App.tsx 配置 Toaster
export { toasterConfig as ToasterConfig };

// 导出原始 toast 对象,以便访问更多功能
export { toast };
