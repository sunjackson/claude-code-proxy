use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

/// 创建系统托盘
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // 创建托盘菜单
    let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    // 创建托盘图标
    let _tray = TrayIconBuilder::with_id("main")
        .icon_as_template(true)
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .title("ClaudeCodeProxy")
        .tooltip("ClaudeCodeProxy - 未连接")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
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
        let title = if let Some(ref name) = config_name {
            format!("{} - {}", name, status)
        } else {
            format!("ClaudeCodeProxy - {}", status)
        };

        let tooltip = format!("ClaudeCodeProxy\n当前配置: {}\n状态: {}",
            config_name.as_deref().unwrap_or("未配置"),
            status
        );

        tray.set_title(Some(&title))?;
        tray.set_tooltip(Some(&tooltip))?;
    }
    Ok(())
}
