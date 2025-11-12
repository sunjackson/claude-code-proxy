/**
 * useAutoSwitch Hook
 * 监听自动切换事件并显示通知
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface AutoSwitchEvent {
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

/**
 * 监听自动切换事件
 * @param onSwitch 切换发生时的回调函数
 */
export function useAutoSwitch(onSwitch?: (event: AutoSwitchEvent) => void) {
  useEffect(() => {
    // 监听 auto-switch-triggered 事件
    const unlisten = listen<AutoSwitchEvent>('auto-switch-triggered', (event) => {
      const data = event.payload;

      console.log('Auto-switch triggered:', data);

      // 调用回调函数
      if (onSwitch) {
        onSwitch(data);
      }

      // 显示 Toast 通知
      showToast(data);
    });

    // 清理监听器
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onSwitch]);
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
 * 在页面上显示 Toast 通知
 */
function showInPageToast(reasonText: string, event: AutoSwitchEvent) {
  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 z-50 max-w-md bg-gray-900 border border-amber-500/50 rounded-lg shadow-lg p-4 animate-slide-in';

  // Toast 内容
  toast.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 text-2xl">⚡</div>
      <div class="flex-1">
        <h4 class="font-semibold text-amber-400 mb-1">自动切换触发</h4>
        <p class="text-sm text-gray-300 mb-2">
          <span class="font-medium">${reasonText}</span>
        </p>
        <p class="text-xs text-gray-400">
          ${event.source_config_name} → <span class="text-amber-400">${event.target_config_name}</span>
        </p>
        ${event.latency_before_ms !== null && event.latency_after_ms !== null
          ? `<p class="text-xs text-gray-400 mt-1">
              延迟: ${event.latency_before_ms}ms → ${event.latency_after_ms}ms
            </p>`
          : ''
        }
      </div>
      <button class="flex-shrink-0 text-gray-400 hover:text-gray-300" onclick="this.parentElement.parentElement.remove()">
        ✕
      </button>
    </div>
  `;

  // 添加到页面
  document.body.appendChild(toast);

  // 3秒后自动移除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }, 5000);
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
