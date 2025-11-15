#![allow(dead_code)]

use crate::models::error_classifier::ErrorRecoverability;
use crate::models::failure_counter::FailureCounter;
use crate::models::retry_strategy::RetryStrategy;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// 重试管理器 - 管理每个 API 配置的重试状态
pub struct RetryManager {
    /// 重试策略配置
    strategy: RetryStrategy,

    /// 失败计数器 Map (config_id => FailureCounter)
    counters: Arc<RwLock<HashMap<i64, FailureCounter>>>,
}

impl RetryManager {
    /// 创建新的重试管理器
    pub fn new(strategy: RetryStrategy) -> Self {
        Self {
            strategy,
            counters: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 创建使用默认策略的重试管理器
    pub fn with_default_strategy() -> Self {
        Self::new(RetryStrategy::default())
    }

    /// 判断是否应该重试
    /// 参数:
    ///   - config_id: 配置 ID
    ///   - recoverability: 错误可恢复性
    /// 返回: (是否重试, 当前失败次数)
    pub fn should_retry(
        &self,
        config_id: i64,
        recoverability: &ErrorRecoverability,
    ) -> (bool, u32) {
        // 不可恢复错误直接返回 false
        if !recoverability.should_retry() {
            return (false, 0);
        }

        let counters = self.counters.read().unwrap();
        let current_count = counters
            .get(&config_id)
            .map(|c| c.get_count())
            .unwrap_or(0);

        // 检查是否超过最大重试次数
        let should_retry = current_count < self.strategy.max_retries;

        (should_retry, current_count)
    }

    /// 计算重试延迟 (毫秒)
    /// 参数:
    ///   - config_id: 配置 ID
    ///   - recoverability: 错误可恢复性
    /// 返回: 延迟时间 (毫秒)
    pub fn calculate_delay(&self, config_id: i64, recoverability: &ErrorRecoverability) -> u32 {
        // 限流错误使用特殊延迟
        if recoverability.needs_rate_limit_delay() {
            return self.strategy.rate_limit_delay_ms;
        }

        let counters = self.counters.read().unwrap();
        let current_count = counters
            .get(&config_id)
            .map(|c| c.get_count())
            .unwrap_or(0);

        // 使用指数退避算法计算延迟
        self.strategy.calculate_delay_with_jitter(current_count)
    }

    /// 增加失败计数
    /// 返回: 增加后的失败次数
    pub fn increment_failure(&self, config_id: i64) -> u32 {
        let mut counters = self.counters.write().unwrap();
        let counter = counters
            .entry(config_id)
            .or_insert_with(FailureCounter::new);
        counter.increment()
    }

    /// 重置失败计数 (成功响应后调用)
    pub fn reset_counter(&self, config_id: i64) {
        let counters = self.counters.read().unwrap();
        if let Some(counter) = counters.get(&config_id) {
            counter.reset();
        }
    }

    /// 获取当前失败计数
    pub fn get_failure_count(&self, config_id: i64) -> u32 {
        let counters = self.counters.read().unwrap();
        counters
            .get(&config_id)
            .map(|c| c.get_count())
            .unwrap_or(0)
    }

    /// 获取所有失败计数器快照
    /// 返回: Vec<(config_id, failure_count)>
    pub fn get_all_failure_counts(&self) -> Vec<(i64, u32)> {
        let counters = self.counters.read().unwrap();
        counters
            .iter()
            .map(|(id, counter)| (*id, counter.get_count()))
            .filter(|(_, count)| *count > 0)
            .collect()
    }

    /// 清除所有失败计数器
    pub fn clear_all_counters(&self) {
        let mut counters = self.counters.write().unwrap();
        counters.clear();
    }

    /// 更新重试策略
    pub fn update_strategy(&mut self, strategy: RetryStrategy) {
        self.strategy = strategy;
    }

    /// 获取当前重试策略的引用
    pub fn get_strategy(&self) -> &RetryStrategy {
        &self.strategy
    }
}

impl Clone for RetryManager {
    fn clone(&self) -> Self {
        Self {
            strategy: self.strategy.clone(),
            counters: Arc::clone(&self.counters),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_retry_basic() {
        let strategy = RetryStrategy::new(3, 1000, 5000, 30000);
        let manager = RetryManager::new(strategy);

        // 可恢复错误,第一次失败应该重试
        let (should_retry, count) =
            manager.should_retry(1, &ErrorRecoverability::Recoverable);
        assert!(should_retry);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_should_retry_after_failures() {
        let strategy = RetryStrategy::new(3, 1000, 5000, 30000);
        let manager = RetryManager::new(strategy);

        // 模拟 3 次失败
        manager.increment_failure(1);
        manager.increment_failure(1);
        manager.increment_failure(1);

        // 已经失败 3 次,不应该再重试
        let (should_retry, count) =
            manager.should_retry(1, &ErrorRecoverability::Recoverable);
        assert!(!should_retry);
        assert_eq!(count, 3);
    }

    #[test]
    fn test_should_not_retry_unrecoverable() {
        let strategy = RetryStrategy::new(3, 1000, 5000, 30000);
        let manager = RetryManager::new(strategy);

        // 不可恢复错误,直接返回 false
        let (should_retry, _) =
            manager.should_retry(1, &ErrorRecoverability::Unrecoverable);
        assert!(!should_retry);
    }

    #[test]
    fn test_calculate_delay_exponential_backoff() {
        let strategy = RetryStrategy::new(5, 1000, 10000, 30000);
        let manager = RetryManager::new(strategy);

        // 模拟递增的失败次数
        manager.increment_failure(1); // count = 1
        let delay1 = manager.calculate_delay(1, &ErrorRecoverability::Recoverable);

        manager.increment_failure(1); // count = 2
        let delay2 = manager.calculate_delay(1, &ErrorRecoverability::Recoverable);

        manager.increment_failure(1); // count = 3
        let delay3 = manager.calculate_delay(1, &ErrorRecoverability::Recoverable);

        // 延迟应该逐渐增加 (带抖动,所以不是精确的 2 倍关系)
        assert!(delay2 > delay1);
        assert!(delay3 > delay2);
    }

    #[test]
    fn test_calculate_delay_rate_limit() {
        let strategy = RetryStrategy::new(3, 1000, 5000, 30000);
        let manager = RetryManager::new(strategy);

        // 限流错误使用特殊延迟
        let delay = manager.calculate_delay(1, &ErrorRecoverability::RateLimit);
        assert_eq!(delay, 30000);
    }

    #[test]
    fn test_increment_failure() {
        let manager = RetryManager::with_default_strategy();

        assert_eq!(manager.get_failure_count(1), 0);

        let count1 = manager.increment_failure(1);
        assert_eq!(count1, 1);
        assert_eq!(manager.get_failure_count(1), 1);

        let count2 = manager.increment_failure(1);
        assert_eq!(count2, 2);
        assert_eq!(manager.get_failure_count(1), 2);
    }

    #[test]
    fn test_reset_counter() {
        let manager = RetryManager::with_default_strategy();

        manager.increment_failure(1);
        manager.increment_failure(1);
        assert_eq!(manager.get_failure_count(1), 2);

        manager.reset_counter(1);
        assert_eq!(manager.get_failure_count(1), 0);
    }

    #[test]
    fn test_multiple_configs() {
        let manager = RetryManager::with_default_strategy();

        manager.increment_failure(1);
        manager.increment_failure(1);
        manager.increment_failure(2);

        assert_eq!(manager.get_failure_count(1), 2);
        assert_eq!(manager.get_failure_count(2), 1);
        assert_eq!(manager.get_failure_count(3), 0);
    }

    #[test]
    fn test_get_all_failure_counts() {
        let manager = RetryManager::with_default_strategy();

        manager.increment_failure(1);
        manager.increment_failure(1);
        manager.increment_failure(2);

        let all_counts = manager.get_all_failure_counts();
        assert_eq!(all_counts.len(), 2);
        assert!(all_counts.contains(&(1, 2)));
        assert!(all_counts.contains(&(2, 1)));
    }

    #[test]
    fn test_clear_all_counters() {
        let manager = RetryManager::with_default_strategy();

        manager.increment_failure(1);
        manager.increment_failure(2);
        assert_eq!(manager.get_all_failure_counts().len(), 2);

        manager.clear_all_counters();
        assert_eq!(manager.get_all_failure_counts().len(), 0);
    }

    #[test]
    fn test_clone_shares_counters() {
        let manager1 = RetryManager::with_default_strategy();
        manager1.increment_failure(1);

        let manager2 = manager1.clone();

        // clone 共享同一个计数器
        assert_eq!(manager2.get_failure_count(1), 1);

        manager1.increment_failure(1);
        assert_eq!(manager2.get_failure_count(1), 2);
    }
}
