/**
 * Skills 配置相关 API
 */

import { invoke } from '@tauri-apps/api/core';
import type { SkillInfo, SkillDefinition } from '../types/tauri';

/**
 * 列出所有技能
 */
export async function listSkills(): Promise<SkillInfo[]> {
  return await invoke<SkillInfo[]>('list_skills');
}

/**
 * 添加技能
 * @param name 技能名称
 * @param promptContent 提示词内容
 * @param description 技能描述
 */
export async function addSkill(
  name: string,
  promptContent: string,
  description?: string
): Promise<void> {
  return await invoke<void>('add_skill', { name, promptContent, description });
}

/**
 * 更新技能
 * @param name 技能名称
 * @param promptContent 提示词内容
 * @param description 技能描述
 * @param enabled 是否启用
 */
export async function updateSkill(
  name: string,
  promptContent?: string,
  description?: string,
  enabled?: boolean
): Promise<void> {
  return await invoke<void>('update_skill', { name, promptContent, description, enabled });
}

/**
 * 删除技能
 * @param name 技能名称
 */
export async function removeSkill(name: string): Promise<void> {
  return await invoke<void>('remove_skill', { name });
}

/**
 * 读取技能提示词内容
 * @param name 技能名称
 */
export async function readSkillPrompt(name: string): Promise<string> {
  return await invoke<string>('read_skill_prompt', { name });
}

/**
 * 批量导入技能
 * @param skills 技能配置映射
 */
export async function importSkills(skills: Record<string, SkillDefinition>): Promise<void> {
  return await invoke<void>('import_skills', { skills });
}

/**
 * 导出技能配置
 */
export async function exportSkills(): Promise<Record<string, SkillDefinition>> {
  return await invoke<Record<string, SkillDefinition>>('export_skills');
}
