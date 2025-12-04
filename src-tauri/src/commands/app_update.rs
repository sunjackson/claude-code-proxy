use crate::services::{AppUpdater, AppVersionInfo};

/// 检查应用更新
#[tauri::command]
pub async fn check_app_updates() -> Result<AppVersionInfo, String> {
    // 从 Cargo.toml 读取当前版本
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let updater = AppUpdater::new(
        "sunjackson".to_string(),
        "claude-code-proxy".to_string(),
        current_version,
    );

    updater.check_for_updates().await
}

/// 获取当前应用版本
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 下载更新包
#[tauri::command]
pub async fn download_app_update(url: String, save_path: String) -> Result<(), String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let updater = AppUpdater::new(
        "sunjackson".to_string(),
        "claude-code-proxy".to_string(),
        current_version,
    );

    updater.download_update(&url, &save_path).await
}

/// 打开发布页面
#[tauri::command]
pub async fn open_release_page() -> Result<(), String> {
    let url = "https://github.com/sunjackson/claude-code-proxy/releases/latest";

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", url])
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }

    Ok(())
}
