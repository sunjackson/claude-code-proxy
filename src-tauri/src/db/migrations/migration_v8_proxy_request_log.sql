-- 迁移 v7 -> v8: 代理请求日志表
-- 用于记录代理接口的实际请求延迟

-- 创建代理请求日志表
CREATE TABLE IF NOT EXISTS ProxyRequestLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 请求时间
    request_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- HTTP 方法
    method TEXT NOT NULL,
    -- 请求路径
    uri TEXT NOT NULL,
    -- 目标服务器 URL
    target_url TEXT NOT NULL,
    -- 关联的配置 ID
    config_id INTEGER,
    -- 配置名称（冗余存储，防止配置删除后丢失）
    config_name TEXT,
    -- 请求延迟（毫秒）
    latency_ms INTEGER NOT NULL,
    -- HTTP 状态码
    status_code INTEGER NOT NULL,
    -- 是否成功（2xx 状态码）
    is_success BOOLEAN NOT NULL DEFAULT 1,
    -- 错误信息（如果有）
    error_message TEXT,
    -- 客户端地址
    remote_addr TEXT,

    FOREIGN KEY (config_id) REFERENCES ApiConfig(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_proxy_log_time ON ProxyRequestLog(request_at);
CREATE INDEX IF NOT EXISTS idx_proxy_log_config ON ProxyRequestLog(config_id);
CREATE INDEX IF NOT EXISTS idx_proxy_log_success ON ProxyRequestLog(is_success);
CREATE INDEX IF NOT EXISTS idx_proxy_log_status ON ProxyRequestLog(status_code);
