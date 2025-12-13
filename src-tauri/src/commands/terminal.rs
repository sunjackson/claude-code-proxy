/**
 * Terminal Session Commands
 *
 * Tauri commands for managing terminal sessions and their proxy configurations.
 * Each terminal session can be bound to a specific API config for routing.
 */

use crate::services::session_config::{SessionConfigEntry, SESSION_CONFIG_MAP};
use crate::services::pty_manager::{PtyManagerState, PtySessionInfo, ClaudeCodeOptions};
use serde::{Deserialize, Serialize};
use tauri::State;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Terminal session info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionInfo {
    pub session_id: String,
    pub config_id: i64,
    pub name: Option<String>,
    pub created_at: String,
    pub last_used_at: String,
}

impl From<(String, SessionConfigEntry)> for TerminalSessionInfo {
    fn from((session_id, entry): (String, SessionConfigEntry)) -> Self {
        Self {
            session_id,
            config_id: entry.config_id,
            name: entry.name,
            created_at: entry.created_at.to_rfc3339(),
            last_used_at: entry.last_used_at.to_rfc3339(),
        }
    }
}

/// Register a new terminal session with its proxy config
///
/// # Arguments
/// - `session_id`: Unique identifier for the terminal session
/// - `config_id`: API configuration ID to use for this session
/// - `name`: Optional display name for the session
#[tauri::command]
pub async fn register_terminal_session(
    session_id: String,
    config_id: i64,
    name: Option<String>,
) -> Result<TerminalSessionInfo, String> {
    log::info!(
        "Registering terminal session: {} -> config_id={}",
        session_id,
        config_id
    );

    SESSION_CONFIG_MAP.register(session_id.clone(), config_id, name.clone());

    // Return the created session info
    if let Some(entry) = SESSION_CONFIG_MAP.get_entry(&session_id) {
        Ok(TerminalSessionInfo::from((session_id, entry)))
    } else {
        Err("Failed to register session".to_string())
    }
}

/// Switch a terminal session to use a different proxy config
///
/// # Arguments
/// - `session_id`: Session to switch
/// - `new_config_id`: New API configuration ID
#[tauri::command]
pub async fn switch_terminal_provider(
    session_id: String,
    new_config_id: i64,
) -> Result<TerminalSessionInfo, String> {
    log::info!(
        "Switching terminal provider: {} -> config_id={}",
        session_id,
        new_config_id
    );

    if SESSION_CONFIG_MAP.switch(&session_id, new_config_id) {
        if let Some(entry) = SESSION_CONFIG_MAP.get_entry(&session_id) {
            Ok(TerminalSessionInfo::from((session_id, entry)))
        } else {
            Err("Failed to get session after switch".to_string())
        }
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

/// Get info about a specific terminal session
#[tauri::command]
pub async fn get_terminal_session(session_id: String) -> Result<Option<TerminalSessionInfo>, String> {
    Ok(SESSION_CONFIG_MAP
        .get_entry(&session_id)
        .map(|entry| TerminalSessionInfo::from((session_id, entry))))
}

/// List all active terminal sessions
#[tauri::command]
pub async fn list_terminal_sessions() -> Result<Vec<TerminalSessionInfo>, String> {
    let sessions = SESSION_CONFIG_MAP
        .list_sessions()
        .into_iter()
        .map(TerminalSessionInfo::from)
        .collect();
    Ok(sessions)
}

/// Remove a terminal session (called when terminal closes)
#[tauri::command]
pub async fn remove_terminal_session(session_id: String) -> Result<bool, String> {
    log::info!("Removing terminal session: {}", session_id);
    Ok(SESSION_CONFIG_MAP.remove(&session_id).is_some())
}

/// Get count of active terminal sessions
#[tauri::command]
pub async fn get_terminal_session_count() -> Result<usize, String> {
    Ok(SESSION_CONFIG_MAP.session_count())
}

/// Clean up stale terminal sessions
///
/// # Arguments
/// - `max_age_secs`: Maximum age in seconds (default: 3600 = 1 hour)
#[tauri::command]
pub async fn cleanup_stale_terminal_sessions(max_age_secs: Option<i64>) -> Result<usize, String> {
    let max_age = max_age_secs.unwrap_or(3600);
    let removed = SESSION_CONFIG_MAP.cleanup_stale_sessions(max_age);
    log::info!("Cleaned up {} stale terminal sessions", removed);
    Ok(removed)
}

/// Clear all terminal sessions (used on app restart)
#[tauri::command]
pub async fn clear_all_terminal_sessions() -> Result<(), String> {
    log::info!("Clearing all terminal sessions");
    SESSION_CONFIG_MAP.clear();
    Ok(())
}

/// Get the proxy URL for a terminal session
///
/// Returns the URL that should be used as HTTP_PROXY for this session.
/// Format: http://127.0.0.1:{port}/session/{session_id}
#[tauri::command]
pub async fn get_terminal_proxy_url(
    session_id: String,
    proxy_port: Option<u16>,
) -> Result<String, String> {
    let port = proxy_port.unwrap_or(25341);
    let proxy_url = format!("http://127.0.0.1:{}/session/{}", port, session_id);
    Ok(proxy_url)
}

/// Build environment variables for a terminal session
///
/// Returns a map of environment variables to set in the terminal.
#[tauri::command]
pub async fn build_terminal_env_vars(
    session_id: String,
    proxy_port: Option<u16>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let port = proxy_port.unwrap_or(25341);
    let proxy_url = format!("http://127.0.0.1:{}/session/{}", port, session_id);

    let mut env_vars = std::collections::HashMap::new();

    // Proxy environment variables
    env_vars.insert("HTTP_PROXY".to_string(), proxy_url.clone());
    env_vars.insert("HTTPS_PROXY".to_string(), proxy_url.clone());
    env_vars.insert("http_proxy".to_string(), proxy_url.clone());
    env_vars.insert("https_proxy".to_string(), proxy_url.clone());
    env_vars.insert("NO_PROXY".to_string(), "localhost,127.0.0.1".to_string());

    // Session identification
    env_vars.insert("CLAUDE_PROXY_SESSION".to_string(), session_id.clone());
    env_vars.insert("CLAUDE_PROXY_ENABLED".to_string(), "1".to_string());

    // Get config name if available
    if let Some(entry) = SESSION_CONFIG_MAP.get_entry(&session_id) {
        env_vars.insert(
            "CLAUDE_PROXY_CONFIG_ID".to_string(),
            entry.config_id.to_string(),
        );
        if let Some(name) = entry.name {
            env_vars.insert("CLAUDE_PROXY_SESSION_NAME".to_string(), name);
        }
    }

    Ok(env_vars)
}

// ============================================================================
// PTY Management Commands
// ============================================================================

/// Create a new PTY terminal session
///
/// # Arguments
/// - `session_id`: Unique session identifier
/// - `config_id`: API config ID for proxy routing
/// - `name`: Optional display name
/// - `work_dir`: Optional working directory
/// - `rows`: Terminal rows (default: 24)
/// - `cols`: Terminal columns (default: 80)
#[tauri::command]
pub async fn create_pty_session(
    session_id: String,
    config_id: i64,
    name: Option<String>,
    work_dir: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
    pty_state: State<'_, PtyManagerState>,
    app_handle: tauri::AppHandle,
) -> Result<PtySessionInfo, String> {
    log::info!(
        "Creating PTY session: {} -> config_id={}, size={}x{}",
        session_id,
        config_id,
        cols.unwrap_or(80),
        rows.unwrap_or(24)
    );

    let manager = pty_state.manager();
    manager.create_session(
        session_id.clone(),
        config_id,
        name.clone(),
        work_dir.clone(),
        rows.unwrap_or(24),
        cols.unwrap_or(80),
        app_handle,
    ).await?;

    // Return session info
    Ok(PtySessionInfo {
        session_id,
        config_id,
        name,
        work_dir: work_dir.unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        }),
        running: true,
        is_claude_code: false,
        claude_options: None,
    })
}

/// Create a new Claude Code terminal session
///
/// # Arguments
/// - `session_id`: Unique session identifier
/// - `config_id`: API config ID for proxy routing
/// - `name`: Optional display name
/// - `work_dir`: Project working directory (required for Claude Code)
/// - `rows`: Terminal rows (default: 24)
/// - `cols`: Terminal columns (default: 80)
/// - `claude_options`: Claude Code startup options
#[tauri::command]
pub async fn create_claude_code_session(
    session_id: String,
    config_id: i64,
    name: Option<String>,
    work_dir: String,
    rows: Option<u16>,
    cols: Option<u16>,
    claude_options: ClaudeCodeOptions,
    pty_state: State<'_, PtyManagerState>,
    app_handle: tauri::AppHandle,
) -> Result<PtySessionInfo, String> {
    log::info!(
        "Creating Claude Code session: {} -> config_id={}, size={}x{}, dir={}",
        session_id,
        config_id,
        cols.unwrap_or(80),
        rows.unwrap_or(24),
        work_dir
    );
    log::debug!("Claude options: {:?}", claude_options);

    let manager = pty_state.manager();
    manager.create_claude_code_session(
        session_id.clone(),
        config_id,
        name.clone(),
        Some(work_dir.clone()),
        rows.unwrap_or(24),
        cols.unwrap_or(80),
        app_handle,
        claude_options.clone(),
    ).await?;

    // Return session info
    Ok(PtySessionInfo {
        session_id,
        config_id,
        name,
        work_dir,
        running: true,
        is_claude_code: true,
        claude_options: Some(claude_options),
    })
}

/// Write input to a PTY session
///
/// # Arguments
/// - `session_id`: Session to write to
/// - `data`: Base64 encoded input data
#[tauri::command]
pub async fn pty_write_input(
    session_id: String,
    data: String,
    pty_state: State<'_, PtyManagerState>,
) -> Result<(), String> {
    let decoded = BASE64.decode(&data).map_err(|e| format!("Invalid base64: {}", e))?;

    let manager = pty_state.manager();
    manager.write_input(&session_id, &decoded).await
}

/// Close a PTY session
///
/// # Arguments
/// - `session_id`: Session to close
#[tauri::command]
pub async fn close_pty_session(
    session_id: String,
    pty_state: State<'_, PtyManagerState>,
) -> Result<(), String> {
    log::info!("Closing PTY session: {}", session_id);

    let manager = pty_state.manager();
    manager.close_session(&session_id).await
}

/// List all active PTY sessions
#[tauri::command]
pub async fn list_pty_sessions(
    pty_state: State<'_, PtyManagerState>,
) -> Result<Vec<PtySessionInfo>, String> {
    let manager = pty_state.manager();
    Ok(manager.list_sessions().await)
}

/// Get PTY session count
#[tauri::command]
pub async fn get_pty_session_count(
    pty_state: State<'_, PtyManagerState>,
) -> Result<usize, String> {
    let manager = pty_state.manager();
    Ok(manager.session_count().await)
}

/// Switch provider for a PTY session at runtime
///
/// # Arguments
/// - `session_id`: Session to switch
/// - `new_config_id`: New API config ID
#[tauri::command]
pub async fn switch_pty_provider(
    session_id: String,
    new_config_id: i64,
    pty_state: State<'_, PtyManagerState>,
) -> Result<(), String> {
    log::info!(
        "Switching PTY provider: {} -> config_id={}",
        session_id,
        new_config_id
    );

    let manager = pty_state.manager();
    manager.switch_config(&session_id, new_config_id).await
}

/// Resize a PTY terminal session
///
/// # Arguments
/// - `session_id`: Session to resize
/// - `rows`: New row count
/// - `cols`: New column count
#[tauri::command]
pub async fn pty_resize(
    session_id: String,
    rows: u16,
    cols: u16,
    pty_state: State<'_, PtyManagerState>,
) -> Result<(), String> {
    log::debug!(
        "Resizing PTY session: {} to {}x{}",
        session_id,
        cols,
        rows
    );

    let manager = pty_state.manager();
    manager.resize(&session_id, rows, cols).await
}
