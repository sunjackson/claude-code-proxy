/**
 * 健康检查命令
 * 提供健康检查调度器的 Tauri 命令
 */

use crate::db::DbPool;
use crate::models::health_check::ConfigHealthSummary;
use crate::services::health_check_scheduler::HealthCheckScheduler;
use crate::services::health_check_service::HealthCheckService;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// 健康检查调度器状态管理
pub struct HealthCheckState {
    scheduler: Arc<Mutex<Option<HealthCheckScheduler>>>,
}

impl HealthCheckState {
    pub fn new() -> Self {
        Self {
            scheduler: Arc::new(Mutex::new(None)),
        }
    }

    pub fn scheduler(&self) -> &Arc<Mutex<Option<HealthCheckScheduler>>> {
        &self.scheduler
    }
}

impl Default for HealthCheckState {
    fn default() -> Self {
        Self::new()
    }
}

/// 健康检查状态响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckStatusResponse {
    /// 是否运行中
    pub running: bool,
    /// 检查间隔（秒）
    pub interval_secs: u64,
}

/// 启动健康检查调度器
#[tauri::command]
pub async fn start_health_check(
    pool: State<'_, Arc<DbPool>>,
    health_state: State<'_, HealthCheckState>,
    interval_secs: Option<u64>,
) -> Result<HealthCheckStatusResponse, String> {
    let interval = interval_secs.unwrap_or(300); // 默认5分钟

    let mut scheduler_guard = health_state.scheduler().lock().await;

    // 如果已有调度器在运行，先停止它
    if let Some(ref scheduler) = *scheduler_guard {
        scheduler.stop().await.map_err(|e| e.to_string())?;
    }

    // 创建新的健康检查调度器
    let scheduler = HealthCheckScheduler::new(pool.inner().clone());

    // 设置检查间隔
    scheduler.set_interval(interval).await;

    // 启动调度器
    scheduler.start().await.map_err(|e| e.to_string())?;

    // 保存调度器实例
    *scheduler_guard = Some(scheduler);

    log::info!("健康检查已启动，间隔: {}秒", interval);

    Ok(HealthCheckStatusResponse {
        running: true,
        interval_secs: interval,
    })
}

/// 停止健康检查调度器
#[tauri::command]
pub async fn stop_health_check(
    health_state: State<'_, HealthCheckState>,
) -> Result<HealthCheckStatusResponse, String> {
    let mut scheduler_guard = health_state.scheduler().lock().await;

    if let Some(ref scheduler) = *scheduler_guard {
        scheduler.stop().await.map_err(|e| e.to_string())?;
    }

    *scheduler_guard = None;

    log::info!("健康检查已停止");

    Ok(HealthCheckStatusResponse {
        running: false,
        interval_secs: 300,
    })
}

/// 获取健康检查状态
#[tauri::command]
pub async fn get_health_check_status(
    health_state: State<'_, HealthCheckState>,
) -> Result<HealthCheckStatusResponse, String> {
    let scheduler_guard = health_state.scheduler().lock().await;

    if let Some(ref scheduler) = *scheduler_guard {
        let interval = scheduler.get_interval().await;
        let status = scheduler.status().await;
        let running =
            status == crate::services::health_check_scheduler::HealthCheckSchedulerStatus::Running;

        Ok(HealthCheckStatusResponse {
            running,
            interval_secs: interval,
        })
    } else {
        Ok(HealthCheckStatusResponse {
            running: false,
            interval_secs: 300,
        })
    }
}

/// 手动执行一次健康检查
#[tauri::command]
pub async fn run_health_check_now(
    pool: State<'_, Arc<DbPool>>,
    health_state: State<'_, HealthCheckState>,
) -> Result<(), String> {
    let scheduler_guard = health_state.scheduler().lock().await;

    if let Some(ref scheduler) = *scheduler_guard {
        // 使用已有的调度器执行检查
        scheduler.check_now().await.map_err(|e| e.to_string())
    } else {
        // 创建临时调度器执行检查
        let scheduler = HealthCheckScheduler::new(pool.inner().clone());
        scheduler.check_now().await.map_err(|e| e.to_string())
    }
}

/// 获取所有配置的健康检查摘要
#[tauri::command]
pub async fn get_health_check_summaries(
    pool: State<'_, Arc<DbPool>>,
    hours: Option<i64>,
) -> Result<Vec<ConfigHealthSummary>, String> {
    let hours = hours.unwrap_or(24);
    HealthCheckService::get_all_summaries(pool.inner(), hours).map_err(|e| e.to_string())
}

/// 切换自动健康检查状态
#[tauri::command]
pub async fn toggle_auto_health_check(
    pool: State<'_, Arc<DbPool>>,
    health_state: State<'_, HealthCheckState>,
    enabled: bool,
    interval_secs: Option<u64>,
) -> Result<HealthCheckStatusResponse, String> {
    let interval = interval_secs.unwrap_or(300);

    if enabled {
        start_health_check(pool, health_state, Some(interval)).await
    } else {
        stop_health_check(health_state).await
    }
}
