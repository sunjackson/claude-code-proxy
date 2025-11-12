// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod proxy;
mod services;
mod utils;

use commands::{
    apply_config_to_env, check_anthropic_env, clear_all_claude_code_backups, clear_anthropic_env,
    count_configs_in_group, create_api_config, create_claude_code_backup, create_config_group,
    delete_api_config, delete_claude_code_backup, delete_config_group, detect_claude_code_path,
    disable_claude_code_proxy, enable_claude_code_proxy, get_api_config, get_api_key,
    get_claude_code_proxy, get_claude_code_settings, get_config_group, get_environment_variable,
    get_provider_categories, get_provider_preset, get_provider_presets_by_category,
    get_proxy_status, get_recommended_provider_presets, get_switch_logs, get_test_results,
    list_api_configs, list_claude_code_backups, list_config_groups, list_environment_variables,
    list_provider_presets, load_recommended_services, preview_claude_code_backup,
    reorder_api_config, refresh_recommended_services, restore_claude_code_backup,
    restore_claude_code_config, set_environment_variable, set_environment_variables,
    start_proxy_service, stop_proxy_service, switch_proxy_config, switch_proxy_group,
    test_api_config, test_api_endpoints, test_group_configs, toggle_auto_switch,
    unset_environment_variable, update_api_config, update_config_group, EnvironmentVariableState,
    ProxyServiceState, RecommendationServiceState,
};
use db::{initialize_database, DbPool};
use services::proxy_service::ProxyService;
use std::sync::Arc;
use utils::logger;

fn main() {
    // 初始化日志系统
    logger::init_logger();

    // 初始化数据库
    let conn = initialize_database().expect("无法初始化数据库");
    let db_pool = Arc::new(DbPool::new(conn));

    log::info!("数据库连接池已创建");

    // 初始化代理服务
    let proxy_service = ProxyService::new(db_pool.clone());
    let proxy_state = ProxyServiceState::new(proxy_service);

    log::info!("代理服务已初始化");

    // 初始化推荐服务
    let recommendation_state = RecommendationServiceState::new(
        None, // 远程 URL 可以从配置加载
        Some(std::path::PathBuf::from("../config/providers.json")),
        3600, // 默认 TTL 1小时
    );

    log::info!("推荐服务已初始化");

    // 初始化环境变量服务
    let env_var_state = EnvironmentVariableState::new();

    log::info!("环境变量服务已初始化");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(db_pool)
        .manage(proxy_state.clone())
        .manage(recommendation_state)
        .manage(env_var_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            // Set app handle for proxy service (for event emission)
            tauri::async_runtime::block_on(async {
                proxy_state.service().set_app_handle(handle.clone()).await;
            });
            log::info!("Tauri app handle configured for proxy service");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_claude_code_path,
            list_claude_code_backups,
            create_claude_code_backup,
            restore_claude_code_backup,
            delete_claude_code_backup,
            preview_claude_code_backup,
            clear_all_claude_code_backups,
            enable_claude_code_proxy,
            disable_claude_code_proxy,
            get_claude_code_proxy,
            get_claude_code_settings,
            restore_claude_code_config,
            create_config_group,
            list_config_groups,
            update_config_group,
            delete_config_group,
            get_config_group,
            count_configs_in_group,
            create_api_config,
            list_api_configs,
            get_api_config,
            update_api_config,
            delete_api_config,
            reorder_api_config,
            get_api_key,
            test_api_config,
            test_api_endpoints,
            test_group_configs,
            get_test_results,
            start_proxy_service,
            stop_proxy_service,
            get_proxy_status,
            switch_proxy_group,
            switch_proxy_config,
            toggle_auto_switch,
            get_switch_logs,
            load_recommended_services,
            refresh_recommended_services,
            list_provider_presets,
            get_provider_preset,
            get_provider_presets_by_category,
            get_recommended_provider_presets,
            get_provider_categories,
            list_environment_variables,
            get_environment_variable,
            set_environment_variable,
            unset_environment_variable,
            set_environment_variables,
            apply_config_to_env,
            check_anthropic_env,
            clear_anthropic_env,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
