/**
 * HTTP Proxy Server Implementation
 * Provides async HTTP proxy service using Hyper + Tokio
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::proxy::logger::ProxyLogger;
use crate::proxy::router::RequestRouter;
use crate::services::auto_switch::AutoSwitchService;
use crate::services::proxy_log::ProxyRequestLogService;
use crate::utils::constants::default_proxy_port;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{body::Incoming, Request, Response};
use hyper_util::rt::TokioIo;
use http_body_util::combinators::BoxBody;
use hyper::body::Bytes;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::RwLock;

/// Proxy server configuration
#[derive(Debug, Clone)]
pub struct ProxyConfig {
    /// Listen host
    pub host: String,
    /// Listen port (default: 25341 for production, 15341 for development)
    pub port: u16,
    /// Currently active config group ID
    pub active_group_id: Option<i64>,
    /// Currently active config ID
    pub active_config_id: Option<i64>,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: default_proxy_port(),
            active_group_id: None,
            active_config_id: None,
        }
    }
}

/// Proxy server status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProxyServerStatus {
    /// Stopped
    Stopped,
    /// Starting
    Starting,
    /// Running
    Running,
    /// Stopping
    Stopping,
    /// Error
    Error,
}

/// Proxy server
pub struct ProxyServer {
    /// Configuration
    config: Arc<RwLock<ProxyConfig>>,
    /// Server status
    status: Arc<RwLock<ProxyServerStatus>>,
    /// Shutdown signal sender (used to stop server)
    shutdown_tx: Arc<RwLock<Option<tokio::sync::broadcast::Sender<()>>>>,
    /// Database pool
    db_pool: Arc<DbPool>,
    /// Auto-switch service (shared across all requests)
    auto_switch_service: Arc<AutoSwitchService>,
}

impl ProxyServer {
    /// Create new proxy server instance
    pub fn new(config: ProxyConfig, db_pool: Arc<DbPool>) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            status: Arc::new(RwLock::new(ProxyServerStatus::Stopped)),
            shutdown_tx: Arc::new(RwLock::new(None)),
            auto_switch_service: Arc::new(AutoSwitchService::new(db_pool.clone())),
            db_pool,
        }
    }

    /// Get auto-switch service reference (for setting app_handle)
    pub fn auto_switch_service(&self) -> Arc<AutoSwitchService> {
        self.auto_switch_service.clone()
    }

    /// Get current status
    pub async fn status(&self) -> ProxyServerStatus {
        *self.status.read().await
    }

    /// Get current configuration
    pub async fn config(&self) -> ProxyConfig {
        self.config.read().await.clone()
    }

    /// Update configuration
    pub async fn update_config(&self, config: ProxyConfig) {
        let mut cfg = self.config.write().await;
        *cfg = config;
    }

    /// Start proxy server
    pub async fn start(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == ProxyServerStatus::Running {
            return Err(AppError::InvalidState {
                message: "Proxy server is already running".to_string(),
            });
        }

        *status = ProxyServerStatus::Starting;
        drop(status);

        let config = self.config.read().await.clone();
        let mut port = config.port;
        let max_attempts = 10; // 最多尝试10个端口

        log::info!("Starting proxy server on {}:{}", config.host, port);

        // 尝试绑定端口，如果失败则自动递增端口号重试
        let (listener, final_port) = {
            let mut attempt = 0;

            loop {
                let addr = format!("{}:{}", config.host, port);

                match TcpListener::bind(&addr).await {
                    Ok(listener) => {
                        if port != config.port {
                            log::info!("Port {} was occupied, automatically using port {}", config.port, port);
                        }
                        log::info!("Proxy server bound to {}", addr);
                        break (listener, port);
                    }
                    Err(e) => {
                        log::warn!("Failed to bind to {} (attempt {}): {}", addr, attempt + 1, e);
                        attempt += 1;

                        if attempt >= max_attempts {
                            log::error!("Failed to bind after {} attempts, last port tried: {}", max_attempts, port);
                            let mut status = self.status.write().await;
                            *status = ProxyServerStatus::Error;
                            return Err(AppError::IoError {
                                message: format!(
                                    "Failed to bind address after {} attempts. Last error: {}",
                                    max_attempts,
                                    e
                                ),
                            });
                        }

                        // 端口号+1，确保不超过65535
                        port = if port >= 65535 {
                            log::error!("Port number reached maximum (65535), cannot continue");
                            let mut status = self.status.write().await;
                            *status = ProxyServerStatus::Error;
                            return Err(AppError::IoError {
                                message: "Port number reached maximum value".to_string(),
                            });
                        } else {
                            port + 1
                        };
                    }
                }
            }
        };

        // 如果使用了不同的端口，更新配置
        if final_port != config.port {
            log::info!("Updating configuration with new port: {}", final_port);
            let mut cfg = self.config.write().await;
            cfg.port = final_port;
        }

        // Create shutdown signal channel
        let (shutdown_tx, _shutdown_rx) = tokio::sync::broadcast::channel::<()>(1);
        {
            let mut tx = self.shutdown_tx.write().await;
            *tx = Some(shutdown_tx.clone());
        }

        // Update status to running
        {
            let mut status = self.status.write().await;
            *status = ProxyServerStatus::Running;
        }

        let config_arc = self.config.clone();
        let status_arc = self.status.clone();
        let db_pool_arc = self.db_pool.clone();
        let auto_switch_arc = self.auto_switch_service.clone();

        // Spawn async task to handle connections
        tokio::spawn(async move {
            log::info!("Proxy server accepting connections");

            let mut shutdown_rx = shutdown_tx.subscribe();

            loop {
                // Use tokio::select! to listen for both accept and shutdown signal
                tokio::select! {
                    // Accept new connection
                    accept_result = listener.accept() => {
                        match accept_result {
                            Ok((stream, remote_addr)) => {
                                log::debug!("New connection from {}", remote_addr);

                                let config = config_arc.clone();
                                let db_pool = db_pool_arc.clone();
                                let auto_switch = auto_switch_arc.clone();
                                let mut conn_shutdown_rx = shutdown_tx.subscribe();

                                // Create async task for each connection
                                tokio::spawn(async move {
                                    let io = TokioIo::new(stream);

                                    // Create service handler function
                                    let service = service_fn(move |req: Request<Incoming>| {
                                        let config = config.clone();
                                        let db_pool = db_pool.clone();
                                        let auto_switch = auto_switch.clone();
                                        async move {
                                            Self::handle_request(req, remote_addr, config, db_pool, auto_switch).await
                                        }
                                    });

                                    // Use HTTP/1.1 to handle connection
                                    let conn = http1::Builder::new().serve_connection(io, service);

                                    // Add graceful shutdown support
                                    tokio::select! {
                                        result = conn => {
                                            if let Err(e) = result {
                                                log::error!("Connection error ({}): {}", remote_addr, e);
                                            }
                                        }
                                        _ = conn_shutdown_rx.recv() => {
                                            log::debug!("Connection {} received shutdown signal", remote_addr);
                                        }
                                    }
                                });
                            }
                            Err(e) => {
                                log::error!("Failed to accept connection: {}", e);
                                continue;
                            }
                        }
                    }
                    // Listen for shutdown signal
                    _ = shutdown_rx.recv() => {
                        log::info!("Received shutdown signal, stopping server");
                        break;
                    }
                }
            }

            log::info!("Proxy server stopped accepting connections");

            // Drop listener to release port immediately
            drop(listener);
            log::debug!("TCP listener dropped, port released");

            // Update status
            let mut status = status_arc.write().await;
            *status = ProxyServerStatus::Stopped;
        });

        Ok(())
    }

    /// Stop proxy server
    pub async fn stop(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status != ProxyServerStatus::Running {
            return Err(AppError::InvalidState {
                message: "Proxy server is not running".to_string(),
            });
        }

        *status = ProxyServerStatus::Stopping;
        drop(status);

        log::info!("Stopping proxy server");

        // Send shutdown signal
        let mut shutdown_tx = self.shutdown_tx.write().await;
        if let Some(tx) = shutdown_tx.take() {
            let _ = tx.send(());
        }
        drop(shutdown_tx);

        // Wait for server to stop and release port
        // The spawned task will update status to Stopped
        let max_wait = 50; // 最多等待500ms (50 * 10ms)
        for _ in 0..max_wait {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            let status = self.status.read().await;
            if *status == ProxyServerStatus::Stopped {
                log::info!("Proxy server stopped, port released");
                return Ok(());
            }
        }

        // 如果超时，强制设置状态为停止
        log::warn!("Proxy server stop timeout, forcing status to stopped");
        let mut status = self.status.write().await;
        *status = ProxyServerStatus::Stopped;

        Ok(())
    }

    /// Handle proxy request
    async fn handle_request(
        req: Request<Incoming>,
        remote_addr: SocketAddr,
        config: Arc<RwLock<ProxyConfig>>,
        db_pool: Arc<DbPool>,
        auto_switch_service: Arc<AutoSwitchService>,
    ) -> Result<Response<BoxBody<Bytes, hyper::Error>>, hyper::Error> {
        let method = req.method().clone();
        let uri = req.uri().clone();

        // 捕获请求头信息用于日志
        let request_headers: std::collections::HashMap<String, String> = req
            .headers()
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();
        let request_headers_json = serde_json::to_string(&request_headers).ok();

        // 提取 User-Agent 和 Content-Type
        let user_agent = req
            .headers()
            .get(hyper::header::USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let content_type = req
            .headers()
            .get(hyper::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        // Start request logging
        let mut log_builder = ProxyLogger::start_request(
            method.clone(),
            uri.clone(),
            remote_addr.to_string(),
        );

        // 添加请求头信息到日志构建器
        if let Some(headers) = request_headers_json {
            log_builder = log_builder.with_request_headers(headers);
        }
        if let Some(ua) = user_agent {
            log_builder = log_builder.with_user_agent(ua);
        }
        if let Some(ct) = content_type {
            log_builder = log_builder.with_content_type(ct);
        }

        // Get active config ID and group ID
        let cfg = config.read().await;
        let config_id = cfg.active_config_id;
        let group_id = cfg.active_group_id.unwrap_or(0);
        drop(cfg);

        // If no active config, return error
        let config_id = match config_id {
            Some(id) => id,
            None => {
                let response = RequestRouter::default_response(
                    hyper::StatusCode::SERVICE_UNAVAILABLE,
                    "No active API configuration. Please configure and activate an API endpoint.",
                );

                // Log the request
                let log_entry = log_builder
                    .finish_with_error(
                        hyper::StatusCode::SERVICE_UNAVAILABLE,
                        "No active configuration".to_string(),
                    );
                ProxyLogger::log_request(&log_entry);

                // Save to database
                let db = db_pool.clone();
                tokio::spawn(async move {
                    if let Err(e) = ProxyRequestLogService::save_log(&db, &log_entry) {
                        log::warn!("Failed to save proxy request log: {}", e);
                    }
                });

                return Ok(response);
            }
        };

        // Create router and forward request (with config reference and shared auto-switch service)
        let router = RequestRouter::new_with_config(
            db_pool.clone(),
            config.clone(),
            auto_switch_service,
        );

        // Get config name for logging
        let config_name = db_pool
            .with_connection(|conn| {
                use crate::services::api_config::ApiConfigService;
                ApiConfigService::get_config_by_id(conn, config_id).map(|c| c.name)
            })
            .ok();

        let target_url = format!("config:{}", config_id);
        let log_builder = log_builder.with_target(target_url);
        let log_builder = if let Some(name) = config_name {
            log_builder.with_config(config_id, name)
        } else {
            log_builder
        };

        match router.forward_request(req, config_id, group_id).await {
            Ok((response, forward_details, stream_rx)) => {
                // 使用详细信息构建日志
                let mut log_builder = log_builder;

                // 添加请求体信息
                if let Some(body) = forward_details.request_body.clone() {
                    log_builder = log_builder.with_request_body(body, forward_details.request_body_size);
                }

                // 添加模型信息
                if let Some(model) = forward_details.model.clone() {
                    log_builder = log_builder.with_model(model);
                }

                // 标记响应开始
                log_builder.mark_response_start();

                // 检查是否有流式响应接收器
                if let Some(mut rx) = stream_rx {
                    // 流式响应 - 先保存初始日志，然后在流结束后更新
                    let initial_log_entry = log_builder.finish_with_details(
                        response.status(),
                        forward_details.response_headers.clone(),
                        Some("[streaming...]".to_string()),
                        0,
                        true,
                        0,
                    );

                    ProxyLogger::log_request(&initial_log_entry);

                    // 保存初始日志并获取 ID
                    let db = db_pool.clone();
                    let log_id = match ProxyRequestLogService::save_log(&db, &initial_log_entry) {
                        Ok(id) => id,
                        Err(e) => {
                            log::warn!("Failed to save initial proxy request log: {}", e);
                            return Ok(response);
                        }
                    };

                    // 启动后台任务等待流结束并更新日志
                    let db_for_update = db_pool.clone();
                    let response_headers = forward_details.response_headers;
                    tokio::spawn(async move {
                        // 等待流式响应完成
                        if let Some(completion_data) = rx.recv().await {
                            log::info!(
                                "Stream completed: {} bytes, {} chunks",
                                completion_data.response_body_size,
                                completion_data.chunk_count
                            );

                            // 更新日志记录
                            if let Err(e) = ProxyRequestLogService::update_streaming_log(
                                &db_for_update,
                                log_id,
                                response_headers,
                                Some(completion_data.response_body),
                                completion_data.response_body_size as i64,
                                completion_data.chunk_count as i32,
                            ) {
                                log::warn!("Failed to update streaming log: {}", e);
                            }
                        } else {
                            log::warn!("Stream receiver closed without completion data");
                        }
                    });
                } else {
                    // 非流式响应 - 直接保存完整日志
                    let log_entry = log_builder.finish_with_details(
                        response.status(),
                        forward_details.response_headers,
                        forward_details.response_body,
                        forward_details.response_body_size,
                        forward_details.is_streaming,
                        forward_details.stream_chunk_count as u32,
                    );
                    ProxyLogger::log_request(&log_entry);

                    // Save to database (async, don't block response)
                    let db = db_pool.clone();
                    tokio::spawn(async move {
                        if let Err(e) = ProxyRequestLogService::save_log(&db, &log_entry) {
                            log::warn!("Failed to save proxy request log: {}", e);
                        }
                    });
                }

                Ok(response)
            }
            Err(e) => {
                let error_msg = e.to_string();
                let response = RequestRouter::default_response(
                    hyper::StatusCode::BAD_GATEWAY,
                    &format!("Failed to forward request: {}", error_msg),
                );

                // Log failed request
                let log_entry = log_builder.finish_with_error(
                    hyper::StatusCode::BAD_GATEWAY,
                    error_msg,
                );
                ProxyLogger::log_request(&log_entry);

                // Save to database (async, don't block response)
                let db = db_pool.clone();
                tokio::spawn(async move {
                    if let Err(e) = ProxyRequestLogService::save_log(&db, &log_entry) {
                        log::warn!("Failed to save proxy request log: {}", e);
                    }
                });

                Ok(response)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;

    #[tokio::test]
    async fn test_proxy_server_lifecycle() {
        // Initialize test database
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        let config = ProxyConfig {
            host: "127.0.0.1".to_string(),
            port: 25342, // Use different port to avoid conflicts
            active_group_id: None,
            active_config_id: None,
        };

        let server = ProxyServer::new(config, db_pool);

        // Initial status should be Stopped
        assert_eq!(server.status().await, ProxyServerStatus::Stopped);

        // Start server
        server.start().await.expect("Failed to start server");

        // Wait a moment for server to start
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Status should be Running
        assert_eq!(server.status().await, ProxyServerStatus::Running);

        // Stop server
        server.stop().await.expect("Failed to stop server");

        // Wait a moment for server to stop
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Status should be Stopped
        assert_eq!(server.status().await, ProxyServerStatus::Stopped);
    }

    #[tokio::test]
    async fn test_config_update() {
        let conn = initialize_database().expect("Failed to initialize database");
        let db_pool = Arc::new(DbPool::new(conn));

        let config = ProxyConfig::default();
        let server = ProxyServer::new(config, db_pool);

        let new_config = ProxyConfig {
            host: "0.0.0.0".to_string(),
            port: 8080,
            active_group_id: Some(1),
            active_config_id: Some(2),
        };

        server.update_config(new_config.clone()).await;

        let current_config = server.config().await;
        assert_eq!(current_config.host, "0.0.0.0");
        assert_eq!(current_config.port, 8080);
        assert_eq!(current_config.active_group_id, Some(1));
        assert_eq!(current_config.active_config_id, Some(2));
    }
}
