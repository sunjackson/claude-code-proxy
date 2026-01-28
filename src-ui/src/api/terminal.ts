/**
 * Terminal API Module
 *
 * Tauri commands for terminal session and PTY management.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

/** Terminal session info from SessionConfigMap */
export interface TerminalSessionInfo {
  session_id: string;
  config_id: number;
  name: string | null;
  created_at: string;
  last_used_at: string;
}

/** Claude Code startup options */
export interface ClaudeCodeOptions {
  /** Skip permissions check (--dangerously-skip-permissions) */
  skip_permissions?: boolean;
  /** Resume last session (-r or --resume) */
  resume?: boolean;
  /** Continue in non-interactive mode (-c or --continue) */
  continue_mode?: boolean;
  /** Print mode (-p or --print) */
  print_mode?: boolean;
  /** Custom model (--model) */
  model?: string;
  /** Initial prompt to send */
  initial_prompt?: string;
  /** Additional custom arguments */
  extra_args?: string[];
}

/** PTY session info */
export interface PtySessionInfo {
  session_id: string;
  config_id: number;
  name: string | null;
  work_dir: string;
  running: boolean;
  /** Whether this is a Claude Code session */
  is_claude_code?: boolean;
  /** Claude Code options (if applicable) */
  claude_options?: ClaudeCodeOptions | null;
}

/** Terminal output event payload */
export interface TerminalOutputEvent {
  session_id: string;
  data: string; // base64 encoded
}

/** Terminal closed event payload */
export interface TerminalClosedEvent {
  session_id: string;
}

/** Terminal error event payload */
export interface TerminalErrorEvent {
  session_id: string;
  error: string;
}

// ============================================================================
// Session Management (SessionConfigMap - for routing)
// ============================================================================

/**
 * Register a new terminal session with proxy config
 */
export async function registerTerminalSession(
  sessionId: string,
  configId: number,
  name?: string
): Promise<TerminalSessionInfo> {
  return invoke('register_terminal_session', {
    sessionId,
    configId,
    name: name ?? null,
  });
}

/**
 * Get info about a specific terminal session
 */
export async function getTerminalSession(sessionId: string): Promise<TerminalSessionInfo | null> {
  return invoke('get_terminal_session', { sessionId });
}

/**
 * List all active terminal sessions
 */
export async function listTerminalSessions(): Promise<TerminalSessionInfo[]> {
  return invoke('list_terminal_sessions');
}

/**
 * Remove a terminal session
 */
export async function removeTerminalSession(sessionId: string): Promise<boolean> {
  return invoke('remove_terminal_session', { sessionId });
}

/**
 * Get count of active terminal sessions
 */
export async function getTerminalSessionCount(): Promise<number> {
  return invoke('get_terminal_session_count');
}

/**
 * Clean up stale terminal sessions
 */
export async function cleanupStaleTerminalSessions(maxAgeSecs?: number): Promise<number> {
  return invoke('cleanup_stale_terminal_sessions', {
    maxAgeSecs: maxAgeSecs ?? null,
  });
}

/**
 * Clear all terminal sessions
 */
export async function clearAllTerminalSessions(): Promise<void> {
  return invoke('clear_all_terminal_sessions');
}

/**
 * Get the proxy URL for a terminal session
 */
export async function getTerminalProxyUrl(sessionId: string, proxyPort?: number): Promise<string> {
  return invoke('get_terminal_proxy_url', {
    sessionId,
    proxyPort: proxyPort ?? null,
  });
}

/**
 * Build environment variables for a terminal session
 */
export async function buildTerminalEnvVars(
  sessionId: string,
  proxyPort?: number
): Promise<Record<string, string>> {
  return invoke('build_terminal_env_vars', {
    sessionId,
    proxyPort: proxyPort ?? null,
  });
}

// ============================================================================
// PTY Management
// ============================================================================

/**
 * Create a new PTY terminal session
 */
export async function createPtySession(
  sessionId: string,
  configId: number,
  name?: string,
  workDir?: string,
  rows?: number,
  cols?: number
): Promise<PtySessionInfo> {
  return invoke('create_pty_session', {
    sessionId,
    configId,
    name: name ?? null,
    workDir: workDir ?? null,
    rows: rows ?? null,
    cols: cols ?? null,
  });
}

/**
 * Create a new Claude Code terminal session
 *
 * @param sessionId - Unique session identifier
 * @param configId - API config ID for proxy routing
 * @param workDir - Project working directory (required)
 * @param claudeOptions - Claude Code startup options
 * @param name - Optional display name
 * @param rows - Terminal rows (default: 24)
 * @param cols - Terminal columns (default: 80)
 */
export async function createClaudeCodeSession(
  sessionId: string,
  configId: number,
  workDir: string,
  claudeOptions: ClaudeCodeOptions,
  name?: string,
  rows?: number,
  cols?: number
): Promise<PtySessionInfo> {
  return invoke('create_claude_code_session', {
    sessionId,
    configId,
    workDir,
    claudeOptions: {
      skip_permissions: claudeOptions.skip_permissions ?? false,
      resume: claudeOptions.resume ?? false,
      continue_mode: claudeOptions.continue_mode ?? false,
      print_mode: claudeOptions.print_mode ?? false,
      model: claudeOptions.model ?? null,
      initial_prompt: claudeOptions.initial_prompt ?? null,
      extra_args: claudeOptions.extra_args ?? [],
    },
    name: name ?? null,
    rows: rows ?? null,
    cols: cols ?? null,
  });
}

/**
 * Write input to a PTY session (base64 encoded)
 */
export async function ptyWriteInput(sessionId: string, data: string): Promise<void> {
  return invoke('pty_write_input', { sessionId, data });
}

/**
 * Close a PTY session
 */
export async function closePtySession(sessionId: string): Promise<void> {
  return invoke('close_pty_session', { sessionId });
}

/**
 * List all active PTY sessions
 */
export async function listPtySessions(): Promise<PtySessionInfo[]> {
  return invoke('list_pty_sessions');
}

/**
 * Get PTY session count
 */
export async function getPtySessionCount(): Promise<number> {
  return invoke('get_pty_session_count');
}

/**
 * Resize a PTY terminal session
 */
export async function ptyResize(sessionId: string, rows: number, cols: number): Promise<void> {
  return invoke('pty_resize', { sessionId, rows, cols });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Encode string to base64 for PTY input (UTF-8 safe)
 */
export function encodeInput(text: string): string {
  // Convert string to UTF-8 bytes, then to base64
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  // Convert Uint8Array to binary string
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode base64 PTY output to string (UTF-8 safe)
 */
export function decodeOutput(base64: string): string {
  // Decode base64 to binary string, then convert to UTF-8
  const binary = atob(base64);
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Decode UTF-8 bytes to string
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}
