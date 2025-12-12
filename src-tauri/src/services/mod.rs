pub mod api_config;
pub mod api_test;
pub mod app_updater;
pub mod auto_switch;
pub mod backup;
pub mod balance_scheduler;
pub mod balance_service;
pub mod claude_config;
pub mod claude_installer;
pub mod claude_test_request;
pub mod config_manager;
pub mod env_detection;
pub mod env_var;
pub mod error_classifier;
pub mod health_check_scheduler;
pub mod health_check_service;
pub mod keychain;
pub mod latency_test;
pub mod mcp_config;
pub mod node_scanner;
pub mod permissions_config;
pub mod provider_preset;
pub mod proxy_log;
pub mod proxy_service;
pub mod recommendation;
pub mod retry_manager;
pub mod skills_config;
pub mod status_notifier;
pub mod weight_calculator;

// 重新导出常用类型
pub use api_config::ApiConfigService;
pub use app_updater::{AppUpdater, AppVersionInfo};
pub use backup::BackupService;
pub use balance_service::BalanceService;
pub use claude_config::{ClaudeConfigService, ProxyConfig};
pub use claude_installer::{ClaudeInstaller, InstallMethod, InstallOptions, InstallProgress, VersionInfo};
pub use config_manager::ConfigManager;
pub use env_detection::{EnhancedEnvironmentDetector, EnvironmentStatus};
pub use latency_test::LatencyTestService;
pub use mcp_config::McpConfigService;
pub use permissions_config::PermissionsConfigService;
pub use provider_preset::ProviderPresetService;
pub use skills_config::SkillsConfigService;
// NodeScanner 在 env_detection.rs 中内部使用
// ProxyRequestLog 和 ProxyRequestLogService 在 commands/proxy_log.rs 中直接导入使用
// HealthCheckService 在 commands/health_check.rs 和 health_check_scheduler.rs 中直接导入使用
