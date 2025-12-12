/**
 * 环境设置和 Claude Code 安装相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  EnvironmentStatus,
  EnhancedEnvironmentStatus,
  NodeEnvironmentConfig,
  InstallOptions,
  InstallProgress,
  InstallMethod,
  VersionInfo,
} from '../types/tauri';

/**
 * 检测系统环境
 */
export async function detectEnvironment(): Promise<EnvironmentStatus> {
  return await invoke<EnvironmentStatus>('detect_environment');
}

/**
 * 安装 Claude Code
 * @param options 安装选项
 * @param onProgress 进度回调
 */
export async function installClaudeCode(
  options: InstallOptions,
  onProgress?: (progress: InstallProgress) => void
): Promise<void> {
  // 监听安装进度事件
  if (onProgress) {
    const unlisten = await listen<InstallProgress>('install-progress', (event) => {
      onProgress(event.payload);
    });

    try {
      await invoke<void>('install_claude_code', { options });
    } finally {
      unlisten();
    }
  } else {
    await invoke<void>('install_claude_code', { options });
  }
}

/**
 * 运行 claude doctor
 */
export async function runClaudeDoctor(): Promise<string> {
  return await invoke<string>('run_claude_doctor');
}

/**
 * 获取 Claude Code 版本
 */
export async function getClaudeVersion(): Promise<string> {
  return await invoke<string>('get_claude_version');
}

/**
 * 验证 Claude Code 安装
 */
export async function verifyClaudeInstallation(): Promise<boolean> {
  return await invoke<boolean>('verify_claude_installation');
}

/**
 * 卸载 Claude Code
 * @param method 安装方式
 */
export async function uninstallClaudeCode(method: InstallMethod): Promise<void> {
  return await invoke<void>('uninstall_claude_code', { method });
}

/**
 * 生成环境报告
 */
export async function generateEnvironmentReport(): Promise<string> {
  return await invoke<string>('generate_environment_report');
}

/**
 * 检查是否可以安装
 * @returns [可以安装, 缺失的依赖列表]
 */
export async function checkCanInstall(): Promise<[boolean, string[]]> {
  return await invoke<[boolean, string[]]>('check_can_install');
}

/**
 * 检查 Claude Code 更新
 */
export async function checkForUpdates(): Promise<VersionInfo> {
  return await invoke<VersionInfo>('check_for_updates');
}

/**
 * 更新 Claude Code
 * @param method 安装方式
 * @param onProgress 进度回调
 */
export async function updateClaudeCode(
  method: InstallMethod,
  onProgress?: (progress: InstallProgress) => void
): Promise<void> {
  // 监听安装进度事件
  if (onProgress) {
    const unlisten = await listen<InstallProgress>('install-progress', (event) => {
      onProgress(event.payload);
    });

    try {
      await invoke<void>('update_claude_code', { method });
    } finally {
      unlisten();
    }
  } else {
    await invoke<void>('update_claude_code', { method });
  }
}

// ============================================
// 多环境检测相关 API
// ============================================

/**
 * 增强的环境检测（支持多 Node 环境）
 */
export async function detectEnvironmentEnhanced(): Promise<EnhancedEnvironmentStatus> {
  return await invoke<EnhancedEnvironmentStatus>('detect_environment_enhanced');
}

/**
 * 设置默认 Node 环境
 * @param envId 环境唯一标识
 * @param nodePath Node 可执行文件路径
 * @param nodeVersion Node 版本
 * @param managerType 版本管理器类型
 */
export async function setDefaultNodeEnvironment(
  envId: string,
  nodePath: string,
  nodeVersion: string,
  managerType: string
): Promise<void> {
  return await invoke<void>('set_default_node_environment', {
    envId,
    nodePath,
    nodeVersion,
    managerType,
  });
}

/**
 * 获取默认 Node 环境配置
 */
export async function getDefaultNodeEnvironment(): Promise<NodeEnvironmentConfig | null> {
  return await invoke<NodeEnvironmentConfig | null>('get_default_node_environment');
}

/**
 * 检查是否可以安装（增强版）
 * @returns [可以安装, 缺失的依赖列表]
 */
export async function checkCanInstallEnhanced(): Promise<[boolean, string[]]> {
  return await invoke<[boolean, string[]]>('check_can_install_enhanced');
}

/**
 * 检查系统是否已完成初始配置
 */
export async function checkSystemConfigured(): Promise<boolean> {
  return await invoke<boolean>('check_system_configured');
}
