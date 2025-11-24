/**
 * API 测试页面
 * 用于诊断后端 Tauri 命令是否正常工作
 */

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CompactLayout } from '../components/CompactLayout';

const TestApi: React.FC = () => {
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

    console.log('🔍 开始测试所有 API...');

    // 测试 1: get_proxy_status
    console.log('测试 1: get_proxy_status');
    try {
      await testApi('proxy_status', 'get_proxy_status');
      console.log('✅ proxy_status 成功');
    } catch (e) {
      console.error('❌ proxy_status 失败:', e);
    }

    // 测试 2: list_config_groups
    console.log('测试 2: list_config_groups');
    try {
      await testApi('config_groups', 'list_config_groups');
      console.log('✅ config_groups 成功');
    } catch (e) {
      console.error('❌ config_groups 失败:', e);
    }

    // 测试 3: list_api_configs
    console.log('测试 3: list_api_configs');
    try {
      await testApi('api_configs', 'list_api_configs', { groupId: null });
      console.log('✅ api_configs 成功');
    } catch (e) {
      console.error('❌ api_configs 失败:', e);
    }

    // 测试 4: get_switch_logs
    console.log('测试 4: get_switch_logs');
    try {
      await testApi('switch_logs', 'get_switch_logs', {
        groupId: null,
        limit: 5,
        offset: 0
      });
      console.log('✅ switch_logs 成功');
    } catch (e) {
      console.error('❌ switch_logs 失败:', e);
    }

    setTesting(false);
    console.log('✅ 所有测试完成');
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
                  测试中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  运行所有测试
                </>
              )}
            </button>
            {testing && (
              <div className="text-yellow-400 animate-pulse font-semibold flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                正在测试 API 调用...
              </div>
            )}
          </div>
        </div>

        {/* 测试结果 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-4 tracking-wide">测试结果</h2>

          {/* Test 1: proxy_status */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.proxy_status)}</span>
              <h3 className="text-lg font-bold text-white">1. get_proxy_status</h3>
            </div>
            {results.proxy_status && (
              <div className={`text-sm ${getStatusColor(results.proxy_status)}`}>
                {results.proxy_status.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.proxy_status.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">错误:</span> {results.proxy_status.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 2: config_groups */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.config_groups)}</span>
              <h3 className="text-lg font-bold text-white">2. list_config_groups</h3>
            </div>
            {results.config_groups && (
              <div className={`text-sm ${getStatusColor(results.config_groups)}`}>
                {results.config_groups.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.config_groups.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">错误:</span> {results.config_groups.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 3: api_configs */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.api_configs)}</span>
              <h3 className="text-lg font-bold text-white">3. list_api_configs</h3>
            </div>
            {results.api_configs && (
              <div className={`text-sm ${getStatusColor(results.api_configs)}`}>
                {results.api_configs.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.api_configs.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">错误:</span> {results.api_configs.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 4: switch_logs */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border border-gray-800 rounded-xl p-5 hover:border-yellow-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getStatusIcon(results.switch_logs)}</span>
              <h3 className="text-lg font-bold text-white">4. get_switch_logs</h3>
            </div>
            {results.switch_logs && (
              <div className={`text-sm ${getStatusColor(results.switch_logs)}`}>
                {results.switch_logs.success ? (
                  <pre className="bg-black border border-gray-800 p-4 rounded-lg overflow-x-auto text-gray-300 font-mono text-xs">
                    {JSON.stringify(results.switch_logs.data, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
                    <span className="font-bold">错误:</span> {results.switch_logs.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 font-medium mb-2">💡 使用说明</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• 点击"运行所有测试"按钮开始测试</li>
            <li>• 绿色 ✅ 表示测试成功，红色 ❌ 表示测试失败</li>
            <li>• 如果所有测试都通过，说明后端 API 正常工作</li>
            <li>• 如果有失败的测试，请查看错误信息并将其反馈给开发者</li>
          </ul>
        </div>
      </div>
    </CompactLayout>
  );
};

export default TestApi;
