/**
 * Health Check Scheduler
 * 定时通过代理接口发送请求，监控API健康状态
 *
 * Features:
 * - 每分钟自动发送测试请求
 * - 通过本地代理接口请求，记录真实延迟
 * - 支持启动/停止/配置检查间隔
 * - 结果会自动保存到 ProxyRequestLog 表
 */

use crate::db::DbPool;
use crate::models::error::AppResult;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time::{interval, Duration as TokioDuration};

/// 默认健康检查间隔（秒）
const DEFAULT_HEALTH_CHECK_INTERVAL_SECS: u64 = 60;

/// 健康检查调度器状态
#[derive(Debug, Clone, PartialEq)]
pub enum HealthCheckStatus {
    /// 未运行
    Stopped,
    /// 运行中
    Running,
}

/// 健康检查调度器
pub struct HealthCheckScheduler {
    db_pool: Arc<DbPool>,
    status: Arc<RwLock<HealthCheckStatus>>,
    task_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
    interval_secs: Arc<RwLock<u64>>,
    /// 代理服务器地址
    proxy_host: Arc<RwLock<String>>,
    /// 代理服务器端口
    proxy_port: Arc<RwLock<u16>>,
}

impl HealthCheckScheduler {
    /// 创建新的健康检查调度器
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        Self {
            db_pool,
            status: Arc::new(RwLock::new(HealthCheckStatus::Stopped)),
            task_handle: Arc::new(RwLock::new(None)),
            interval_secs: Arc::new(RwLock::new(DEFAULT_HEALTH_CHECK_INTERVAL_SECS)),
            proxy_host: Arc::new(RwLock::new("127.0.0.1".to_string())),
            proxy_port: Arc::new(RwLock::new(25341)),
        }
    }

    /// 获取调度器状态
    #[allow(dead_code)]
    pub async fn status(&self) -> HealthCheckStatus {
        self.status.read().await.clone()
    }

    /// 设置检查间隔（秒）
    pub async fn set_interval(&self, secs: u64) {
        let mut interval = self.interval_secs.write().await;
        *interval = secs;
        log::info!("健康检查间隔已设置为 {} 秒", secs);
    }

    /// 获取当前检查间隔（秒）
    #[allow(dead_code)]
    pub async fn get_interval(&self) -> u64 {
        *self.interval_secs.read().await
    }

    /// 设置代理服务器地址
    pub async fn set_proxy_address(&self, host: String, port: u16) {
        let mut h = self.proxy_host.write().await;
        *h = host.clone();
        let mut p = self.proxy_port.write().await;
        *p = port;
        log::info!("健康检查代理地址已设置为 {}:{}", host, port);
    }

    /// 启动调度器
    pub async fn start(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == HealthCheckStatus::Running {
            log::warn!("健康检查调度器已在运行");
            return Ok(());
        }

        let interval_secs = *self.interval_secs.read().await;
        let proxy_host = self.proxy_host.read().await.clone();
        let proxy_port = *self.proxy_port.read().await;

        log::info!(
            "正在启动健康检查调度器... 间隔: {}秒, 代理: {}:{}",
            interval_secs,
            proxy_host,
            proxy_port
        );

        let db_pool = self.db_pool.clone();

        // 启动后台任务
        let handle = tokio::spawn(async move {
            log::info!(
                "健康检查调度器后台任务已启动，检查间隔: {}秒",
                interval_secs
            );

            let mut ticker = interval(TokioDuration::from_secs(interval_secs));

            loop {
                ticker.tick().await;

                log::debug!("健康检查开始");

                // 执行健康检查
                if let Err(e) = Self::perform_health_check(&db_pool, &proxy_host, proxy_port).await
                {
                    log::error!("健康检查执行失败: {}", e);
                }

                log::debug!("健康检查完成");
            }
        });

        // 保存任务句柄
        let mut task_handle = self.task_handle.write().await;
        *task_handle = Some(handle);

        *status = HealthCheckStatus::Running;

        log::info!("健康检查调度器已启动");
        Ok(())
    }

    /// 停止调度器
    #[allow(dead_code)]
    pub async fn stop(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == HealthCheckStatus::Stopped {
            log::warn!("健康检查调度器未运行");
            return Ok(());
        }

        log::info!("正在停止健康检查调度器...");

        // 取消后台任务
        let mut task_handle = self.task_handle.write().await;
        if let Some(handle) = task_handle.take() {
            handle.abort();
            log::debug!("健康检查调度器后台任务已取消");
        }

        *status = HealthCheckStatus::Stopped;

        log::info!("健康检查调度器已停止");
        Ok(())
    }

    /// 执行健康检查
    ///
    /// 通过代理接口发送一个简单的请求来测试API连通性
    async fn perform_health_check(
        _db_pool: &Arc<DbPool>,
        proxy_host: &str,
        proxy_port: u16,
    ) -> AppResult<()> {
        let proxy_url = format!("http://{}:{}", proxy_host, proxy_port);

        log::info!("执行健康检查，代理地址: {}", proxy_url);

        // 创建HTTP客户端
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| crate::models::error::AppError::ServiceError {
                message: format!("创建HTTP客户端失败: {}", e),
            })?;

        // 构建健康检查请求
        // 使用 /v1/models 端点进行简单测试，这是一个轻量级的API调用
        let start_time = std::time::Instant::now();

        let response = client
            .get(format!("{}/v1/models", proxy_url))
            .header("Content-Type", "application/json")
            .send()
            .await;

        let latency_ms = start_time.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                let status_code = resp.status().as_u16();
                if resp.status().is_success() || status_code == 401 || status_code == 403 {
                    // 200, 401, 403 都表示代理工作正常（认证问题不影响代理本身）
                    log::info!(
                        "✅ 健康检查成功 - 状态码: {}, 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                } else {
                    log::warn!(
                        "⚠️ 健康检查响应异常 - 状态码: {}, 延迟: {}ms",
                        status_code,
                        latency_ms
                    );
                }
            }
            Err(e) => {
                log::error!("❌ 健康检查失败 - 错误: {}, 延迟: {}ms", e, latency_ms);
            }
        }

        // 注意：请求日志会由代理服务器自动记录到 ProxyRequestLog 表

        Ok(())
    }

    /// 手动执行一次健康检查
    pub async fn check_now(&self) -> AppResult<()> {
        let proxy_host = self.proxy_host.read().await.clone();
        let proxy_port = *self.proxy_port.read().await;

        Self::perform_health_check(&self.db_pool, &proxy_host, proxy_port).await
    }
}

impl Drop for HealthCheckScheduler {
    fn drop(&mut self) {
        log::debug!("健康检查调度器正在被销毁");
    }
}
