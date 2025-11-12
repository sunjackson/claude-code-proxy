/**
 * 推荐服务命令
 * Tauri commands for recommended services functionality
 *
 * Commands:
 * - load_recommended_services: 加载推荐服务列表
 * - refresh_recommended_services: 强制刷新推荐服务列表
 */

use crate::models::error::AppResult;
use crate::models::recommended_service::RecommendedService;
use crate::services::recommendation::RecommendationService;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// 推荐服务状态
pub struct RecommendationServiceState {
    service: Arc<Mutex<RecommendationService>>,
}

impl RecommendationServiceState {
    /// 创建新的推荐服务状态
    pub fn new(
        remote_url: Option<String>,
        local_path: Option<PathBuf>,
        cache_ttl: u64,
    ) -> Self {
        let service = RecommendationService::new(remote_url, local_path, cache_ttl);
        Self {
            service: Arc::new(Mutex::new(service)),
        }
    }

    /// 获取服务实例
    pub fn service(&self) -> Arc<Mutex<RecommendationService>> {
        self.service.clone()
    }
}

/// 加载推荐服务列表
///
/// # Arguments
/// - `force_refresh`: 是否强制刷新，忽略缓存（默认 false）
///
/// # Returns
/// - Vec<RecommendedService>: 推荐服务列表
#[tauri::command]
pub async fn load_recommended_services(
    force_refresh: Option<bool>,
    state: State<'_, RecommendationServiceState>,
) -> AppResult<Vec<RecommendedService>> {
    log::info!(
        "Command: load_recommended_services (force_refresh: {:?})",
        force_refresh
    );

    let service = state.service();
    let service_lock = service.lock().await;
    let services = service_lock.load_services(force_refresh.unwrap_or(false)).await?;

    log::info!("成功加载 {} 个推荐服务", services.len());
    Ok(services)
}

/// 强制刷新推荐服务列表
///
/// # Returns
/// - Vec<RecommendedService>: 刷新后的推荐服务列表
#[tauri::command]
pub async fn refresh_recommended_services(
    state: State<'_, RecommendationServiceState>,
) -> AppResult<Vec<RecommendedService>> {
    log::info!("Command: refresh_recommended_services");

    let service = state.service();
    let service_lock = service.lock().await;

    // 清空缓存
    service_lock.clear_cache();

    // 重新加载
    let services = service_lock.load_services(true).await?;

    log::info!("成功刷新 {} 个推荐服务", services.len());
    Ok(services)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recommendation_service_state() {
        let state = RecommendationServiceState::new(None, None, 3600);
        assert!(state.service().try_lock().is_ok());
    }
}
