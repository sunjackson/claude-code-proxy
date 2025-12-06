#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// ConfigGroup (配置分组) 数据模型
/// 代表一组相关 API 配置的逻辑分组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigGroup {
    /// 分组唯一标识符
    pub id: i64,

    /// 分组名称(如"工作"、"个人")
    pub name: String,

    /// 分组描述
    pub description: Option<String>,

    /// 是否启用自动择优切换
    pub auto_switch_enabled: bool,

    /// 延迟阈值(毫秒),超过此值触发自动切换
    pub latency_threshold_ms: i32,

    /// 重试次数 (1-10)
    pub retry_count: i32,

    /// 重试基础延迟 (毫秒)
    pub retry_base_delay_ms: i32,

    /// 重试最大延迟 (毫秒)
    pub retry_max_delay_ms: i32,

    /// 限流错误延迟 (毫秒)
    pub rate_limit_delay_ms: i32,

    /// 是否启用健康检查
    pub health_check_enabled: bool,

    /// 健康检查间隔 (秒, 60-3600)
    pub health_check_interval_sec: i32,

    /// 创建时间
    pub created_at: String,

    /// 最后修改时间
    pub updated_at: String,
}

/// 创建配置分组的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConfigGroupInput {
    pub name: String,
    pub description: Option<String>,
    pub auto_switch_enabled: Option<bool>,
    pub latency_threshold_ms: Option<i32>,
    pub health_check_enabled: Option<bool>,
    pub health_check_interval_sec: Option<i32>,
}

/// 更新配置分组的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigGroupInput {
    pub id: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub auto_switch_enabled: Option<bool>,
    pub latency_threshold_ms: Option<i32>,
    pub health_check_enabled: Option<bool>,
    pub health_check_interval_sec: Option<i32>,
}

/// 更新分组重试策略的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroupRetryStrategyInput {
    /// 分组 ID
    pub group_id: i64,

    /// 重试次数 (1-10)
    pub retry_count: Option<i32>,

    /// 重试基础延迟 (毫秒, 100-10000)
    pub retry_base_delay_ms: Option<i32>,

    /// 重试最大延迟 (毫秒, 1000-60000)
    pub retry_max_delay_ms: Option<i32>,

    /// 限流错误延迟 (毫秒, 1000-300000)
    pub rate_limit_delay_ms: Option<i32>,
}

impl ConfigGroup {
    /// 验证分组名称
    pub fn validate_name(name: &str) -> Result<(), String> {
        if name.is_empty() {
            return Err("分组名称不能为空".to_string());
        }

        if name.len() > 100 {
            return Err("分组名称不能超过 100 个字符".to_string());
        }

        Ok(())
    }

    /// 验证延迟阈值
    pub fn validate_latency_threshold(threshold_ms: i32) -> Result<(), String> {
        if threshold_ms <= 0 {
            return Err("延迟阈值必须大于 0".to_string());
        }

        if threshold_ms > 60000 {
            return Err("延迟阈值不能超过 60000 毫秒 (1分钟)".to_string());
        }

        Ok(())
    }

    /// 验证重试次数
    pub fn validate_retry_count(count: i32) -> Result<(), String> {
        if count < 1 || count > 10 {
            return Err("重试次数必须在 1-10 之间".to_string());
        }
        Ok(())
    }

    /// 验证重试基础延迟
    pub fn validate_retry_base_delay(delay_ms: i32) -> Result<(), String> {
        if delay_ms < 100 || delay_ms > 10000 {
            return Err("重试基础延迟必须在 100-10000 毫秒之间".to_string());
        }
        Ok(())
    }

    /// 验证重试最大延迟
    pub fn validate_retry_max_delay(delay_ms: i32) -> Result<(), String> {
        if delay_ms < 1000 || delay_ms > 60000 {
            return Err("重试最大延迟必须在 1000-60000 毫秒之间".to_string());
        }
        Ok(())
    }

    /// 验证限流延迟
    pub fn validate_rate_limit_delay(delay_ms: i32) -> Result<(), String> {
        if delay_ms < 1000 || delay_ms > 300000 {
            return Err("限流延迟必须在 1000-300000 毫秒之间".to_string());
        }
        Ok(())
    }

    /// 检查是否为特殊分组 "未分组"
    pub fn is_ungrouped(&self) -> bool {
        self.name == "未分组"
    }

    /// 检查是否可以删除
    /// "未分组" 不能删除
    pub fn can_delete(&self) -> bool {
        !self.is_ungrouped()
    }

    /// 验证配置分组
    pub fn validate(&self) -> Result<(), String> {
        Self::validate_name(&self.name)?;
        Self::validate_latency_threshold(self.latency_threshold_ms)?;
        Ok(())
    }
}

impl CreateConfigGroupInput {
    /// 验证创建输入
    pub fn validate(&self) -> Result<(), String> {
        ConfigGroup::validate_name(&self.name)?;

        if let Some(threshold) = self.latency_threshold_ms {
            ConfigGroup::validate_latency_threshold(threshold)?;
        }

        Ok(())
    }
}

impl UpdateConfigGroupInput {
    /// 验证更新输入
    pub fn validate(&self) -> Result<(), String> {
        if let Some(ref name) = self.name {
            ConfigGroup::validate_name(name)?;
        }

        if let Some(threshold) = self.latency_threshold_ms {
            ConfigGroup::validate_latency_threshold(threshold)?;
        }

        Ok(())
    }
}

impl UpdateGroupRetryStrategyInput {
    /// 验证重试策略输入
    pub fn validate(&self) -> Result<(), String> {
        if let Some(count) = self.retry_count {
            ConfigGroup::validate_retry_count(count)?;
        }

        if let Some(base_delay) = self.retry_base_delay_ms {
            ConfigGroup::validate_retry_base_delay(base_delay)?;
        }

        if let Some(max_delay) = self.retry_max_delay_ms {
            ConfigGroup::validate_retry_max_delay(max_delay)?;
        }

        if let Some(rate_limit_delay) = self.rate_limit_delay_ms {
            ConfigGroup::validate_rate_limit_delay(rate_limit_delay)?;
        }

        // 验证基础延迟必须小于最大延迟
        if let (Some(base), Some(max)) = (self.retry_base_delay_ms, self.retry_max_delay_ms) {
            if base >= max {
                return Err("重试基础延迟必须小于最大延迟".to_string());
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name() {
        assert!(ConfigGroup::validate_name("工作").is_ok());
        assert!(ConfigGroup::validate_name("Personal").is_ok());
        assert!(ConfigGroup::validate_name("").is_err());
        assert!(ConfigGroup::validate_name(&"a".repeat(101)).is_err());
    }

    #[test]
    fn test_validate_latency_threshold() {
        assert!(ConfigGroup::validate_latency_threshold(3000).is_ok());
        assert!(ConfigGroup::validate_latency_threshold(1).is_ok());
        assert!(ConfigGroup::validate_latency_threshold(60000).is_ok());
        assert!(ConfigGroup::validate_latency_threshold(0).is_err());
        assert!(ConfigGroup::validate_latency_threshold(-100).is_err());
        assert!(ConfigGroup::validate_latency_threshold(60001).is_err());
    }

    #[test]
    fn test_is_ungrouped() {
        let group = ConfigGroup {
            id: 0,
            name: "未分组".to_string(),
            description: None,
            auto_switch_enabled: false,
            latency_threshold_ms: 30000,
            retry_count: 3,
            retry_base_delay_ms: 2000,
            retry_max_delay_ms: 8000,
            rate_limit_delay_ms: 30000,
            created_at: "2025-11-09".to_string(),
            updated_at: "2025-11-09".to_string(),
        };

        assert!(group.is_ungrouped());
        assert!(!group.can_delete());
    }

    #[test]
    fn test_can_delete() {
        let group = ConfigGroup {
            id: 1,
            name: "工作".to_string(),
            description: None,
            auto_switch_enabled: false,
            latency_threshold_ms: 30000,
            retry_count: 3,
            retry_base_delay_ms: 2000,
            retry_max_delay_ms: 8000,
            rate_limit_delay_ms: 30000,
            created_at: "2025-11-09".to_string(),
            updated_at: "2025-11-09".to_string(),
        };

        assert!(!group.is_ungrouped());
        assert!(group.can_delete());
    }

    #[test]
    fn test_create_input_validation() {
        let valid_input = CreateConfigGroupInput {
            name: "测试分组".to_string(),
            description: Some("测试描述".to_string()),
            auto_switch_enabled: Some(true),
            latency_threshold_ms: Some(5000),
        };
        assert!(valid_input.validate().is_ok());

        let invalid_input = CreateConfigGroupInput {
            name: "".to_string(),
            description: None,
            auto_switch_enabled: None,
            latency_threshold_ms: None,
        };
        assert!(invalid_input.validate().is_err());
    }
}
