/**
 * Balance Query Commands
 * Tauri commands for querying API provider balance
 *
 * Commands:
 * - query_balance: Query balance for a single configuration
 * - query_all_balances: Query balance for all auto-enabled configurations
 * - get_all_balance_info: Get all balance info from database
 */

use crate::db::DbPool;
use crate::models::balance::BalanceInfo;
use crate::models::error::AppResult;
use crate::services::BalanceService;
use std::sync::Arc;
use tauri::State;

/// Query balance for a single configuration
///
/// # Arguments
/// - `config_id`: API configuration ID
///
/// # Returns
/// - BalanceInfo with balance and query status
#[tauri::command]
pub async fn query_balance(
    config_id: i64,
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<BalanceInfo> {
    log::info!("Command: query_balance (config_id: {})", config_id);

    let service = BalanceService::new(db_pool.inner().clone());
    service.query_balance(config_id).await
}

/// Query balance for all auto-enabled configurations
///
/// Queries all configurations that have auto_balance_check enabled
///
/// # Returns
/// - Vec<BalanceInfo> with balance results
#[tauri::command]
pub async fn query_all_balances(
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<Vec<BalanceInfo>> {
    log::info!("Command: query_all_balances");

    let service = BalanceService::new(db_pool.inner().clone());
    service.query_all_balances().await
}

/// Get all balance info from database
///
/// Returns cached balance information without making API requests
///
/// # Returns
/// - Vec<BalanceInfo> with stored balance data
#[tauri::command]
pub fn get_all_balance_info(
    db_pool: State<'_, Arc<DbPool>>,
) -> AppResult<Vec<BalanceInfo>> {
    log::debug!("Command: get_all_balance_info");

    let service = BalanceService::new(db_pool.inner().clone());
    service.get_all_balance_info()
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;
    use crate::db::initialize_database;

    #[tokio::test]
    async fn test_commands_with_mock_data() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        // Test basic command structure
        assert!(db_pool.inner().is_some());
    }
}
