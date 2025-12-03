-- Migration v9: Health Check Records
-- Add health check recording and auto-check settings

-- 1. Add auto_health_check_enabled to AppSettings
ALTER TABLE AppSettings ADD COLUMN auto_health_check_enabled BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE AppSettings ADD COLUMN health_check_interval_secs INTEGER NOT NULL DEFAULT 300;

-- 2. Create HealthCheckRecord table for storing health check results
CREATE TABLE IF NOT EXISTS HealthCheckRecord (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    check_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'timeout')),
    latency_ms INTEGER CHECK(latency_ms >= 0),
    error_message TEXT,
    http_status_code INTEGER,

    FOREIGN KEY (config_id) REFERENCES ApiConfig(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- 3. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_health_check_config ON HealthCheckRecord(config_id);
CREATE INDEX IF NOT EXISTS idx_health_check_time ON HealthCheckRecord(check_at);
CREATE INDEX IF NOT EXISTS idx_health_check_config_time ON HealthCheckRecord(config_id, check_at);

-- 4. Create a view for hourly statistics
CREATE VIEW IF NOT EXISTS HealthCheckHourlyStats AS
SELECT
    config_id,
    strftime('%Y-%m-%d %H:00:00', check_at) as hour,
    COUNT(*) as total_checks,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
    SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_count,
    AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as avg_latency_ms,
    MIN(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as min_latency_ms,
    MAX(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END) as max_latency_ms
FROM HealthCheckRecord
GROUP BY config_id, strftime('%Y-%m-%d %H:00:00', check_at);
