use serde::{Deserialize, Serialize};

/// 终端会话模型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: Option<i64>,
    pub session_id: String,  // UUID
    pub config_id: i64,
    pub name: Option<String>,
    pub work_dir: String,
    pub created_at: String,
    pub last_used_at: String,
    pub closed_at: Option<String>,
    pub is_claude_code: bool,
    pub claude_options: Option<String>,  // JSON 字符串
    pub running: bool,
    pub rows: i32,
    pub cols: i32,
}

/// 新建终端会话请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTerminalSession {
    pub session_id: String,
    pub config_id: i64,
    pub name: Option<String>,
    pub work_dir: String,
    pub is_claude_code: bool,
    pub claude_options: Option<String>,
    pub rows: i32,
    pub cols: i32,
}

/// 会话历史记录模型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionHistory {
    pub id: Option<i64>,
    pub session_id: String,
    pub config_id: i64,
    pub name: Option<String>,
    pub work_dir: Option<String>,
    pub created_at: String,
    pub closed_at: String,
    pub exit_code: Option<i32>,
    pub exited_normally: bool,
}

/// 命令审计日志模型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandAuditLog {
    pub id: Option<i64>,
    pub session_id: String,
    pub command: String,
    pub timestamp: String,
    pub allowed: bool,
}
