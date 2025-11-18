use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use crate::db::DbPool;
use crate::services::api_config::ApiConfigService;
use std::sync::Arc;

/// 创建系统托盘
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // === 状态信息区（只读，两行显示） ===
    let config_name_item = MenuItem::with_id(app, "config_name", "未选择配置", false, None::<&str>)?;
    let proxy_status_item = MenuItem::with_id(app, "proxy_status", "⚪ 未连接", false, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;

    // === 配置切换区（核心功能） ===
    let switch_submenu = Submenu::with_id_and_items(
        app,
        "switch_config_submenu",
        "⚡ 切换配置",
        true,
        &[],
    )?;

    let separator2 = PredefinedMenuItem::separator(app)?;

    // === 操作区 ===
    let open_window_item = MenuItem::with_id(app, "open_window", "📊 打开主窗口", true, None::<&str>)?;
    let restart_item = MenuItem::with_id(app, "restart", "🔄 重启服务", true, None::<&str>)?;

    let separator3 = PredefinedMenuItem::separator(app)?;

    // === 底部 ===
    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &config_name_item,
            &proxy_status_item,
            &separator1,
            &switch_submenu,
            &separator2,
            &open_window_item,
            &restart_item,
            &separator3,
            &quit_item,
        ],
    )?;

    // 创建托盘图标
    let _tray = TrayIconBuilder::with_id("main")
        .icon_as_template(true)
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .title("Claude Code Proxy")
        .tooltip("Claude Code Proxy - 未连接")
        .on_menu_event(move |app, event| {
            let event_id = event.id.as_ref();
            match event_id {
                "open_window" => {
                    // 打开主窗口并聚焦
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
                "restart" => {
                    // 重启代理服务
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        use crate::commands::ProxyServiceState;

                        if let Some(proxy_state) = app_handle.try_state::<ProxyServiceState>() {
                            // 先停止
                            if let Err(e) = proxy_state.service().stop().await {
                                log::error!("❌ 停止服务失败: {}", e);
                                return;
                            }

                            // 等待一下
                            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                            // 再启动
                            if let Err(e) = proxy_state.service().start().await {
                                log::error!("❌ 启动服务失败: {}", e);
                            } else {
                                log::info!("✅ 服务重启成功");
                            }
                        }
                    });
                }
                "quit" => {
                    app.exit(0);
                }
                "config_name" | "proxy_status" => {
                    // 状态项是只读的，不处理点击
                }
                id if id.starts_with("config_") => {
                    // 处理配置切换: config_{id}
                    if let Some(config_id_str) = id.strip_prefix("config_") {
                        if let Ok(config_id) = config_id_str.parse::<i64>() {
                            // 异步调用切换配置命令
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                use crate::commands::ProxyServiceState;

                                if let Some(proxy_state) = app_handle.try_state::<ProxyServiceState>() {
                                    match proxy_state.service().switch_config(config_id).await {
                                        Ok(_) => log::info!("✅ 从托盘切换到配置 ID: {}", config_id),
                                        Err(e) => log::error!("❌ 托盘切换配置失败: {}", e),
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

/// 更新托盘标题和提示
pub fn update_tray_status<R: Runtime>(
    app: &AppHandle<R>,
    config_name: Option<String>,
    status: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        // 彩色 Emoji 状态符号
        let (status_symbol, status_text) = match status {
            "运行中" => ("🟢", "运行中"),
            "已停止" => ("⚪", "已停止"),
            "启动中" => ("🟡", "启动中"),
            "停止中" => ("🟡", "停止中"),
            "错误" => ("🔴", "错误"),
            _ => ("⚪", "未连接"),
        };

        // 托盘标题（macOS 在菜单栏显示 - 优雅格式）
        let title = if let Some(ref name) = config_name {
            // 格式: 配置名·状态符号
            // 使用间隔号(·)连接，优雅简洁
            format!("{}·{}", name, status_symbol)
        } else {
            // 没有配置时只显示状态符号
            format!("{}", status_symbol)
        };

        // 悬停提示（详细信息）
        let tooltip = if let Some(ref name) = config_name {
            format!(
                "Claude Code Proxy\n\n配置: {}\n状态: {} {}",
                name, status_symbol, status_text
            )
        } else {
            format!(
                "Claude Code Proxy\n\n{} {}",
                status_symbol, status_text
            )
        };

        tray.set_title(Some(&title))?;
        tray.set_tooltip(Some(&tooltip))?;

        // 同时更新菜单中的状态项
        update_status_menu_item(app, config_name.as_deref(), status_symbol, status_text)?;
    }
    Ok(())
}

/// 更新菜单中的状态显示项
fn update_status_menu_item<R: Runtime>(
    app: &AppHandle<R>,
    config_name: Option<&str>,
    status_symbol: &str,
    status_text: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 使用统一的菜单构建函数，传入状态信息，但不更新配置列表
    rebuild_tray_menu(app, Some((status_symbol, status_text, config_name)), None, None)
}

/// 统一的托盘菜单构建函数
///
/// # 参数
/// - `status_info`: 可选的状态信息 (symbol, text, config_name)
/// - `config_items`: 可选的配置菜单项列表
/// - `active_config_id`: 当前活动的配置 ID
fn rebuild_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    status_info: Option<(&str, &str, Option<&str>)>,
    config_items: Option<Vec<(i64, String, bool)>>,  // (id, name, is_available)
    active_config_id: Option<i64>,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        // === 状态信息区（两行显示） ===
        let (config_name_display, proxy_status_display) = if let Some((symbol, text, name)) = status_info {
            let name_display = if let Some(n) = name {
                n.to_string()
            } else {
                "未选择配置".to_string()
            };
            let status_display = format!("{} {}", symbol, text);
            (name_display, status_display)
        } else {
            ("未选择配置".to_string(), "⚪ 未连接".to_string())
        };

        let config_name_item = MenuItem::with_id(app, "config_name", config_name_display, false, None::<&str>)?;
        let proxy_status_item = MenuItem::with_id(app, "proxy_status", proxy_status_display, false, None::<&str>)?;
        let separator1 = PredefinedMenuItem::separator(app)?;

        // === 配置切换区 ===
        let switch_submenu = if let Some(configs) = config_items {
            let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<R>>> = Vec::new();

            if configs.is_empty() {
                let no_config_item = MenuItem::with_id(
                    app,
                    "no_config",
                    "暂无可用配置",
                    false,
                    None::<&str>,
                )?;
                items.push(Box::new(no_config_item));
            } else {
                for (config_id, config_name, _is_available) in configs {
                    let is_active = Some(config_id) == active_config_id;
                    let label = if is_active {
                        format!("● {}", config_name)
                    } else {
                        format!("  {}", config_name)
                    };

                    let config_item = MenuItem::with_id(
                        app,
                        &format!("config_{}", config_id),
                        label,
                        !is_active,
                        None::<&str>,
                    )?;
                    items.push(Box::new(config_item));
                }
            }

            Submenu::with_id_and_items(
                app,
                "switch_config_submenu",
                "⚡ 切换配置",
                true,
                &items.iter().map(|item| item.as_ref()).collect::<Vec<_>>(),
            )?
        } else {
            Submenu::with_id_and_items(
                app,
                "switch_config_submenu",
                "⚡ 切换配置",
                true,
                &[],
            )?
        };

        let separator2 = PredefinedMenuItem::separator(app)?;

        // === 操作区 ===
        let open_window_item = MenuItem::with_id(app, "open_window", "📊 打开主窗口", true, None::<&str>)?;
        let restart_item = MenuItem::with_id(app, "restart", "🔄 重启服务", true, None::<&str>)?;

        let separator3 = PredefinedMenuItem::separator(app)?;

        // === 底部 ===
        let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

        // 构建菜单
        let menu = Menu::with_items(
            app,
            &[
                &config_name_item,
                &proxy_status_item,
                &separator1,
                &switch_submenu,
                &separator2,
                &open_window_item,
                &restart_item,
                &separator3,
                &quit_item,
            ],
        )?;

        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

/// 更新托盘菜单中的配置列表
pub fn update_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    db_pool: Arc<DbPool>,
    active_group_id: Option<i64>,
    active_config_id: Option<i64>,
) -> Result<(), Box<dyn std::error::Error>> {
    // 获取当前分组的所有可用配置
    let configs = db_pool.with_connection(|conn| {
        if let Some(group_id) = active_group_id {
            ApiConfigService::list_configs(conn, Some(group_id))
        } else {
            ApiConfigService::list_configs(conn, None)
        }
    })?;

    // 转换为简化的配置列表 (id, name, is_available)
    let config_items: Vec<(i64, String, bool)> = configs
        .into_iter()
        .filter(|c| c.is_available)
        .map(|c| (c.id, c.name, c.is_available))
        .collect();

    // 使用统一的菜单构建函数，不传入状态信息（保持当前状态）
    rebuild_tray_menu(app, None, Some(config_items.clone()), active_config_id)?;

    log::debug!("托盘菜单已更新，共 {} 个可用配置", config_items.len());

    Ok(())
}
