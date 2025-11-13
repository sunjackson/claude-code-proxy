-- ============================================
-- Migration v3 -> v4: 余额查询功能
-- Date: 2025-11-12
-- Description: 为 ApiConfig 添加余额查询相关字段
-- ============================================

-- 添加余额查询URL字段
ALTER TABLE ApiConfig ADD COLUMN balance_query_url TEXT;

-- 添加余额字段（存储最新余额，单位：元/美元，保留2位小数）
ALTER TABLE ApiConfig ADD COLUMN last_balance REAL;

-- 添加余额货币单位
ALTER TABLE ApiConfig ADD COLUMN balance_currency TEXT DEFAULT 'CNY' CHECK(balance_currency IN ('CNY', 'USD', 'EUR', 'JPY'));

-- 添加最后余额查询时间
ALTER TABLE ApiConfig ADD COLUMN last_balance_check_at DATETIME;

-- 添加余额查询状态
ALTER TABLE ApiConfig ADD COLUMN balance_query_status TEXT CHECK(balance_query_status IN ('success', 'failed', 'pending', NULL));

-- 添加余额查询错误信息
ALTER TABLE ApiConfig ADD COLUMN balance_query_error TEXT;

-- 添加是否启用自动余额查询（默认启用）
ALTER TABLE ApiConfig ADD COLUMN auto_balance_check BOOLEAN NOT NULL DEFAULT 1;

-- 添加余额查询间隔（秒）
ALTER TABLE ApiConfig ADD COLUMN balance_check_interval_sec INTEGER DEFAULT 3600 CHECK(balance_check_interval_sec >= 60);

-- 添加索引用于查询需要检查余额的配置
CREATE INDEX IF NOT EXISTS idx_apiconfig_auto_balance ON ApiConfig(auto_balance_check, last_balance_check_at)
WHERE auto_balance_check = 1;

-- 添加索引用于查询余额状态
CREATE INDEX IF NOT EXISTS idx_apiconfig_balance_status ON ApiConfig(balance_query_status);

-- 修复：为已有配置启用余额查询（如果配置了余额查询URL）
UPDATE ApiConfig
SET auto_balance_check = 1
WHERE balance_query_url IS NOT NULL
  AND balance_query_url != '';
