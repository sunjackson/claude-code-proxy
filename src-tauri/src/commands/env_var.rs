/**
 * 环境变量管理命令
 * 提供环境变量的查询、设置和应用功能
 */

use crate::models::error::AppResult;
use crate::services::env_var::EnvironmentVariableService;
use crate::services::ApiConfigService;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// 环境变量信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentVariable {
    /// 变量名
    pub key: String,
    /// 变量值
    pub value: String,
    /// 是否为 Anthropic 相关变量
    pub is_anthropic: bool,
}

/// 环境变量服务状态
pub struct EnvironmentVariableState {
    service: EnvironmentVariableService,
}

impl EnvironmentVariableState {
    pub fn new() -> Self {
        Self {
            service: EnvironmentVariableService::new(),
        }
    }

    pub fn service(&self) -> &EnvironmentVariableService {
        &self.service
    }
}

/// 列出所有环境变量
#[tauri::command]
pub fn list_environment_variables(
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<Vec<EnvironmentVariable>> {
    let service = state.service();
    let all_vars = service.list_all();

    let mut result: Vec<EnvironmentVariable> = all_vars
        .into_iter()
        .map(|(key, value)| {
            let is_anthropic = key.starts_with("ANTHROPIC_");
            EnvironmentVariable {
                key,
                value,
                is_anthropic,
            }
        })
        .collect();

    // 按变量名排序
    result.sort_by(|a, b| a.key.cmp(&b.key));

    Ok(result)
}

/// 获取指定的环境变量
#[tauri::command]
pub fn get_environment_variable(
    key: String,
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<Option<String>> {
    let service = state.service();
    service.get_env(&key)
}

/// 设置环境变量
#[tauri::command]
pub fn set_environment_variable(
    key: String,
    value: String,
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<()> {
    let service = state.service();
    service.set_env(&key, &value)
}

/// 删除环境变量
#[tauri::command]
pub fn unset_environment_variable(
    key: String,
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<()> {
    let service = state.service();
    service.unset_env(&key)
}

/// 从 API 配置应用环境变量
///
/// # 参数
/// - `config_id`: API 配置 ID
#[tauri::command]
pub async fn apply_config_to_env(
    config_id: i64,
    db_pool: State<'_, Arc<Mutex<Connection>>>,
    env_state: State<'_, EnvironmentVariableState>,
) -> AppResult<()> {
    // 获取 API 配置
    let db = db_pool.lock().await;
    let config = ApiConfigService::get_config_by_id(&db, config_id)?;
    drop(db);

    // 应用环境变量
    let env_service = env_state.service();
    env_service.apply_from_config(&config)?;

    Ok(())
}

/// 检查 Anthropic 环境变量是否已设置
#[tauri::command]
pub fn check_anthropic_env(
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<bool> {
    let service = state.service();
    service.check_anthropic_env()
}

/// 清除 Anthropic 相关环境变量
#[tauri::command]
pub fn clear_anthropic_env(
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<()> {
    let service = state.service();
    service.clear_anthropic_env()
}

/// 批量设置环境变量
///
/// # 参数
/// - `variables`: 环境变量键值对映射
#[tauri::command]
pub fn set_environment_variables(
    variables: HashMap<String, String>,
    state: State<'_, EnvironmentVariableState>,
) -> AppResult<()> {
    let service = state.service();

    for (key, value) in variables {
        service.set_env(&key, &value)?;
    }

    Ok(())
}
