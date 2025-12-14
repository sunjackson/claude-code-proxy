/**
 * 模型映射配置 API 包装器
 * 封装与后端 Tauri 命令的交互
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ModelMapping,
  MappingDirection,
  MappingType,
  ModelMappingExport,
} from '../types/tauri';

/**
 * 获取所有模型映射配置
 */
export async function listModelMappings(params?: {
  sourceModel?: string;
  targetModel?: string;
  direction?: MappingDirection;
  mappingType?: MappingType;
  isEnabled?: boolean;
  isCustom?: boolean;
}): Promise<ModelMapping[]> {
  return await invoke('list_model_mappings', {
    sourceModel: params?.sourceModel || null,
    targetModel: params?.targetModel || null,
    direction: params?.direction || null,
    mappingType: params?.mappingType || null,
    isEnabled: params?.isEnabled ?? null,
    isCustom: params?.isCustom ?? null,
  });
}

/**
 * 根据 ID 获取模型映射配置
 */
export async function getModelMapping(id: number): Promise<ModelMapping | null> {
  return await invoke('get_model_mapping', { id });
}

/**
 * 创建模型映射配置
 */
export async function createModelMapping(params: {
  sourceModel: string;
  targetModel: string;
  direction: MappingDirection;
  sourceProvider?: string;
  targetProvider?: string;
  priority?: number;
  description?: string;
  notes?: string;
  isEnabled?: boolean;
}): Promise<ModelMapping> {
  return await invoke('create_model_mapping', {
    sourceModel: params.sourceModel,
    targetModel: params.targetModel,
    direction: params.direction,
    sourceProvider: params.sourceProvider || null,
    targetProvider: params.targetProvider || null,
    priority: params.priority ?? 50,
    description: params.description || null,
    notes: params.notes || null,
    isEnabled: params.isEnabled ?? true,
  });
}

/**
 * 更新模型映射配置
 */
export async function updateModelMapping(
  id: number,
  params: {
    targetModel?: string;
    priority?: number;
    description?: string;
    notes?: string;
    isEnabled?: boolean;
  }
): Promise<ModelMapping> {
  return await invoke('update_model_mapping', {
    id,
    targetModel: params.targetModel || null,
    priority: params.priority ?? null,
    description: params.description ?? null,
    notes: params.notes ?? null,
    isEnabled: params.isEnabled ?? null,
  });
}

/**
 * 删除模型映射配置
 */
export async function deleteModelMapping(id: number): Promise<void> {
  return await invoke('delete_model_mapping', { id });
}

/**
 * 批量删除模型映射配置
 */
export async function batchDeleteModelMappings(ids: number[]): Promise<number> {
  return await invoke('batch_delete_model_mappings', { ids });
}

/**
 * 导出模型映射配置
 */
export async function exportModelMappings(includeBuiltin: boolean): Promise<ModelMappingExport> {
  return await invoke('export_model_mappings', { includeBuiltin });
}

/**
 * 导入模型映射配置
 * @returns [成功数量, 跳过数量]
 */
export async function importModelMappings(
  exportJson: string,
  overwriteExisting: boolean
): Promise<[number, number]> {
  return await invoke('import_model_mappings', { exportJson, overwriteExisting });
}

/**
 * 重置为默认映射 (删除所有自定义映射)
 */
export async function resetToDefaultMappings(): Promise<number> {
  return await invoke('reset_to_default_mappings');
}
