/**
 * Status Notifier Service
 * 负责代理状态变更的通知，包括事件发送和系统托盘更新
 *
 * Features:
 * - 发送 proxy-status-changed 事件到前端
 * - 更新系统托盘状态和菜单
 * - 支持静态方法避免循环引用
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::proxy_status::{ProxyService as ProxyServiceModel, ProxyStatus};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

/// 状态通知服务
pub struct StatusNotifier;

impl StatusNotifier {
    /// 获取代理状态的中文描述
    pub fn status_text(status: &ProxyStatus) -> &'static str {
        match status {
            ProxyStatus::Running => "运行中",
            ProxyStatus::Stopped => "已停止",
            ProxyStatus::Starting => "启动中",
            ProxyStatus::Stopping => "停止中",
            ProxyStatus::Error => "错误",
        }
    }

    /// 发送状态变更事件到前端
    ///
    /// # Arguments
    /// - `app_handle`: Tauri AppHandle
    /// - `status`: 当前代理服务状态
    pub async fn emit_status_changed(
        app_handle: &Arc<RwLock<Option<AppHandle>>>,
        status: &ProxyServiceModel,
    ) {
        use tauri::Emitter;

        let handle_guard = app_handle.read().await;
        if let Some(handle) = handle_guard.as_ref() {
            if let Err(e) = handle.emit("proxy-status-changed", status) {
                log::error!("Failed to emit proxy-status-changed event: {}", e);
            } else {
                log::debug!("Emitted proxy-status-changed event: {:?}", status.status);
            }
        }
    }

    /// 更新系统托盘状态
    ///
    /// # Arguments
    /// - `app_handle`: Tauri AppHandle
    /// - `db_pool`: 数据库连接池
    /// - `status`: 当前代理服务状态
    pub async fn update_tray(
        app_handle: &Arc<RwLock<Option<AppHandle>>>,
        db_pool: &Arc<DbPool>,
        status: &ProxyServiceModel,
    ) {
        let handle_guard = app_handle.read().await;
        if let Some(handle) = handle_guard.as_ref() {
            let status_text = Self::status_text(&status.status);

            // 更新托盘状态文本和图标
            if let Err(e) = crate::tray::update_tray_status(
                handle,
                status.active_config_name.clone(),
                status_text,
            ) {
                log::error!("Failed to update tray status: {}", e);
            }

            // 更新托盘菜单中的配置列表
            if let Err(e) = crate::tray::update_tray_menu(
                handle,
                db_pool.clone(),
                status.active_group_id,
                status.active_config_id,
                status.active_config_name.clone(),
                status_text,
            ) {
                log::error!("Failed to update tray menu: {}", e);
            }
        }
    }

    /// 发送状态变更事件并更新托盘（组合方法）
    ///
    /// # Arguments
    /// - `app_handle`: Tauri AppHandle
    /// - `db_pool`: 数据库连接池
    /// - `status`: 当前代理服务状态
    #[allow(dead_code)]
    pub async fn notify_status_changed(
        app_handle: &Arc<RwLock<Option<AppHandle>>>,
        db_pool: &Arc<DbPool>,
        status: &ProxyServiceModel,
    ) {
        Self::emit_status_changed(app_handle, status).await;
        Self::update_tray(app_handle, db_pool, status).await;
    }

    /// 获取并发送状态更新事件（静态方法，避免循环引用）
    ///
    /// 用于回调场景，直接从数据库获取状态并广播
    ///
    /// # Arguments
    /// - `db_pool`: 数据库连接池
    /// - `app_handle`: Tauri AppHandle
    pub async fn fetch_and_emit_status(
        db_pool: Arc<DbPool>,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
    ) -> AppResult<()> {
        use tauri::Emitter;

        // 延迟100ms确保数据库写入完成
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // 读取 ProxyService 表获取当前活动配置
        let (active_config_id, active_group_id) = db_pool.with_connection(|conn| {
            use rusqlite::params;

            conn.query_row(
                "SELECT current_config_id, current_group_id FROM ProxyService WHERE id = 1",
                params![],
                |row| Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询 ProxyService 失败: {}", e),
            })
        })?;

        // 获取配置详情
        let active_config = if let Some(config_id) = active_config_id {
            use crate::services::api_config::ApiConfigService;
            db_pool
                .with_connection(|conn| ApiConfigService::get_config_by_id(conn, config_id))
                .ok()
        } else {
            None
        };

        // 获取分组详情
        let active_group = if let Some(group_id) = active_group_id {
            use crate::services::config_manager::ConfigManager;
            db_pool
                .with_connection(|conn| ConfigManager::get_group_by_id(conn, group_id))
                .ok()
        } else {
            None
        };

        // 构建状态模型
        let status = ProxyServiceModel {
            status: ProxyStatus::Running,
            listen_host: "127.0.0.1".to_string(),
            listen_port: 3000,
            active_group_id,
            active_group_name: active_group.map(|g| g.name),
            active_config_id,
            active_config_name: active_config.map(|c| c.name),
        };

        // 发送事件
        let handle_guard = app_handle.read().await;
        if let Some(handle) = handle_guard.as_ref() {
            // 发送 proxy-status-changed 事件
            if let Err(e) = handle.emit("proxy-status-changed", &status) {
                log::error!("Failed to emit proxy-status-changed: {}", e);
            } else {
                log::info!(
                    "✅ 已发送 proxy-status-changed 事件: config={:?}",
                    status.active_config_name
                );
            }

            let status_text = Self::status_text(&status.status);

            // 更新托盘状态文本和图标
            if let Err(e) =
                crate::tray::update_tray_status(handle, status.active_config_name.clone(), status_text)
            {
                log::error!("更新托盘状态失败: {}", e);
            }

            // 更新托盘菜单中的配置列表
            if let Err(e) = crate::tray::update_tray_menu(
                handle,
                db_pool.clone(),
                status.active_group_id,
                status.active_config_id,
                status.active_config_name.clone(),
                status_text,
            ) {
                log::error!("更新托盘菜单失败: {}", e);
            }

            log::info!("✅ 系统托盘已更新: config={:?}", status.active_config_name);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_text() {
        assert_eq!(StatusNotifier::status_text(&ProxyStatus::Running), "运行中");
        assert_eq!(StatusNotifier::status_text(&ProxyStatus::Stopped), "已停止");
        assert_eq!(StatusNotifier::status_text(&ProxyStatus::Starting), "启动中");
        assert_eq!(StatusNotifier::status_text(&ProxyStatus::Stopping), "停止中");
        assert_eq!(StatusNotifier::status_text(&ProxyStatus::Error), "错误");
    }
}
