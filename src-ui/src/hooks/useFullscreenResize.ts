/**
 * useFullscreenResize Hook
 *
 * 监听全屏状态变化并触发回调
 */

import { useEffect } from 'react';

export const useFullscreenResize = (callback: () => void) => {
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout | null = null;

    const handleFullscreenChange = () => {
      // 延迟执行以确保 DOM 已更新
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        callback();
      }, 200);
    };

    // 监听各浏览器的全屏事件
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [callback]);
};
