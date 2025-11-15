#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// 重试策略配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryStrategy {
    /// 最大重试次数 (1-10)
    pub max_retries: u32,

    /// 基础延迟 (毫秒)
    pub base_delay_ms: u32,

    /// 最大延迟 (毫秒)
    pub max_delay_ms: u32,

    /// 限流错误的延迟 (毫秒)
    pub rate_limit_delay_ms: u32,
}

impl RetryStrategy {
    /// 创建新的重试策略
    pub fn new(
        max_retries: u32,
        base_delay_ms: u32,
        max_delay_ms: u32,
        rate_limit_delay_ms: u32,
    ) -> Self {
        Self {
            max_retries,
            base_delay_ms,
            max_delay_ms,
            rate_limit_delay_ms,
        }
    }

    /// 创建默认重试策略
    pub fn default_strategy() -> Self {
        Self {
            max_retries: 3,
            base_delay_ms: 2000,   // 2秒
            max_delay_ms: 8000,    // 8秒
            rate_limit_delay_ms: 30000, // 30秒
        }
    }

    /// 验证重试策略参数
    pub fn validate(&self) -> Result<(), String> {
        if self.max_retries < 1 || self.max_retries > 10 {
            return Err("重试次数必须在 1-10 之间".to_string());
        }

        if self.base_delay_ms < 100 || self.base_delay_ms > 10000 {
            return Err("基础延迟必须在 100-10000 毫秒之间".to_string());
        }

        if self.max_delay_ms < 1000 || self.max_delay_ms > 60000 {
            return Err("最大延迟必须在 1000-60000 毫秒之间".to_string());
        }

        if self.rate_limit_delay_ms < 1000 || self.rate_limit_delay_ms > 300000 {
            return Err("限流延迟必须在 1000-300000 毫秒之间".to_string());
        }

        if self.base_delay_ms >= self.max_delay_ms {
            return Err("基础延迟必须小于最大延迟".to_string());
        }

        Ok(())
    }

    /// 计算指数退避延迟 (毫秒)
    /// attempt: 当前重试次数 (0-based)
    /// 返回: 延迟时间 (毫秒)
    pub fn calculate_backoff_delay(&self, attempt: u32) -> u32 {
        if attempt == 0 {
            return 0;
        }

        // 指数退避: base_delay * 2^(attempt-1)
        // 使用 checked_mul 和 saturating_pow 防止溢出
        let exponential_delay = self.base_delay_ms.saturating_mul(
            2u32.saturating_pow(attempt.saturating_sub(1))
        );

        // 限制在最大延迟范围内
        exponential_delay.min(self.max_delay_ms)
    }

    /// 计算带抖动的延迟 (毫秒)
    /// 抖动范围: ±10%
    pub fn calculate_delay_with_jitter(&self, attempt: u32) -> u32 {
        let base_delay = self.calculate_backoff_delay(attempt);

        // 添加 ±10% 的随机抖动
        let jitter_range = base_delay / 10;
        let jitter = (rand::random::<u32>() % (jitter_range * 2)).saturating_sub(jitter_range);

        base_delay.saturating_add(jitter)
    }
}

impl Default for RetryStrategy {
    fn default() -> Self {
        Self::default_strategy()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_strategy() {
        let strategy = RetryStrategy::default();
        assert_eq!(strategy.max_retries, 3);
        assert_eq!(strategy.base_delay_ms, 2000);
        assert_eq!(strategy.max_delay_ms, 8000);
        assert_eq!(strategy.rate_limit_delay_ms, 30000);
        assert!(strategy.validate().is_ok());
    }

    #[test]
    fn test_validate() {
        let valid = RetryStrategy::new(3, 2000, 8000, 30000);
        assert!(valid.validate().is_ok());

        let invalid_retry_count = RetryStrategy::new(11, 2000, 8000, 30000);
        assert!(invalid_retry_count.validate().is_err());

        let invalid_base_delay = RetryStrategy::new(3, 50, 8000, 30000);
        assert!(invalid_base_delay.validate().is_err());

        let invalid_delay_order = RetryStrategy::new(3, 8000, 2000, 30000);
        assert!(invalid_delay_order.validate().is_err());
    }

    #[test]
    fn test_calculate_backoff_delay() {
        let strategy = RetryStrategy::new(5, 2000, 16000, 30000);

        assert_eq!(strategy.calculate_backoff_delay(0), 0);     // 第0次: 0ms
        assert_eq!(strategy.calculate_backoff_delay(1), 2000);  // 第1次: 2s
        assert_eq!(strategy.calculate_backoff_delay(2), 4000);  // 第2次: 4s
        assert_eq!(strategy.calculate_backoff_delay(3), 8000);  // 第3次: 8s
        assert_eq!(strategy.calculate_backoff_delay(4), 16000); // 第4次: 16s
        assert_eq!(strategy.calculate_backoff_delay(5), 16000); // 第5次: 16s (达到上限)
    }

    #[test]
    fn test_backoff_max_limit() {
        let strategy = RetryStrategy::new(10, 1000, 5000, 30000);

        // 即使指数增长,也不会超过 max_delay_ms
        assert_eq!(strategy.calculate_backoff_delay(10), 5000);
        assert_eq!(strategy.calculate_backoff_delay(100), 5000);
    }

    #[test]
    fn test_delay_with_jitter_range() {
        let strategy = RetryStrategy::new(3, 2000, 8000, 30000);

        // 测试抖动在合理范围内
        for _ in 0..100 {
            let delay = strategy.calculate_delay_with_jitter(1);
            // base_delay = 2000, jitter = ±200
            assert!(delay >= 1800 && delay <= 2200, "delay = {}", delay);
        }
    }
}
