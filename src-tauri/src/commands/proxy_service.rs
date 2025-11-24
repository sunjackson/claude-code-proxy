/**
 * Proxy Service Commands
 * Tauri commands for managing proxy service
 *
 * Commands:
 * - start_proxy_service: Start proxy server
 * - stop_proxy_service: Stop proxy server
 * - get_proxy_status: Get current status
 * - switch_proxy_group: Switch to different group
 * - switch_proxy_config: Switch to different configuration
 */

use crate::models::error::AppResult;
use crate::models::proxy_status::ProxyService as ProxyServiceModel;
use crate::services::proxy_service::ProxyService;
use std::sync::Arc;
use tauri::State;

/// Global proxy service state
#[derive(Clone)]
pub struct ProxyServiceState {
    service: Arc<ProxyService>,
}

impl ProxyServiceState {
    pub fn new(service: ProxyService) -> Self {
        Self {
            service: Arc::new(service),
        }
    }

    pub fn service(&self) -> &ProxyService {
        &self.service
    }
}

/// Start proxy service
///
/// Checks:
/// - Port availability (FR-025)
/// - Current group has available configurations
/// - Active configuration exists
///
/// # Returns
/// - ProxyServiceModel with current status
#[tauri::command]
pub async fn start_proxy_service(
    state: State<'_, ProxyServiceState>,
) -> AppResult<ProxyServiceModel> {
    log::info!("Command: start_proxy_service");
    state.service().start().await
}

/// Stop proxy service
///
/// # Returns
/// - ProxyServiceModel with current status
#[tauri::command]
pub async fn stop_proxy_service(
    state: State<'_, ProxyServiceState>,
) -> AppResult<ProxyServiceModel> {
    log::info!("Command: stop_proxy_service");
    state.service().stop().await
}

/// Get proxy service status
///
/// # Returns
/// - ProxyServiceModel with current status
#[tauri::command]
pub async fn get_proxy_status(
    state: State<'_, ProxyServiceState>,
) -> AppResult<ProxyServiceModel> {
    log::debug!("Command: get_proxy_status");
    state.service().get_status().await
}

/// Switch to different configuration group
///
/// - Switches to target group
/// - Automatically selects first available configuration
/// - Prevents switching to empty groups (FR-036)
///
/// # Arguments
/// - `group_id`: Target group ID
///
/// # Returns
/// - ProxyServiceModel with updated status
#[tauri::command]
pub async fn switch_proxy_group(
    group_id: i64,
    state: State<'_, ProxyServiceState>,
) -> AppResult<ProxyServiceModel> {
    log::info!("Command: switch_proxy_group (group_id: {})", group_id);
    state.service().switch_group(group_id).await
}

/// Switch to different configuration within current group
///
/// - Only allows switching to configurations in current group
/// - Records manual switch log (reason='manual')
///
/// # Arguments
/// - `config_id`: Target configuration ID
///
/// # Returns
/// - ProxyServiceModel with updated status
#[tauri::command]
pub async fn switch_proxy_config(
    config_id: i64,
    state: State<'_, ProxyServiceState>,
) -> AppResult<ProxyServiceModel> {
    log::info!("Command: switch_proxy_config (config_id: {})", config_id);

    // Manual switch log is recorded in ProxyService::switch_config
    state.service().switch_config(config_id).await
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;
    use crate::db::{initialize_database, DbPool};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_get_proxy_status() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        let service = ProxyService::new(db_pool);
        let state = ProxyServiceState::new(service);

        let status = get_proxy_status(State::from(&state))
            .await
            .expect("Failed to get status");

        assert_eq!(status.status, crate::models::proxy_status::ProxyStatus::Stopped);
    }
}
