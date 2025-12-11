//! 权重计算服务
//!
//! 根据多维度指标计算配置的智能权重分数，用于自动切换决策。
//!
//! ## 权重计算公式
//!
//! **有余额信息时：**
//! W = (0.30 × 延迟分) + (0.30 × 成功率分) + (0.25 × 余额分) + (0.15 × 优先级分)
//!
//! **无余额信息时：**
//! W = (0.40 × 延迟分) + (0.40 × 成功率分) + (0.20 × 优先级分)
//!
//! ## 各项指标计算
//!
//! - **延迟分**：基于最近延迟，<200ms得100分，>2000ms得0分，线性插值
//! - **成功率分**：基于连续失败次数，0次得100分，≥5次得0分
//! - **余额分**：基于剩余余额，≥$50得100分，≤$1得0分，对数插值
//! - **优先级分**：基于sort_order，第1位得100分，递减

use rusqlite::Connection;
use crate::models::api_config::ApiConfig;
use crate::models::error::AppResult;

/// 权重计算配置
#[derive(Debug, Clone)]
pub struct WeightConfig {
    /// 延迟权重（有余额时）
    pub latency_weight_with_balance: f64,
    /// 成功率权重（有余额时）
    pub success_rate_weight_with_balance: f64,
    /// 余额权重
    pub balance_weight: f64,
    /// 优先级权重（有余额时）
    pub priority_weight_with_balance: f64,

    /// 延迟权重（无余额时）
    pub latency_weight_no_balance: f64,
    /// 成功率权重（无余额时）
    pub success_rate_weight_no_balance: f64,
    /// 优先级权重（无余额时）
    pub priority_weight_no_balance: f64,

    /// 延迟评分阈值（毫秒）
    pub latency_excellent_ms: i32,  // 优秀延迟阈值
    pub latency_poor_ms: i32,       // 差延迟阈值

    /// 余额评分阈值（美元）
    pub balance_excellent: f64,     // 优秀余额阈值
    pub balance_poor: f64,          // 差余额阈值

    /// 连续失败次数阈值
    pub max_consecutive_failures: i32,
}

impl Default for WeightConfig {
    fn default() -> Self {
        Self {
            // 有余额时的权重分配
            latency_weight_with_balance: 0.30,
            success_rate_weight_with_balance: 0.30,
            balance_weight: 0.25,
            priority_weight_with_balance: 0.15,

            // 无余额时的权重分配
            latency_weight_no_balance: 0.40,
            success_rate_weight_no_balance: 0.40,
            priority_weight_no_balance: 0.20,

            // 延迟阈值
            latency_excellent_ms: 200,
            latency_poor_ms: 2000,

            // 余额阈值（美元）
            balance_excellent: 50.0,
            balance_poor: 1.0,

            // 最大连续失败次数
            max_consecutive_failures: 5,
        }
    }
}

/// 权重计算服务
pub struct WeightCalculator {
    config: WeightConfig,
}

impl WeightCalculator {
    /// 创建新的权重计算器
    pub fn new() -> Self {
        Self {
            config: WeightConfig::default(),
        }
    }

    /// 使用自定义配置创建权重计算器
    #[allow(dead_code)]
    pub fn with_config(config: WeightConfig) -> Self {
        Self { config }
    }

    /// 计算延迟分数 (0-100)
    ///
    /// - <200ms: 100分
    /// - >2000ms: 0分
    /// - 中间线性插值
    pub fn calculate_latency_score(&self, latency_ms: Option<i32>) -> f64 {
        match latency_ms {
            None => 50.0, // 无延迟数据时给中等分数
            Some(latency) => {
                if latency <= self.config.latency_excellent_ms {
                    100.0
                } else if latency >= self.config.latency_poor_ms {
                    0.0
                } else {
                    // 线性插值
                    let range = (self.config.latency_poor_ms - self.config.latency_excellent_ms) as f64;
                    let position = (latency - self.config.latency_excellent_ms) as f64;
                    100.0 * (1.0 - position / range)
                }
            }
        }
    }

    /// 计算成功率分数 (0-100)
    ///
    /// 基于连续失败次数：
    /// - 0次失败: 100分
    /// - ≥5次失败: 0分
    /// - 中间线性递减
    pub fn calculate_success_rate_score(&self, consecutive_failures: i32) -> f64 {
        if consecutive_failures <= 0 {
            100.0
        } else if consecutive_failures >= self.config.max_consecutive_failures {
            0.0
        } else {
            let max = self.config.max_consecutive_failures as f64;
            100.0 * (1.0 - consecutive_failures as f64 / max)
        }
    }

    /// 计算余额分数 (0-100)
    ///
    /// 使用对数插值，更好地处理余额差异：
    /// - ≥$50: 100分
    /// - ≤$1: 0分
    /// - 中间对数插值
    pub fn calculate_balance_score(&self, balance: Option<f64>, currency: Option<&str>) -> f64 {
        match balance {
            None => 50.0, // 无余额数据时给中等分数
            Some(bal) => {
                // 统一转换为美元（简化处理）
                let usd_balance = self.normalize_to_usd(bal, currency);

                if usd_balance >= self.config.balance_excellent {
                    100.0
                } else if usd_balance <= self.config.balance_poor {
                    0.0
                } else {
                    // 对数插值，使小额余额差异更明显
                    let log_balance = (usd_balance + 1.0).ln();
                    let log_excellent = (self.config.balance_excellent + 1.0).ln();
                    let log_poor = (self.config.balance_poor + 1.0).ln();

                    100.0 * (log_balance - log_poor) / (log_excellent - log_poor)
                }
            }
        }
    }

    /// 计算优先级分数 (0-100)
    ///
    /// 基于排序顺序：
    /// - 第1位: 100分
    /// - 递减，每位减10分，最低0分
    pub fn calculate_priority_score(&self, sort_order: i32, total_configs: i32) -> f64 {
        if total_configs <= 1 {
            return 100.0;
        }

        // 第1位100分，最后一位0分
        let max_order = total_configs - 1;
        if sort_order <= 0 {
            100.0
        } else if sort_order >= max_order {
            0.0
        } else {
            100.0 * (1.0 - sort_order as f64 / max_order as f64)
        }
    }

    /// 计算配置的综合权重分数
    ///
    /// # Arguments
    /// - `config`: API 配置
    /// - `total_configs`: 同组配置总数（用于优先级计算）
    ///
    /// # Returns
    /// 权重分数 (0.0 - 1.0)
    pub fn calculate_weight(&self, config: &ApiConfig, total_configs: i32) -> f64 {
        let latency_score = self.calculate_latency_score(config.last_latency_ms);
        let success_rate_score = self.calculate_success_rate_score(config.consecutive_failures);
        let priority_score = self.calculate_priority_score(config.sort_order, total_configs);

        // 判断是否有余额信息
        let has_balance = config.last_balance.is_some() && config.auto_balance_check;

        let weight = if has_balance {
            let balance_score = self.calculate_balance_score(
                config.last_balance,
                config.balance_currency.as_deref(),
            );

            (self.config.latency_weight_with_balance * latency_score
                + self.config.success_rate_weight_with_balance * success_rate_score
                + self.config.balance_weight * balance_score
                + self.config.priority_weight_with_balance * priority_score)
                / 100.0
        } else {
            (self.config.latency_weight_no_balance * latency_score
                + self.config.success_rate_weight_no_balance * success_rate_score
                + self.config.priority_weight_no_balance * priority_score)
                / 100.0
        };

        // 确保权重在 0.0 - 1.0 范围内
        weight.clamp(0.0, 1.0)
    }

    /// 批量计算并更新配置权重
    ///
    /// # Arguments
    /// - `conn`: 数据库连接
    /// - `configs`: 配置列表
    pub fn update_weights(&self, conn: &Connection, configs: &[ApiConfig]) -> AppResult<()> {
        use crate::services::ApiConfigService;

        let total_configs = configs.len() as i32;

        for config in configs {
            let weight = self.calculate_weight(config, total_configs);

            // 更新数据库中的权重分数
            ApiConfigService::update_weight_score(conn, config.id, weight)?;

            log::debug!(
                "更新配置 {} (ID: {}) 权重: {:.4}",
                config.name,
                config.id,
                weight
            );
        }

        Ok(())
    }

    /// 将余额标准化为美元
    fn normalize_to_usd(&self, balance: f64, currency: Option<&str>) -> f64 {
        match currency {
            Some("CNY") => balance / 7.2, // 人民币转美元（近似汇率）
            Some("EUR") => balance * 1.08, // 欧元转美元
            Some("GBP") => balance * 1.27, // 英镑转美元
            Some("JPY") => balance / 150.0, // 日元转美元
            _ => balance, // 默认按美元处理
        }
    }

    /// 获取最佳配置（基于权重）
    ///
    /// # Arguments
    /// - `configs`: 已启用且可用的配置列表
    ///
    /// # Returns
    /// 权重最高的配置 ID
    #[allow(dead_code)]
    pub fn get_best_config(&self, configs: &[ApiConfig]) -> Option<i64> {
        if configs.is_empty() {
            return None;
        }

        let total_configs = configs.len() as i32;

        configs
            .iter()
            .filter(|c| c.is_enabled && c.is_available)
            .max_by(|a, b| {
                let weight_a = self.calculate_weight(a, total_configs);
                let weight_b = self.calculate_weight(b, total_configs);
                weight_a.partial_cmp(&weight_b).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|c| c.id)
    }
}

impl Default for WeightCalculator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latency_score() {
        let calculator = WeightCalculator::new();

        // 优秀延迟
        assert_eq!(calculator.calculate_latency_score(Some(100)), 100.0);
        assert_eq!(calculator.calculate_latency_score(Some(200)), 100.0);

        // 差延迟
        assert_eq!(calculator.calculate_latency_score(Some(2000)), 0.0);
        assert_eq!(calculator.calculate_latency_score(Some(3000)), 0.0);

        // 中等延迟
        let mid_score = calculator.calculate_latency_score(Some(1100));
        assert!(mid_score > 0.0 && mid_score < 100.0);

        // 无延迟数据
        assert_eq!(calculator.calculate_latency_score(None), 50.0);
    }

    #[test]
    fn test_success_rate_score() {
        let calculator = WeightCalculator::new();

        assert_eq!(calculator.calculate_success_rate_score(0), 100.0);
        assert_eq!(calculator.calculate_success_rate_score(5), 0.0);
        assert_eq!(calculator.calculate_success_rate_score(10), 0.0);

        // 中间值
        let mid_score = calculator.calculate_success_rate_score(2);
        assert!(mid_score > 0.0 && mid_score < 100.0);
    }

    #[test]
    fn test_balance_score() {
        let calculator = WeightCalculator::new();

        // 优秀余额
        assert_eq!(calculator.calculate_balance_score(Some(100.0), Some("USD")), 100.0);

        // 差余额
        assert_eq!(calculator.calculate_balance_score(Some(0.5), Some("USD")), 0.0);

        // 无余额数据
        assert_eq!(calculator.calculate_balance_score(None, None), 50.0);

        // 人民币余额
        let cny_score = calculator.calculate_balance_score(Some(360.0), Some("CNY"));
        assert!(cny_score > 90.0); // 360 CNY ≈ 50 USD
    }

    #[test]
    fn test_priority_score() {
        let calculator = WeightCalculator::new();

        // 第一位
        assert_eq!(calculator.calculate_priority_score(0, 5), 100.0);

        // 最后一位
        assert_eq!(calculator.calculate_priority_score(4, 5), 0.0);

        // 中间位置
        let mid_score = calculator.calculate_priority_score(2, 5);
        assert!(mid_score > 0.0 && mid_score < 100.0);
    }
}
