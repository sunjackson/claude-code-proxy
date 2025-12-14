-- Migration V15: 模型映射配置表
-- Date: 2025-12-13
-- Description: 添加自定义模型映射配置支持

-- ============================================
-- ModelMapping (模型映射配置)
-- ============================================
CREATE TABLE IF NOT EXISTS ModelMapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 映射关系
    source_model TEXT NOT NULL,           -- 源模型名称 (如: claude-sonnet-4-5-20250929)
    target_model TEXT NOT NULL,           -- 目标模型名称 (如: gpt-4o)

    -- 映射方向和类型
    direction TEXT NOT NULL CHECK(direction IN ('claude_to_openai', 'openai_to_claude', 'bidirectional')),
    mapping_type TEXT NOT NULL DEFAULT 'user_defined' CHECK(mapping_type IN ('builtin', 'user_defined')),

    -- 模型信息 (可选)
    source_provider TEXT CHECK(source_provider IN ('Claude', 'OpenAI')),
    target_provider TEXT CHECK(target_provider IN ('Claude', 'OpenAI')),

    -- 优先级 (数字越大优先级越高)
    priority INTEGER NOT NULL DEFAULT 0 CHECK(priority >= 0 AND priority <= 100),

    -- 元数据
    description TEXT,
    notes TEXT,

    -- 状态
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    is_custom BOOLEAN NOT NULL DEFAULT 1,      -- 1=用户自定义, 0=系统预设

    -- 时间戳
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 唯一约束: 同一方向的映射对只能有一个
    UNIQUE(source_model, direction)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_model_mapping_source ON ModelMapping(source_model);
CREATE INDEX IF NOT EXISTS idx_model_mapping_target ON ModelMapping(target_model);
CREATE INDEX IF NOT EXISTS idx_model_mapping_direction ON ModelMapping(direction);
CREATE INDEX IF NOT EXISTS idx_model_mapping_enabled ON ModelMapping(is_enabled);
CREATE INDEX IF NOT EXISTS idx_model_mapping_priority ON ModelMapping(priority DESC);
CREATE INDEX IF NOT EXISTS idx_model_mapping_type ON ModelMapping(mapping_type);

-- 触发器: 自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_model_mapping_timestamp
AFTER UPDATE ON ModelMapping
BEGIN
    UPDATE ModelMapping SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 插入系统预设的模型映射 (is_custom = 0)
-- ============================================

-- Claude Sonnet 4.5 → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-sonnet-4-5-20250929', 'gpt-4o', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 100, 0, 'Claude Sonnet 4.5 最新版本 → GPT-4o');

-- Claude 3.5 Sonnet → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-sonnet-20241022', 'gpt-4o', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 90, 0, 'Claude 3.5 Sonnet → GPT-4o');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-sonnet-latest', 'gpt-4o', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 90, 0, 'Claude 3.5 Sonnet Latest → GPT-4o');

-- Claude 3.5 Haiku → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-haiku-20241022', 'gpt-4o-mini', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 80, 0, 'Claude 3.5 Haiku → GPT-4o Mini');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-haiku-latest', 'gpt-4o-mini', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 80, 0, 'Claude 3.5 Haiku Latest → GPT-4o Mini');

-- Claude 3 Opus → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-opus-20240229', 'gpt-4-turbo', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 85, 0, 'Claude 3 Opus → GPT-4 Turbo');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-opus-latest', 'gpt-4-turbo', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 85, 0, 'Claude 3 Opus Latest → GPT-4 Turbo');

-- Claude 3 Sonnet → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-sonnet-20240229', 'gpt-4', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 70, 0, 'Claude 3 Sonnet → GPT-4');

-- Claude 3 Haiku → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-haiku-20240307', 'gpt-3.5-turbo', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 60, 0, 'Claude 3 Haiku → GPT-3.5 Turbo');

-- Claude 2 系列 → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-2.1', 'gpt-4', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 50, 0, 'Claude 2.1 → GPT-4');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-2.0', 'gpt-4', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 50, 0, 'Claude 2.0 → GPT-4');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-instant-1.2', 'gpt-3.5-turbo', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 40, 0, 'Claude Instant 1.2 → GPT-3.5 Turbo');

-- ============================================
-- OpenAI → Claude 反向映射
-- ============================================

-- GPT-4o → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o', 'claude-sonnet-4-5-20250929', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'GPT-4o → Claude Sonnet 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o-2024-08-06', 'claude-sonnet-4-5-20250929', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'GPT-4o (2024-08) → Claude Sonnet 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o-2024-05-13', 'claude-sonnet-4-5-20250929', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'GPT-4o (2024-05) → Claude Sonnet 4.5');

-- GPT-4o Mini → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o-mini', 'claude-3-5-haiku-20241022', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 90, 0, 'GPT-4o Mini → Claude 3.5 Haiku');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o-mini-2024-07-18', 'claude-3-5-haiku-20241022', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 90, 0, 'GPT-4o Mini (2024-07) → Claude 3.5 Haiku');

-- GPT-4 Turbo → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4-turbo', 'claude-3-opus-20240229', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 85, 0, 'GPT-4 Turbo → Claude 3 Opus');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4-turbo-2024-04-09', 'claude-3-opus-20240229', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 85, 0, 'GPT-4 Turbo (2024-04) → Claude 3 Opus');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4-turbo-preview', 'claude-3-opus-20240229', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 85, 0, 'GPT-4 Turbo Preview → Claude 3 Opus');

-- GPT-4 → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4', 'claude-3-sonnet-20240229', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 70, 0, 'GPT-4 → Claude 3 Sonnet');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4-0613', 'claude-3-sonnet-20240229', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 70, 0, 'GPT-4 (0613) → Claude 3 Sonnet');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4-0314', 'claude-3-sonnet-20240229', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 70, 0, 'GPT-4 (0314) → Claude 3 Sonnet');

-- GPT-3.5 Turbo → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-3.5-turbo', 'claude-3-haiku-20240307', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 60, 0, 'GPT-3.5 Turbo → Claude 3 Haiku');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-3.5-turbo-0125', 'claude-3-haiku-20240307', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 60, 0, 'GPT-3.5 Turbo (0125) → Claude 3 Haiku');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-3.5-turbo-1106', 'claude-3-haiku-20240307', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 60, 0, 'GPT-3.5 Turbo (1106) → Claude 3 Haiku');
