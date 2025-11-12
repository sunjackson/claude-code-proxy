/**
 * 代理状态 Hook
 * 监听 proxy-status-changed 事件并实时更新状态
 */

import { useState, useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { ProxyService } from '../types/tauri';
import * as proxyApi from '../api/proxy';

interface UseProxyStatusResult {
  /** 代理服务状态 */
  status: ProxyService | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新状态 */
  refresh: () => Promise<void>;
}

/**
 * 代理状态 Hook
 *
 * @returns 代理状态、加载状态、错误信息和刷新方法
 *
 * @example
 * ```tsx
 * const { status, loading, error, refresh } = useProxyStatus();
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 *
 * return (
 *   <div>
 *     <p>Status: {status?.status}</p>
 *     <button onClick={refresh}>Refresh</button>
 *   </div>
 * );
 * ```
 */
export function useProxyStatus(): UseProxyStatusResult {
  const [status, setStatus] = useState<ProxyService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载初始状态
  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const proxyStatus = await proxyApi.getProxyStatus();
      setStatus(proxyStatus);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取代理状态失败';
      setError(errorMessage);
      console.error('Failed to load proxy status:', err);
    } finally {
      setLoading(false);
    }
  };

  // 刷新状态
  const refresh = async () => {
    await loadStatus();
  };

  useEffect(() => {
    // 初始加载
    loadStatus();

    // 监听状态变化事件
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<ProxyService>('proxy-status-changed', (event) => {
          console.log('Received proxy-status-changed event:', event.payload);
          setStatus(event.payload);
          setError(null);
        });
      } catch (err) {
        console.error('Failed to setup proxy-status-changed listener:', err);
      }
    };

    setupListener();

    // 清理监听器
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return {
    status,
    loading,
    error,
    refresh,
  };
}
