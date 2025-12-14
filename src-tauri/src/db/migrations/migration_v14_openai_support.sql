-- Migration v14: OpenAI API 支持
-- 添加 OpenAI Organization ID 字段

-- ============================================
-- 1. ApiConfig 表新增字段
-- ============================================

-- 1.1 organization_id: OpenAI Organization ID (可选)
-- 用于多组织账号场景
ALTER TABLE ApiConfig ADD COLUMN organization_id TEXT;
