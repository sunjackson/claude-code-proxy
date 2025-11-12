/**
 * Request Router Module
 * Routes incoming requests to Claude API backend servers
 *
 * Features:
 * - Read current configuration and forward to server_url:server_port
 * - Inject API key into request headers (x-api-key)
 * - Handle request/response forwarding
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::switch_log::SwitchReason;
// use crate::proxy::error_handler::{ProxyErrorHandler, ProxyErrorType};
use crate::services::api_config::ApiConfigService;
use crate::services::auto_switch::AutoSwitchService;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use http_body_util::BodyExt;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::TlsConnector;
use rustls::pki_types::ServerName;
use tokio::io::{AsyncRead, AsyncWrite};

/// Request timeout in seconds (FR-012)
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// High latency threshold in milliseconds
const HIGH_LATENCY_THRESHOLD_MS: u128 = 3000;

/// Stream wrapper to support both HTTP and HTTPS connections
enum MaybeHttpsStream {
    Http(TcpStream),
    Https(tokio_rustls::client::TlsStream<TcpStream>),
}

impl AsyncRead for MaybeHttpsStream {
    fn poll_read(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match &mut *self {
            MaybeHttpsStream::Http(s) => std::pin::Pin::new(s).poll_read(cx, buf),
            MaybeHttpsStream::Https(s) => std::pin::Pin::new(s).poll_read(cx, buf),
        }
    }
}

impl AsyncWrite for MaybeHttpsStream {
    fn poll_write(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        match &mut *self {
            MaybeHttpsStream::Http(s) => std::pin::Pin::new(s).poll_write(cx, buf),
            MaybeHttpsStream::Https(s) => std::pin::Pin::new(s).poll_write(cx, buf),
        }
    }

    fn poll_flush(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match &mut *self {
            MaybeHttpsStream::Http(s) => std::pin::Pin::new(s).poll_flush(cx),
            MaybeHttpsStream::Https(s) => std::pin::Pin::new(s).poll_flush(cx),
        }
    }

    fn poll_shutdown(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match &mut *self {
            MaybeHttpsStream::Http(s) => std::pin::Pin::new(s).poll_shutdown(cx),
            MaybeHttpsStream::Https(s) => std::pin::Pin::new(s).poll_shutdown(cx),
        }
    }
}

/// Request Router
/// Forwards requests to Claude API backends based on configuration
pub struct RequestRouter {
    /// Database connection pool
    db_pool: Arc<DbPool>,
    /// Auto-switch service
    auto_switch: Arc<AutoSwitchService>,
}

impl RequestRouter {
    /// Create a new request router
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        let auto_switch = Arc::new(AutoSwitchService::new(db_pool.clone()));
        Self {
            db_pool,
            auto_switch,
        }
    }

    /// 设置 Tauri app handle (for auto-switch events)
    #[allow(dead_code)]
    pub async fn set_app_handle(&self, handle: tauri::AppHandle) {
        self.auto_switch.set_app_handle(handle).await;
    }

    /// Forward request to target server with auto-switch support
    ///
    /// # Arguments
    /// - `req`: Original HTTP request
    /// - `config_id`: Target configuration ID
    /// - `group_id`: Current group ID (for auto-switch)
    ///
    /// # Returns
    /// - Forwarded response or error
    pub async fn forward_request(
        &self,
        req: Request<Incoming>,
        config_id: i64,
        group_id: i64,
    ) -> AppResult<Response<String>> {
        let start_time = Instant::now();

        // Try forwarding with current config
        match self.try_forward(req, config_id, group_id).await {
            Ok(response) => {
                let latency = start_time.elapsed().as_millis();

                // Check for high latency trigger (FR-016)
                if latency > HIGH_LATENCY_THRESHOLD_MS {
                    log::warn!(
                        "High latency detected: {}ms (threshold: {}ms)",
                        latency,
                        HIGH_LATENCY_THRESHOLD_MS
                    );

                    // Trigger auto-switch for high latency
                    if let Err(e) = self
                        .auto_switch
                        .handle_failure(
                            config_id,
                            group_id,
                            SwitchReason::HighLatency,
                            None,
                            Some(latency as i32),
                        )
                        .await
                    {
                        log::error!("Auto-switch failed: {}", e);
                    }
                }

                Ok(response)
            }
            Err(e) => {
                // Determine failure reason and trigger auto-switch
                let (reason, error_msg) = self.classify_error(&e);
                let latency = start_time.elapsed().as_millis() as i32;

                log::error!("Request failed: {:?}, reason: {:?}", e, reason);

                // Attempt auto-switch (note: cannot retry request as it's already consumed)
                match self
                    .auto_switch
                    .handle_failure(config_id, group_id, reason, Some(error_msg.clone()), Some(latency))
                    .await
                {
                    Ok(Some(new_config_id)) => {
                        log::info!("Auto-switched to config {} (retry not possible - request already consumed)", new_config_id);
                        // Cannot retry because Request<Incoming> cannot be cloned
                        // The next request will use the new config
                        Err(e)
                    }
                    Ok(None) => {
                        log::warn!("No available config for auto-switch");
                        Err(e)
                    }
                    Err(switch_err) => {
                        log::error!("Auto-switch error: {}", switch_err);
                        Err(e)
                    }
                }
            }
        }
    }

    /// Try forwarding request without auto-switch
    async fn try_forward(
        &self,
        mut req: Request<Incoming>,
        config_id: i64,
        _group_id: i64,
    ) -> AppResult<Response<String>> {
        // 1. Get configuration and API key
        let (config, api_key) = self.db_pool.with_connection(|conn| {
            let config = ApiConfigService::get_config_by_id(conn, config_id)?;
            let api_key = ApiConfigService::get_api_key(conn, config_id)?;
            Ok((config, api_key))
        })?;

        log::info!(
            "Forwarding request to config: {} ({})",
            config.name,
            config.server_url
        );

        // 2. Extract client request path and query
        let client_uri = req.uri().clone();
        let client_path_and_query = client_uri.path_and_query()
            .map(|pq| pq.as_str())
            .unwrap_or("/");

        log::debug!("Client request path: {}", client_path_and_query);

        // 3. Inject API key into request headers
        req.headers_mut()
            .insert("x-api-key", api_key.parse().map_err(|_| {
                AppError::ServiceError {
                    message: "Failed to parse API key".to_string(),
                }
            })?);

        // 4. Parse target address and path from server_url
        // Extract host, port, and path prefix from the full URL
        let url_without_protocol = config
            .server_url
            .strip_prefix("https://")
            .or_else(|| config.server_url.strip_prefix("http://"))
            .unwrap_or(&config.server_url);

        // Extract host, port, and path prefix
        let parts: Vec<&str> = url_without_protocol.splitn(2, '/').collect();
        let host_and_port = parts[0];
        let backend_path_prefix = if parts.len() > 1 {
            format!("/{}", parts[1])
        } else {
            String::new()
        };

        // Determine target address with port
        let target_addr = if host_and_port.contains(':') {
            // Port is explicitly specified in URL (e.g., "api.example.com:8443")
            host_and_port.to_string()
        } else {
            // Use standard port based on protocol
            let default_port = if config.server_url.starts_with("https://") {
                443
            } else {
                80
            };
            format!("{}:{}", host_and_port, default_port)
        };

        // Build complete target path by combining backend prefix with client path
        let target_path = if !backend_path_prefix.is_empty() {
            format!("{}{}", backend_path_prefix, client_path_and_query)
        } else {
            client_path_and_query.to_string()
        };

        log::debug!("Target address: {}, Target path: {}", target_addr, target_path);

        // 5. Check if HTTPS is required
        let is_https = config.server_url.starts_with("https://");

        // 6. Connect to target server with timeout
        let tcp_stream = timeout(
            Duration::from_secs(REQUEST_TIMEOUT_SECS),
            TcpStream::connect(&target_addr),
        )
        .await
        .map_err(|_| {
            log::error!("Connection timeout to target server: {}", target_addr);
            AppError::ServiceError {
                message: "Connection timeout".to_string(),
            }
        })?
        .map_err(|e| {
            log::error!("Failed to connect to target server ({}): {}", target_addr, e);
            AppError::ServiceError {
                message: format!("Connection failed: {}", e),
            }
        })?;

        // 7. Wrap stream based on protocol
        let stream = if is_https {
            // Extract hostname for TLS SNI
            let hostname = url_without_protocol
                .split('/')
                .next()
                .unwrap_or(url_without_protocol)
                .split(':')
                .next()
                .unwrap_or(url_without_protocol);

            log::debug!("Performing TLS handshake for HTTPS connection to {}", hostname);

            // Create TLS connector with default config
            let mut root_store = rustls::RootCertStore::empty();
            root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

            let tls_config = rustls::ClientConfig::builder()
                .with_root_certificates(root_store)
                .with_no_client_auth();

            let connector = TlsConnector::from(Arc::new(tls_config));

            // Perform TLS handshake
            let server_name = ServerName::try_from(hostname.to_string())
                .map_err(|e| AppError::ServiceError {
                    message: format!("Invalid hostname for TLS: {}", e),
                })?;

            let tls_stream = connector
                .connect(server_name, tcp_stream)
                .await
                .map_err(|e| {
                    log::error!("TLS handshake failed: {}", e);
                    AppError::ServiceError {
                        message: format!("TLS handshake failed: {}", e),
                    }
                })?;

            MaybeHttpsStream::Https(tls_stream)
        } else {
            // Plain HTTP connection
            MaybeHttpsStream::Http(tcp_stream)
        };

        let io = TokioIo::new(stream);

        // 8. Create HTTP/1.1 connection
        let (mut sender, conn) = hyper::client::conn::http1::handshake(io)
            .await
            .map_err(|e| {
                log::error!("HTTP handshake failed: {}", e);
                AppError::ServiceError {
                    message: format!("HTTP handshake failed: {}", e),
                }
            })?;

        // 9. Spawn connection handler task
        tokio::spawn(async move {
            if let Err(e) = conn.await {
                log::error!("Connection error: {}", e);
            }
        });

        // 10. Modify request URI to target path
        // We need to create a new request with the modified URI
        let (mut parts, body) = req.into_parts();

        // Build new URI with target path
        let new_uri = target_path.parse::<hyper::Uri>()
            .map_err(|e| AppError::ServiceError {
                message: format!("Failed to parse target URI: {}", e),
            })?;

        parts.uri = new_uri;
        let req = Request::from_parts(parts, body);

        log::debug!("Modified request URI to: {}", req.uri());

        // 11. Send request with timeout
        let response = timeout(
            Duration::from_secs(REQUEST_TIMEOUT_SECS),
            sender.send_request(req),
        )
        .await
        .map_err(|_| {
            log::error!("Request timeout");
            AppError::ServiceError {
                message: "Request timeout".to_string(),
            }
        })?
        .map_err(|e| {
            log::error!("Failed to send request: {}", e);
            AppError::ServiceError {
                message: format!("Request failed: {}", e),
            }
        })?;

        log::info!(
            "Received response: status={}, headers={:?}",
            response.status(),
            response.headers()
        );

        // 9. Check for quota exceeded (status 429)
        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            return Err(AppError::ServiceError {
                message: "API quota exceeded".to_string(),
            });
        }

        // 10. Read response body
        let status = response.status();
        let headers = response.headers().clone();

        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| {
                log::error!("Failed to read response body: {}", e);
                AppError::ServiceError {
                    message: format!("Failed to read response body: {}", e),
                }
            })?
            .to_bytes();

        let body_str = String::from_utf8_lossy(&body_bytes).to_string();

        // 11. Construct response
        let mut resp = Response::new(body_str);
        *resp.status_mut() = status;
        *resp.headers_mut() = headers;

        Ok(resp)
    }

    /// Classify error type for auto-switch trigger
    fn classify_error(&self, error: &AppError) -> (SwitchReason, String) {
        let error_msg = format!("{}", error);

        if error_msg.contains("timeout") || error_msg.contains("Timeout") {
            (SwitchReason::Timeout, error_msg)
        } else if error_msg.contains("quota") || error_msg.contains("429") {
            (SwitchReason::QuotaExceeded, error_msg)
        } else if error_msg.contains("Connection") || error_msg.contains("connect") {
            (SwitchReason::ConnectionFailed, error_msg)
        } else {
            // Default to connection failed for unknown errors
            (SwitchReason::ConnectionFailed, error_msg)
        }
    }

    /// Quick route: default response when no configuration
    pub fn default_response(
        status: StatusCode,
        message: &str,
    ) -> Response<String> {
        Response::builder()
            .status(status)
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(message.to_string())
            .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_response() {
        let resp = RequestRouter::default_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Proxy service unavailable",
        );

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(resp.body(), "Proxy service unavailable");
    }
}
