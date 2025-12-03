use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use crate::db::DbPool;
use crate::services::api_config::ApiConfigService;
use crate::utils::constants::default_proxy_port;
use std::sync::Arc;

/// 创建系统托盘
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // === 状态信息区 ===
    let status_header = MenuItem::with_id(app, "status_header", "Claude Code Proxy", false, None::<&str>)?;
    let status_line = MenuItem::with_id(app, "status_line", "⚪ 服务未启动", false, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;

    // === 快捷操作区 ===
    let toggle_service = MenuItem::with_id(app, "toggle_service", "▶ 启动服务", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;

    // === 配置切换区 ===
    let switch_submenu = Submenu::with_id_and_items(
        app,
        "switch_config_submenu",
        "切换配置",
        true,
        &[],
    )?;

    let separator3 = PredefinedMenuItem::separator(app)?;

    // === 窗口操作区 ===
    let open_window_item = MenuItem::with_id(app, "open_window", "打开控制面板", true, None::<&str>)?;

    let separator4 = PredefinedMenuItem::separator(app)?;

    // === 退出 ===
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &status_header,
            &status_line,
            &separator1,
            &toggle_service,
            &separator2,
            &switch_submenu,
            &separator3,
            &open_window_item,
            &separator4,
            &quit_item,
        ],
    )?;

    // 创建托盘图标
    let _tray = TrayIconBuilder::with_id("main")
        .icon_as_template(true)
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .title("⚪")
        .tooltip("Claude Code Proxy")
        .on_menu_event(move |app, event| {
            let event_id = event.id.as_ref();
            match event_id {
                "open_window" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
                "toggle_service" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        use crate::commands::ProxyServiceState;

                        if let Some(proxy_state) = app_handle.try_state::<ProxyServiceState>() {
                            let status = proxy_state.service().get_status().await;

                            match status {
                                Ok(s) if s.status == crate::models::proxy_status::ProxyStatus::Running => {
                                    // 当前运行中，执行停止
                                    if let Err(e) = proxy_state.service().stop().await {
                                        log::error!("托盘停止服务失败: {}", e);
                                    } else {
                                        log::info!("托盘停止服务成功");
                                    }
                                }
                                _ => {
                                    // 当前未运行，执行启动
                                    if let Err(e) = proxy_state.service().start().await {
                                        log::error!("托盘启动服务失败: {}", e);
                                    } else {
                                        log::info!("托盘启动服务成功");
                                    }
                                }
                            }
                        }
                    });
                }
                "quit" => {
                    // 退出前停止服务
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        use crate::commands::ProxyServiceState;

                        if let Some(proxy_state) = app_handle.try_state::<ProxyServiceState>() {
                            let _ = proxy_state.service().stop().await;
                        }
                        app_handle.exit(0);
                    });
                }
                id if id.starts_with("config_") => {
                    if let Some(config_id_str) = id.strip_prefix("config_") {
                        if let Ok(config_id) = config_id_str.parse::<i64>() {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                use crate::commands::ProxyServiceState;

                                if let Some(proxy_state) = app_handle.try_state::<ProxyServiceState>() {
                                    match proxy_state.service().switch_config(config_id).await {
                                        Ok(_) => log::info!("托盘切换配置成功: ID={}", config_id),
                                        Err(e) => log::error!("托盘切换配置失败: {}", e),
                                    }
                                }
                            });
                        }
                    }
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    log::info!("系统托盘已创建");
    Ok(())
}

/// 托盘状态信息
pub struct TrayStatusInfo {
    /// 是否运行中
    pub is_running: bool,
    /// 监听端口
    pub port: Option<u16>,
    /// 当前配置名称
    pub config_name: Option<String>,
    /// 当前配置 ID
    pub config_id: Option<i64>,
    /// 当前分组 ID
    pub group_id: Option<i64>,
    /// 最后延迟（毫秒）
    pub latency_ms: Option<i64>,
}

impl Default for TrayStatusInfo {
    fn default() -> Self {
        Self {
            is_running: false,
            port: None,
            config_name: None,
            config_id: None,
            group_id: None,
            latency_ms: None,
        }
    }
}

/// 更新托盘显示（主函数）
pub fn update_tray<R: Runtime>(
    app: &AppHandle<R>,
    db_pool: Arc<DbPool>,
    info: &TrayStatusInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    // 更新标题和提示
    update_tray_title(app, info)?;

    // 更新菜单
    update_tray_menu_internal(app, db_pool, info)?;

    Ok(())
}

/// 更新托盘标题和提示
fn update_tray_title<R: Runtime>(
    app: &AppHandle<R>,
    info: &TrayStatusInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        // 状态符号
        let status_symbol = if info.is_running { "🟢" } else { "⚪" };

        // 托盘标题（macOS 菜单栏显示）
        let title = if info.is_running {
            if let Some(ref name) = info.config_name {
                // 运行中：显示配置名
                format!("{}", name)
            } else {
                status_symbol.to_string()
            }
        } else {
            status_symbol.to_string()
        };

        // 悬停提示
        let tooltip = if info.is_running {
            let mut lines = vec!["Claude Code Proxy".to_string()];
            lines.push(format!("状态: {} 运行中", status_symbol));

            if let Some(port) = info.port {
                lines.push(format!("端口: {}", port));
            }
            if let Some(ref name) = info.config_name {
                lines.push(format!("配置: {}", name));
            }
            if let Some(latency) = info.latency_ms {
                lines.push(format!("延迟: {}ms", latency));
            }
            lines.join("\n")
        } else {
            format!("Claude Code Proxy\n状态: {} 已停止", status_symbol)
        };

        tray.set_title(Some(&title))?;
        tray.set_tooltip(Some(&tooltip))?;
    }
    Ok(())
}

/// 更新托盘菜单
fn update_tray_menu_internal<R: Runtime>(
    app: &AppHandle<R>,
    db_pool: Arc<DbPool>,
    info: &TrayStatusInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        let status_symbol = if info.is_running { "🟢" } else { "⚪" };

        // === 状态信息区 ===
        let header_text = if info.is_running {
            if let Some(ref name) = info.config_name {
                format!("{} {}", status_symbol, name)
            } else {
                format!("{} 运行中", status_symbol)
            }
        } else {
            format!("{} 已停止", status_symbol)
        };

        let status_header = MenuItem::with_id(app, "status_header", &header_text, false, None::<&str>)?;

        // 详细状态行
        let status_detail = if info.is_running {
            let mut parts = Vec::new();
            if let Some(port) = info.port {
                parts.push(format!(":{}", port));
            }
            if let Some(latency) = info.latency_ms {
                parts.push(format!("{}ms", latency));
            }
            if parts.is_empty() {
                "服务运行中".to_string()
            } else {
                parts.join(" · ")
            }
        } else {
            "点击下方按钮启动".to_string()
        };
        let status_line = MenuItem::with_id(app, "status_line", &status_detail, false, None::<&str>)?;

        let separator1 = PredefinedMenuItem::separator(app)?;

        // === 服务开关 ===
        let toggle_text = if info.is_running { "■ 停止服务" } else { "▶ 启动服务" };
        let toggle_service = MenuItem::with_id(app, "toggle_service", toggle_text, true, None::<&str>)?;

        let separator2 = PredefinedMenuItem::separator(app)?;

        // === 配置切换区 ===
        let configs = db_pool.with_connection(|conn| {
            if let Some(group_id) = info.group_id {
                ApiConfigService::list_configs(conn, Some(group_id))
            } else {
                ApiConfigService::list_configs(conn, None)
            }
        }).unwrap_or_default();

        let available_configs: Vec<_> = configs
            .into_iter()
            .filter(|c| c.is_available)
            .collect();

        let switch_submenu = {
            let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<R>>> = Vec::new();

            if available_configs.is_empty() {
                let no_config = MenuItem::with_id(app, "no_config", "暂无可用配置", false, None::<&str>)?;
                items.push(Box::new(no_config));
            } else {
                for config in &available_configs {
                    let is_active = Some(config.id) == info.config_id;
                    let label = if is_active {
                        format!("● {}", config.name)
                    } else {
                        config.name.clone()
                    };

                    let item = MenuItem::with_id(
                        app,
                        &format!("config_{}", config.id),
                        &label,
                        !is_active, // 当前配置禁用点击
                        None::<&str>,
                    )?;
                    items.push(Box::new(item));
                }
            }

            Submenu::with_id_and_items(
                app,
                "switch_config_submenu",
                &format!("切换配置 ({})", available_configs.len()),
                !available_configs.is_empty(),
                &items.iter().map(|item| item.as_ref()).collect::<Vec<_>>(),
            )?
        };

        let separator3 = PredefinedMenuItem::separator(app)?;

        // === 窗口操作 ===
        let open_window = MenuItem::with_id(app, "open_window", "打开控制面板", true, None::<&str>)?;

        let separator4 = PredefinedMenuItem::separator(app)?;

        // === 退出 ===
        let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

        // 构建菜单
        let menu = Menu::with_items(
            app,
            &[
                &status_header,
                &status_line,
                &separator1,
                &toggle_service,
                &separator2,
                &switch_submenu,
                &separator3,
                &open_window,
                &separator4,
                &quit,
            ],
        )?;

        tray.set_menu(Some(menu))?;

        log::debug!("托盘菜单已更新: running={}, config={:?}, configs_count={}",
            info.is_running, info.config_name, available_configs.len());
    }
    Ok(())
}

// ========== 兼容旧接口 ==========

/// 更新托盘标题和提示（兼容旧接口）
pub fn update_tray_status<R: Runtime>(
    app: &AppHandle<R>,
    config_name: Option<String>,
    status: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let is_running = status == "运行中";
    let info = TrayStatusInfo {
        is_running,
        config_name,
        ..Default::default()
    };
    update_tray_title(app, &info)
}

/// 更新托盘菜单（兼容旧接口）
pub fn update_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    db_pool: Arc<DbPool>,
    active_group_id: Option<i64>,
    active_config_id: Option<i64>,
    active_config_name: Option<String>,
    status: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let is_running = status == "运行中";
    let info = TrayStatusInfo {
        is_running,
        port: Some(default_proxy_port()),
        config_name: active_config_name,
        config_id: active_config_id,
        group_id: active_group_id,
        latency_ms: None,
    };
    update_tray(app, db_pool, &info)
}
