/**
 * PTY Manager Service
 *
 * Manages pseudo-terminal instances for the terminal integration feature.
 * Each PTY session is associated with a proxy config for Claude Code routing.
 *
 * Design: Uses std::sync::Mutex for PTY handles (not Send/Sync) and
 * tokio::sync::Mutex for metadata to support async operations.
 */

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex as StdMutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use crate::db::DbPool;
use crate::models::terminal_session::NewTerminalSession;
use crate::services::session_config::SESSION_CONFIG_MAP;
use crate::services::terminal_session_service::TerminalSessionService;

/// Claude Code startup options
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct ClaudeCodeOptions {
    /// Skip permissions check (--dangerously-skip-permissions)
    #[serde(default)]
    pub skip_permissions: bool,
    /// Resume last session (-r or --resume)
    #[serde(default)]
    pub resume: bool,
    /// Continue in non-interactive mode (-c or --continue)
    #[serde(default)]
    pub continue_mode: bool,
    /// Print mode (-p or --print)
    #[serde(default)]
    pub print_mode: bool,
    /// Custom model (--model)
    #[serde(default)]
    pub model: Option<String>,
    /// Initial prompt to send
    #[serde(default)]
    pub initial_prompt: Option<String>,
    /// Additional custom arguments
    #[serde(default)]
    pub extra_args: Vec<String>,
}

/// PTY session metadata
#[derive(Debug, Clone)]
pub struct PtySessionMeta {
    /// Session ID (for routing)
    pub session_id: String,
    /// Associated config ID
    pub config_id: i64,
    /// Session display name
    pub name: Option<String>,
    /// Working directory
    pub work_dir: String,
    /// Whether the session is running
    pub running: bool,
    /// Current terminal size
    pub rows: u16,
    pub cols: u16,
    /// Whether this is a Claude Code session
    pub is_claude_code: bool,
    /// Claude Code options (if applicable)
    pub claude_options: Option<ClaudeCodeOptions>,
}

/// PTY handle wrapper for resize operations
struct PtyHandle {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

/// PTY Manager for handling multiple terminal sessions
pub struct PtyManager {
    /// Session metadata (async-safe)
    sessions: Mutex<HashMap<String, PtySessionMeta>>,
    /// PTY handles for each session (sync mutex for non-Send types)
    handles: StdMutex<HashMap<String, PtyHandle>>,
    /// Default proxy port
    proxy_port: u16,
    /// Terminal session persistence service (optional)
    session_service: Option<Arc<TerminalSessionService>>,
}

// Safe because we only access handles through StdMutex
unsafe impl Send for PtyManager {}
unsafe impl Sync for PtyManager {}

impl PtyManager {
    /// Create a new PTY manager
    pub fn new(proxy_port: u16) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            handles: StdMutex::new(HashMap::new()),
            proxy_port,
            session_service: None,
        }
    }

    /// Create a new PTY manager with database persistence
    pub fn with_persistence(proxy_port: u16, db_pool: DbPool) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            handles: StdMutex::new(HashMap::new()),
            proxy_port,
            session_service: Some(Arc::new(TerminalSessionService::new(db_pool))),
        }
    }

    /// 从数据库恢复持久化会话
    ///
    /// 注意: 此方法仅恢复会话元数据到 SessionConfigMap，不会重新创建 PTY 实例
    /// PTY 会话在应用重启后无法恢复，需要用户手动重新创建
    pub async fn load_persisted_sessions(&self) -> Result<usize, String> {
        if let Some(service) = &self.session_service {
            match service.get_active_sessions().await {
                Ok(sessions) => {
                    let mut count = 0;
                    for session in sessions {
                        // 将会话信息恢复到 SessionConfigMap
                        SESSION_CONFIG_MAP.register(
                            session.session_id.clone(),
                            session.config_id,
                            session.name.clone(),
                        );

                        // 更新会话状态为未运行（因为 PTY 无法恢复）
                        if let Err(e) = service.update_running_status(&session.session_id, false).await {
                            log::error!("更新会话运行状态失败: {}", e);
                        }

                        count += 1;
                    }

                    log::info!("从数据库恢复了 {} 个会话元数据", count);
                    Ok(count)
                }
                Err(e) => {
                    log::error!("从数据库加载会话失败: {}", e);
                    Err(format!("加载持久化会话失败: {}", e))
                }
            }
        } else {
            log::debug!("未启用会话持久化，跳过恢复");
            Ok(0)
        }
    }

    /// Create a new terminal session
    pub async fn create_session(
        &self,
        session_id: String,
        config_id: i64,
        name: Option<String>,
        work_dir: Option<String>,
        rows: u16,
        cols: u16,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        self.create_session_internal(
            session_id,
            config_id,
            name,
            work_dir,
            rows,
            cols,
            app_handle,
            false,
            None,
        ).await
    }

    /// Create a Claude Code terminal session
    pub async fn create_claude_code_session(
        &self,
        session_id: String,
        config_id: i64,
        name: Option<String>,
        work_dir: Option<String>,
        rows: u16,
        cols: u16,
        app_handle: AppHandle,
        claude_options: ClaudeCodeOptions,
    ) -> Result<(), String> {
        self.create_session_internal(
            session_id,
            config_id,
            name,
            work_dir,
            rows,
            cols,
            app_handle,
            true,
            Some(claude_options),
        ).await
    }

    /// Internal session creation with optional Claude Code mode
    async fn create_session_internal(
        &self,
        session_id: String,
        config_id: i64,
        name: Option<String>,
        work_dir: Option<String>,
        rows: u16,
        cols: u16,
        app_handle: AppHandle,
        is_claude_code: bool,
        claude_options: Option<ClaudeCodeOptions>,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();

        // Default working directory
        let work_dir = work_dir.unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        });

        // Use provided size or defaults
        let rows = if rows > 0 { rows } else { 24 };
        let cols = if cols > 0 { cols } else { 80 };

        // Create PTY pair with initial size
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create PTY: {}", e))?;

        // Build command based on mode
        let cmd = if is_claude_code {
            self.build_claude_code_command(&work_dir, &session_id, config_id, claude_options.as_ref())
        } else {
            self.build_shell_command(&work_dir, &session_id, config_id)
        };

        // Spawn the process
        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        // Get master for I/O
        let master = pair.master;

        // Register session in SessionConfigMap for proxy routing
        log::info!(
            "[PTY Manager] Registering session in SESSION_CONFIG_MAP: session_id={}, config_id={}, name={:?}",
            session_id, config_id, name
        );
        SESSION_CONFIG_MAP.register(session_id.clone(), config_id, name.clone());

        // Verify registration
        if let Some(registered_config_id) = SESSION_CONFIG_MAP.get_config_id(&session_id) {
            log::info!(
                "[PTY Manager] Session registered successfully: session_id={}, config_id={}",
                session_id, registered_config_id
            );
        } else {
            log::error!(
                "[PTY Manager] Failed to verify session registration: session_id={}",
                session_id
            );
        }

        // Clone reader for output thread
        let reader = master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        // Get writer for input
        let writer = master
            .take_writer()
            .map_err(|e| format!("Failed to get writer: {}", e))?;

        // Start output reader thread
        let session_id_clone = session_id.clone();
        let app_handle_clone = app_handle.clone();
        thread::spawn(move || {
            Self::read_output(session_id_clone, reader, app_handle_clone);
        });

        // Store session metadata
        let meta = PtySessionMeta {
            session_id: session_id.clone(),
            config_id,
            name: name.clone(),
            work_dir: work_dir.clone(),
            running: true,
            rows,
            cols,
            is_claude_code,
            claude_options: claude_options.clone(),
        };

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), meta.clone());
        }

        // Store PTY handle
        {
            let mut handles = self.handles.lock().unwrap();
            handles.insert(session_id.clone(), PtyHandle { master, writer });
        }

        // 持久化到数据库（如果启用）
        if let Some(service) = &self.session_service {
            let new_session = NewTerminalSession {
                session_id: session_id.clone(),
                config_id,
                name,
                work_dir,
                is_claude_code,
                claude_options: claude_options.as_ref().map(|opts| {
                    serde_json::to_string(opts).unwrap_or_default()
                }),
                rows: rows as i32,
                cols: cols as i32,
            };

            if let Err(e) = service.create_session(new_session).await {
                log::error!("持久化会话失败: {}", e);
                // 不影响会话创建，仅记录错误
            }
        }

        Ok(())
    }

    /// Resize a terminal session
    pub async fn resize(&self, session_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        // Update metadata
        {
            let mut sessions = self.sessions.lock().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.rows = rows;
                session.cols = cols;
            } else {
                return Err(format!("Session not found: {}", session_id));
            }
        }

        // Resize PTY
        {
            let handles = self.handles.lock().unwrap();
            if let Some(handle) = handles.get(session_id) {
                handle
                    .master
                    .resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .map_err(|e| format!("Failed to resize PTY: {}", e))?;
                log::debug!("Resized PTY {} to {}x{}", session_id, cols, rows);
            } else {
                return Err(format!("PTY handle not found: {}", session_id));
            }
        }

        // 更新数据库中的终端尺寸
        if let Some(service) = &self.session_service {
            if let Err(e) = service.update_terminal_size(session_id, rows as i32, cols as i32).await {
                log::error!("更新数据库中的终端尺寸失败: {}", e);
            }
        }

        Ok(())
    }

    /// Write input to a terminal session
    pub async fn write_input(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut handles = self.handles.lock().unwrap();

        if let Some(handle) = handles.get_mut(session_id) {
            handle
                .writer
                .write_all(data)
                .map_err(|e| format!("Failed to write: {}", e))?;
            handle
                .writer
                .flush()
                .map_err(|e| format!("Failed to flush: {}", e))?;
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Close a terminal session
    pub async fn close_session(&self, session_id: &str) -> Result<(), String> {
        // Remove from sessions
        {
            let mut sessions = self.sessions.lock().await;
            if sessions.remove(session_id).is_none() {
                return Err(format!("Session not found: {}", session_id));
            }
        }

        // Remove PTY handle (this will close the PTY)
        {
            let mut handles = self.handles.lock().unwrap();
            handles.remove(session_id);
        }

        // Also remove from SessionConfigMap
        SESSION_CONFIG_MAP.remove(session_id);

        // 关闭数据库中的会话记录
        if let Some(service) = &self.session_service {
            if let Err(e) = service.close_session(session_id, None).await {
                log::error!("关闭数据库会话记录失败: {}", e);
            }
        }

        log::info!("Closed terminal session: {}", session_id);
        Ok(())
    }

    /// Get list of active sessions
    pub async fn list_sessions(&self) -> Vec<PtySessionInfo> {
        let sessions = self.sessions.lock().await;
        sessions
            .values()
            .map(|s| PtySessionInfo {
                session_id: s.session_id.clone(),
                config_id: s.config_id,
                name: s.name.clone(),
                work_dir: s.work_dir.clone(),
                running: s.running,
                is_claude_code: s.is_claude_code,
                claude_options: s.claude_options.clone(),
            })
            .collect()
    }

    /// Get session count
    pub async fn session_count(&self) -> usize {
        self.sessions.lock().await.len()
    }

    /// Build environment variables for a terminal session
    fn build_env_vars(&self, session_id: &str, config_id: i64) -> HashMap<String, String> {
        let mut env = HashMap::new();

        // Standard proxy URL (without path - required for Claude Code compatibility)
        let proxy_url = format!("http://127.0.0.1:{}", self.proxy_port);

        // Claude Code uses ANTHROPIC_BASE_URL for API endpoint
        // We include session_id in the path for routing
        let anthropic_base_url = format!("http://127.0.0.1:{}/session/{}", self.proxy_port, session_id);

        // Use a special API key format to pass session_id through Authorization header
        // Format: "proxy-session:{session_id}" - the proxy server will extract session_id and replace with real API key
        let proxy_api_key = format!("proxy-session:{}", session_id);

        log::info!(
            "[PTY Manager] Setting environment variables: session_id={}, config_id={}, ANTHROPIC_BASE_URL={}, API_KEY=proxy-session:{}",
            session_id, config_id, anthropic_base_url, session_id
        );

        // Set ANTHROPIC_BASE_URL for Claude Code to use our proxy with session routing
        env.insert("ANTHROPIC_BASE_URL".to_string(), anthropic_base_url);

        // Set ANTHROPIC_API_KEY with session encoding for reliable routing
        // The proxy server will extract session_id from this and replace with real API key
        env.insert("ANTHROPIC_API_KEY".to_string(), proxy_api_key);

        // Standard proxy environment variables (for other tools that might need them)
        env.insert("HTTP_PROXY".to_string(), proxy_url.clone());
        env.insert("HTTPS_PROXY".to_string(), proxy_url.clone());
        env.insert("http_proxy".to_string(), proxy_url.clone());
        env.insert("https_proxy".to_string(), proxy_url.clone());

        // No proxy for local addresses
        env.insert("NO_PROXY".to_string(), "localhost,127.0.0.1".to_string());
        env.insert("no_proxy".to_string(), "localhost,127.0.0.1".to_string());

        // Session identification (for debugging/logging)
        env.insert("CLAUDE_PROXY_SESSION".to_string(), session_id.to_string());
        env.insert("CLAUDE_PROXY_CONFIG_ID".to_string(), config_id.to_string());
        env.insert("CLAUDE_PROXY_ENABLED".to_string(), "1".to_string());

        // Inherit essential environment variables
        for key in &["PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "LC_ALL", "LC_CTYPE"] {
            if let Ok(value) = std::env::var(key) {
                env.insert(key.to_string(), value);
            }
        }

        // Set TERM for proper terminal emulation
        env.entry("TERM".to_string())
            .or_insert_with(|| "xterm-256color".to_string());

        // Ensure UTF-8 encoding for proper Chinese/Unicode support
        env.entry("LANG".to_string())
            .or_insert_with(|| "en_US.UTF-8".to_string());
        env.entry("LC_ALL".to_string())
            .or_insert_with(|| "en_US.UTF-8".to_string());
        env.entry("LC_CTYPE".to_string())
            .or_insert_with(|| "UTF-8".to_string());

        env
    }


    /// Detect the default shell for the current platform
    fn detect_default_shell() -> String {
        #[cfg(target_os = "windows")]
        {
            if let Ok(shell) = std::env::var("CLAUDE_PROXY_SHELL") {
                let shell = shell.trim().to_string();
                if !shell.is_empty() {
                    return shell;
                }
            }

            if Self::windows_path_has_exe("pwsh.exe") || Self::windows_path_has_exe("pwsh") {
                return "pwsh.exe".to_string();
            }

            if Self::windows_path_has_exe("powershell.exe") || Self::windows_path_has_exe("powershell") {
                return "powershell.exe".to_string();
            }

            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }

        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    }

    fn escape_powershell_single_quoted(s: &str) -> String {
        s.replace('\'', "''")
    }

    fn is_cmd_shell(shell: &str) -> bool {
        let shell = shell.trim().to_ascii_lowercase();
        shell == "cmd"
            || shell == "cmd.exe"
            || shell.ends_with("\\cmd.exe")
            || shell.ends_with("/cmd.exe")
    }

    fn is_powershell_shell(shell: &str) -> bool {
        let shell = shell.trim().to_ascii_lowercase();
        shell == "powershell"
            || shell == "powershell.exe"
            || shell.ends_with("\\powershell.exe")
            || shell.ends_with("/powershell.exe")
            || shell == "pwsh"
            || shell == "pwsh.exe"
            || shell.ends_with("\\pwsh.exe")
            || shell.ends_with("/pwsh.exe")
    }

    #[cfg(target_os = "windows")]
    fn windows_path_has_exe(exe_name: &str) -> bool {
        let exe_name = exe_name.trim();
        if exe_name.is_empty() {
            return false;
        }

        if let Some(paths) = std::env::var_os("PATH") {
            for path in std::env::split_paths(&paths) {
                let candidate = path.join(exe_name);
                if candidate.is_file() {
                    return true;
                }
            }
        }
        false
    }

    fn build_powershell_utf8_init_script() -> &'static str {
        "[Console]::InputEncoding=[System.Text.Encoding]::UTF8; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8; chcp 65001 | Out-Null;"
    }

    fn build_powershell_claude_script(args: &[String]) -> String {
        let args_literal = if args.is_empty() {
            "@()".to_string()
        } else {
            let joined = args
                .iter()
                .map(|a| format!("'{}'", Self::escape_powershell_single_quoted(a)))
                .collect::<Vec<String>>()
                .join(",");
            format!("@({})", joined)
        };

        format!(
            "{} $claudeArgs = {}; & 'claude' @claudeArgs;",
            Self::build_powershell_utf8_init_script(),
            args_literal
        )
    }

    /// Build shell command for normal terminal mode
    fn build_shell_command(&self, work_dir: &str, session_id: &str, config_id: i64) -> CommandBuilder {
        let shell = Self::detect_default_shell();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(work_dir);

        #[cfg(target_os = "windows")]
        {
            if Self::is_powershell_shell(&shell) {
                cmd.arg("-NoLogo");
                cmd.arg("-NoExit");
                cmd.arg("-Command");
                cmd.arg(Self::build_powershell_utf8_init_script());
            } else if Self::is_cmd_shell(&shell) {
                cmd.arg("/K");
                cmd.arg("chcp 65001>nul");
            }
        }

        // Inject proxy environment variables
        let env_vars = self.build_env_vars(session_id, config_id);
        for (key, value) in env_vars {
            cmd.env(key, value);
        }

        cmd
    }

    /// Build Claude Code command with options
    ///
    /// This creates an interactive shell that:
    /// 1. First runs the claude command with specified options
    /// 2. If claude exits (success or error), stays in shell for user to continue
    fn build_claude_code_command(
        &self,
        work_dir: &str,
        session_id: &str,
        config_id: i64,
        options: Option<&ClaudeCodeOptions>,
    ) -> CommandBuilder {
        // Use shell to run claude command (ensures PATH is available)
        let shell = Self::detect_default_shell();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(work_dir);

        // Build claude arguments (excluding command itself)
        let mut claude_args: Vec<String> = Vec::new();

        if let Some(opts) = options {
            // Add flags based on options
            if opts.skip_permissions {
                claude_args.push("--dangerously-skip-permissions".to_string());
            }
            if opts.resume {
                claude_args.push("-r".to_string());
            }
            if opts.continue_mode {
                claude_args.push("-c".to_string());
            }
            if opts.print_mode {
                claude_args.push("-p".to_string());
            }
            if let Some(ref model) = opts.model {
                claude_args.push("--model".to_string());
                claude_args.push(model.clone());
            }
            // Add extra custom arguments
            for arg in &opts.extra_args {
                claude_args.push(arg.clone());
            }
            // Add initial prompt if provided (must be last)
            if let Some(ref prompt) = opts.initial_prompt {
                claude_args.push(prompt.clone());
            }
        }

        // Join arguments into a single command string (for logging only)
        let claude_cmd = std::iter::once("claude".to_string())
            .chain(claude_args.iter().cloned())
            .collect::<Vec<String>>()
            .join(" ");

        // Platform-specific shell invocation
        // Key: Run claude first, then exec into interactive shell regardless of claude's exit status
        // This ensures user can continue using the terminal even if claude fails/exits
        #[cfg(target_os = "windows")]
        {
            if Self::is_powershell_shell(&shell) {
                let script = Self::build_powershell_claude_script(&claude_args);
                cmd.arg("-NoLogo");
                cmd.arg("-NoExit");
                cmd.arg("-Command");
                cmd.arg(script);
            } else {
                // cmd.exe fallback：/K 本身会保持交互，无需再额外启动一个 cmd
                let script = if claude_args.is_empty() {
                    "chcp 65001>nul & claude".to_string()
                } else {
                    format!("chcp 65001>nul & {}",
                        std::iter::once("claude".to_string())
                            .chain(claude_args.iter().cloned())
                            .collect::<Vec<String>>()
                            .join(" ")
                    )
                };
                cmd.arg("/K");
                cmd.arg(&script);
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Unix: run claude, then exec into interactive shell
            // Using exec $SHELL ensures a clean shell after claude exits
            let script = format!("{}; exec $SHELL", claude_cmd);
            cmd.arg("-c");
            cmd.arg(&script);
        }

        // Inject proxy environment variables
        let env_vars = self.build_env_vars(session_id, config_id);
        for (key, value) in env_vars {
            cmd.env(key, value);
        }

        log::info!("Built Claude Code command: {} with fallback shell in {}", claude_cmd, work_dir);
        cmd
    }

    /// Read output from PTY and emit events
    fn read_output(session_id: String, mut reader: Box<dyn Read + Send>, app_handle: AppHandle) {
        let mut buffer = [0u8; 4096];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    // EOF - session ended
                    log::info!("PTY session ended: {}", session_id);
                    let _ = app_handle.emit(
                        "terminal:closed",
                        serde_json::json!({
                            "session_id": session_id,
                        }),
                    );
                    break;
                }
                Ok(n) => {
                    // Emit output event using base64 encoding
                    let data = BASE64.encode(&buffer[..n]);
                    let _ = app_handle.emit(
                        "terminal:output",
                        serde_json::json!({
                            "session_id": session_id,
                            "data": data,
                        }),
                    );
                }
                Err(e) => {
                    log::error!("Error reading from PTY {}: {}", session_id, e);
                    let _ = app_handle.emit(
                        "terminal:error",
                        serde_json::json!({
                            "session_id": session_id,
                            "error": e.to_string(),
                        }),
                    );
                    break;
                }
            }
        }
    }
}

/// Simplified session info for API responses
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PtySessionInfo {
    pub session_id: String,
    pub config_id: i64,
    pub name: Option<String>,
    pub work_dir: String,
    pub running: bool,
    #[serde(default)]
    pub is_claude_code: bool,
    #[serde(default)]
    pub claude_options: Option<ClaudeCodeOptions>,
}

/// Thread-safe PTY manager wrapper for Tauri state
pub struct PtyManagerState {
    manager: Arc<PtyManager>,
}

impl PtyManagerState {
    pub fn new(proxy_port: u16) -> Self {
        Self {
            manager: Arc::new(PtyManager::new(proxy_port)),
        }
    }

    pub fn manager(&self) -> Arc<PtyManager> {
        Arc::clone(&self.manager)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shell() {
        let shell = PtyManager::detect_default_shell();
        assert!(!shell.is_empty());
    }

    #[test]
    fn test_build_env_vars() {
        let manager = PtyManager::new(25341);
        let env = manager.build_env_vars("test-session", 1);

        assert!(env.contains_key("ANTHROPIC_BASE_URL"));
        assert!(env.contains_key("HTTP_PROXY"));
        assert!(env.contains_key("HTTPS_PROXY"));
        assert!(env.contains_key("CLAUDE_PROXY_SESSION"));
        assert!(env.contains_key("CLAUDE_PROXY_CONFIG_ID"));

        // ANTHROPIC_BASE_URL should contain session path
        let base_url = env.get("ANTHROPIC_BASE_URL").unwrap();
        assert!(base_url.contains("/session/test-session"));

        // HTTP_PROXY should NOT contain path (standard proxy format)
        let proxy_url = env.get("HTTP_PROXY").unwrap();
        assert!(!proxy_url.contains("/session/"));
    }

    #[test]
    fn test_escape_powershell_single_quoted() {
        assert_eq!(PtyManager::escape_powershell_single_quoted("abc"), "abc");
        assert_eq!(PtyManager::escape_powershell_single_quoted("a'b"), "a''b");
        assert_eq!(PtyManager::escape_powershell_single_quoted("'"), "''");
    }

    #[test]
    fn test_build_powershell_claude_script_contains_args() {
        let args = vec!["--model".to_string(), "claude-3-5-sonnet".to_string(), "hello world".to_string()];
        let script = PtyManager::build_powershell_claude_script(&args);
        assert!(script.contains("OutputEncoding"));
        assert!(script.contains("$claudeArgs"));
        assert!(script.contains("'--model'"));
        assert!(script.contains("'claude-3-5-sonnet'"));
        assert!(script.contains("'hello world'"));
        assert!(script.contains("& 'claude'"));
    }
}
