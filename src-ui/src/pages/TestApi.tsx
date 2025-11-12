/**
 * API 测试页面
 * 用于诊断后端 Tauri 命令是否正常工作
 */

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppLayout } from '../components/AppLayout';

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
    <AppLayout title="API 测试" subtitle="诊断后端 Tauri 命令">
      <div className="p-6 space-y-6">
        {/* 测试按钮 */}
        <div className="flex items-center gap-4">
          <button
            onClick={runAllTests}
            disabled={testing}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            {testing ? '测试中...' : '运行所有测试'}
          </button>
          {testing && (
            <div className="text-amber-400 animate-pulse">
              正在测试 API 调用...
            </div>
          )}
        </div>

        {/* 测试结果 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-amber-400">测试结果</h2>

          {/* Test 1: proxy_status */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getStatusIcon(results.proxy_status)}</span>
              <h3 className="text-lg font-medium text-white">1. get_proxy_status</h3>
            </div>
            {results.proxy_status && (
              <div className={`text-sm ${getStatusColor(results.proxy_status)}`}>
                {results.proxy_status.success ? (
                  <pre className="bg-gray-900 p-2 rounded overflow-x-auto">
                    {JSON.stringify(results.proxy_status.data, null, 2)}
                  </pre>
                ) : (
                  <div className="text-red-400">
                    错误: {results.proxy_status.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 2: config_groups */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getStatusIcon(results.config_groups)}</span>
              <h3 className="text-lg font-medium text-white">2. list_config_groups</h3>
            </div>
            {results.config_groups && (
              <div className={`text-sm ${getStatusColor(results.config_groups)}`}>
                {results.config_groups.success ? (
                  <pre className="bg-gray-900 p-2 rounded overflow-x-auto">
                    {JSON.stringify(results.config_groups.data, null, 2)}
                  </pre>
                ) : (
                  <div className="text-red-400">
                    错误: {results.config_groups.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 3: api_configs */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getStatusIcon(results.api_configs)}</span>
              <h3 className="text-lg font-medium text-white">3. list_api_configs</h3>
            </div>
            {results.api_configs && (
              <div className={`text-sm ${getStatusColor(results.api_configs)}`}>
                {results.api_configs.success ? (
                  <pre className="bg-gray-900 p-2 rounded overflow-x-auto">
                    {JSON.stringify(results.api_configs.data, null, 2)}
                  </pre>
                ) : (
                  <div className="text-red-400">
                    错误: {results.api_configs.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 4: switch_logs */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getStatusIcon(results.switch_logs)}</span>
              <h3 className="text-lg font-medium text-white">4. get_switch_logs</h3>
            </div>
            {results.switch_logs && (
              <div className={`text-sm ${getStatusColor(results.switch_logs)}`}>
                {results.switch_logs.success ? (
                  <pre className="bg-gray-900 p-2 rounded overflow-x-auto">
                    {JSON.stringify(results.switch_logs.data, null, 2)}
                  </pre>
                ) : (
                  <div className="text-red-400">
                    错误: {results.switch_logs.error}
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
    </AppLayout>
  );
};

export default TestApi;
