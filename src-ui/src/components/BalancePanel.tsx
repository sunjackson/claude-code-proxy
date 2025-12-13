/**
 * 余额查询面板组件
 * 显示和查询 API 配置的账户余额
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiConfig, BalanceInfo } from '../types/tauri';
import * as balanceApi from '../api/balance';
import { MessageDialog } from './ui/Dialog';

interface BalancePanelProps {
  /** 配置列表 */
  configs: ApiConfig[];
  /** 分组 ID (如果指定,则显示查询全部按钮) */
  groupId?: number | null;
  /** 刷新回调 */
  onRefresh?: () => void;
}

/**
 * 余额查询面板
 */
export const BalancePanel: React.FC<BalancePanelProps> = ({
  configs,
  groupId,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [balanceInfos, setBalanceInfos] = useState<Map<number, BalanceInfo>>(new Map());
  const [querying, setQuerying] = useState<Set<number>>(new Set());
  const [queryingAll, setQueryingAll] = useState(false);

  // 消息弹窗状态
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogType, setMessageDialogType] = useState<'error' | 'info'>('error');
  const [messageDialogTitle, setMessageDialogTitle] = useState('');
  const [messageDialogContent, setMessageDialogContent] = useState('');

  const showMessage = (type: 'error' | 'info', title: string, content: string) => {
    setMessageDialogType(type);
    setMessageDialogTitle(title);
    setMessageDialogContent(content);
    setMessageDialogOpen(true);
  };

  // 加载所有余额信息
  useEffect(() => {
    loadBalanceInfos();
  }, [configs]);

  const loadBalanceInfos = async () => {
    try {
      const allBalances = await balanceApi.getAllBalanceInfo();
      const balanceMap = new Map<number, BalanceInfo>();
      allBalances.forEach(info => {
        balanceMap.set(info.config_id, info);
      });
      setBalanceInfos(balanceMap);
    } catch (error) {
      console.error('加载余额信息失败:', error);
    }
  };

  // 查询单个配置的余额
  const handleQueryBalance = async (configId: number) => {
    setQuerying(prev => new Set(prev).add(configId));
    try {
      const result = await balanceApi.queryBalance(configId);
      setBalanceInfos(prev => new Map(prev).set(configId, result));
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error(`查询余额失败 (config_id: ${configId}):`, error);
      showMessage('error', t('balance.queryFailed'), error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setQuerying(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  // 查询全部余额（只查询启用了自动余额查询的配置）
  const handleQueryAll = async () => {
    // 过滤出启用了自动余额查询的配置
    const enabledConfigs = configs.filter(c => c.auto_balance_check && c.balance_query_url);

    if (enabledConfigs.length === 0) {
      showMessage('info', t('balance.noAvailableConfigs'), t('balance.noAutoBalanceEnabled'));
      return;
    }

    setQueryingAll(true);
    try {
      const results = await balanceApi.queryAllBalances();
      const balanceMap = new Map<number, BalanceInfo>();
      results.forEach(result => {
        balanceMap.set(result.config_id, result);
      });
      setBalanceInfos(balanceMap);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('批量查询余额失败:', error);
      showMessage('error', t('balance.batchQueryFailed'), error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setQueryingAll(false);
    }
  };

  // 格式化余额显示
  const formatBalance = (balance: number | null, currency: string | null): string => {
    if (balance === null || balance === undefined) {
      return '-';
    }

    const currencySymbols: Record<string, string> = {
      'CNY': '¥',
      'USD': '$',
      'EUR': '€',
      'JPY': '¥',
    };

    const symbol = currency ? currencySymbols[currency] || currency : '';
    return `${symbol}${balance.toFixed(2)}`;
  };

  // 获取余额颜色
  const getBalanceColor = (balance: number | null): string => {
    if (balance === null || balance === undefined) {
      return 'text-gray-400';
    }
    if (balance >= 10) {
      return 'text-green-400';
    } else if (balance >= 1) {
      return 'text-yellow-400';
    } else {
      return 'text-red-400';
    }
  };

  // 格式化时间显示
  const formatTime = (timestamp: string): string => {
    if (timestamp === '未查询') {
      return '-';
    }
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(t('common.locale'), {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'failed':
        return (
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return <div className="w-6 h-6 bg-gray-600 rounded-full" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部：标题 + 查询全部按钮 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-yellow-400">{t('balance.queryResult')}</h3>
        {groupId && configs.length > 0 && (() => {
          const enabledCount = configs.filter(c => c.auto_balance_check && c.balance_query_url).length;
          const hasEnabledConfigs = enabledCount > 0;

          return (
            <button
              onClick={handleQueryAll}
              disabled={queryingAll || !hasEnabledConfigs}
              className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              title={!hasEnabledConfigs ? t('balance.noAutoBalanceEnabled') : t('balance.queryCountConfigs', { count: enabledCount })}
            >
            {queryingAll ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('balance.querying')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('balance.queryAll')}
              </>
            )}
          </button>
          );
        })()}
      </div>

      {/* 配置列表 */}
      {configs.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-400">{t('common.noConfigs')}</p>
          <p className="mt-1 text-sm text-gray-500">{t('balance.pleaseAddConfig')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const balanceInfo = balanceInfos.get(config.id);
            const isQuerying = querying.has(config.id) || queryingAll;

            return (
              <div
                key={config.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-yellow-500/30 transition-all"
              >
                {/* 使用grid布局确保列对齐 */}
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* 状态图标 - 1列 */}
                  <div className="col-span-1 flex justify-center">
                    {isQuerying ? (
                      <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    ) : balanceInfo ? (
                      getStatusIcon(balanceInfo.status)
                    ) : (
                      <div className="w-6 h-6 bg-gray-600 rounded-full" />
                    )}
                  </div>

                  {/* 配置名称 - 4列 */}
                  <div className="col-span-4">
                    <div className="text-white font-medium truncate">{config.name}</div>
                    {config.balance_query_url && (
                      <div className="text-xs text-gray-500 truncate">{config.balance_query_url}</div>
                    )}
                  </div>

                  {/* 余额显示 - 3列 */}
                  <div className="col-span-3 text-center">
                    {balanceInfo && balanceInfo.balance !== null ? (
                      <div className={`font-mono font-semibold inline-block px-2.5 py-1 rounded-md ${getBalanceColor(balanceInfo.balance)}`}>
                        {formatBalance(balanceInfo.balance, balanceInfo.currency)}
                      </div>
                    ) : (
                      <div className="text-gray-500">-</div>
                    )}
                  </div>

                  {/* 查询状态 - 2列 */}
                  <div className="col-span-2 text-center">
                    {balanceInfo ? (
                      balanceInfo.status === 'success' ? (
                        <span className="inline-block px-2.5 py-1 bg-green-500/20 text-green-400 text-sm rounded-md border border-green-500/50">
                          {t('balance.success')}
                        </span>
                      ) : balanceInfo.status === 'failed' ? (
                        <span className="inline-block px-2.5 py-1 bg-red-500/20 text-red-400 text-sm rounded-md border border-red-500/50">
                          {t('balance.failed')}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 bg-gray-600/20 text-gray-500 text-sm rounded-md">
                          {t('balance.pending')}
                        </span>
                      )
                    ) : (
                      <span className="inline-block px-2.5 py-1 bg-gray-600/20 text-gray-500 text-sm rounded-md">
                        {t('balance.notQueried')}
                      </span>
                    )}
                  </div>

                  {/* 查询按钮 - 2列 */}
                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => handleQueryBalance(config.id)}
                      disabled={isQuerying || !config.balance_query_url || !config.auto_balance_check}
                      className={`px-3 py-1.5 rounded-md transition-colors text-sm border inline-flex items-center gap-1.5 ${
                        isQuerying
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 cursor-wait'
                          : config.balance_query_url && config.auto_balance_check
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20 hover:border-yellow-500/50'
                          : 'bg-gray-600/10 text-gray-500 border-gray-600/30 cursor-not-allowed'
                      }`}
                      title={
                        !config.balance_query_url
                          ? t('balance.noBalanceUrl')
                          : !config.auto_balance_check
                          ? t('balance.balanceQueryDisabledHint')
                          : t('balance.queryBalance')
                      }
                    >
                      {isQuerying ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('balance.querying')}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t('balance.query')}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 查询时间和错误信息（如果有） */}
                {balanceInfo && (
                  <div className="mt-2 pt-2 border-t border-gray-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('balance.lastQuery')}: {formatTime(balanceInfo.checked_at)}
                      </div>
                      {!config.auto_balance_check && (
                        <span className="inline-block px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded border border-orange-500/50">
                          {t('balance.balanceQueryDisabled')}
                        </span>
                      )}
                    </div>
                    {balanceInfo.error_message && (
                      <div className="text-xs text-red-400 flex items-start gap-1.5">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="flex-1">{balanceInfo.error_message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 消息弹窗 */}
      <MessageDialog
        isOpen={messageDialogOpen}
        type={messageDialogType}
        title={messageDialogTitle}
        content={messageDialogContent}
        onClose={() => setMessageDialogOpen(false)}
      />
    </div>
  );
};
