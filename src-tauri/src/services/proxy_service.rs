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
        let mut app_handle = self.app_handle.write().await;
        *app_handle = Some(handle);
        log::debug!("Tauri app handle set for proxy service");
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

            if let Err(e) = crate::tray::update_tray_status(
                handle,
                status.active_config_name.clone(),
                status_text,
            ) {
                log::error!("Failed to update tray status: {}", e);
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

        // Map server status to ProxyStatus
        let status = match server_status {
            ProxyServerStatus::Stopped => ProxyStatus::Stopped,
            ProxyServerStatus::Starting => ProxyStatus::Starting,
            ProxyServerStatus::Running => ProxyStatus::Running,
            ProxyServerStatus::Stopping => ProxyStatus::Stopping,
            ProxyServerStatus::Error => ProxyStatus::Error,
        };

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;

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
