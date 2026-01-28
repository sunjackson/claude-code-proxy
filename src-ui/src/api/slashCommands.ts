/**
 * 斜杠命令 (Slash Commands) API
 * 适配 Claude Code 新版命令管理机制
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  CommandScope,
  SlashCommand,
  SlashCommandInfo,
  SlashCommandInput,
} from '../types/tauri';

/**
 * 列出所有斜杠命令
 * @param projectRoot 可选的项目根目录（用于获取项目级命令）
 */
export async function listSlashCommands(
  projectRoot?: string
): Promise<SlashCommandInfo[]> {
  return await invoke<SlashCommandInfo[]>('list_slash_commands', { projectRoot });
}

/**
 * 获取斜杠命令详情
 * @param name 命令名称
 * @param scope 命令作用域
 * @param projectRoot 项目根目录（项目级命令必需）
 */
export async function getSlashCommand(
  name: string,
  scope: CommandScope,
  projectRoot?: string
): Promise<SlashCommand> {
  return await invoke<SlashCommand>('get_slash_command', { name, scope, projectRoot });
}

/**
 * 创建斜杠命令
 * @param input 命令输入
 * @param projectRoot 项目根目录（项目级命令必需）
 */
export async function createSlashCommand(
  input: SlashCommandInput,
  projectRoot?: string
): Promise<SlashCommandInfo> {
  return await invoke<SlashCommandInfo>('create_slash_command', { input, projectRoot });
}

/**
 * 更新斜杠命令
 * @param input 命令输入
 * @param projectRoot 项目根目录（项目级命令必需）
 */
export async function updateSlashCommand(
  input: SlashCommandInput,
  projectRoot?: string
): Promise<SlashCommandInfo> {
  return await invoke<SlashCommandInfo>('update_slash_command', { input, projectRoot });
}

/**
 * 删除斜杠命令
 * @param name 命令名称
 * @param scope 命令作用域
 * @param projectRoot 项目根目录（项目级命令必需）
 */
export async function deleteSlashCommand(
  name: string,
  scope: CommandScope,
  projectRoot?: string
): Promise<void> {
  return await invoke<void>('delete_slash_command', { name, scope, projectRoot });
}

/**
 * 读取斜杠命令内容
 * @param name 命令名称
 * @param scope 命令作用域
 * @param projectRoot 项目根目录（项目级命令必需）
 */
export async function readSlashCommandBody(
  name: string,
  scope: CommandScope,
  projectRoot?: string
): Promise<string> {
  return await invoke<string>('read_slash_command_body', { name, scope, projectRoot });
}

/**
 * 从旧版 skills 迁移到新版 commands
 * @returns 迁移的技能名称列表
 */
export async function migrateSkillsToCommands(): Promise<string[]> {
  return await invoke<string[]>('migrate_skills_to_commands');
}

/**
 * 常用工具列表（用于 UI 选择）
 */
export const COMMON_TOOLS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'TodoWrite',
  'NotebookEdit',
  'LSP',
] as const;

/**
 * 可用模型列表
 */
export const AVAILABLE_MODELS = [
  { value: 'sonnet', label: 'Sonnet (推荐)', description: '平衡性能和成本' },
  { value: 'opus', label: 'Opus', description: '最强大，适合复杂任务' },
  { value: 'haiku', label: 'Haiku', description: '最快，适合简单任务' },
] as const;
