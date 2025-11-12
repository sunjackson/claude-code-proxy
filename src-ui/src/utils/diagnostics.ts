/**
 * 诊断工具 - 测试 Tauri API 调用
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 测试所有关键的 Tauri 命令
 */
export async function runDiagnostics() {
  console.group('🔍 Claude Code Router 诊断测试');

  const results = {
    invoke_available: false,
    proxy_status: false,
    config_groups: false,
    api_configs: false,
    switch_logs: false,
  };

  // 测试 1: invoke 函数是否可用
  try {
    if (typeof invoke === 'function') {
      results.invoke_available = true;
      console.log('✅ invoke 函数可用');
    } else {
      console.error('❌ invoke 函数不可用');
    }
  } catch (error) {
    console.error('❌ invoke 检测失败:', error);
  }

  if (!results.invoke_available) {
    console.groupEnd();
    return results;
  }

  // 测试 2: get_proxy_status
  try {
    const proxyStatus = await invoke('get_proxy_status');
    results.proxy_status = true;
    console.log('✅ get_proxy_status:', proxyStatus);
  } catch (error: any) {
    console.error('❌ get_proxy_status 失败:', error);
  }

  // 测试 3: list_config_groups
  try {
    const groups = await invoke('list_config_groups');
    results.config_groups = true;
    console.log('✅ list_config_groups:', groups);
  } catch (error: any) {
    console.error('❌ list_config_groups 失败:', error);
  }

  // 测试 4: list_api_configs
  try {
    const configs = await invoke('list_api_configs', { groupId: null });
    results.api_configs = true;
    console.log('✅ list_api_configs:', configs);
  } catch (error: any) {
    console.error('❌ list_api_configs 失败:', error);
  }

  // 测试 5: get_switch_logs
  try {
    const logs = await invoke('get_switch_logs', {
      groupId: null,
      limit: 5,
      offset: 0
    });
    results.switch_logs = true;
    console.log('✅ get_switch_logs:', logs);
  } catch (error: any) {
    console.error('❌ get_switch_logs 失败:', error);
  }

  console.groupEnd();

  // 打印摘要
  const passedTests = Object.values(results).filter(r => r).length;
  const totalTests = Object.keys(results).length;
  console.log(`\n📊 诊断结果: ${passedTests}/${totalTests} 测试通过`);

  if (passedTests === totalTests) {
    console.log('✅ 所有测试通过！');
  } else {
    console.error('❌ 部分测试失败，请检查上述错误信息');
  }

  return results;
}

// 在开发环境下自动挂载到 window 对象
if (import.meta.env.DEV) {
  (window as any).runDiagnostics = runDiagnostics;
  console.log('💡 提示: 在控制台输入 runDiagnostics() 可运行诊断测试');
}
