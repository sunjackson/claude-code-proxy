/**
 * Balance Query Scheduler
 * 定时查询 API 供应商的账户余额
 *
 * Features:
 * - 自动后台任务调度
 * - 根据配置的interval自动查询
 * - 支持启动/停止调度器
 * - 防止重复查询
 */

use crate::db::DbPool;
use crate::models::error::AppResult;
use crate::services::balance_service::BalanceService;
use chrono::{DateTime, Duration, Utc};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time::{interval, Duration as TokioDuration};

/// 调度器检查间隔（秒）
const SCHEDULER_CHECK_INTERVAL_SECS: u64 = 60;

/// 余额查询调度器状态
#[derive(Debug, Clone, PartialEq)]
pub enum SchedulerStatus {
    /// 未运行
    Stopped,
    /// 运行中
    Running,
}

/// 余额查询调度器
pub struct BalanceScheduler {
    db_pool: Arc<DbPool>,
    status: Arc<RwLock<SchedulerStatus>>,
    task_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
}

impl BalanceScheduler {
    /// 创建新的余额查询调度器
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        Self {
            db_pool,
            status: Arc::new(RwLock::new(SchedulerStatus::Stopped)),
            task_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// 获取调度器状态
    #[allow(dead_code)]
    pub async fn status(&self) -> SchedulerStatus {
        self.status.read().await.clone()
    }

    /// 启动调度器
    pub async fn start(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == SchedulerStatus::Running {
            log::warn!("余额查询调度器已在运行");
            return Ok(());
        }

        log::info!("正在启动余额查询调度器...");

        let db_pool = self.db_pool.clone();

        // 启动后台任务
        let handle = tokio::spawn(async move {
            log::info!(
                "余额查询调度器后台任务已启动，检查间隔: {}秒",
                SCHEDULER_CHECK_INTERVAL_SECS
            );

            let mut ticker = interval(TokioDuration::from_secs(SCHEDULER_CHECK_INTERVAL_SECS));

            loop {
                ticker.tick().await;

                log::debug!("余额查询调度器检查开始");

                // 检查并执行需要查询的配置
                if let Err(e) = Self::check_and_query_balances(&db_pool).await {
                    log::error!("余额查询调度器执行失败: {}", e);
                }

                log::debug!("余额查询调度器检查完成");
            }
        });

        // 保存任务句柄
        let mut task_handle = self.task_handle.write().await;
        *task_handle = Some(handle);

        *status = SchedulerStatus::Running;

        log::info!("余额查询调度器已启动");
        Ok(())
    }

    /// 停止调度器
    #[allow(dead_code)]
    pub async fn stop(&self) -> AppResult<()> {
        let mut status = self.status.write().await;

        if *status == SchedulerStatus::Stopped {
            log::warn!("余额查询调度器未运行");
            return Ok(());
        }

        log::info!("正在停止余额查询调度器...");

        // 取消后台任务
        let mut task_handle = self.task_handle.write().await;
        if let Some(handle) = task_handle.take() {
            handle.abort();
            log::debug!("余额查询调度器后台任务已取消");
        }

        *status = SchedulerStatus::Stopped;

        log::info!("余额查询调度器已停止");
        Ok(())
    }

    /// 检查并查询需要更新余额的配置
    async fn check_and_query_balances(db_pool: &Arc<DbPool>) -> AppResult<()> {
        // 获取所有启用了自动余额查询的配置
        let configs = db_pool.with_connection(|conn| {
            use crate::services::api_config::ApiConfigService;
            ApiConfigService::list_configs(conn, None)
        })?;

        let auto_check_configs: Vec<_> = configs
            .into_iter()
            .filter(|c| c.auto_balance_check)
            .collect();

        if auto_check_configs.is_empty() {
            log::debug!("没有启用自动余额查询的配置");
            return Ok(());
        }

        log::info!(
            "找到 {} 个启用自动余额查询的配置",
            auto_check_configs.len()
        );

        let balance_service = BalanceService::new(db_pool.clone());
        let now = Utc::now();

        for config in auto_check_configs {
            // 检查是否到了查询时间
            if !Self::should_query(&config.last_balance_check_at, config.balance_check_interval_sec, now) {
                log::debug!(
                    "配置 {} 尚未到查询时间，跳过",
                    config.name
                );
                continue;
            }

            log::info!("开始查询配置 {} 的余额", config.name);

            // 执行余额查询
            match balance_service.query_balance(config.id).await {
                Ok(info) => {
                    log::info!(
                        "配置 {} 余额查询成功: {} {:?}",
                        config.name,
                        info.balance.unwrap_or(0.0),
                        info.currency
                    );
                }
                Err(e) => {
                    log::error!("配置 {} 余额查询失败: {}", config.name, e);
                }
            }
        }

        Ok(())
    }

    /// 判断是否应该查询余额
    ///
    /// # Arguments
    /// - `last_check_at`: 上次查询时间
    /// - `interval_sec`: 查询间隔（秒）
    /// - `now`: 当前时间
    ///
    /// # Returns
    /// - true: 应该查询, false: 不需要查询
    fn should_query(
        last_check_at: &Option<String>,
        interval_sec: Option<i32>,
        now: DateTime<Utc>,
    ) -> bool {
        // 如果没有配置间隔，使用默认值3600秒（1小时）
        let interval = interval_sec.unwrap_or(3600);

        // 如果从未查询过，应该立即查询
        let last_check_at = match last_check_at {
            Some(s) => s,
            None => return true,
        };

        // 解析上次查询时间
        let last_check_time = match DateTime::parse_from_rfc3339(last_check_at) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(e) => {
                log::warn!("解析上次查询时间失败: {}, 将立即查询", e);
                return true;
            }
        };

        // 计算下次查询时间
        let next_check_time = last_check_time + Duration::seconds(interval as i64);

        // 如果当前时间已经超过下次查询时间，应该查询
        now >= next_check_time
    }
}

impl Drop for BalanceScheduler {
    fn drop(&mut self) {
        log::debug!("余额查询调度器正在被销毁");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_should_query() {
        let now = Utc.with_ymd_and_hms(2025, 11, 12, 12, 0, 0).unwrap();

        // 测试：从未查询过，应该立即查询
        assert!(BalanceScheduler::should_query(&None, Some(3600), now));

        // 测试：上次查询是2小时前，间隔1小时，应该查询
        let last_check = Utc.with_ymd_and_hms(2025, 11, 12, 10, 0, 0).unwrap();
        assert!(BalanceScheduler::should_query(
            &Some(last_check.to_rfc3339()),
            Some(3600),
            now
        ));

        // 测试：上次查询是30分钟前，间隔1小时，不应该查询
        let last_check = Utc.with_ymd_and_hms(2025, 11, 12, 11, 30, 0).unwrap();
        assert!(!BalanceScheduler::should_query(
            &Some(last_check.to_rfc3339()),
            Some(3600),
            now
        ));

        // 测试：上次查询正好1小时前，应该查询
        let last_check = Utc.with_ymd_and_hms(2025, 11, 12, 11, 0, 0).unwrap();
        assert!(BalanceScheduler::should_query(
            &Some(last_check.to_rfc3339()),
            Some(3600),
            now
        ));

        // 测试：使用默认间隔
        let last_check = Utc.with_ymd_and_hms(2025, 11, 12, 10, 0, 0).unwrap();
        assert!(BalanceScheduler::should_query(
            &Some(last_check.to_rfc3339()),
            None, // 使用默认3600秒
            now
        ));
    }
}
