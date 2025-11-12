-- Migration: V2 - 供应商配置系统
-- Date: 2025-11-10
-- Description: 参考 cc-switch 设计，改造为供应商配置系统
-- Changes:
--   1. server_url 改为完整 URL（包含协议），移除 server_port
--   2. 添加 category 字段（供应商分类）
--   3. 添加 is_partner 字段（合作伙伴标识）
--   4. 添加 theme_* 字段（视觉主题）
--   5. 添加 meta 字段（JSON 元数据）

-- ============================================
-- Step 1: 添加新字段
-- ============================================

-- 供应商分类
ALTER TABLE ApiConfig ADD COLUMN category TEXT DEFAULT 'custom'
  CHECK(category IN ('official', 'cn_official', 'aggregator', 'third_party', 'custom'));

-- 合作伙伴标识
ALTER TABLE ApiConfig ADD COLUMN is_partner INTEGER DEFAULT 0;

-- 视觉主题
ALTER TABLE ApiConfig ADD COLUMN theme_icon TEXT;
ALTER TABLE ApiConfig ADD COLUMN theme_bg_color TEXT;
ALTER TABLE ApiConfig ADD COLUMN theme_text_color TEXT;

-- 元数据（JSON 格式）
-- 存储: custom_endpoints, template_values 等
ALTER TABLE ApiConfig ADD COLUMN meta TEXT DEFAULT '{}';

-- ============================================
-- Step 2: 数据迁移 - 合并 server_url 和 server_port
-- ============================================

-- 更新所有配置，将 server_url 和 server_port 合并为完整 URL
-- 规则：
-- 1. 如果 server_url 已包含协议，保持不变
-- 2. 如果 server_url 不包含协议，添加 https://
-- 3. 如果端口不是 443，在 URL 后添加端口

UPDATE ApiConfig
SET server_url = CASE
    -- 已经是完整 URL（包含协议）
    WHEN server_url LIKE 'http://%' OR server_url LIKE 'https://%' THEN
        CASE
            -- 非标准端口，添加端口号
            WHEN server_port != 443 AND server_port != 80 THEN
                CASE
                    WHEN server_url LIKE 'https://%' THEN 'https://' || REPLACE(server_url, 'https://', '') || ':' || CAST(server_port AS TEXT)
                    WHEN server_url LIKE 'http://%' THEN 'http://' || REPLACE(server_url, 'http://', '') || ':' || CAST(server_port AS TEXT)
                END
            -- 标准端口，保持原样
            ELSE server_url
        END
    -- 不包含协议，添加 https://
    ELSE
        CASE
            -- 非 443 端口，添加端口号
            WHEN server_port != 443 THEN 'https://' || server_url || ':' || CAST(server_port AS TEXT)
            -- 443 端口，默认省略
            ELSE 'https://' || server_url
        END
END;

-- ============================================
-- Step 3: 根据 server_url 推断分类
-- ============================================

UPDATE ApiConfig SET category = CASE
    WHEN server_url LIKE '%anthropic.com%' THEN 'official'
    WHEN server_url LIKE '%deepseek.com%' THEN 'cn_official'
    WHEN server_url LIKE '%bigmodel.cn%' THEN 'cn_official'
    WHEN server_url LIKE '%moonshot.cn%' THEN 'cn_official'
    WHEN server_url LIKE '%aliyun%' THEN 'cn_official'
    WHEN server_url LIKE '%minimaxi.com%' THEN 'cn_official'
    WHEN server_url LIKE '%longcat.chat%' THEN 'cn_official'
    WHEN server_url LIKE '%streamlake.ai%' THEN 'cn_official'
    WHEN server_url LIKE '%aihubmix.com%' THEN 'aggregator'
    WHEN server_url LIKE '%dmxapi%' THEN 'aggregator'
    WHEN server_url LIKE '%modelscope.cn%' THEN 'aggregator'
    WHEN server_url LIKE '%packyapi.com%' THEN 'third_party'
    WHEN server_url LIKE '%anyrouter.top%' THEN 'third_party'
    ELSE 'custom'
END;

-- ============================================
-- Step 4: 初始化 meta 字段为有效 JSON
-- ============================================

UPDATE ApiConfig SET meta = '{}' WHERE meta IS NULL OR meta = '';

-- ============================================
-- Step 5: 创建新索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_config_category ON ApiConfig(category);
CREATE INDEX IF NOT EXISTS idx_config_partner ON ApiConfig(is_partner);

-- ============================================
-- Note: server_port 字段保留但不再使用
-- ============================================
-- 为了向后兼容，保留 server_port 字段
-- 前端和新逻辑将忽略此字段，只使用 server_url
