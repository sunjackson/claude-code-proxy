/**
 * 代理服务模块
 * 提供 HTTP 代理服务器、请求路由、错误处理等功能
 */

pub mod server;
pub mod router;
pub mod error_handler;
pub mod error_converter;
pub mod stream_converter;
pub mod logger;
pub mod protocol_detector;
pub mod structured_logger;
pub mod client_detector;
pub mod smart_router;

// 重新导出公共类型
#[allow(unused_imports)]
pub use protocol_detector::{ProtocolDetector, RequestFormat, ConversionMatrix, ConversionRule};
#[allow(unused_imports)]
pub use error_converter::{UnifiedErrorConverter, ClaudeErrorResponse, ClaudeError};
#[allow(unused_imports)]
pub use error_handler::{ProxyErrorHandler, ProxyErrorType};
#[allow(unused_imports)]
pub use stream_converter::{
    OpenAIToClaudeStreamConverter, ClaudeToOpenAIStreamConverter,
    StreamState, StreamIntegrityReport,
};
#[allow(unused_imports)]
pub use structured_logger::{
    StructuredLogEntry, LogFields, LogLevel, LogEventType,
    RequestTracer, PerformanceMetrics, MetricsCollector, METRICS,
    generate_request_id,
};
#[allow(unused_imports)]
pub use client_detector::{ClientDetector, ClientType, ClientDetectionResult};
#[allow(unused_imports)]
pub use smart_router::{RoutingContext, ConversionDirection};
