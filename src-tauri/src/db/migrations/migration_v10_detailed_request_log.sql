-- 迁移 v9 -> v10: 扩展代理请求日志表，添加详细请求/响应信息
-- 用于开发者模式下查看完整的请求详情

-- 添加详细字段到 ProxyRequestLog 表
ALTER TABLE ProxyRequestLog ADD COLUMN request_headers TEXT;
ALTER TABLE ProxyRequestLog ADD COLUMN request_body TEXT;
ALTER TABLE ProxyRequestLog ADD COLUMN response_headers TEXT;
ALTER TABLE ProxyRequestLog ADD COLUMN response_body TEXT;
ALTER TABLE ProxyRequestLog ADD COLUMN response_start_at DATETIME;
ALTER TABLE ProxyRequestLog ADD COLUMN response_end_at DATETIME;
ALTER TABLE ProxyRequestLog ADD COLUMN request_body_size INTEGER DEFAULT 0;
ALTER TABLE ProxyRequestLog ADD COLUMN response_body_size INTEGER DEFAULT 0;
ALTER TABLE ProxyRequestLog ADD COLUMN is_streaming BOOLEAN DEFAULT 0;
ALTER TABLE ProxyRequestLog ADD COLUMN stream_chunk_count INTEGER DEFAULT 0;
ALTER TABLE ProxyRequestLog ADD COLUMN time_to_first_byte_ms INTEGER;
ALTER TABLE ProxyRequestLog ADD COLUMN content_type TEXT;
ALTER TABLE ProxyRequestLog ADD COLUMN user_agent TEXT;
ALTER TABLE ProxyRequestLog ADD COLUMN model TEXT;
