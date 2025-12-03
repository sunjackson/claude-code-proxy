/**
 * useAutoSwitch Hook
 * 监听自动切换事件并显示通知，提供切换状态供组件使用
 */

import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

export interface AutoSwitchEvent {
  group_id: number;
  group_name: string;
  source_config_id: number;
  source_config_name: string;
  target_config_id: number;
  target_config_name: string;
  reason: string;
  latency_before_ms: number | null;
  latency_after_ms: number | null;
}

export interface SwitchState {
  /** 是否刚刚发生了切换 */
  justSwitched: boolean;
  /** 切换来源配置ID */
  sourceConfigId: number | null;
  /** 切换目标配置ID */
  targetConfigId: number | null;
  /** 切换原因 */
  reason: string | null;
  /** 切换事件详情 */
  event: AutoSwitchEvent | null;
}

/**
 * 监听自动切换事件
 * @param onSwitch 切换发生时的回调函数
 * @returns 切换状态对象
 */
export function useAutoSwitch(onSwitch?: (event: AutoSwitchEvent) => void): SwitchState {
  const [switchState, setSwitchState] = useState<SwitchState>({
    justSwitched: false,
    sourceConfigId: null,
    targetConfigId: null,
    reason: null,
    event: null,
  });

  // 清除切换状态的函数
  const clearSwitchState = useCallback(() => {
    setSwitchState({
      justSwitched: false,
      sourceConfigId: null,
      targetConfigId: null,
      reason: null,
      event: null,
    });
  }, []);

  useEffect(() => {
    // 监听 auto-switch-triggered 事件
    const unlisten = listen<AutoSwitchEvent>('auto-switch-triggered', (event) => {
      const data = event.payload;

      console.log('Auto-switch triggered:', data);

      // 更新切换状态
      setSwitchState({
        justSwitched: true,
        sourceConfigId: data.source_config_id,
        targetConfigId: data.target_config_id,
        reason: data.reason,
        event: data,
      });

      // 调用回调函数
      if (onSwitch) {
        onSwitch(data);
      }

      // 显示 Toast 通知
      showToast(data);

      // 5秒后清除切换状态（与动画时间匹配）
      setTimeout(clearSwitchState, 5000);
    });

    // 清理监听器
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onSwitch, clearSwitchState]);

  return switchState;
}

/**
 * 显示 Toast 通知
 */
function showToast(event: AutoSwitchEvent) {
  // 获取原因的中文文本
  const reasonText = getReasonText(event.reason);

  // 构建通知消息
  let message = `自动切换: ${reasonText}\n`;
  message += `${event.source_config_name} → ${event.target_config_name}`;

  // 如果有延迟信息,显示延迟变化
  if (event.latency_before_ms !== null && event.latency_after_ms !== null) {
    const change = event.latency_after_ms - event.latency_before_ms;
    const sign = change > 0 ? '+' : '';
    message += `\n延迟: ${event.latency_before_ms}ms → ${event.latency_after_ms}ms (${sign}${change}ms)`;
  }

  // 使用浏览器原生通知API
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('代理配置自动切换', {
      body: message,
      icon: '/icon.png', // 可以根据实际情况调整
    });
  } else {
    // 降级为控制台日志
    console.info('Auto-switch notification:', message);
  }

  // 同时在页面上显示 Toast (简单实现)
  showInPageToast(reasonText, event);
}

/**
 * 在页面上显示 Toast 通知（增强版）
 */
function showInPageToast(reasonText: string, event: AutoSwitchEvent) {
  // 移除已存在的 toast
  const existingToast = document.getElementById('auto-switch-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.id = 'auto-switch-toast';
  toast.className = 'fixed top-4 right-4 z-[9999] max-w-sm animate-slide-in';

  // 计算延迟变化
  let latencyInfo = '';
  let latencyColor = 'text-gray-400';
  if (event.latency_before_ms !== null && event.latency_after_ms !== null) {
    const improvement = event.latency_before_ms - event.latency_after_ms;
    if (improvement > 0) {
      latencyInfo = `延迟优化 ${improvement}ms`;
      latencyColor = 'text-green-400';
    } else if (improvement < 0) {
      latencyInfo = `延迟增加 ${Math.abs(improvement)}ms`;
      latencyColor = 'text-orange-400';
    }
  }

  // Toast 内容（增强版样式）
  toast.innerHTML = `
    <div class="bg-gradient-to-br from-gray-900 via-gray-900 to-black border-2 border-yellow-500/60 rounded-xl shadow-2xl shadow-yellow-500/20 overflow-hidden">
      <!-- 顶部进度条 -->
      <div class="h-1 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 animate-shrink-width"></div>

      <div class="p-4">
        <div class="flex items-start gap-3">
          <!-- 闪电图标 -->
          <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 animate-pulse">
            <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <!-- 标题 -->
            <div class="flex items-center gap-2 mb-2">
              <h4 class="font-bold text-yellow-400">自动切换完成</h4>
              <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                ${reasonText}
              </span>
            </div>

            <!-- 切换详情 -->
            <div class="flex items-center gap-2 text-sm mb-2">
              <span class="text-gray-500 line-through truncate max-w-[100px]">${event.source_config_name}</span>
              <svg class="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span class="text-yellow-400 font-bold truncate max-w-[100px]">${event.target_config_name}</span>
            </div>

            <!-- 延迟信息 -->
            ${latencyInfo ? `
              <div class="flex items-center gap-1.5 text-xs ${latencyColor}">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>${latencyInfo}</span>
              </div>
            ` : ''}
          </div>

          <!-- 关闭按钮 -->
          <button
            class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            onclick="this.closest('#auto-switch-toast').remove()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes shrink-width {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }
    .animate-slide-in {
      animation: slide-in 0.3s ease-out forwards;
    }
    .animate-shrink-width {
      animation: shrink-width 6s linear forwards;
    }
  `;

  // 检查是否已添加样式
  if (!document.getElementById('auto-switch-toast-styles')) {
    style.id = 'auto-switch-toast-styles';
    document.head.appendChild(style);
  }

  // 添加到页面
  document.body.appendChild(toast);

  // 6秒后自动移除（与进度条动画同步）
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }
  }, 6000);
}

/**
 * 获取原因的中文文本
 */
function getReasonText(reason: string): string {
  switch (reason) {
    case 'connection_failed':
      return '连接失败';
    case 'timeout':
      return '请求超时';
    case 'quota_exceeded':
      return 'API配额耗尽';
    case 'high_latency':
      return '高延迟';
    case 'manual':
      return '手动切换';
    case 'retry_failed':
      return '重试失败';
    case 'unrecoverable_error':
      return '不可恢复错误';
    case 'rate_limit_exceeded':
      return '限流超限';
    default:
      return '未知原因';
  }
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}
