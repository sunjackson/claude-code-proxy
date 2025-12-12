-- 迁移: v12 -> v13 - Node 环境配置表
-- 用于保存用户选择的默认 Node 环境

-- 创建 Node 环境配置表
CREATE TABLE IF NOT EXISTS NodeEnvironmentConfig (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 环境唯一标识 (格式: {manager}-{version}, 如 nvm-20.10.0)
    environment_id TEXT NOT NULL UNIQUE,
    -- Node 可执行文件完整路径
    node_path TEXT NOT NULL,
    -- Node 版本号 (如 v20.10.0)
    node_version TEXT NOT NULL,
    -- 版本管理器类型 (NVM, FNM, Volta, ASDF, N, NVMWindows, System, Unknown)
    manager_type TEXT NOT NULL,
    -- 是否为默认环境 (只能有一个为 1)
    is_default BOOLEAN NOT NULL DEFAULT 0,
    -- Claude Code 路径 (如果在此环境中安装了 Claude Code)
    claude_path TEXT,
    -- Claude Code 版本
    claude_version TEXT,
    -- 创建时间
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- 更新时间
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 创建索引：快速查找默认环境
CREATE INDEX IF NOT EXISTS idx_node_env_default
    ON NodeEnvironmentConfig(is_default);

-- 创建索引：按管理器类型查询
CREATE INDEX IF NOT EXISTS idx_node_env_manager
    ON NodeEnvironmentConfig(manager_type);

-- 创建触发器：更新时自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_node_env_updated_at
    AFTER UPDATE ON NodeEnvironmentConfig
    FOR EACH ROW
    BEGIN
        UPDATE NodeEnvironmentConfig
        SET updated_at = datetime('now')
        WHERE id = NEW.id;
    END;

-- 创建触发器：确保只有一个默认环境
-- 当设置新的默认环境时，清除其他环境的默认标记
CREATE TRIGGER IF NOT EXISTS trg_node_env_single_default
    AFTER UPDATE OF is_default ON NodeEnvironmentConfig
    WHEN NEW.is_default = 1
    BEGIN
        UPDATE NodeEnvironmentConfig
        SET is_default = 0
        WHERE id != NEW.id AND is_default = 1;
    END;
