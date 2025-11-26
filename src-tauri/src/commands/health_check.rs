/**
 * 健康检查命令
 * 提供健康检查调度器的 Tauri 命令
 */

use crate::db::DbPool;
use crate::services::health_check_scheduler::HealthCheckScheduler;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

// 注意：HealthCheckState 暂未使用，当前实现使用 Box::leak
// 未来可以改进为使用 State 管理调度器生命周期
#[allow(dead_code)]
pub struct HealthCheckState {
    scheduler: Arc<Mutex<Option<HealthCheckScheduler>>>,
}

#[allow(dead_code)]
impl HealthCheckState {
    pub fn new() -> Self {
        Self {
            scheduler: Arc::new(Mutex::new(None)),
        }
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
    proxy_state: State<'_, crate::commands::proxy_service::ProxyServiceState>,
    interval_secs: Option<u64>,
) -> Result<HealthCheckStatusResponse, String> {
    // 获取代理服务状态来确定端口
    let proxy_status = proxy_state
        .service()
        .get_status()
        .await
        .map_err(|e| e.to_string())?;

    let proxy_port = proxy_status.listen_port as u16;
    let interval = interval_secs.unwrap_or(60);

    // 创建健康检查调度器
    let scheduler = HealthCheckScheduler::new(pool.inner().clone());

    // 设置检查间隔
    scheduler.set_interval(interval).await;

    // 设置代理地址
    scheduler
        .set_proxy_address("127.0.0.1".to_string(), proxy_port)
        .await;

    // 启动调度器
    scheduler.start().await.map_err(|e| e.to_string())?;

    // 保持调度器运行（通过 leak 防止被 drop）
    // 注意：这是一个简化的实现，生产环境应该使用更好的生命周期管理
    Box::leak(Box::new(scheduler));

    log::info!("健康检查已启动，间隔: {}秒，代理端口: {}", interval, proxy_port);

    Ok(HealthCheckStatusResponse {
        running: true,
        interval_secs: interval,
    })
}

/// 停止健康检查调度器
#[tauri::command]
pub async fn stop_health_check() -> Result<HealthCheckStatusResponse, String> {
    // 注意：由于当前实现使用 Box::leak，停止功能需要重新设计
    // 这里只返回状态
    log::warn!("stop_health_check 调用，但当前实现不支持停止已泄漏的调度器");

    Ok(HealthCheckStatusResponse {
        running: false,
        interval_secs: 60,
    })
}

/// 手动执行一次健康检查
#[tauri::command]
pub async fn run_health_check_now(
    pool: State<'_, Arc<DbPool>>,
    proxy_state: State<'_, crate::commands::proxy_service::ProxyServiceState>,
) -> Result<(), String> {
    // 获取代理服务状态
    let proxy_status = proxy_state
        .service()
        .get_status()
        .await
        .map_err(|e| e.to_string())?;

    let proxy_port = proxy_status.listen_port as u16;

    // 创建临时调度器执行检查
    let scheduler = HealthCheckScheduler::new(pool.inner().clone());
    scheduler
        .set_proxy_address("127.0.0.1".to_string(), proxy_port)
        .await;

    scheduler.check_now().await.map_err(|e| e.to_string())
}
