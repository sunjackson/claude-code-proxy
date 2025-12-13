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

use crate::services::session_config::SESSION_CONFIG_MAP;

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
        SESSION_CONFIG_MAP.register(session_id.clone(), config_id, name.clone());

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
            name,
            work_dir,
            running: true,
            rows,
            cols,
            is_claude_code,
            claude_options,
        };

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), meta);
        }

        // Store PTY handle
        {
            let mut handles = self.handles.lock().unwrap();
            handles.insert(session_id, PtyHandle { master, writer });
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

    /// Switch the config ID for a session (runtime provider switch)
    pub async fn switch_config(&self, session_id: &str, new_config_id: i64) -> Result<(), String> {
        // Update SessionConfigMap (proxy routing will use this)
        if SESSION_CONFIG_MAP.switch(session_id, new_config_id) {
            // Also update our local session record
            let mut sessions = self.sessions.lock().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.config_id = new_config_id;
            }
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Build environment variables for a terminal session
    fn build_env_vars(&self, session_id: &str, config_id: i64) -> HashMap<String, String> {
        let mut env = HashMap::new();

        // Standard proxy URL (without path - required for Claude Code compatibility)
        let proxy_url = format!("http://127.0.0.1:{}", self.proxy_port);

        // Claude Code uses ANTHROPIC_BASE_URL for API endpoint
        // We include session_id in the path for routing
        let anthropic_base_url = format!("http://127.0.0.1:{}/session/{}", self.proxy_port, session_id);

        // Set ANTHROPIC_BASE_URL for Claude Code to use our proxy with session routing
        env.insert("ANTHROPIC_BASE_URL".to_string(), anthropic_base_url);

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
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }

        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    }

    /// Build shell command for normal terminal mode
    fn build_shell_command(&self, work_dir: &str, session_id: &str, config_id: i64) -> CommandBuilder {
        let shell = Self::detect_default_shell();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(work_dir);

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

        // Build claude command with arguments
        let mut claude_args = vec!["claude".to_string()];

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

        // Join arguments into a single command string
        let claude_cmd = claude_args.join(" ");

        // Platform-specific shell invocation
        // Key: Run claude first, then exec into interactive shell regardless of claude's exit status
        // This ensures user can continue using the terminal even if claude fails/exits
        #[cfg(target_os = "windows")]
        {
            // Windows: run claude, then start a new cmd
            let script = format!("{} & cmd", claude_cmd);
            cmd.arg("/K");
            cmd.arg(&script);
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
}
