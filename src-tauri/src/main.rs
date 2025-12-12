// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod converters;
mod db;
mod models;
mod proxy;
mod services;
mod tray;
mod utils;

use commands::{
    add_mcp_server, add_mcp_server_from_template, add_skill, apply_config_to_env,
    check_anthropic_env, check_app_updates, check_can_install, check_can_install_enhanced,
    check_for_updates, clear_all_claude_code_backups, clear_anthropic_env,
    clear_permissions_config, clear_switch_logs, cleanup_proxy_request_logs,
    count_configs_in_group, create_api_config, create_claude_code_backup, create_config_group,
    delete_api_config, delete_claude_code_backup, delete_config_group, detect_claude_code_path,
    detect_environment, detect_environment_enhanced, disable_claude_code_proxy,
    download_app_update, enable_claude_code_proxy, export_mcp_servers, export_skills,
    generate_environment_report, get_all_balance_info, get_all_proxy_request_logs,
    get_api_config, get_api_key, get_app_version, get_claude_code_proxy, get_claude_code_settings,
    get_claude_version, get_config_group, get_default_node_environment, get_environment_variable,
    get_mcp_templates, get_permissions_config, get_provider_categories, get_provider_preset,
    get_provider_presets_by_category, get_proxy_request_log_count, get_proxy_request_log_detail,
    get_proxy_request_log_stats, get_proxy_request_logs, get_proxy_status,
    get_recommended_provider_presets, get_switch_logs, get_test_results, get_health_check_status,
    get_health_check_summaries, toggle_auto_health_check, import_mcp_servers, import_skills,
    install_claude_code, list_api_configs, list_claude_code_backups, list_config_groups,
    list_environment_variables, list_mcp_servers, list_provider_presets, list_skills,
    load_recommended_services, open_release_page, preview_claude_code_backup, query_all_balances,
    query_balance, quick_test_config_url, read_skill_prompt, refresh_recommended_services,
    remove_mcp_server, remove_skill, reorder_api_config, restore_claude_code_backup,
    restore_claude_code_config, run_claude_doctor, run_health_check_now, set_config_enabled,
    set_default_node_environment, set_environment_variable, set_environment_variables,
    start_health_check, start_proxy_service, stop_health_check, stop_proxy_service,
    switch_proxy_config, switch_proxy_group, test_api_config, test_api_endpoints,
    test_group_configs, test_mcp_server, toggle_auto_switch, uninstall_claude_code,
    unset_environment_variable, update_api_config, update_claude_code, update_config_group,
    update_mcp_server, update_permissions_config, update_skill, verify_claude_installation,
    check_system_configured, EnvironmentVariableState, HealthCheckState, ProxyServiceState,
    RecommendationServiceState,
};
use db::{initialize_database, DbPool};
use services::balance_scheduler::BalanceScheduler;
use services::proxy_service::ProxyService;
use std::sync::Arc;
use utils::logger;

fn main() {
    // 初始化日志系统
    logger::init_logger();

    // 初始化 Rustls 加密提供程序
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    // 初始化数据库
    let conn = initialize_database().expect("无法初始化数据库");
    let db_pool = Arc::new(DbPool::new(conn));

    log::info!("数据库连接池已创建");

    // 初始化代理服务
    let proxy_service = ProxyService::new(db_pool.clone());
    let proxy_state = ProxyServiceState::new(proxy_service);

    log::info!("代理服务已初始化");

    // 初始化推荐服务
    // 优先使用远程 OSS 配置,失败时回退到内嵌的 providers.json
    let recommendation_state = RecommendationServiceState::new(
        Some("https://all-app-config.oss-cn-beijing.aliyuncs.com/ccproxy/providers.json".to_string()), // 远程 OSS URL
        None, // 不使用本地文件,改用内嵌的 providers.json 作为回退
        3600, // 默认 TTL 1小时
    );

    log::info!("推荐服务已初始化");

    // 初始化环境变量服务
    let env_var_state = EnvironmentVariableState::new();

    log::info!("环境变量服务已初始化");

    // 初始化健康检查状态
    let health_check_state = HealthCheckState::new();

    log::info!("健康检查服务已初始化");

    // 初始化余额查询调度器
    let balance_scheduler = Arc::new(BalanceScheduler::new(db_pool.clone()));

    log::info!("余额查询调度器已初始化");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(db_pool)
        .manage(proxy_state.clone())
        .manage(recommendation_state)
        .manage(env_var_state)
        .manage(health_check_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            // Set app handle for proxy service (for event emission)
            tauri::async_runtime::block_on(async {
                proxy_state.service().set_app_handle(handle.clone()).await;
            });
            log::info!("Tauri app handle configured for proxy service");

            // 创建系统托盘
            if let Err(e) = tray::create_tray(&app.handle()) {
                log::error!("Failed to create system tray: {}", e);
            }

            // 启动余额查询调度器
            let scheduler_clone = balance_scheduler.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = scheduler_clone.start().await {
                    log::error!("Failed to start balance scheduler: {}", e);
                } else {
                    log::info!("Balance scheduler started successfully");
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 阻止默认关闭行为，改为隐藏窗口
                window.hide().unwrap();
                api.prevent_close();
            }
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
            set_config_enabled,
            get_api_key,
            test_api_config,
            test_api_endpoints,
            quick_test_config_url,
            test_group_configs,
            get_test_results,
            query_balance,
            query_all_balances,
            get_all_balance_info,
            start_proxy_service,
            stop_proxy_service,
            get_proxy_status,
            switch_proxy_group,
            switch_proxy_config,
            toggle_auto_switch,
            get_switch_logs,
            clear_switch_logs,
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
            // 代理请求日志
            get_proxy_request_logs,
            get_all_proxy_request_logs,
            cleanup_proxy_request_logs,
            get_proxy_request_log_count,
            get_proxy_request_log_detail,
            get_proxy_request_log_stats,
            // 健康检查
            start_health_check,
            stop_health_check,
            run_health_check_now,
            get_health_check_status,
            get_health_check_summaries,
            toggle_auto_health_check,
            // 环境设置和 Claude Code 安装
            detect_environment,
            detect_environment_enhanced,
            set_default_node_environment,
            get_default_node_environment,
            check_can_install_enhanced,
            install_claude_code,
            run_claude_doctor,
            get_claude_version,
            verify_claude_installation,
            uninstall_claude_code,
            generate_environment_report,
            check_can_install,
            check_for_updates,
            update_claude_code,
            check_system_configured,
            // MCP 配置管理
            list_mcp_servers,
            add_mcp_server,
            update_mcp_server,
            remove_mcp_server,
            get_mcp_templates,
            add_mcp_server_from_template,
            test_mcp_server,
            import_mcp_servers,
            export_mcp_servers,
            // Permissions 配置管理
            get_permissions_config,
            update_permissions_config,
            clear_permissions_config,
            // Skills 配置管理
            list_skills,
            add_skill,
            update_skill,
            remove_skill,
            read_skill_prompt,
            import_skills,
            export_skills,
            // 应用更新
            check_app_updates,
            get_app_version,
            download_app_update,
            open_release_page,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
