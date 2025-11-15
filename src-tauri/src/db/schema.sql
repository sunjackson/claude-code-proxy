-- SQLite Schema for Claude Code Proxy
-- Version: 1.0.0
-- Date: 2025-11-09
-- 基于 data-model.md 的数据模型定义

-- ============================================
-- 1. ConfigGroup (配置分组)
-- ============================================
CREATE TABLE IF NOT EXISTS ConfigGroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    auto_switch_enabled BOOLEAN NOT NULL DEFAULT 0,
    latency_threshold_ms INTEGER NOT NULL DEFAULT 30000 CHECK(latency_threshold_ms > 0 AND latency_threshold_ms <= 60000),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_name ON ConfigGroup(name);

-- ============================================
-- 2. ApiConfig (API 配置 / 供应商配置)
-- ============================================
CREATE TABLE IF NOT EXISTS ApiConfig (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL,  -- 直接存储在数据库（已移除密钥链）
    server_url TEXT NOT NULL,  -- 完整URL（含协议），如 https://api.example.com
    server_port INTEGER NOT NULL DEFAULT 443 CHECK(server_port >= 1 AND server_port <= 65535),  -- 已弃用，保留向后兼容
    group_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
    is_available BOOLEAN NOT NULL DEFAULT 1,
    last_test_at DATETIME,
    last_latency_ms INTEGER CHECK(last_latency_ms >= 0),

    -- 供应商配置（V2新增）
    category TEXT NOT NULL DEFAULT 'custom' CHECK(category IN ('official', 'cn_official', 'aggregator', 'third_party', 'custom')),
    is_partner INTEGER NOT NULL DEFAULT 0,  -- SQLite BOOLEAN: 0=false, 1=true
    theme_icon TEXT,
    theme_bg_color TEXT,
    theme_text_color TEXT,
    meta TEXT NOT NULL DEFAULT '{}',  -- JSON 格式元数据

    -- Claude 模型配置
    default_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
    haiku_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
    sonnet_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
    opus_model TEXT DEFAULT 'claude-opus-4-20250514',
    small_fast_model TEXT DEFAULT 'claude-haiku-4-5-20251001',

    -- API 高级设置
    api_timeout_ms INTEGER DEFAULT 600000 CHECK(api_timeout_ms > 0 AND api_timeout_ms <= 3600000),
    max_output_tokens INTEGER DEFAULT 65000 CHECK(max_output_tokens > 0 AND max_output_tokens <= 200000),

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (group_id) REFERENCES ConfigGroup(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_config_name ON ApiConfig(name);
CREATE INDEX IF NOT EXISTS idx_config_group ON ApiConfig(group_id);
CREATE INDEX IF NOT EXISTS idx_config_group_sort ON ApiConfig(group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_config_category ON ApiConfig(category);
CREATE INDEX IF NOT EXISTS idx_config_partner ON ApiConfig(is_partner);

-- ============================================
-- 3. ConfigBackup (配置备份)
-- ============================================
CREATE TABLE IF NOT EXISTS ConfigBackup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    original_path TEXT NOT NULL,
    content TEXT NOT NULL,
    backup_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    platform TEXT NOT NULL CHECK(platform IN ('Windows', 'macOS', 'Linux')),
    is_restored BOOLEAN NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_backup_time ON ConfigBackup(backup_at);
CREATE INDEX IF NOT EXISTS idx_backup_platform ON ConfigBackup(platform);

-- ============================================
-- 4. ProxyService (代理服务)
-- ============================================
CREATE TABLE IF NOT EXISTS ProxyService (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listen_port INTEGER NOT NULL DEFAULT 25341 CHECK(listen_port >= 1 AND listen_port <= 65535),
    current_group_id INTEGER,
    current_config_id INTEGER,
    status TEXT NOT NULL DEFAULT 'stopped' CHECK(status IN ('stopped', 'starting', 'running', 'error')),
    error_message TEXT,
    started_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (current_group_id) REFERENCES ConfigGroup(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (current_config_id) REFERENCES ApiConfig(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proxy_status ON ProxyService(status);
CREATE INDEX IF NOT EXISTS idx_proxy_group ON ProxyService(current_group_id);
CREATE INDEX IF NOT EXISTS idx_proxy_config ON ProxyService(current_config_id);

-- ============================================
-- 5. TestResult (测试结果)
-- ============================================
CREATE TABLE IF NOT EXISTS TestResult (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    group_id INTEGER,
    test_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'timeout')),
    latency_ms INTEGER CHECK(latency_ms >= 0),
    error_message TEXT,
    is_valid_key BOOLEAN,
    response_text TEXT,
    test_model TEXT,
    attempt INTEGER DEFAULT 1,

    FOREIGN KEY (config_id) REFERENCES ApiConfig(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (group_id) REFERENCES ConfigGroup(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_config ON TestResult(config_id);
CREATE INDEX IF NOT EXISTS idx_test_time ON TestResult(test_at);
CREATE INDEX IF NOT EXISTS idx_test_group ON TestResult(group_id);

-- ============================================
-- 6. SwitchLog (切换日志)
-- ============================================
CREATE TABLE IF NOT EXISTS SwitchLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    switch_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL CHECK(reason IN ('connection_failed', 'timeout', 'quota_exceeded', 'high_latency', 'manual')),
    source_config_id INTEGER,
    target_config_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    is_cross_group BOOLEAN NOT NULL DEFAULT 0 CHECK(is_cross_group = 0),  -- 必须为 FALSE (FR-017)
    latency_before_ms INTEGER CHECK(latency_before_ms >= 0),
    latency_after_ms INTEGER CHECK(latency_after_ms >= 0),
    error_message TEXT,

    FOREIGN KEY (group_id) REFERENCES ConfigGroup(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    FOREIGN KEY (source_config_id) REFERENCES ApiConfig(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (target_config_id) REFERENCES ApiConfig(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_switch_time ON SwitchLog(switch_at);
CREATE INDEX IF NOT EXISTS idx_switch_group ON SwitchLog(group_id);
CREATE INDEX IF NOT EXISTS idx_switch_source ON SwitchLog(source_config_id);
CREATE INDEX IF NOT EXISTS idx_switch_target ON SwitchLog(target_config_id);

-- ============================================
-- 7. EnvironmentVariable (环境变量)
-- ============================================
CREATE TABLE IF NOT EXISTS EnvironmentVariable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 0,
    set_at DATETIME,
    unset_at DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_env_key ON EnvironmentVariable(key);
CREATE INDEX IF NOT EXISTS idx_env_active ON EnvironmentVariable(is_active);

-- ============================================
-- 8. AppSettings (应用设置)
-- ============================================
CREATE TABLE IF NOT EXISTS AppSettings (
    id INTEGER PRIMARY KEY CHECK(id = 1),  -- 单例: 固定 id=1
    language TEXT NOT NULL DEFAULT 'zh-CN' CHECK(language IN ('zh-CN', 'en-US')),
    default_latency_threshold_ms INTEGER NOT NULL DEFAULT 30000 CHECK(default_latency_threshold_ms > 0 AND default_latency_threshold_ms <= 60000),
    default_proxy_port INTEGER NOT NULL DEFAULT 25341 CHECK(default_proxy_port >= 1 AND default_proxy_port <= 65535),
    remote_recommendation_url TEXT,
    local_recommendation_path TEXT,
    recommendation_cache_ttl_sec INTEGER NOT NULL DEFAULT 3600 CHECK(recommendation_cache_ttl_sec >= 0),
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. RecommendedService (推荐服务)
-- ============================================
CREATE TABLE IF NOT EXISTS RecommendedService (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    promotion_url TEXT NOT NULL,
    is_recommended BOOLEAN NOT NULL DEFAULT 0,
    hotness_score INTEGER NOT NULL DEFAULT 0 CHECK(hotness_score >= 0 AND hotness_score <= 100),
    source TEXT NOT NULL CHECK(source IN ('remote', 'local')),
    loaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_hotness ON RecommendedService(hotness_score DESC);
CREATE INDEX IF NOT EXISTS idx_service_source ON RecommendedService(source);
CREATE INDEX IF NOT EXISTS idx_service_loaded ON RecommendedService(loaded_at);

-- ============================================
-- 10. RecommendationSource (推荐服务源)
-- ============================================
CREATE TABLE IF NOT EXISTS RecommendationSource (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL CHECK(source_type IN ('remote', 'local')),
    url TEXT,
    file_path TEXT,
    priority INTEGER NOT NULL DEFAULT 0 CHECK(priority >= 0),
    last_fetch_at DATETIME,
    last_fetch_status TEXT CHECK(last_fetch_status IN ('success', 'failed', 'timeout')),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_source_priority ON RecommendationSource(priority ASC);
CREATE INDEX IF NOT EXISTS idx_source_type ON RecommendationSource(source_type);

-- ============================================
-- 触发器: 自动更新 updated_at 时间戳
-- ============================================

-- ConfigGroup 更新时间戳
CREATE TRIGGER IF NOT EXISTS update_configgroup_timestamp
AFTER UPDATE ON ConfigGroup
BEGIN
    UPDATE ConfigGroup SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ApiConfig 更新时间戳
CREATE TRIGGER IF NOT EXISTS update_apiconfig_timestamp
AFTER UPDATE ON ApiConfig
BEGIN
    UPDATE ApiConfig SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ProxyService 更新时间戳
CREATE TRIGGER IF NOT EXISTS update_proxyservice_timestamp
AFTER UPDATE ON ProxyService
BEGIN
    UPDATE ProxyService SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- AppSettings 更新时间戳
CREATE TRIGGER IF NOT EXISTS update_appsettings_timestamp
AFTER UPDATE ON AppSettings
BEGIN
    UPDATE AppSettings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
