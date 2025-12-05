import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, Download, X, ExternalLink } from 'lucide-react';

interface AppVersionInfo {
  current_version: string;
  latest_version: string | null;
  has_update: boolean;
  release_notes: string | null;
  download_url: string | null;
  release_page_url: string | null;
  published_at: string | null;
}

interface UpdateNotificationProps {
  onClose?: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 检查更新
  const checkForUpdates = async () => {
    try {
      const info = await invoke<AppVersionInfo>('check_app_updates');
      setVersionInfo(info);
      if (info.has_update) {
        setIsVisible(true);
        // 保存到 localStorage，避免重复提示
        const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
        if (dismissedVersion !== info.latest_version) {
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  };

  // 组件加载时检查更新
  useEffect(() => {
    // 延迟 5 秒后检查更新，避免影响启动速度
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // 关闭通知
  const handleDismiss = () => {
    if (versionInfo?.latest_version) {
      localStorage.setItem('dismissedUpdateVersion', versionInfo.latest_version);
    }
    setIsVisible(false);
    onClose?.();
  };

  // 打开发布页面
  const handleOpenReleasePage = async () => {
    try {
      await invoke('open_release_page');
    } catch (error) {
      console.error('打开发布页面失败:', error);
    }
  };

  // 下载更新（目前只是打开浏览器）
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await handleOpenReleasePage();
      handleDismiss();
    } catch (error) {
      console.error('下载更新失败:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isVisible || !versionInfo?.has_update) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 animate-slide-up">
      <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-lg shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <AlertCircle className="w-5 h-5 animate-pulse" />
            <span className="font-bold text-lg">发现新版本</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-3">
          {/* 版本信息 */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">当前版本</p>
              <p className="text-lg font-semibold text-gray-800">{versionInfo.current_version}</p>
            </div>
            <div className="text-2xl font-bold text-amber-500">→</div>
            <div>
              <p className="text-sm text-gray-600">最新版本</p>
              <p className="text-lg font-semibold text-amber-600">{versionInfo.latest_version}</p>
            </div>
          </div>

          {/* 发布说明 */}
          {versionInfo.release_notes && (
            <div className="bg-white rounded-lg p-3 max-h-32 overflow-y-auto border border-yellow-200">
              <p className="text-xs font-semibold text-gray-700 mb-1">更新说明：</p>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {versionInfo.release_notes.split('\n').slice(0, 5).join('\n')}
                {versionInfo.release_notes.split('\n').length > 5 && '...'}
              </div>
            </div>
          )}

          {/* 发布时间 */}
          {versionInfo.published_at && (
            <p className="text-xs text-gray-500">
              发布时间: {new Date(versionInfo.published_at).toLocaleString('zh-CN')}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? '正在打开...' : '立即下载'}</span>
            </button>
            <button
              onClick={handleOpenReleasePage}
              className="flex-1 bg-white hover:bg-gray-50 text-amber-600 font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 border border-amber-300 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>查看详情</span>
            </button>
          </div>

          {/* 稍后提醒 */}
          <button
            onClick={handleDismiss}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors"
          >
            稍后提醒
          </button>
        </div>
      </div>
    </div>
  );
};

// 在应用标题栏显示的简洁版本更新提示
export const UpdateBadge: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const version = await invoke<string>('get_app_version');
        setCurrentVersion(version);

        const info = await invoke<AppVersionInfo>('check_app_updates');
        const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
        setHasUpdate(info.has_update && dismissedVersion !== info.latest_version);
      } catch (error) {
        console.error('检查更新失败:', error);
      }
    };

    checkUpdate();
    // 每小时检查一次
    const interval = setInterval(checkUpdate, 3600000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = async () => {
    try {
      await invoke('open_release_page');
    } catch (error) {
      console.error('打开发布页面失败:', error);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-gray-500">v{currentVersion}</span>
      {hasUpdate && (
        <button
          onClick={handleClick}
          className="relative inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        >
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          新版本
        </button>
      )}
    </div>
  );
};
