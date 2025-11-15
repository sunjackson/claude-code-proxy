/**
 * API Test Commands
 * Tauri commands for testing API configurations
 *
 * Commands:
 * - test_api_config: Test single configuration
 * - test_group_configs: Test all configurations in a group
 */

use crate::db::DbPool;
use crate::models::error::AppResult;
use crate::models::test_result::TestResult;
use crate::services::api_test::ApiTestService;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// Test single API configuration
///
/// # Arguments
/// - `config_id`: API configuration ID
///
/// # Returns
/// - TestResult with latency and status
#[tauri::command]
pub async fn test_api_config(
    config_id: i64,
    app_handle: AppHandle,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<TestResult> {
    log::info!("Command: test_api_config (config_id: {})", config_id);

    let service = ApiTestService::new(db_pool.inner().clone());
    service.set_app_handle(app_handle).await;
    service.test_single_config(config_id).await
}

/// Test all configurations in a group
///
/// Tests configurations in parallel for better performance
///
/// # Arguments
/// - `group_id`: Configuration group ID
///
/// # Returns
/// - Vec<TestResult> with results for all configurations
#[tauri::command]
pub async fn test_group_configs(
    group_id: i64,
    app_handle: AppHandle,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<Vec<TestResult>> {
    log::info!("Command: test_group_configs (group_id: {})", group_id);

    let service = ApiTestService::new(db_pool.inner().clone());
    service.set_app_handle(app_handle).await;
    service.test_group_configs(group_id).await
}

/// Get recent test results for a configuration
///
/// # Arguments
/// - `config_id`: API configuration ID
/// - `limit`: Maximum number of results to return
///
/// # Returns
/// - Vec<TestResult> with recent test results
#[tauri::command]
pub fn get_test_results(
    config_id: i64,
    limit: Option<i32>,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<Vec<TestResult>> {
    log::debug!("Command: get_test_results (config_id: {}, limit: {:?})", config_id, limit);

    let service = ApiTestService::new(db_pool.inner().clone());
    service.get_recent_test_results(config_id, limit.unwrap_or(10))
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;
    use crate::db::initialize_database;

    #[tokio::test]
    async fn test_commands_with_mock_data() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        // 这里只测试命令的基本结构
        // 实际的 API 测试需要真实的服务器
        assert!(db_pool.inner().is_some());
    }
}
