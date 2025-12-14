/**
 * 模型映射配置 Tauri 命令
 *
 * 提供前端调用的 IPC 接口
 */

use crate::models::error::AppResult;
use crate::models::model_mapping::*;
use crate::services::model_mapping_service::ModelMappingService;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// 模型映射服务状态
pub struct ModelMappingServiceState {
    service: Arc<Mutex<ModelMappingService>>,
}

impl ModelMappingServiceState {
    pub fn new(service: ModelMappingService) -> Self {
        Self {
            service: Arc::new(Mutex::new(service)),
        }
    }
}

/// 获取所有模型映射配置
#[tauri::command]
pub async fn list_model_mappings(
    source_model: Option<String>,
    target_model: Option<String>,
    direction: Option<String>,
    mapping_type: Option<String>,
    is_enabled: Option<bool>,
    is_custom: Option<bool>,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<Vec<ModelMapping>> {
    let query = ModelMappingQuery {
        source_model,
        target_model,
        direction: direction.and_then(|s| MappingDirection::from_str(&s).ok()),
        mapping_type: mapping_type.and_then(|s| MappingType::from_str(&s).ok()),
        is_enabled,
        is_custom,
    };

    let service = state.service.lock().await;
    service.list_model_mappings(Some(query)).await
}

/// 根据 ID 获取模型映射配置
#[tauri::command]
pub async fn get_model_mapping(
    id: i64,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<Option<ModelMapping>> {
    let service = state.service.lock().await;
    service.get_model_mapping(id).await
}

/// 创建模型映射配置
#[tauri::command]
pub async fn create_model_mapping(
    source_model: String,
    target_model: String,
    direction: String,
    source_provider: Option<String>,
    target_provider: Option<String>,
    priority: Option<i32>,
    description: Option<String>,
    notes: Option<String>,
    is_enabled: Option<bool>,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<ModelMapping> {
    let request = CreateModelMappingRequest {
        source_model,
        target_model,
        direction: MappingDirection::from_str(&direction).map_err(|e| {
            crate::models::error::AppError::ValidationError {
                field: "direction".to_string(),
                message: e,
            }
        })?,
        source_provider: source_provider.and_then(|s| ModelProvider::from_str(&s).ok()),
        target_provider: target_provider.and_then(|s| ModelProvider::from_str(&s).ok()),
        priority: priority.unwrap_or(50),
        description,
        notes,
        is_enabled: is_enabled.unwrap_or(true),
    };

    let service = state.service.lock().await;
    service.create_model_mapping(request).await
}

/// 更新模型映射配置
#[tauri::command]
pub async fn update_model_mapping(
    id: i64,
    target_model: Option<String>,
    priority: Option<i32>,
    description: Option<String>,
    notes: Option<String>,
    is_enabled: Option<bool>,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<ModelMapping> {
    let request = UpdateModelMappingRequest {
        target_model,
        priority,
        description,
        notes,
        is_enabled,
    };

    let service = state.service.lock().await;
    service.update_model_mapping(id, request).await
}

/// 删除模型映射配置
#[tauri::command]
pub async fn delete_model_mapping(
    id: i64,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<()> {
    let service = state.service.lock().await;
    service.delete_model_mapping(id).await
}

/// 批量删除模型映射配置
#[tauri::command]
pub async fn batch_delete_model_mappings(
    ids: Vec<i64>,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<usize> {
    let service = state.service.lock().await;
    service.batch_delete_model_mappings(ids).await
}

/// 导出模型映射配置
#[tauri::command]
pub async fn export_model_mappings(
    include_builtin: bool,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<ModelMappingExport> {
    let service = state.service.lock().await;
    service.export_model_mappings(include_builtin).await
}

/// 导入模型映射配置
#[tauri::command]
pub async fn import_model_mappings(
    export_json: String,
    overwrite_existing: bool,
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<(usize, usize)> {
    let export: ModelMappingExport = serde_json::from_str(&export_json).map_err(|e| {
        crate::models::error::AppError::ValidationError {
            field: "export_json".to_string(),
            message: format!("JSON 解析失败: {}", e),
        }
    })?;

    let service = state.service.lock().await;
    service.import_model_mappings(export, overwrite_existing).await
}

/// 重置为默认映射
#[tauri::command]
pub async fn reset_to_default_mappings(
    state: State<'_, ModelMappingServiceState>,
) -> AppResult<usize> {
    let service = state.service.lock().await;
    service.reset_to_default_mappings().await
}
