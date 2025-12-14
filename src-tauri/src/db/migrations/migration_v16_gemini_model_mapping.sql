-- Migration V16: 扩展模型映射支持 Gemini
-- Date: 2025-12-14
-- Description: 添加 Gemini 方向的模型映射支持和更多默认映射

-- ============================================
-- 步骤 1: 重建 ModelMapping 表以支持 Gemini 方向
-- SQLite 不支持直接修改 CHECK 约束，需要重建表
-- ============================================

-- 1.1 创建新表
CREATE TABLE IF NOT EXISTS ModelMapping_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 映射关系
    source_model TEXT NOT NULL,           -- 源模型名称
    target_model TEXT NOT NULL,           -- 目标模型名称

    -- 映射方向和类型 (扩展支持 Gemini)
    direction TEXT NOT NULL CHECK(direction IN (
        'claude_to_openai', 'openai_to_claude',
        'claude_to_gemini', 'gemini_to_claude',
        'openai_to_gemini', 'gemini_to_openai',
        'bidirectional'
    )),
    mapping_type TEXT NOT NULL DEFAULT 'user_defined' CHECK(mapping_type IN ('builtin', 'user_defined')),

    -- 模型信息 (可选，扩展支持 Gemini)
    source_provider TEXT CHECK(source_provider IN ('Claude', 'OpenAI', 'Gemini')),
    target_provider TEXT CHECK(target_provider IN ('Claude', 'OpenAI', 'Gemini')),

    -- 优先级
    priority INTEGER NOT NULL DEFAULT 0 CHECK(priority >= 0 AND priority <= 100),

    -- 元数据
    description TEXT,
    notes TEXT,

    -- 状态
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    is_custom BOOLEAN NOT NULL DEFAULT 1,

    -- 时间戳
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 唯一约束
    UNIQUE(source_model, direction)
);

-- 1.2 复制现有数据
INSERT INTO ModelMapping_new (
    id, source_model, target_model, direction, mapping_type,
    source_provider, target_provider, priority, description, notes,
    is_enabled, is_custom, created_at, updated_at
)
SELECT
    id, source_model, target_model, direction, mapping_type,
    source_provider, target_provider, priority, description, notes,
    is_enabled, is_custom, created_at, updated_at
FROM ModelMapping;

-- 1.3 删除旧表
DROP TABLE IF EXISTS ModelMapping;

-- 1.4 重命名新表
ALTER TABLE ModelMapping_new RENAME TO ModelMapping;

-- 1.5 重建索引
CREATE INDEX IF NOT EXISTS idx_model_mapping_source ON ModelMapping(source_model);
CREATE INDEX IF NOT EXISTS idx_model_mapping_target ON ModelMapping(target_model);
CREATE INDEX IF NOT EXISTS idx_model_mapping_direction ON ModelMapping(direction);
CREATE INDEX IF NOT EXISTS idx_model_mapping_enabled ON ModelMapping(is_enabled);
CREATE INDEX IF NOT EXISTS idx_model_mapping_priority ON ModelMapping(priority DESC);
CREATE INDEX IF NOT EXISTS idx_model_mapping_type ON ModelMapping(mapping_type);

-- 1.6 重建触发器
DROP TRIGGER IF EXISTS update_model_mapping_timestamp;
CREATE TRIGGER IF NOT EXISTS update_model_mapping_timestamp
AFTER UPDATE ON ModelMapping
BEGIN
    UPDATE ModelMapping SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 步骤 2: 添加更多 Claude ↔ OpenAI 映射
-- ============================================

-- Claude Opus 4 系列 (最新旗舰)
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-opus-4-20250514', 'gpt-4o', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 100, 0, 'Claude Opus 4 → GPT-4o');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-opus-4-5-20251101', 'gpt-4o', 'claude_to_openai', 'builtin', 'Claude', 'OpenAI', 100, 0, 'Claude Opus 4.5 → GPT-4o');

-- OpenAI o1/o3 系列 → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o1', 'claude-opus-4-5-20251101', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'OpenAI o1 → Claude Opus 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o1-preview', 'claude-opus-4-5-20251101', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'OpenAI o1 Preview → Claude Opus 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o1-mini', 'claude-sonnet-4-5-20250929', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 95, 0, 'OpenAI o1 Mini → Claude Sonnet 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o3', 'claude-opus-4-5-20251101', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'OpenAI o3 → Claude Opus 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o3-mini', 'claude-sonnet-4-5-20250929', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 95, 0, 'OpenAI o3 Mini → Claude Sonnet 4.5');

-- GPT-4.5 系列 → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4.5-preview', 'claude-opus-4-5-20251101', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'GPT-4.5 Preview → Claude Opus 4.5');

-- chatgpt-4o 别名 → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('chatgpt-4o-latest', 'claude-sonnet-4-5-20250929', 'openai_to_claude', 'builtin', 'OpenAI', 'Claude', 100, 0, 'ChatGPT-4o Latest → Claude Sonnet 4.5');

-- ============================================
-- 步骤 3: 添加 Claude ↔ Gemini 映射
-- ============================================

-- Claude → Gemini
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-sonnet-4-5-20250929', 'gemini-2.0-flash-exp', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 100, 0, 'Claude Sonnet 4.5 → Gemini 2.0 Flash');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-opus-4-5-20251101', 'gemini-1.5-pro', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 100, 0, 'Claude Opus 4.5 → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-sonnet-20241022', 'gemini-1.5-pro', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 90, 0, 'Claude 3.5 Sonnet → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-sonnet-latest', 'gemini-1.5-pro', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 90, 0, 'Claude 3.5 Sonnet Latest → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-haiku-20241022', 'gemini-1.5-flash', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 80, 0, 'Claude 3.5 Haiku → Gemini 1.5 Flash');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-5-haiku-latest', 'gemini-1.5-flash', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 80, 0, 'Claude 3.5 Haiku Latest → Gemini 1.5 Flash');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-opus-20240229', 'gemini-1.5-pro', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 85, 0, 'Claude 3 Opus → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-sonnet-20240229', 'gemini-1.5-flash', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 70, 0, 'Claude 3 Sonnet → Gemini 1.5 Flash');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('claude-3-haiku-20240307', 'gemini-1.5-flash-8b', 'claude_to_gemini', 'builtin', 'Claude', 'Gemini', 60, 0, 'Claude 3 Haiku → Gemini 1.5 Flash 8B');

-- Gemini → Claude
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-2.0-flash-exp', 'claude-sonnet-4-5-20250929', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 100, 0, 'Gemini 2.0 Flash → Claude Sonnet 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-2.0-flash', 'claude-sonnet-4-5-20250929', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 100, 0, 'Gemini 2.0 Flash → Claude Sonnet 4.5');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-pro', 'claude-3-5-sonnet-20241022', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 90, 0, 'Gemini 1.5 Pro → Claude 3.5 Sonnet');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-pro-latest', 'claude-3-5-sonnet-20241022', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 90, 0, 'Gemini 1.5 Pro Latest → Claude 3.5 Sonnet');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-flash', 'claude-3-5-haiku-20241022', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 80, 0, 'Gemini 1.5 Flash → Claude 3.5 Haiku');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-flash-latest', 'claude-3-5-haiku-20241022', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 80, 0, 'Gemini 1.5 Flash Latest → Claude 3.5 Haiku');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-flash-8b', 'claude-3-haiku-20240307', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 60, 0, 'Gemini 1.5 Flash 8B → Claude 3 Haiku');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-pro', 'claude-3-sonnet-20240229', 'gemini_to_claude', 'builtin', 'Gemini', 'Claude', 70, 0, 'Gemini Pro → Claude 3 Sonnet');

-- ============================================
-- 步骤 4: 添加 OpenAI ↔ Gemini 映射
-- ============================================

-- OpenAI → Gemini
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o', 'gemini-2.0-flash-exp', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 100, 0, 'GPT-4o → Gemini 2.0 Flash');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4o-mini', 'gemini-1.5-flash', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 90, 0, 'GPT-4o Mini → Gemini 1.5 Flash');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4-turbo', 'gemini-1.5-pro', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 85, 0, 'GPT-4 Turbo → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-4', 'gemini-1.5-pro', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 80, 0, 'GPT-4 → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gpt-3.5-turbo', 'gemini-1.5-flash-8b', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 60, 0, 'GPT-3.5 Turbo → Gemini 1.5 Flash 8B');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o1', 'gemini-1.5-pro', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 100, 0, 'OpenAI o1 → Gemini 1.5 Pro');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('o1-mini', 'gemini-2.0-flash-exp', 'openai_to_gemini', 'builtin', 'OpenAI', 'Gemini', 95, 0, 'OpenAI o1 Mini → Gemini 2.0 Flash');

-- Gemini → OpenAI
INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-2.0-flash-exp', 'gpt-4o', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 100, 0, 'Gemini 2.0 Flash → GPT-4o');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-2.0-flash', 'gpt-4o', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 100, 0, 'Gemini 2.0 Flash → GPT-4o');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-pro', 'gpt-4-turbo', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 90, 0, 'Gemini 1.5 Pro → GPT-4 Turbo');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-pro-latest', 'gpt-4-turbo', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 90, 0, 'Gemini 1.5 Pro Latest → GPT-4 Turbo');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-flash', 'gpt-4o-mini', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 80, 0, 'Gemini 1.5 Flash → GPT-4o Mini');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-flash-latest', 'gpt-4o-mini', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 80, 0, 'Gemini 1.5 Flash Latest → GPT-4o Mini');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-1.5-flash-8b', 'gpt-3.5-turbo', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 60, 0, 'Gemini 1.5 Flash 8B → GPT-3.5 Turbo');

INSERT OR IGNORE INTO ModelMapping (source_model, target_model, direction, mapping_type, source_provider, target_provider, priority, is_custom, description)
VALUES ('gemini-pro', 'gpt-4', 'gemini_to_openai', 'builtin', 'Gemini', 'OpenAI', 70, 0, 'Gemini Pro → GPT-4');

-- ============================================
-- 完成
-- ============================================
