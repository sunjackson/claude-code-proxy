-- Migration V5: Add retry strategy support
-- Date: 2025-01-14
-- Description: 为 ConfigGroup 和 SwitchLog 表添加重试策略相关字段

BEGIN TRANSACTION;

-- 1. 扩展 ConfigGroup 表
ALTER TABLE ConfigGroup ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 3;
ALTER TABLE ConfigGroup ADD COLUMN retry_base_delay_ms INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE ConfigGroup ADD COLUMN retry_max_delay_ms INTEGER NOT NULL DEFAULT 8000;
ALTER TABLE ConfigGroup ADD COLUMN rate_limit_delay_ms INTEGER NOT NULL DEFAULT 30000;

-- 2. 扩展 SwitchLog 表
ALTER TABLE SwitchLog ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE SwitchLog ADD COLUMN error_type TEXT;
ALTER TABLE SwitchLog ADD COLUMN error_details TEXT;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_switch_log_error_type ON SwitchLog(error_type);
CREATE INDEX IF NOT EXISTS idx_switch_log_switch_at ON SwitchLog(switch_at DESC);

-- 4. 更新现有数据（为现有分组设置默认重试策略）
UPDATE ConfigGroup SET
    retry_count = 3,
    retry_base_delay_ms = 2000,
    retry_max_delay_ms = 8000,
    rate_limit_delay_ms = 30000
WHERE retry_count IS NULL;

COMMIT;
