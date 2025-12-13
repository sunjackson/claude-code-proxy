/**
 * API 测试页面
 * 用于诊断后端 Tauri 命令是否正常工作
 */

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { CompactLayout } from '../components/CompactLayout';

const TestApi: React.FC = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState(false);

  const testApi = async (name: string, command: string, args?: any) => {
    try {
      const result = await invoke(command, args);
      setResults(prev => ({
        ...prev,
        [name]: { success: true, data: result }
      }));
      return result;
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [name]: { success: false, error: error.toString() }
      }));
      throw error;
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setResults({});

    console.log('🔍 ' + t('testApi.startTesting'));

    // 测试 1: get_proxy_status
    console.log(t('testApi.test1'));
    try {
      await testApi('proxy_status', 'get_proxy_status');
      console.log('✅ ' + t('testApi.test1Success'));
    } catch (e) {
      console.error('❌ ' + t('testApi.test1Failed') + ':', e);
    }

    // 测试 2: list_config_groups
    console.log(t('testApi.test2'));
    try {
      await testApi('config_groups', 'list_config_groups');
      console.log('✅ ' + t('testApi.test2Success'));
    } catch (e) {
      console.error('❌ ' + t('testApi.test2Failed') + ':', e);
    }

    // 测试 3: list_api_configs
    console.log(t('testApi.test3'));
    try {
      await testApi('api_configs', 'list_api_configs', { groupId: null });
      console.log('✅ ' + t('testApi.test3Success'));
    } catch (e) {
      console.error('❌ ' + t('testApi.test3Failed') + ':', e);
    }

    // 测试 4: get_switch_logs
    console.log(t('testApi.test4'));
    try {
      await testApi('switch_logs', 'get_switch_logs', {
        groupId: null,
        limit: 5,
        offset: 0
      });
      console.log('✅ ' + t('testApi.test4Success'));
    } catch (e) {
      console.error('❌ ' + t('testApi.test4Failed') + ':', e);
    }

    setTesting(false);
    console.log('✅ ' + t('testApi.allTestsComplete'));
  };

  const getStatusIcon = (result: any) => {
    if (!result) return '⏳';
    return result.success ? '✅' : '❌';
  };

  const getStatusColor = (result: any) => {
    if (!result) return 'text-gray-400';
    return result.success ? 'text-green-400' : 'text-red-400';
  };

  return (
    <CompactLayout>
      <div className="space-y-6">
        {/* 测试按钮 */}
        <div className="bg-gradient-to-br from-black via-gray-950 to-black border border-yellow-500/30 rounded-xl p-6 shadow-lg shadow-yellow-500/5">
          <div className="flex items-center gap-4">
            <button
              onClick={runAllTests}
              disabled={testing}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-700 disabled:to-gray-800 text-black disabled:text-gray-500 rounded-lg font-bold transition-all duration-200 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 disabled:shadow-none flex items-center gap-2"
            >
              {testing ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.testing')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t('testApi.runAllTests')}
                </>
              )}
            </button>
            {testing && (
              <div className="text-yellow-400 animate-pulse font-semibold flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                {t('testApi.testingApi')}
              </div>
            )}
          </div>
        </div>

        {/* 测试结果 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-4 tracking-wide">{t('testApi.testResults')}</h2>

          {/* Test 1: proxy_status */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.proxy_status)}</span>
              <h3 className="text-lg font-bold text-white">{t('testApi.test1')}</h3>
            </div>
            {results.proxy_status && (
              <div className={`text-sm ${getStatusColor(results.proxy_status)}`}>
                {results.proxy_status.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.proxy_status.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">{t('common.error')}:</span> {results.proxy_status.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 2: config_groups */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.config_groups)}</span>
              <h3 className="text-lg font-bold text-white">{t('testApi.test2')}</h3>
            </div>
            {results.config_groups && (
              <div className={`text-sm ${getStatusColor(results.config_groups)}`}>
                {results.config_groups.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.config_groups.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">{t('common.error')}:</span> {results.config_groups.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 3: api_configs */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.api_configs)}</span>
              <h3 className="text-lg font-bold text-white">{t('testApi.test3')}</h3>
            </div>
            {results.api_configs && (
              <div className={`text-sm ${getStatusColor(results.api_configs)}`}>
                {results.api_configs.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.api_configs.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">{t('common.error')}:</span> {results.api_configs.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 4: switch_logs */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.switch_logs)}</span>
              <h3 className="text-lg font-bold text-white">{t('testApi.test4')}</h3>
            </div>
            {results.switch_logs && (
              <div className={`text-sm ${getStatusColor(results.switch_logs)}`}>
                {results.switch_logs.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.switch_logs.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">{t('common.error')}:</span> {results.switch_logs.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 font-medium mb-2">💡 {t('testApi.usageInstructions')}</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• {t('testApi.instruction1')}</li>
            <li>• {t('testApi.instruction2')}</li>
            <li>• {t('testApi.instruction3')}</li>
            <li>• {t('testApi.instruction4')}</li>
          </ul>
        </div>
      </div>
    </CompactLayout>
  );
};

export default TestApi;
