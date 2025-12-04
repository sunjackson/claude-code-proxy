/**
 * 自动刷新状态管理 Store
 * 管理各组件的自动刷新开关状态，确保切换页面后状态不会丢失
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HealthCheckStatusResponse } from '../types/tauri';

interface AutoRefreshState {
  // 服务商监控自动刷新
  monitorAutoRefresh: boolean;
  // 开发日志自动刷新
  devLogAutoRefresh: boolean;
  // 健康检查状态（从后端同步，非持久化）
  healthCheckStatus: HealthCheckStatusResponse | null;
  // 健康检查间隔（秒）
  healthCheckInterval: number;

  // 操作方法
  setMonitorAutoRefresh: (value: boolean) => void;
  setDevLogAutoRefresh: (value: boolean) => void;
  toggleMonitorAutoRefresh: () => void;
  toggleDevLogAutoRefresh: () => void;
  setHealthCheckStatus: (status: HealthCheckStatusResponse | null) => void;
  setHealthCheckInterval: (interval: number) => void;
}

/**
 * 自动刷新状态 Store
 * 使用 persist 中间件将状态持久化到 localStorage
 */
export const useAutoRefreshStore = create<AutoRefreshState>()(
  persist(
    (set) => ({
      // 初始状态
      monitorAutoRefresh: false,
      devLogAutoRefresh: true,
      healthCheckStatus: null,
      healthCheckInterval: 300, // 默认5分钟

      // 设置服务商监控自动刷新
      setMonitorAutoRefresh: (value) => set({ monitorAutoRefresh: value }),

      // 设置开发日志自动刷新
      setDevLogAutoRefresh: (value) => set({ devLogAutoRefresh: value }),

      // 切换服务商监控自动刷新
      toggleMonitorAutoRefresh: () =>
        set((state) => ({ monitorAutoRefresh: !state.monitorAutoRefresh })),

      // 切换开发日志自动刷新
      toggleDevLogAutoRefresh: () =>
        set((state) => ({ devLogAutoRefresh: !state.devLogAutoRefresh })),

      // 设置健康检查状态
      setHealthCheckStatus: (status) => set({ healthCheckStatus: status }),

      // 设置健康检查间隔
      setHealthCheckInterval: (interval) => set({ healthCheckInterval: interval }),
    }),
    {
      name: 'auto-refresh-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // 只持久化这些字段，healthCheckStatus 不持久化（需要从后端获取实际状态）
      partialize: (state) => ({
        monitorAutoRefresh: state.monitorAutoRefresh,
        devLogAutoRefresh: state.devLogAutoRefresh,
        healthCheckInterval: state.healthCheckInterval,
      }),
    }
  )
);
