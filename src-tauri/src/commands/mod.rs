// Commands 模块
pub mod api_config;
pub mod api_test;
pub mod auto_switch;
pub mod balance;
pub mod claude_code;
pub mod config_group;
pub mod env_var;
pub mod provider_preset;
pub mod proxy_service;
pub mod recommendation;

// 重新导出常用命令
pub use api_config::{
    create_api_config, delete_api_config, get_api_config, get_api_key, list_api_configs,
    quick_test_config_url, reorder_api_config, test_api_endpoints, update_api_config,
};

pub use api_test::{get_test_results, test_api_config, test_group_configs};

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
