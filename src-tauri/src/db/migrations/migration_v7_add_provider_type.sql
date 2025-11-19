-- 添加 provider_type 字段以支持不同的 API 提供商
-- Migration: 001_add_provider_type
-- Date: 2025-11-19

-- 添加 provider_type 列
ALTER TABLE ApiConfig ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'claude'
  CHECK(provider_type IN ('claude', 'gemini'));

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_config_provider_type ON ApiConfig(provider_type);
