-- Migration v16 -> v17: 终端会话管理支持
-- 添加 TerminalSession, SessionHistory, CommandAuditLog 三个表

-- ============================================
-- 1. TerminalSession (终端会话)
-- ============================================
CREATE TABLE IF NOT EXISTS TerminalSession (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,  -- UUID
    config_id INTEGER NOT NULL,
    name TEXT,
    work_dir TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    is_claude_code BOOLEAN NOT NULL DEFAULT 0,
    claude_options TEXT,  -- JSON 格式存储 Claude Code 选项
    running BOOLEAN NOT NULL DEFAULT 1,
    rows INTEGER NOT NULL DEFAULT 24 CHECK(rows > 0 AND rows <= 500),
    cols INTEGER NOT NULL DEFAULT 80 CHECK(cols > 0 AND cols <= 500),

    FOREIGN KEY (config_id) REFERENCES ApiConfig(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_terminal_session_id ON TerminalSession(session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_config ON TerminalSession(config_id);
CREATE INDEX IF NOT EXISTS idx_terminal_created ON TerminalSession(created_at);
CREATE INDEX IF NOT EXISTS idx_terminal_running ON TerminalSession(running);

-- ============================================
-- 2. SessionHistory (会话历史记录)
-- ============================================
CREATE TABLE IF NOT EXISTS SessionHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,  -- 原会话 ID
    config_id INTEGER NOT NULL,
    name TEXT,
    work_dir TEXT,
    created_at DATETIME NOT NULL,
    closed_at DATETIME NOT NULL,
    exit_code INTEGER,
    exited_normally BOOLEAN NOT NULL DEFAULT 1,

    FOREIGN KEY (config_id) REFERENCES ApiConfig(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_history_session ON SessionHistory(session_id);
CREATE INDEX IF NOT EXISTS idx_history_config ON SessionHistory(config_id);
CREATE INDEX IF NOT EXISTS idx_history_closed ON SessionHistory(closed_at);

-- ============================================
-- 3. CommandAuditLog (命令审计日志)
-- ============================================
CREATE TABLE IF NOT EXISTS CommandAuditLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    command TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    allowed BOOLEAN NOT NULL DEFAULT 1,  -- 1=允许执行, 0=被拦截

    FOREIGN KEY (session_id) REFERENCES TerminalSession(session_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON CommandAuditLog(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON CommandAuditLog(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_allowed ON CommandAuditLog(allowed);

-- ============================================
-- 4. 触发器: TerminalSession 更新时间戳
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_terminal_session_timestamp
AFTER UPDATE ON TerminalSession
FOR EACH ROW
BEGIN
    UPDATE TerminalSession SET last_used_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
