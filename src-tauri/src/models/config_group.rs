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
}

/// 更新配置分组的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigGroupInput {
    pub id: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub auto_switch_enabled: Option<bool>,
    pub latency_threshold_ms: Option<i32>,
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
            latency_threshold_ms: 3000,
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
            latency_threshold_ms: 3000,
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
