// Commands 模块
pub mod api_config;
pub mod api_test;
pub mod app_update;
pub mod auto_switch;
pub mod balance;
pub mod claude_code;
pub mod config_group;
pub mod env_var;
pub mod health_check;
pub mod mcp;
pub mod permissions;
pub mod provider_preset;
pub mod proxy_log;
pub mod proxy_service;
pub mod recommendation;
pub mod setup;
pub mod skills;
pub mod terminal;

// 重新导出常用命令
pub use api_config::{
    create_api_config, delete_api_config, get_api_config, get_api_key, list_api_configs,
    quick_test_config_url, reorder_api_config, set_config_enabled, test_api_endpoints,
    update_api_config,
};

pub use api_test::{get_test_results, test_api_config, test_group_configs};

pub use app_update::{
    check_app_updates, download_app_update, get_app_version, open_release_page,
};

pub use auto_switch::{clear_switch_logs, get_switch_logs, toggle_auto_switch};

pub use balance::{get_all_balance_info, query_all_balances, query_balance};

pub use claude_code::{
    clear_all_claude_code_backups, create_claude_code_backup, delete_claude_code_backup,
    detect_claude_code_path, disable_claude_code_proxy, enable_claude_code_proxy,
    get_claude_code_proxy, get_claude_code_settings, list_claude_code_backups,
    preview_claude_code_backup, restore_claude_code_backup, restore_claude_code_config,
};

pub use config_group::{
    count_configs_in_group, create_config_group, delete_config_group, get_config_group,
    list_config_groups, update_config_group,
};

pub use proxy_service::{
    get_proxy_status, start_proxy_service, stop_proxy_service, switch_proxy_config,
    switch_proxy_group, ProxyServiceState,
};

pub use provider_preset::{
    get_provider_categories, get_provider_preset, get_provider_presets_by_category,
    get_recommended_provider_presets, list_provider_presets,
};

pub use recommendation::{
    load_recommended_services, refresh_recommended_services, RecommendationServiceState,
};

pub use env_var::{
    apply_config_to_env, check_anthropic_env, clear_anthropic_env, get_environment_variable,
    list_environment_variables, set_environment_variable, set_environment_variables,
    unset_environment_variable, EnvironmentVariableState,
};

pub use proxy_log::{
    cleanup_proxy_request_logs, get_all_proxy_request_logs, get_proxy_request_log_count,
    get_proxy_request_log_detail, get_proxy_request_log_stats, get_proxy_request_logs,
};

pub use health_check::{
    get_health_check_status, get_health_check_summaries, run_health_check_now,
    start_health_check, stop_health_check, toggle_auto_health_check, HealthCheckState,
};

pub use setup::{
    check_can_install, check_can_install_enhanced, check_for_updates, check_system_configured,
    detect_environment, detect_environment_enhanced, generate_environment_report, get_claude_version,
    get_default_node_environment, install_claude_code, run_claude_doctor, set_default_node_environment,
    uninstall_claude_code, update_claude_code, verify_claude_installation,
};

pub use mcp::{
    add_mcp_server, add_mcp_server_from_template, export_mcp_servers, get_mcp_templates,
    import_mcp_servers, list_mcp_servers, remove_mcp_server, test_mcp_server, update_mcp_server,
};

pub use permissions::{clear_permissions_config, get_permissions_config, update_permissions_config};

pub use skills::{
    add_skill, export_skills, import_skills, list_skills, read_skill_prompt, remove_skill,
    update_skill,
};

pub use terminal::{
    build_terminal_env_vars, cleanup_stale_terminal_sessions, clear_all_terminal_sessions,
    get_terminal_proxy_url, get_terminal_session, get_terminal_session_count,
    list_terminal_sessions, register_terminal_session, remove_terminal_session,
    switch_terminal_provider, TerminalSessionInfo,
    // PTY commands
    create_pty_session, create_claude_code_session, pty_write_input, close_pty_session,
    list_pty_sessions, get_pty_session_count, switch_pty_provider, pty_resize,
};
