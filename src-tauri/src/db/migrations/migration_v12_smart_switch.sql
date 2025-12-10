-- Migration v12: 智能切换功能增强
-- 添加配置启用/停用、权重计算、切换冷却期等功能支持

-- ============================================
-- 1. ApiConfig 表新增字段
-- ============================================

-- 1.1 is_enabled: 用户手动控制配置是否参与智能切换
-- 区别于 is_available（系统自动设置的可用状态）
ALTER TABLE ApiConfig ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT 1;

-- 1.2 weight_score: 权重计算分数，用于智能选择
-- 范围 0.0 - 1.0，值越高优先级越高
ALTER TABLE ApiConfig ADD COLUMN weight_score REAL NOT NULL DEFAULT 1.0 CHECK(weight_score >= 0.0 AND weight_score <= 1.0);

-- 1.3 last_success_time: 最后一次成功请求的时间
-- 用于计算配置的新鲜度
ALTER TABLE ApiConfig ADD COLUMN last_success_time DATETIME;

-- 1.4 consecutive_failures: 连续失败次数
-- 用于智能重试和权重调整
ALTER TABLE ApiConfig ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures >= 0);

-- ============================================
-- 2. SwitchCooldown 表（切换冷却期记录）
-- ============================================
CREATE TABLE IF NOT EXISTS SwitchCooldown (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL UNIQUE,
    last_switch_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cooldown_seconds INTEGER NOT NULL DEFAULT 60 CHECK(cooldown_seconds >= 0 AND cooldown_seconds <= 3600),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (config_id) REFERENCES ApiConfig(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cooldown_config ON SwitchCooldown(config_id);
CREATE INDEX IF NOT EXISTS idx_cooldown_time ON SwitchCooldown(last_switch_time);

-- ============================================
-- 3. 创建索引优化查询性能
-- ============================================

-- 为 is_enabled 创建索引，加速过滤查询
CREATE INDEX IF NOT EXISTS idx_config_enabled ON ApiConfig(is_enabled);

-- 为 weight_score 创建索引，加速排序查询
CREATE INDEX IF NOT EXISTS idx_config_weight ON ApiConfig(weight_score DESC);

-- 复合索引：分组内启用且可用的配置按权重排序
CREATE INDEX IF NOT EXISTS idx_config_group_enabled_weight ON ApiConfig(group_id, is_enabled, is_available, weight_score DESC);
