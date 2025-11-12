-- 数据库迁移脚本: 添加模型配置字段
-- 迁移版本: 001
-- 创建时间: 2025-11-10
-- 描述: 为 ApiConfig 表添加 Claude 模型配置和 API 高级设置字段

-- 开始事务
BEGIN TRANSACTION;

-- 1. 添加 Claude 模型配置字段
ALTER TABLE ApiConfig ADD COLUMN default_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';
ALTER TABLE ApiConfig ADD COLUMN haiku_model TEXT DEFAULT 'claude-haiku-4-5-20251001';
ALTER TABLE ApiConfig ADD COLUMN sonnet_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';
ALTER TABLE ApiConfig ADD COLUMN opus_model TEXT DEFAULT 'claude-opus-4-20250514';
ALTER TABLE ApiConfig ADD COLUMN small_fast_model TEXT DEFAULT 'claude-haiku-4-5-20251001';

-- 2. 添加 API 高级设置字段
ALTER TABLE ApiConfig ADD COLUMN api_timeout_ms INTEGER DEFAULT 600000 CHECK(api_timeout_ms > 0 AND api_timeout_ms <= 3600000);
ALTER TABLE ApiConfig ADD COLUMN max_output_tokens INTEGER DEFAULT 65000 CHECK(max_output_tokens > 0 AND max_output_tokens <= 200000);

-- 提交事务
COMMIT;

-- 验证迁移结果
SELECT 'Migration 001 completed successfully' AS status;
