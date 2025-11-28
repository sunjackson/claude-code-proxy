/**
 * Proxy Service Manager
 * Manages proxy server lifecycle using singleton pattern
 *
 * Features:
 * - Singleton instance management
 * - Start/stop proxy server
 * - Switch active configuration/group
 * - Auto port fallback (handled by ProxyServer)
 * - Status reporting
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::proxy_status::{ProxyService as ProxyServiceModel, ProxyStatus};
use crate::proxy::server::{ProxyConfig, ProxyServer, ProxyServerStatus};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

/// Proxy service manager (singleton)
pub struct ProxyService {
    /// Proxy server instance
    server: Arc<ProxyServer>,
    /// Database pool
    db_pool: Arc<DbPool>,
    /// Tauri app handle (optional, for event emission)
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl ProxyService {
    /// Create new proxy service manager
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        let config = ProxyConfig::default();
        let server = Arc::new(ProxyServer::new(config, db_pool.clone()));

        Self {
            server,
            db_pool,
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Set Tauri app handle for event emission
    ///
    /// # Arguments
    /// - `handle`: Tauri AppHandle
    pub async fn set_app_handle(&self, handle: AppHandle) {
        // Set app handle for proxy service
        let mut app_handle = self.app_handle.write().await;
        *app_handle = Some(handle.clone());
        log::debug!("Tauri app handle set for proxy service");

        // Also set app handle for auto-switch service (for event emission)
        let auto_switch = self.server.auto_switch_service();
        auto_switch.set_app_handle(handle).await;
        log::debug!("Tauri app handle set for auto-switch service");

        // 注册切换完成回调：自动刷新状态
        let db_pool = self.db_pool.clone();
        let app_handle_for_callback = self.app_handle.clone();
        auto_switch.set_switch_callback(move |new_config_id| {
            log::info!(
                "\n┌─────────────────────────────────────────────────────────┐\n\
                 │  📡 配置切换完成 - 正在更新状态                         │\n\
                 ├─────────────────────────────────────────────────────────┤\n\
                 │  新配置ID: {}                                            \n\
                 └─────────────────────────────────────────────────────────┘",
                new_config_id
            );

            // 异步刷新状态（使用 tokio::spawn 避免阻塞）
            let db_pool_clone = db_pool.clone();
            let app_handle_clone = app_handle_for_callback.clone();

            tokio::spawn(async move {
                // 获取最新状态
                // 注意：这里不能直接调用 ProxyService 的方法，因为会造成循环引用
                // 我们手动查询数据库并发送事件
                match Self::fetch_and_emit_status(db_pool_clone, app_handle_clone).await {
                    Ok(_) => {
                        log::info!(
                            "\n┌─────────────────────────────────────────────────────────┐\n\
                             │  ✅ 配置切换后状态已更新                                 │\n\
                             │  仪表盘和系统托盘已同步                                  │\n\
                             └─────────────────────────────────────────────────────────┘"
                        );
                    }
                    Err(e) => {
                        log::error!(
                            "\n┌─────────────────────────────────────────────────────────┐\n\
                             │  ❌ 配置切换后状态更新失败                               │\n\
                             │  错误: {}                                                \n\
                             └─────────────────────────────────────────────────────────┘",
                            e
                        );
                    }
                }
            });
        }).await;
        log::debug!("Switch callback registered for ProxyService");
    }

    /// 获取并发送状态更新事件（静态方法，避免循环引用）
    ///
    /// # Arguments
    /// - `db_pool`: 数据库连接池
    /// - `app_handle`: Tauri AppHandle
    async fn fetch_and_emit_status(
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
            listen_host: "127.0.0.1".to_string(), // 默认值，实际值应该从 server config 读取
            listen_port: 3000, // 默认值
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
                log::info!("✅ 已发送 proxy-status-changed 事件: config={:?}", status.active_config_name);
            }

            // 更新系统托盘
            Self::update_tray_direct(handle, &status).await;
        }

        Ok(())
    }

    /// 直接更新系统托盘状态（静态方法）
    async fn update_tray_direct(handle: &AppHandle, status: &ProxyServiceModel) {
        let status_text = match status.status {
            ProxyStatus::Running => "运行中",
            ProxyStatus::Stopped => "已停止",
            ProxyStatus::Starting => "启动中",
            ProxyStatus::Stopping => "停止中",
            ProxyStatus::Error => "错误",
        };

        let config_name = status
            .active_config_name
            .as_ref()
            .map(|n| n.as_str())
            .unwrap_or("未选择配置");

        let title = format!("ClaudeCodeProxy\n{} - {}", status_text, config_name);

        if let Some(tray) = handle.tray_by_id("main") {
            if let Err(e) = tray.set_tooltip(Some(&title)) {
                log::error!("Failed to update tray tooltip: {}", e);
            }
        }
    }

    /// Emit proxy status changed event
    ///
    /// # Arguments
    /// - `status`: Current proxy service status
    async fn emit_status_changed(&self, status: &ProxyServiceModel) {
        use tauri::Emitter;
        let app_handle = self.app_handle.read().await;
        if let Some(handle) = app_handle.as_ref() {
            if let Err(e) = handle.emit("proxy-status-changed", status) {
                log::error!("Failed to emit proxy-status-changed event: {}", e);
            } else {
                log::debug!("Emitted proxy-status-changed event: {:?}", status.status);
            }
        }
    }

    /// Update system tray status
    ///
    /// # Arguments
    /// - `status`: Current proxy service status
    async fn update_tray_status(&self, status: &ProxyServiceModel) {
        let app_handle = self.app_handle.read().await;
        if let Some(handle) = app_handle.as_ref() {
            let status_text = match status.status {
                ProxyStatus::Running => "运行中",
                ProxyStatus::Stopped => "已停止",
                ProxyStatus::Starting => "启动中",
                ProxyStatus::Stopping => "停止中",
                ProxyStatus::Error => "错误",
            };

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
                self.db_pool.clone(),
                status.active_group_id,
                status.active_config_id,
                status.active_config_name.clone(),
                status_text,
            ) {
                log::error!("Failed to update tray menu: {}", e);
            }
        }
    }

    /// Start proxy service
    ///
    /// # Returns
    /// - ProxyServiceModel with current status
    pub async fn start(&self) -> AppResult<ProxyServiceModel> {
        // Check if already running
        let status = self.server.status().await;
        if status == ProxyServerStatus::Running {
            return Err(AppError::AlreadyRunning);
        }

        // Get current configuration
        let config = self.server.config().await;

        // Note: Port availability check is removed here.
        // The server.start() method has built-in port fallback mechanism
        // that will automatically try ports 25341-25350 if needed.

        // Check if current group has available configurations
        if let Some(group_id) = config.active_group_id {
            let count = self.db_pool.with_connection(|conn| {
                use crate::services::config_manager::ConfigManager;
                ConfigManager::count_configs_in_group(conn, group_id)
            })?;

            if count == 0 {
                return Err(AppError::EmptyGroup { group_id });
            }
        }

        // Check if there's an active configuration
        if config.active_config_id.is_none() {
            return Err(AppError::NoConfigAvailable);
        }

        // Start the server
        self.server.start().await?;

        log::info!(
            "Proxy service started on {}:{}",
            config.host,
            config.port
        );

        // 自动配置 Claude Code 指向本地代理
        self.configure_claude_code_proxy(&config).await;

        // Get current status and emit event
        let status = self.get_status().await?;
        self.emit_status_changed(&status).await;
        self.update_tray_status(&status).await;

        Ok(status)
    }

    /// Stop proxy service
    ///
    /// # Returns
    /// - ProxyServiceModel with current status
    pub async fn stop(&self) -> AppResult<ProxyServiceModel> {
        // Check if already stopped
        let status = self.server.status().await;
        if status == ProxyServerStatus::Stopped {
            return Err(AppError::AlreadyStopped);
        }

        // Stop the server
        self.server.stop().await?;

        log::info!("Proxy service stopped");

        // 自动恢复 Claude Code 配置
        self.restore_claude_code_config().await;

        // Get current status and emit event
        let status = self.get_status().await?;
        self.emit_status_changed(&status).await;
        self.update_tray_status(&status).await;

        Ok(status)
    }

    /// Get current proxy service status
    ///
    /// # Returns
    /// - ProxyServiceModel with current status
    pub async fn get_status(&self) -> AppResult<ProxyServiceModel> {
        let server_status = self.server.status().await;
        let config = self.server.config().await;

        // Get active configuration details
        let active_config = if let Some(config_id) = config.active_config_id {
            self.db_pool
                .with_connection(|conn| {
                    use crate::services::api_config::ApiConfigService;
                    ApiConfigService::get_config_by_id(conn, config_id)
                })
                .ok()
        } else {
            None
        };

        // Get active group details
        let active_group = if let Some(group_id) = config.active_group_id {
            self.db_pool
                .with_connection(|conn| {
                    use crate::services::config_manager::ConfigManager;
                    ConfigManager::get_group_by_id(conn, group_id)
                })
                .ok()
        } else {
            None
        };

        // Check if current active config is unavailable
        // If the service is running but the active config became unavailable,
        // set status to Error to alert the user
        let status = match server_status {
            ProxyServerStatus::Stopped => ProxyStatus::Stopped,
            ProxyServerStatus::Starting => ProxyStatus::Starting,
            ProxyServerStatus::Stopping => ProxyStatus::Stopping,
            ProxyServerStatus::Error => ProxyStatus::Error,
            ProxyServerStatus::Running => {
                // Check if active config is still available
                if let Some(ref config) = active_config {
                    if !config.is_available {
                        log::warn!(
                            "Proxy is running but active config '{}' (id: {}) is now unavailable",
                            config.name,
                            config.id
                        );
                        ProxyStatus::Error
                    } else {
                        ProxyStatus::Running
                    }
                } else {
                    // No active config - this shouldn't happen if running
                    log::warn!("Proxy is running but no active config found");
                    ProxyStatus::Error
                }
            }
        };

        Ok(ProxyServiceModel {
            status,
            listen_host: config.host,
            listen_port: config.port as i32,
            active_group_id: config.active_group_id,
            active_group_name: active_group.map(|g| g.name),
            active_config_id: config.active_config_id,
            active_config_name: active_config.map(|c| c.name),
        })
    }

    /// Refresh and broadcast proxy status
    ///
    /// Fetches current status and emits status change events to update UI.
    /// This is useful when configuration changes externally and UI needs to be notified.
    ///
    /// # Returns
    /// - ProxyServiceModel with current status
    pub async fn refresh_status(&self) -> AppResult<ProxyServiceModel> {
        let status = self.get_status().await?;
        self.emit_status_changed(&status).await;
        self.update_tray_status(&status).await;
        Ok(status)
    }

    /// Switch to a different configuration group
    ///
    /// # Arguments
    /// - `group_id`: Target group ID
    ///
    /// # Returns
    /// - ProxyServiceModel with updated status
    pub async fn switch_group(&self, group_id: i64) -> AppResult<ProxyServiceModel> {
        // Verify group exists
        let group = self.db_pool.with_connection(|conn| {
            use crate::services::config_manager::ConfigManager;
            ConfigManager::get_group_by_id(conn, group_id)
        })?;

        // Check if group is empty (FR-036)
        let count = self.db_pool.with_connection(|conn| {
            use crate::services::config_manager::ConfigManager;
            ConfigManager::count_configs_in_group(conn, group_id)
        })?;

        if count == 0 {
            return Err(AppError::EmptyGroup { group_id });
        }

        // Get first available configuration in the group
        let configs = self.db_pool.with_connection(|conn| {
            use crate::services::api_config::ApiConfigService;
            ApiConfigService::list_configs(conn, Some(group_id))
        })?;

        let first_config = configs
            .into_iter()
            .find(|c| c.is_available)
            .ok_or(AppError::NoConfigAvailable)?;

        // Update server configuration
        let mut config = self.server.config().await;
        config.active_group_id = Some(group_id);
        config.active_config_id = Some(first_config.id);
        self.server.update_config(config).await;

        log::info!(
            "Switched to group: {} (config: {})",
            group.name,
            first_config.name
        );

        // Get updated status and emit event
        let status = self.get_status().await?;
        self.emit_status_changed(&status).await;
        self.update_tray_status(&status).await;

        Ok(status)
    }

    /// Switch to a different configuration within the current group
    ///
    /// # Arguments
    /// - `config_id`: Target configuration ID
    ///
    /// # Returns
    /// - ProxyServiceModel with updated status
    pub async fn switch_config(&self, config_id: i64) -> AppResult<ProxyServiceModel> {
        // Get current configuration
        let current_config = self.server.config().await;
        let source_config_id = current_config.active_config_id;

        // Verify target configuration exists
        let target_config = self.db_pool.with_connection(|conn| {
            use crate::services::api_config::ApiConfigService;
            ApiConfigService::get_config_by_id(conn, config_id)
        })?;

        // If there's an active group, verify config belongs to it
        if let Some(current_group_id) = current_config.active_group_id {
            if target_config.group_id != Some(current_group_id) {
                return Err(AppError::ConfigNotInGroup {
                    config_id,
                    group_id: current_group_id,
                });
            }
        }

        // Check if configuration is available
        if !target_config.is_available {
            return Err(AppError::ConfigUnavailable { config_id });
        }

        // Update server configuration
        let mut config = current_config;
        config.active_config_id = Some(config_id);
        self.server.update_config(config).await;

        log::info!("Switched to config: {}", target_config.name);

        // Record manual switch log
        if let Some(group_id) = target_config.group_id {
            use crate::models::switch_log::{CreateSwitchLogInput, SwitchReason};
            use crate::services::auto_switch::AutoSwitchService;

            let auto_switch = AutoSwitchService::new(self.db_pool.clone());
            let log_input = CreateSwitchLogInput {
                reason: SwitchReason::Manual,
                source_config_id,
                target_config_id: config_id,
                group_id,
                latency_before_ms: None,
                latency_after_ms: None,
                error_message: None,
                retry_count: None,
                error_type: None,
                error_details: None,
            };

            match auto_switch.log_switch(log_input).await {
                Ok(log_id) => log::info!("Manual switch log recorded (id: {})", log_id),
                Err(e) => log::warn!("Failed to record manual switch log: {}", e),
            }
        }

        // Get updated status and emit event
        let status = self.get_status().await?;
        self.emit_status_changed(&status).await;
        self.update_tray_status(&status).await;

        Ok(status)
    }

    /// Get the underlying proxy server (for advanced operations)
    #[allow(dead_code)]
    pub fn server(&self) -> &Arc<ProxyServer> {
        &self.server
    }

    /// 配置 Claude Code 指向本地代理
    ///
    /// 启动代理服务器后自动调用，将 ~/.claude/settings.json 中的
    /// ANTHROPIC_BASE_URL 设置为本地代理地址
    ///
    /// # Arguments
    /// - `config`: 代理服务器配置
    async fn configure_claude_code_proxy(&self, config: &crate::proxy::server::ProxyConfig) {
        use crate::services::claude_config::ClaudeConfigService;
        use crate::services::claude_config::ProxyConfig as ClaudeProxyConfig;

        let proxy_config = ClaudeProxyConfig {
            host: config.host.clone(),
            port: config.port,
        };

        match ClaudeConfigService::enable_proxy(&proxy_config) {
            Ok(()) => {
                log::info!(
                    "✅ 已自动配置 Claude Code 指向本地代理: {}:{}",
                    config.host,
                    config.port
                );
                log::info!("   Claude Code 的所有请求将通过本地代理路由转发");
            }
            Err(e) => {
                log::error!("❌ 自动配置 Claude Code 失败: {}", e);
                log::error!("   您可能需要手动配置 ~/.claude/settings.json");
            }
        }
    }

    /// 恢复 Claude Code 原始配置
    ///
    /// 停止代理服务器后自动调用，恢复 ~/.claude/settings.json 的原始配置
    async fn restore_claude_code_config(&self) {
        use crate::services::claude_config::ClaudeConfigService;

        match ClaudeConfigService::disable_proxy() {
            Ok(()) => {
                log::info!("✅ 已恢复 Claude Code 原始配置");
            }
            Err(e) => {
                log::error!("❌ 恢复 Claude Code 配置失败: {}", e);
                log::error!("   您可能需要手动恢复 ~/.claude/settings.json");
            }
        }
    }
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;
    use crate::db::initialize_database;
    use std::net::TcpListener;

    #[tokio::test]
    async fn test_port_availability() {
        assert!(ProxyService::is_port_available(25343));

        // Bind to a port
        let _listener = TcpListener::bind(("127.0.0.1", 25344)).unwrap();

        // Port should not be available now
        assert!(!ProxyService::is_port_available(25344));
    }

    #[tokio::test]
    async fn test_proxy_service_lifecycle() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        let service = ProxyService::new(db_pool);

        // Initial status should be Stopped
        let status = service.get_status().await.expect("Failed to get status");
        assert_eq!(status.status, ProxyStatus::Stopped);

        // Cannot stop when already stopped
        let result = service.stop().await;
        assert!(result.is_err());
    }
}
