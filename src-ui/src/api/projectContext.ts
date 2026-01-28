/**
 * 项目上下文 API
 * 获取项目的记忆、命令等上下文信息
 */

import { invoke } from '@tauri-apps/api/core';
import type { MemoryInfo, MemoryScope, ProjectContextInfo } from '../types/tauri';

/**
 * 获取项目完整上下文信息
 * @param projectPath 项目路径
 * @returns 项目上下文信息
 */
export async function getProjectContext(projectPath: string): Promise<ProjectContextInfo> {
  return invoke<ProjectContextInfo>('get_project_context', { projectPath });
}

/**
 * 列出项目记忆
 * @param projectPath 项目路径 (可选)
 * @returns 记忆列表
 */
export async function listProjectMemories(projectPath?: string): Promise<MemoryInfo[]> {
  return invoke<MemoryInfo[]>('list_project_memories', { projectPath });
}

/**
 * 读取记忆内容
 * @param name 记忆名称
 * @param scope 作用域
 * @param projectPath 项目路径 (项目级记忆需要)
 * @returns 记忆内容
 */
export async function readMemoryContent(
  name: string,
  scope: MemoryScope,
  projectPath?: string
): Promise<string> {
  return invoke<string>('read_memory_content', { name, scope, projectPath });
}

/**
 * 保存记忆内容
 * @param name 记忆名称
 * @param scope 作用域
 * @param content 内容
 * @param projectPath 项目路径 (项目级记忆需要)
 * @returns 更新后的记忆信息
 */
export async function saveMemoryContent(
  name: string,
  scope: MemoryScope,
  content: string,
  projectPath?: string
): Promise<MemoryInfo> {
  return invoke<MemoryInfo>('save_memory_content', { name, scope, content, projectPath });
}

/**
 * 删除记忆
 * @param name 记忆名称
 * @param scope 作用域
 * @param projectPath 项目路径 (项目级记忆需要)
 */
export async function deleteMemory(
  name: string,
  scope: MemoryScope,
  projectPath?: string
): Promise<void> {
  return invoke<void>('delete_memory', { name, scope, projectPath });
}

/**
 * 读取项目 CLAUDE.md 内容
 * @param projectPath 项目路径
 * @returns CLAUDE.md 内容 (如果不存在返回 null)
 */
export async function readProjectClaudeMd(projectPath: string): Promise<string | null> {
  return invoke<string | null>('read_project_claude_md', { projectPath });
}

/**
 * 保存项目 CLAUDE.md 内容
 * @param projectPath 项目路径
 * @param content 内容
 */
export async function saveProjectClaudeMd(projectPath: string, content: string): Promise<void> {
  return invoke<void>('save_project_claude_md', { projectPath, content });
}
