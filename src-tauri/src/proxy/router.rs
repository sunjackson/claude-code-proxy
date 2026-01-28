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
use crate::services::model_mapping_service::ModelMappingService;
use crate::converters::claude_types::ClaudeRequest;
use crate::converters::claude_to_gemini::convert_claude_request_to_gemini;
use crate::converters::gemini_to_claude::{convert_gemini_response_to_claude, convert_gemini_stream_chunk_to_claude_events};
use crate::converters::gemini_types::GeminiResponse;
use crate::converters::openai_types::OpenAIRequest;
use super::smart_router::{RoutingContext, ConversionDirection};
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use http_body_util::{BodyExt, combinators::BoxBody, StreamBody};
use hyper::body::{Bytes, Frame};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::TlsConnector;
use rustls::pki_types::ServerName;
use tokio::io::{AsyncRead, AsyncWrite};
use futures_util::stream::Stream;
use std::pin::Pin;
use std::convert::Infallible;
use std::task::{Context, Poll};
use tokio::sync::mpsc;

/// Request timeout in seconds (FR-012)
/// Increased to 120s for streaming responses
const REQUEST_TIMEOUT_SECS: u64 = 120;

/// High latency threshold in milliseconds
const HIGH_LATENCY_THRESHOLD_MS: u128 = 3000;

/// 流式响应完成后的数据
#[derive(Debug, Clone)]
pub struct StreamCompletionData {
    /// 响应体内容（截取前 8KB）
    pub response_body: String,
    /// 响应体总大小
    pub response_body_size: u64,
    /// 流式 chunk 数量
    pub chunk_count: u32,
}

/// 转发请求的详细信息
#[derive(Debug, Clone, Default)]
pub struct ForwardDetails {
    /// 请求体 (用于日志，可能被截断)
    pub request_body: Option<String>,
    /// 请求体大小
    pub request_body_size: u64,
    /// 响应头 (JSON 格式)
    pub response_headers: Option<String>,
    /// 响应体 (用于日志，可能被截断)
    pub response_body: Option<String>,
    /// 响应体大小
    pub response_body_size: u64,
    /// 是否是流式响应
    pub is_streaming: bool,
    /// 流式 chunk 数量
    pub stream_chunk_count: u32,
    /// 提取的模型名称（原始）
    pub model: Option<String>,
    /// 映射后的模型名称
    pub mapped_model: Option<String>,
    /// 目标 URL
    pub target_url: Option<String>,
}

/// 流式响应捕获包装器
/// 在传输数据的同时收集数据，流结束后通过通道发送完整数据
struct StreamingBodyWrapper<B> {
    inner: B,
    buffer: Vec<u8>,
    chunk_count: u32,
    completion_tx: Option<mpsc::Sender<StreamCompletionData>>,
}

impl<B> StreamingBodyWrapper<B> {
    fn new(inner: B, completion_tx: mpsc::Sender<StreamCompletionData>) -> Self {
        Self {
            inner,
            buffer: Vec::new(),
            chunk_count: 0,
            completion_tx: Some(completion_tx),
        }
    }

    fn send_completion(&mut self) {
        if let Some(tx) = self.completion_tx.take() {
            let body_str = String::from_utf8_lossy(&self.buffer);
            let response_body = if body_str.len() > 8192 {
                format!("{}...(truncated)", &body_str[..8192])
            } else {
                body_str.to_string()
            };

            let data = StreamCompletionData {
                response_body,
                response_body_size: self.buffer.len() as u64,
                chunk_count: self.chunk_count,
            };

            // 使用 try_send 避免阻塞
            let _ = tx.try_send(data);
        }
    }
}

impl<B> http_body::Body for StreamingBodyWrapper<B>
where
    B: http_body::Body<Data = Bytes> + Unpin,
    B::Error: std::fmt::Debug,
{
    type Data = Bytes;
    type Error = B::Error;

    fn poll_frame(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        let inner = Pin::new(&mut self.inner);
        match inner.poll_frame(cx) {
            Poll::Ready(Some(Ok(frame))) => {
                if let Some(data) = frame.data_ref() {
                    // 收集数据到缓冲区
                    self.buffer.extend_from_slice(data);
                    self.chunk_count += 1;
                }
                Poll::Ready(Some(Ok(frame)))
            }
            Poll::Ready(Some(Err(e))) => {
                // 发生错误时也发送已收集的数据
                self.send_completion();
                Poll::Ready(Some(Err(e)))
            }
            Poll::Ready(None) => {
                // 流结束，发送完整数据
                self.send_completion();
                Poll::Ready(None)
            }
            Poll::Pending => Poll::Pending,
        }
    }

    fn is_end_stream(&self) -> bool {
        false
    }

    fn size_hint(&self) -> http_body::SizeHint {
        self.inner.size_hint()
    }
}

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
    /// Proxy server configuration (shared with ProxyServer)
    proxy_config: Option<Arc<tokio::sync::RwLock<crate::proxy::server::ProxyConfig>>>,
}

impl RequestRouter {
    /// Create a new request router
    #[allow(dead_code)]
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        let auto_switch = Arc::new(AutoSwitchService::new(db_pool.clone()));
        Self {
            db_pool,
            auto_switch,
            proxy_config: None,
        }
    }

    /// Create a new request router with proxy config reference and shared auto-switch service
    pub fn new_with_config(
        db_pool: Arc<DbPool>,
        proxy_config: Arc<tokio::sync::RwLock<crate::proxy::server::ProxyConfig>>,
        auto_switch: Arc<AutoSwitchService>,
    ) -> Self {
        Self {
            db_pool,
            auto_switch,
            proxy_config: Some(proxy_config),
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
    /// - Tuple of (forwarded response, forward details, optional stream completion receiver) or error
    pub async fn forward_request(
        &self,
        req: Request<Incoming>,
        config_id: i64,
        group_id: i64,
    ) -> AppResult<(Response<BoxBody<Bytes, hyper::Error>>, ForwardDetails, Option<mpsc::Receiver<StreamCompletionData>>)> {
        let start_time = Instant::now();

        // Try forwarding with current config
        match self.try_forward(req, config_id, group_id).await {
            Ok((response, details, stream_rx)) => {
                let latency = start_time.elapsed().as_millis();

                // Get group's latency threshold from database
                let latency_threshold = self.db_pool.with_connection(|conn| {
                    use crate::services::config_manager::ConfigManager;
                    ConfigManager::get_group_by_id(conn, group_id)
                        .map(|g| g.latency_threshold_ms as u128)
                }).unwrap_or(HIGH_LATENCY_THRESHOLD_MS);

                // Check for high latency trigger (FR-016)
                if latency > latency_threshold {
                    log::warn!(
                        "High latency detected: {}ms (threshold: {}ms)",
                        latency,
                        latency_threshold
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
                } else {
                    // T043: 成功请求，重置失败计数器
                    self.auto_switch.reset_failure_counter(config_id);
                }

                Ok((response, details, stream_rx))
            }
            Err(e) => {
                // T045: 使用智能重试机制处理失败
                let (_reason, error_msg) = self.classify_error(&e);
                let latency = start_time.elapsed().as_millis() as i32;

                log::error!("Request failed: {}, error_msg: {}", e, error_msg);

                // T037-T044: 调用智能重试逻辑 (错误分类、可恢复性判断、重试决策)
                match self
                    .auto_switch
                    .handle_failure_with_retry(config_id, group_id, error_msg.clone(), Some(latency))
                    .await
                {
                    Ok(Some(new_config_id)) => {
                        // 立即切换到新配置
                        log::info!("立即切换到新配置: {}", new_config_id);

                        // Update proxy config if we have reference
                        if let Some(proxy_cfg) = &self.proxy_config {
                            let mut cfg = proxy_cfg.write().await;
                            cfg.active_config_id = Some(new_config_id);
                            log::info!("Updated proxy active_config_id to {}", new_config_id);
                        }

                        // Update database ProxyService record
                        if let Err(update_err) = self.update_proxy_service_config(new_config_id).await {
                            log::error!("Failed to update ProxyService config: {}", update_err);
                        } else {
                            log::info!("Updated ProxyService current_config_id to {}", new_config_id);
                        }

                        // Cannot retry because Request<Incoming> cannot be cloned
                        // The next request will use the new config
                        Err(e)
                    }
                    Ok(None) => {
                        // 决定重试当前配置（不切换）
                        log::info!("决定重试当前配置: {}, 下次请求将继续使用", config_id);
                        Err(e)
                    }
                    Err(switch_err) => {
                        log::error!("智能重试处理失败: {}", switch_err);
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
    ) -> AppResult<(Response<BoxBody<Bytes, hyper::Error>>, ForwardDetails, Option<mpsc::Receiver<StreamCompletionData>>)> {
        // 初始化详情收集器
        let mut details = ForwardDetails::default();

        // 1. Get configuration and API key
        let (config, api_key) = self.db_pool.with_connection(|conn| {
            let config = ApiConfigService::get_config_by_id(conn, config_id)?;
            let api_key = ApiConfigService::get_api_key(conn, config_id)?;
            Ok((config, api_key))
        })?;

        // 记录目标 URL
        details.target_url = Some(config.server_url.clone());

        log::info!(
            "Forwarding request to config: {} ({})",
            config.name,
            config.server_url
        );

        // 2. Extract client request path and query
        let client_uri = req.uri().clone();
        let raw_path_and_query = client_uri.path_and_query()
            .map(|pq| pq.as_str())
            .unwrap_or("/");

        // Strip /session/{session_id} prefix if present
        // This allows session-based routing while keeping the actual API path clean
        let client_path_and_query = if raw_path_and_query.starts_with("/session/") {
            // Find the end of session_id (next '/' or end of path)
            if let Some(rest) = raw_path_and_query.strip_prefix("/session/") {
                // Skip session_id to find the actual path
                if let Some(slash_pos) = rest.find('/') {
                    &rest[slash_pos..]
                } else {
                    // Only session prefix, no further path
                    "/"
                }
            } else {
                raw_path_and_query
            }
        } else {
            raw_path_and_query
        };

        log::debug!("Client request path: {} (original: {})", client_path_and_query, raw_path_and_query);

        // Log original Authorization header for debugging session routing
        let original_auth = req.headers()
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .map(|s| {
                if s.len() > 30 {
                    format!("{}...(truncated)", &s[..30])
                } else {
                    s.to_string()
                }
            });
        log::info!("原始请求头 Original request headers: {:?}, Authorization: {:?}", req.headers(), original_auth);

        // 2.1 创建智能路由上下文 - 检测客户端类型并决定转换方向
        let routing_ctx = RoutingContext::new(
            req.headers(),
            client_path_and_query,
            config.provider_type,
        );
        log::info!(
            "Smart routing: client={}, client_format={:?}, provider={:?}, request_conv={}, response_conv={}",
            routing_ctx.client_type,
            routing_ctx.client_format,
            routing_ctx.provider_type,
            routing_ctx.request_conversion,
            routing_ctx.response_conversion
        );

        // 3. Parse target address first (needed for Host header)
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

        // 修改请求头：设置正确的Host头和API密钥
        let headers = req.headers_mut();

        // 1. 设置Host头为后端主机名（88Code等服务会检查Host头来验证请求来源）
        // 提取主机名（不含端口）
        let backend_host = host_and_port.split(':').next().unwrap_or(host_and_port);
        headers.insert("host", backend_host.parse().map_err(|_| {
            AppError::ServiceError {
                message: "Failed to parse backend host".to_string(),
            }
        })?);

        // 2. 替换 Authorization 头为后端服务的 API 密钥（使用 Bearer 格式）
        // 注意：不删除，而是替换，因为后端服务需要 Authorization 头来认证
        let auth_value = format!("Bearer {}", api_key);
        headers.insert("authorization", auth_value.parse().map_err(|_| {
            AppError::ServiceError {
                message: "Failed to parse authorization header".to_string(),
            }
        })?);

        log::info!("已修改请求头 - Host: {}, Authorization: Bearer xxx...", backend_host);

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

            // Create TLS connector with explicit crypto provider
            let mut root_store = rustls::RootCertStore::empty();
            root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

            // Explicitly use ring crypto provider to avoid runtime panic
            let tls_config = rustls::ClientConfig::builder_with_provider(
                    rustls::crypto::ring::default_provider().into()
                )
                .with_safe_default_protocol_versions()
                .expect("Failed to configure TLS protocol versions")
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

        // 10.1 Handle API conversion based on provider type
        let body = if parts.method == hyper::Method::POST || parts.method == hyper::Method::PUT {
            // Collect request body
            let body_bytes = body.collect().await
                .map_err(|e| AppError::ServiceError {
                    message: format!("Failed to read request body: {}", e),
                })?
                .to_bytes();

            // 记录请求体大小
            details.request_body_size = body_bytes.len() as u64;

            // 记录完整请求体
            let body_str = String::from_utf8_lossy(&body_bytes);
            details.request_body = Some(body_str.to_string());

            // 尝试从请求体提取模型名称
            let mut source_model: Option<String> = None;
            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                if let Some(model) = json.get("model").and_then(|m| m.as_str()) {
                    source_model = Some(model.to_string());
                    details.model = Some(model.to_string());
                }
            }

            // 查询模型映射（如果需要转换）
            let mapped_model: Option<String> = if routing_ctx.request_conversion != ConversionDirection::NoConversion {
                if let Some(ref src_model) = source_model {
                    let direction_str = routing_ctx.request_conversion.to_string();
                    let db_pool = self.db_pool.clone();
                    db_pool.with_connection(|conn| {
                        Ok(ModelMappingService::lookup_target_model(conn, src_model, &direction_str))
                    }).unwrap_or(None)
                } else {
                    None
                }
            } else {
                None
            };

            // 记录映射后的模型名称
            if mapped_model.is_some() {
                details.mapped_model = mapped_model.clone();
                log::info!(
                    "Model mapping applied: {} -> {}",
                    source_model.as_deref().unwrap_or("unknown"),
                    mapped_model.as_deref().unwrap_or("unknown")
                );
            }

            // Check conversion direction and perform conversion if needed
            let processed_bytes = match routing_ctx.request_conversion {
                ConversionDirection::NoConversion => {
                    // 无需转换 - 过滤不支持的字段后直接转发
                    log::info!("No request conversion needed, forwarding as-is");
                    match serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                        Ok(mut json) => {
                            // Remove unsupported fields
                            if let Some(obj) = json.as_object_mut() {
                                let removed_fields: Vec<String> = obj.keys()
                                    .filter(|k| k.as_str() == "context_management")
                                    .cloned()
                                    .collect();

                                for field in &removed_fields {
                                    obj.remove(field);
                                    log::debug!("Filtered unsupported field from request: {}", field);
                                }
                            }
                            serde_json::to_vec(&json)
                                .map_err(|e| AppError::ServiceError {
                                    message: format!("Failed to serialize filtered request: {}", e),
                                })?
                        }
                        Err(_) => {
                            log::debug!("Request body is not JSON, forwarding as-is");
                            body_bytes.to_vec()
                        }
                    }
                },
                ConversionDirection::ClaudeToOpenAI => {
                    log::info!("Converting Claude request to OpenAI format");
                    let claude_req: ClaudeRequest = serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse Claude request: {}", e),
                        })?;

                    let mut openai_req = crate::converters::openai_claude::convert_claude_request_to_openai(&claude_req);

                    // 应用模型映射
                    if let Some(ref target_model) = mapped_model {
                        openai_req.model = target_model.clone();
                    }

                    // Update target path to OpenAI API endpoint
                    let openai_path = "/v1/chat/completions";
                    let openai_uri = openai_path.parse::<hyper::Uri>()
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to parse OpenAI URI: {}", e),
                        })?;
                    parts.uri = openai_uri;

                    log::info!("Updated request URI to OpenAI endpoint: {}", openai_path);

                    serde_json::to_vec(&openai_req)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize OpenAI request: {}", e),
                        })?
                },
                ConversionDirection::OpenAIToClaude => {
                    log::info!("Converting OpenAI request to Claude format");
                    let openai_req: OpenAIRequest = serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse OpenAI request: {}", e),
                        })?;

                    let mut claude_req = crate::converters::openai_claude::convert_openai_request_to_claude(&openai_req);

                    // 应用模型映射
                    if let Some(ref target_model) = mapped_model {
                        claude_req.model = target_model.clone();
                    }

                    // Update target path to Claude API endpoint
                    let claude_path = "/v1/messages";
                    let claude_uri = claude_path.parse::<hyper::Uri>()
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to parse Claude URI: {}", e),
                        })?;
                    parts.uri = claude_uri;

                    log::info!("Updated request URI to Claude endpoint: {}", claude_path);

                    serde_json::to_vec(&claude_req)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize Claude request: {}", e),
                        })?
                },
                ConversionDirection::ClaudeToGemini => {
                    log::info!("Converting Claude request to Gemini format");
                    let claude_req: ClaudeRequest = serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse Claude request: {}", e),
                        })?;

                    // 优先使用映射后的模型名，否则使用配置的默认模型
                    let gemini_model = mapped_model
                        .as_deref()
                        .or_else(|| config.default_model.as_ref().filter(|m| !m.is_empty()).map(|m| m.as_str()))
                        .unwrap_or("gemini-pro");

                    let (gemini_req, gemini_path) = convert_claude_request_to_gemini(&claude_req, gemini_model)?;

                    let gemini_uri = gemini_path.parse::<hyper::Uri>()
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to parse Gemini URI: {}", e),
                        })?;
                    parts.uri = gemini_uri;

                    log::info!("Updated request URI to Gemini endpoint: {}", gemini_path);

                    serde_json::to_vec(&gemini_req)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize Gemini request: {}", e),
                        })?
                },
                ConversionDirection::OpenAIToGemini => {
                    log::info!("Converting OpenAI request to Gemini format");
                    // 先将 OpenAI 转为 Claude，再转为 Gemini
                    let openai_req: OpenAIRequest = serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse OpenAI request: {}", e),
                        })?;

                    let claude_req = crate::converters::openai_claude::convert_openai_request_to_claude(&openai_req);

                    // 优先使用映射后的模型名，否则使用配置的默认模型
                    let gemini_model = mapped_model
                        .as_deref()
                        .or_else(|| config.default_model.as_ref().filter(|m| !m.is_empty()).map(|m| m.as_str()))
                        .unwrap_or("gemini-pro");

                    let (gemini_req, gemini_path) = convert_claude_request_to_gemini(&claude_req, gemini_model)?;

                    let gemini_uri = gemini_path.parse::<hyper::Uri>()
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to parse Gemini URI: {}", e),
                        })?;
                    parts.uri = gemini_uri;

                    log::info!("Updated request URI to Gemini endpoint: {}", gemini_path);

                    serde_json::to_vec(&gemini_req)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize Gemini request: {}", e),
                        })?
                },
                ConversionDirection::GeminiToClaude | ConversionDirection::GeminiToOpenAI => {
                    // Gemini 客户端通常不会发送请求到代理，暂时不支持
                    log::warn!("Gemini-originated requests are not yet supported, forwarding as-is");
                    body_bytes.to_vec()
                }
            };

            // Update Content-Length header
            parts.headers.insert(
                hyper::header::CONTENT_LENGTH,
                processed_bytes.len().to_string().parse().unwrap()
            );

            use http_body_util::Full;
            Full::new(Bytes::from(processed_bytes))
                .map_err(|e| match e {})
                .boxed()
        } else {
            // For GET/DELETE, just forward the body as-is
            body.boxed()
        };

        let req = Request::from_parts(parts, body);

        log::debug!("Modified request URI to: {}", req.uri());
        log::info!("发送给后端的请求头 Final request headers: {:?}", req.headers());

        // 11. Send request with timeout
        log::info!("Sending HTTP request to backend...");
        let send_start = std::time::Instant::now();

        let response = timeout(
            Duration::from_secs(REQUEST_TIMEOUT_SECS),
            sender.send_request(req),
        )
        .await
        .map_err(|_| {
            log::error!("Request timeout after {}ms (timeout: {}s)",
                send_start.elapsed().as_millis(), REQUEST_TIMEOUT_SECS);
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

        // 立即计算并记录延迟（首字节响应时间）
        let latency_ms = send_start.elapsed().as_millis() as i32;
        log::info!(
            "Received response: status={}, headers={:?}, latency={}ms",
            response.status(),
            response.headers(),
            latency_ms
        );

        // 更新配置的延迟信息
        if let Err(e) = self.db_pool.with_connection(|conn| {
            ApiConfigService::update_latency(conn, config_id, latency_ms)
        }) {
            log::warn!("Failed to update latency for config {}: {}", config_id, e);
            // 不影响请求继续处理
        }

        // 9. Get response status and headers
        let status = response.status();
        let headers = response.headers().clone();

        // 记录响应头（JSON 格式）
        let headers_map: std::collections::HashMap<String, String> = headers
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();
        details.response_headers = serde_json::to_string(&headers_map).ok();

        // 判断是否是流式响应
        details.is_streaming = headers
            .get(hyper::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|ct| ct.contains("text/event-stream") || ct.contains("stream"))
            .unwrap_or(false);

        // 10. Check for error status codes and inspect response body for critical errors
        if status.is_client_error() || status.is_server_error() {
            log::warn!("Received error status: {}", status);

            // Collect response body to analyze error content
            let body_bytes = response.into_body()
                .collect()
                .await
                .map_err(|e| AppError::ServiceError {
                    message: format!("Failed to read error response body: {}", e),
                })?
                .to_bytes();

            let body_text = String::from_utf8_lossy(&body_bytes);
            log::error!("Error response body: {}", body_text);

            // 记录错误响应体
            details.response_body_size = body_bytes.len() as u64;
            details.response_body = Some(if body_text.len() > 8192 {
                format!("{}...(truncated)", &body_text[..8192])
            } else {
                body_text.to_string()
            });

            // Check for critical errors that should trigger auto-switch
            let lower_text = body_text.to_lowercase();

            // 余额不足
            if lower_text.contains("余额不足")
                || lower_text.contains("insufficient") && lower_text.contains("balance")
                || lower_text.contains("insufficient") && lower_text.contains("credit")
                || status == StatusCode::PAYMENT_REQUIRED {
                return Err(AppError::ServiceError {
                    message: format!("Insufficient balance: {}", body_text),
                });
            }

            // 账号被封禁
            if lower_text.contains("banned")
                || lower_text.contains("suspended")
                || lower_text.contains("disabled")
                || lower_text.contains("blocked")
                || (status == StatusCode::FORBIDDEN && (
                    lower_text.contains("account") || lower_text.contains("api key")
                )) {
                return Err(AppError::ServiceError {
                    message: format!("Account banned or suspended: {}", body_text),
                });
            }

            // API密钥无效
            if status == StatusCode::UNAUTHORIZED
                || lower_text.contains("invalid api key")
                || lower_text.contains("invalid token")
                || lower_text.contains("authentication failed") {
                return Err(AppError::ServiceError {
                    message: format!("Authentication failed: {}", body_text),
                });
            }

            // 限流/配额超限
            if status == StatusCode::TOO_MANY_REQUESTS
                || lower_text.contains("rate limit")
                || lower_text.contains("quota exceeded") {
                return Err(AppError::ServiceError {
                    message: format!("Rate limit or quota exceeded: {}", body_text),
                });
            }

            // 其他客户端错误 - 不触发切换，直接返回给客户端
            if status.is_client_error() {
                log::info!("Client error ({}), returning to client without auto-switch", status);
                use http_body_util::Full;
                let body = Full::new(body_bytes).map_err(|e| match e {}).boxed();
                let mut resp = Response::new(body);
                *resp.status_mut() = status;
                *resp.headers_mut() = headers;
                return Ok((resp, details, None));
            }

            // 服务器错误 - 触发切换
            return Err(AppError::ServiceError {
                message: format!("Server error ({}): {}", status, body_text),
            });
        }

        // 11. Success response - Handle conversion based on response_conversion direction
        match routing_ctx.response_conversion {
            ConversionDirection::NoConversion => {
                // 无需响应转换 - 直接透传响应
                log::info!("No response conversion needed, forwarding as-is");
                let body = response.into_body();

                // 为流式响应创建通道
                if details.is_streaming {
                    let (tx, rx) = mpsc::channel::<StreamCompletionData>(1);
                    let wrapped_body = StreamingBodyWrapper::new(body, tx);
                    let boxed_body = wrapped_body.boxed();

                    let mut resp = Response::new(boxed_body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;

                    log::info!("Streaming response with capture wrapper (status: {})", status);
                    return Ok((resp, details, Some(rx)));
                }

                // 非流式响应
                let body_bytes = body
                    .collect()
                    .await
                    .map_err(|e| AppError::ServiceError {
                        message: format!("Failed to read response body: {}", e),
                    })?
                    .to_bytes();

                details.response_body_size = body_bytes.len() as u64;
                let response_str = String::from_utf8_lossy(&body_bytes);
                details.response_body = Some(if response_str.len() > 8192 {
                    format!("{}...(truncated)", &response_str[..8192])
                } else {
                    response_str.to_string()
                });

                use http_body_util::Full;
                let boxed_body = Full::new(body_bytes).map_err(|e| match e {}).boxed();
                let mut resp = Response::new(boxed_body);
                *resp.status_mut() = status;
                *resp.headers_mut() = headers;

                log::info!("Non-streaming pass-through response (status: {}, size: {} bytes)", status, details.response_body_size);
                Ok((resp, details, None))
            },
            ConversionDirection::OpenAIToClaude => {
                // OpenAI 响应 → Claude 格式 (客户端是 Claude Code)
                log::info!("Converting OpenAI response to Claude format");

                let is_streaming = headers
                    .get(hyper::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|ct| ct.contains("text/event-stream") || ct.contains("stream"))
                    .unwrap_or(false);

                if is_streaming {
                    log::info!("Converting OpenAI streaming response to Claude SSE format");
                    let claude_model = "claude-sonnet-4-5-20250929".to_string();
                    let body = response.into_body();

                    let converted_stream = Self::convert_openai_stream(body, claude_model);
                    use futures_util::TryStreamExt;
                    let mapped_stream = converted_stream.map_err(|e: Infallible| match e {});

                    let stream_body = StreamBody::new(mapped_stream);
                    let boxed_body = BodyExt::boxed(stream_body);

                    let mut resp = Response::new(boxed_body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_TYPE,
                        "text/event-stream".parse().unwrap()
                    );

                    log::info!("Streaming OpenAI→Claude response conversion started");
                    Ok((resp, details, None))
                } else {
                    let body_bytes = response.into_body()
                        .collect()
                        .await
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to read OpenAI response body: {}", e),
                        })?
                        .to_bytes();

                    let openai_resp: crate::converters::openai_types::OpenAIResponse =
                        serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse OpenAI response: {}", e),
                        })?;

                    let claude_model = "claude-sonnet-4-5-20250929";
                    let claude_resp = crate::converters::openai_claude::convert_openai_response_to_claude(
                        &openai_resp,
                        claude_model
                    );

                    let claude_bytes = serde_json::to_vec(&claude_resp)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize Claude response: {}", e),
                        })?;

                    log::info!("Successfully converted OpenAI response to Claude format");

                    details.response_body_size = claude_bytes.len() as u64;
                    let response_str = String::from_utf8_lossy(&claude_bytes);
                    details.response_body = Some(if response_str.len() > 8192 {
                        format!("{}...(truncated)", &response_str[..8192])
                    } else {
                        response_str.to_string()
                    });

                    let content_length = claude_bytes.len();
                    use http_body_util::Full;
                    let body = Full::new(Bytes::from(claude_bytes)).map_err(|e| match e {}).boxed();
                    let mut resp = Response::new(body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_LENGTH,
                        content_length.to_string().parse().unwrap()
                    );

                    Ok((resp, details, None))
                }
            },
            ConversionDirection::ClaudeToOpenAI => {
                // Claude 响应 → OpenAI 格式 (客户端是 Codex/Cursor)
                log::info!("Converting Claude response to OpenAI format");

                let is_streaming = headers
                    .get(hyper::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|ct| ct.contains("text/event-stream") || ct.contains("stream"))
                    .unwrap_or(false);

                if is_streaming {
                    log::info!("Converting Claude streaming response to OpenAI SSE format");
                    let body = response.into_body();

                    // 使用 Claude → OpenAI 流转换器
                    let converted_stream = Self::convert_claude_to_openai_stream(body);
                    use futures_util::TryStreamExt;
                    let mapped_stream = converted_stream.map_err(|e: Infallible| match e {});

                    let stream_body = StreamBody::new(mapped_stream);
                    let boxed_body = BodyExt::boxed(stream_body);

                    let mut resp = Response::new(boxed_body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_TYPE,
                        "text/event-stream".parse().unwrap()
                    );

                    log::info!("Streaming Claude→OpenAI response conversion started");
                    Ok((resp, details, None))
                } else {
                    let body_bytes = response.into_body()
                        .collect()
                        .await
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to read Claude response body: {}", e),
                        })?
                        .to_bytes();

                    let claude_resp: crate::converters::claude_types::ClaudeResponse =
                        serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse Claude response: {}", e),
                        })?;

                    let openai_resp = crate::converters::openai_claude::convert_claude_response_to_openai(&claude_resp, "gpt-4");

                    let openai_bytes = serde_json::to_vec(&openai_resp)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize OpenAI response: {}", e),
                        })?;

                    log::info!("Successfully converted Claude response to OpenAI format");

                    details.response_body_size = openai_bytes.len() as u64;
                    let response_str = String::from_utf8_lossy(&openai_bytes);
                    details.response_body = Some(if response_str.len() > 8192 {
                        format!("{}...(truncated)", &response_str[..8192])
                    } else {
                        response_str.to_string()
                    });

                    let content_length = openai_bytes.len();
                    use http_body_util::Full;
                    let body = Full::new(Bytes::from(openai_bytes)).map_err(|e| match e {}).boxed();
                    let mut resp = Response::new(body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_LENGTH,
                        content_length.to_string().parse().unwrap()
                    );

                    Ok((resp, details, None))
                }
            },
            ConversionDirection::GeminiToClaude => {
                // Gemini 响应 → Claude 格式
                log::info!("Converting Gemini response to Claude format");

                let is_streaming = headers
                    .get(hyper::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|ct| ct.contains("text/event-stream") || ct.contains("stream"))
                    .unwrap_or(false);

                if is_streaming {
                    log::info!("Converting Gemini streaming response to Claude SSE format");
                    let claude_model = "claude-sonnet-4-5-20250929".to_string();
                    let body = response.into_body();

                    let converted_stream = Self::convert_gemini_stream(body, claude_model);
                    use futures_util::TryStreamExt;
                    let mapped_stream = converted_stream.map_err(|e: Infallible| match e {});

                    let stream_body = StreamBody::new(mapped_stream);
                    let boxed_body = BodyExt::boxed(stream_body);

                    let mut resp = Response::new(boxed_body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_TYPE,
                        "text/event-stream".parse().unwrap()
                    );

                    log::info!("Streaming Gemini→Claude response conversion started");
                    Ok((resp, details, None))
                } else {
                    let body_bytes = response.into_body()
                        .collect()
                        .await
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to read Gemini response body: {}", e),
                        })?
                        .to_bytes();

                    let gemini_resp: GeminiResponse = serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse Gemini response: {}", e),
                        })?;

                    let claude_model = "claude-sonnet-4-5-20250929";
                    let claude_resp = convert_gemini_response_to_claude(&gemini_resp, claude_model)?;

                    let claude_bytes = serde_json::to_vec(&claude_resp)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize Claude response: {}", e),
                        })?;

                    log::info!("Successfully converted Gemini response to Claude format");

                    details.response_body_size = claude_bytes.len() as u64;
                    let response_str = String::from_utf8_lossy(&claude_bytes);
                    details.response_body = Some(if response_str.len() > 8192 {
                        format!("{}...(truncated)", &response_str[..8192])
                    } else {
                        response_str.to_string()
                    });

                    let content_length = claude_bytes.len();
                    use http_body_util::Full;
                    let body = Full::new(Bytes::from(claude_bytes)).map_err(|e| match e {}).boxed();
                    let mut resp = Response::new(body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_LENGTH,
                        content_length.to_string().parse().unwrap()
                    );

                    Ok((resp, details, None))
                }
            },
            ConversionDirection::GeminiToOpenAI => {
                // Gemini 响应 → OpenAI 格式 (客户端是 Codex/Cursor，后端是 Gemini)
                log::info!("Converting Gemini response to OpenAI format");

                let is_streaming = headers
                    .get(hyper::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|ct| ct.contains("text/event-stream") || ct.contains("stream"))
                    .unwrap_or(false);

                if is_streaming {
                    log::info!("Converting Gemini streaming response to OpenAI SSE format");
                    // 先转为 Claude，再转为 OpenAI (两阶段转换)
                    // TODO: 实现直接的 Gemini → OpenAI 流转换器
                    let body = response.into_body();

                    // 暂时先透传，后续实现双阶段流转换
                    let boxed_body = body.boxed();
                    let mut resp = Response::new(boxed_body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;

                    log::warn!("Gemini→OpenAI streaming conversion not yet implemented, passing through");
                    Ok((resp, details, None))
                } else {
                    let body_bytes = response.into_body()
                        .collect()
                        .await
                        .map_err(|e| AppError::ServiceError {
                            message: format!("Failed to read Gemini response body: {}", e),
                        })?
                        .to_bytes();

                    // 先转 Gemini → Claude
                    let gemini_resp: GeminiResponse = serde_json::from_slice(&body_bytes)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to parse Gemini response: {}", e),
                        })?;

                    let claude_model = "claude-sonnet-4-5-20250929";
                    let claude_resp = convert_gemini_response_to_claude(&gemini_resp, claude_model)?;

                    // 再转 Claude → OpenAI
                    let openai_resp = crate::converters::openai_claude::convert_claude_response_to_openai(&claude_resp, "gpt-4");

                    let openai_bytes = serde_json::to_vec(&openai_resp)
                        .map_err(|e| AppError::ConversionError {
                            message: format!("Failed to serialize OpenAI response: {}", e),
                        })?;

                    log::info!("Successfully converted Gemini response to OpenAI format (via Claude)");

                    details.response_body_size = openai_bytes.len() as u64;
                    let response_str = String::from_utf8_lossy(&openai_bytes);
                    details.response_body = Some(if response_str.len() > 8192 {
                        format!("{}...(truncated)", &response_str[..8192])
                    } else {
                        response_str.to_string()
                    });

                    let content_length = openai_bytes.len();
                    use http_body_util::Full;
                    let body = Full::new(Bytes::from(openai_bytes)).map_err(|e| match e {}).boxed();
                    let mut resp = Response::new(body);
                    *resp.status_mut() = status;
                    *resp.headers_mut() = headers;
                    resp.headers_mut().insert(
                        hyper::header::CONTENT_LENGTH,
                        content_length.to_string().parse().unwrap()
                    );

                    Ok((resp, details, None))
                }
            },
            ConversionDirection::ClaudeToGemini | ConversionDirection::OpenAIToGemini => {
                // 响应不应该需要转换到 Gemini 格式（Gemini 客户端不常见）
                log::warn!("Unexpected response conversion direction: {}, passing through", routing_ctx.response_conversion);
                let body = response.into_body().boxed();
                let mut resp = Response::new(body);
                *resp.status_mut() = status;
                *resp.headers_mut() = headers;
                Ok((resp, details, None))
            }
        }
    }

    /// Update ProxyService current_config_id in database
    async fn update_proxy_service_config(&self, new_config_id: i64) -> AppResult<()> {
        self.db_pool.with_connection(|conn| {
            conn.execute(
                "UPDATE ProxyService SET current_config_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                rusqlite::params![new_config_id],
            ).map_err(|e| AppError::DatabaseError {
                message: format!("Failed to update ProxyService: {}", e),
            })?;
            Ok(())
        })
    }

    /// Convert Gemini streaming response to Claude SSE format
    ///
    /// Gemini streams newline-delimited JSON objects, we convert them to Claude SSE events
    /// This stream never fails - all errors are converted to SSE error events
    fn convert_gemini_stream(
        body: Incoming,
        claude_model: String,
    ) -> Pin<Box<dyn Stream<Item = Result<Frame<Bytes>, Infallible>> + Send + Sync>> {
        Box::pin(futures_util::stream::unfold(
            (body, claude_model, Vec::new(), true),
            |(mut body, claude_model, mut buffer, mut is_first_chunk)| async move {
                loop {
                    // Try to get the next frame from the body
                    match body.frame().await {
                        Some(Ok(frame)) => {
                            // Only process data frames
                            if let Some(data) = frame.data_ref() {
                                buffer.extend_from_slice(data);

                                // Process complete lines (delimited by \n)
                                if let Some(newline_pos) = buffer.iter().position(|&b| b == b'\n') {
                                    // Extract the line
                                    let line_bytes = buffer.drain(..=newline_pos).collect::<Vec<_>>();
                                    let line = String::from_utf8_lossy(&line_bytes).trim().to_string();

                                    // Skip empty lines
                                    if line.is_empty() {
                                        continue;
                                    }

                                    // Convert Gemini JSON chunk to Claude SSE events
                                    match convert_gemini_stream_chunk_to_claude_events(
                                        &line,
                                        &claude_model,
                                        is_first_chunk,
                                    ) {
                                        Ok(events) => {
                                            is_first_chunk = false;

                                            // Combine all events into a single string
                                            let combined_events = events.join("");

                                            // Return the SSE events as a data frame
                                            let frame = Frame::data(Bytes::from(combined_events));
                                            return Some((
                                                Ok(frame),
                                                (body, claude_model, buffer, is_first_chunk),
                                            ));
                                        }
                                        Err(e) => {
                                            log::error!("Failed to convert Gemini stream chunk: {}", e);
                                            // Return error as SSE event instead of failing the stream
                                            let error_msg = format!("event: error\ndata: {{\"error\": \"{}\"}}\n\n", e);
                                            let frame = Frame::data(Bytes::from(error_msg));
                                            return Some((
                                                Ok(frame),
                                                (body, claude_model, buffer, is_first_chunk),
                                            ));
                                        }
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            log::error!("Error reading Gemini stream: {}", e);
                            // Return error as SSE event and end stream
                            let error_msg = format!("event: error\ndata: {{\"error\": \"Stream error: {}\"}}\n\n", e);
                            let frame = Frame::data(Bytes::from(error_msg));
                            return Some((
                                Ok(frame),
                                (body, claude_model, Vec::new(), false),
                            ));
                        }
                        None => {
                            // Stream ended
                            log::info!("Gemini stream conversion completed");
                            return None;
                        }
                    }
                }
            },
        ))
    }

    /// Convert OpenAI streaming response to Claude SSE format
    ///
    /// OpenAI streams SSE events with "data: {json}\n\n", we convert them to Claude SSE format
    /// This stream never fails - all errors are converted to SSE error events
    fn convert_openai_stream(
        body: Incoming,
        claude_model: String,
    ) -> Pin<Box<dyn Stream<Item = Result<Frame<Bytes>, Infallible>> + Send + Sync>> {
        Box::pin(futures_util::stream::unfold(
            (body, claude_model, Vec::new(), true, String::new()),
            |(mut body, claude_model, mut buffer, mut is_first_chunk, mut chunk_id)| async move {
                loop {
                    // Try to get the next frame from the body
                    match body.frame().await {
                        Some(Ok(frame)) => {
                            // Only process data frames
                            if let Some(data) = frame.data_ref() {
                                buffer.extend_from_slice(data);

                                // Process complete SSE lines (delimited by \n\n)
                                while let Some(double_newline_pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                                    // Extract the SSE event
                                    let event_bytes = buffer.drain(..double_newline_pos + 2).collect::<Vec<_>>();
                                    let event_str = String::from_utf8_lossy(&event_bytes).trim().to_string();

                                    // Skip empty events
                                    if event_str.is_empty() {
                                        continue;
                                    }

                                    // Check for [DONE] marker
                                    if event_str.contains("[DONE]") {
                                        log::info!("OpenAI stream completed with [DONE] marker");
                                        return None;
                                    }

                                    // Parse "data: {json}" format
                                    if let Some(json_str) = event_str.strip_prefix("data: ") {
                                        // Parse OpenAI stream chunk
                                        match serde_json::from_str::<crate::converters::openai_types::OpenAIStreamChunk>(json_str) {
                                            Ok(openai_chunk) => {
                                                // Generate chunk ID on first chunk
                                                if chunk_id.is_empty() {
                                                    chunk_id = openai_chunk.id.clone();
                                                }

                                                // Convert to Claude SSE events
                                                let claude_events = crate::converters::openai_claude::convert_claude_stream_to_openai(
                                                    &crate::converters::claude_types::ClaudeStreamEvent::ContentBlockDelta {
                                                        index: 0,
                                                        delta: crate::converters::claude_types::ClaudeContentDelta {
                                                            delta_type: "text_delta".to_string(),
                                                            text: openai_chunk.choices.first()
                                                                .and_then(|c| c.delta.content.clone()),
                                                        },
                                                    },
                                                    &claude_model,
                                                    &chunk_id,
                                                );

                                                is_first_chunk = false;

                                                // Return Claude SSE events if any
                                                if let Some(event_str) = claude_events {
                                                    let frame = Frame::data(Bytes::from(event_str));
                                                    return Some((
                                                        Ok(frame),
                                                        (body, claude_model, buffer, is_first_chunk, chunk_id),
                                                    ));
                                                }
                                            }
                                            Err(e) => {
                                                log::error!("Failed to parse OpenAI stream chunk: {}", e);
                                                // Continue to next chunk instead of failing
                                                continue;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            log::error!("Error reading OpenAI stream: {}", e);
                            // Return error as SSE event and end stream
                            let error_msg = format!("event: error\ndata: {{\"error\": \"Stream error: {}\"}}\n\n", e);
                            let frame = Frame::data(Bytes::from(error_msg));
                            return Some((
                                Ok(frame),
                                (body, claude_model, Vec::new(), false, chunk_id),
                            ));
                        }
                        None => {
                            // Stream ended
                            log::info!("OpenAI stream conversion completed");
                            return None;
                        }
                    }
                }
            },
        ))
    }

    /// Convert Claude streaming response to OpenAI SSE format
    ///
    /// Claude streams SSE events, we convert them to OpenAI SSE format
    /// This stream never fails - all errors are converted to SSE error events
    fn convert_claude_to_openai_stream(
        body: Incoming,
    ) -> Pin<Box<dyn Stream<Item = Result<Frame<Bytes>, Infallible>> + Send + Sync>> {
        Box::pin(futures_util::stream::unfold(
            (body, Vec::new(), String::new(), 0u32),
            |(mut body, mut buffer, mut request_id, mut chunk_index)| async move {
                loop {
                    match body.frame().await {
                        Some(Ok(frame)) => {
                            if let Some(data) = frame.data_ref() {
                                buffer.extend_from_slice(data);

                                // Process complete SSE lines (delimited by \n\n)
                                while let Some(double_newline_pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                                    let event_bytes = buffer.drain(..double_newline_pos + 2).collect::<Vec<_>>();
                                    let event_str = String::from_utf8_lossy(&event_bytes).trim().to_string();

                                    if event_str.is_empty() {
                                        continue;
                                    }

                                    // Parse Claude SSE event
                                    let mut event_type = String::new();
                                    let mut event_data = String::new();

                                    for line in event_str.lines() {
                                        if let Some(t) = line.strip_prefix("event: ") {
                                            event_type = t.to_string();
                                        } else if let Some(d) = line.strip_prefix("data: ") {
                                            event_data = d.to_string();
                                        }
                                    }

                                    // Generate request_id on first event
                                    if request_id.is_empty() {
                                        request_id = format!("chatcmpl-{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..24].to_string());
                                    }

                                    // Convert based on event type
                                    let openai_sse = match event_type.as_str() {
                                        "message_start" | "content_block_start" => {
                                            // Send initial chunk
                                            let chunk = crate::converters::openai_types::OpenAIStreamChunk {
                                                id: request_id.clone(),
                                                object: "chat.completion.chunk".to_string(),
                                                created: std::time::SystemTime::now()
                                                    .duration_since(std::time::UNIX_EPOCH)
                                                    .unwrap_or_default()
                                                    .as_secs() as i64,
                                                model: "gpt-4".to_string(),
                                                choices: vec![crate::converters::openai_types::OpenAIStreamChoice {
                                                    index: 0,
                                                    delta: crate::converters::openai_types::OpenAIDelta {
                                                        role: Some("assistant".to_string()),
                                                        content: None,
                                                    },
                                                    finish_reason: None,
                                                    logprobs: None,
                                                }],
                                                usage: None,
                                                system_fingerprint: None,
                                            };
                                            Some(format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap_or_default()))
                                        }
                                        "content_block_delta" => {
                                            // Parse delta and send content
                                            if let Ok(delta) = serde_json::from_str::<serde_json::Value>(&event_data) {
                                                let text = delta.get("delta")
                                                    .and_then(|d| d.get("text"))
                                                    .and_then(|t| t.as_str())
                                                    .unwrap_or("");

                                                if !text.is_empty() {
                                                    let chunk = crate::converters::openai_types::OpenAIStreamChunk {
                                                        id: request_id.clone(),
                                                        object: "chat.completion.chunk".to_string(),
                                                        created: std::time::SystemTime::now()
                                                            .duration_since(std::time::UNIX_EPOCH)
                                                            .unwrap_or_default()
                                                            .as_secs() as i64,
                                                        model: "gpt-4".to_string(),
                                                        choices: vec![crate::converters::openai_types::OpenAIStreamChoice {
                                                            index: 0,
                                                            delta: crate::converters::openai_types::OpenAIDelta {
                                                                role: None,
                                                                content: Some(text.to_string()),
                                                            },
                                                            finish_reason: None,
                                                            logprobs: None,
                                                        }],
                                                        usage: None,
                                                        system_fingerprint: None,
                                                    };
                                                    chunk_index += 1;
                                                    Some(format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap_or_default()))
                                                } else {
                                                    None
                                                }
                                            } else {
                                                None
                                            }
                                        }
                                        "message_stop" => {
                                            // Send final chunk with finish_reason
                                            let chunk = crate::converters::openai_types::OpenAIStreamChunk {
                                                id: request_id.clone(),
                                                object: "chat.completion.chunk".to_string(),
                                                created: std::time::SystemTime::now()
                                                    .duration_since(std::time::UNIX_EPOCH)
                                                    .unwrap_or_default()
                                                    .as_secs() as i64,
                                                model: "gpt-4".to_string(),
                                                choices: vec![crate::converters::openai_types::OpenAIStreamChoice {
                                                    index: 0,
                                                    delta: crate::converters::openai_types::OpenAIDelta {
                                                        role: None,
                                                        content: None,
                                                    },
                                                    finish_reason: Some("stop".to_string()),
                                                    logprobs: None,
                                                }],
                                                usage: None,
                                                system_fingerprint: None,
                                            };
                                            Some(format!("data: {}\n\ndata: [DONE]\n\n", serde_json::to_string(&chunk).unwrap_or_default()))
                                        }
                                        _ => None,
                                    };

                                    if let Some(sse) = openai_sse {
                                        let frame = Frame::data(Bytes::from(sse));
                                        return Some((
                                            Ok(frame),
                                            (body, buffer, request_id, chunk_index),
                                        ));
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            log::error!("Error reading Claude stream: {}", e);
                            let error_msg = format!("data: {{\"error\": \"Stream error: {}\"}}\n\n", e);
                            let frame = Frame::data(Bytes::from(error_msg));
                            return Some((
                                Ok(frame),
                                (body, Vec::new(), request_id, chunk_index),
                            ));
                        }
                        None => {
                            log::info!("Claude→OpenAI stream conversion completed");
                            return None;
                        }
                    }
                }
            },
        ))
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
    ) -> Response<BoxBody<Bytes, hyper::Error>> {
        use http_body_util::Full;

        let body = Full::new(Bytes::from(message.to_string()))
            .map_err(|never| match never {})
            .boxed();

        Response::builder()
            .status(status)
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(body)
            .unwrap()
    }
}

#[cfg(all(test, feature = "old_tests"))]
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
