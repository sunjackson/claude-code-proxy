#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// EnvironmentVariable (环境变量) 数据模型
/// 代表系统环境变量键值对
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentVariable {
    /// 环境变量唯一标识符
    pub id: i64,

    /// 变量名
    pub key: String,

    /// 变量值
    pub value: String,

    /// 是否已应用到系统环境
    pub is_active: bool,

    /// 设置时间
    pub set_at: Option<String>,

    /// 清除时间
    pub unset_at: Option<String>,
}

/// 创建或更新环境变量的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetEnvironmentVariableInput {
    pub key: String,
    pub value: String,
}

/// 环境变量详情 (用于前端展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentVariableDetail {
    /// 变量 ID
    pub id: i64,

    /// 变量名
    pub key: String,

    /// 变量值 (可能被隐藏)
    pub value: String,

    /// 是否激活
    pub is_active: bool,

    /// 设置时间
    pub set_at: Option<String>,

    /// 值是否已隐藏
    pub is_masked: bool,
}

impl EnvironmentVariable {
    /// 验证变量名
    pub fn validate_key(key: &str) -> Result<(), String> {
        if key.is_empty() {
            return Err("变量名不能为空".to_string());
        }

        // 检查变量名格式 (只能包含字母、数字和下划线,且不能以数字开头)
        let first_char = key.chars().next().unwrap();
        if first_char.is_numeric() {
            return Err("变量名不能以数字开头".to_string());
        }

        if !key.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err("变量名只能包含字母、数字和下划线".to_string());
        }

        if key.len() > 200 {
            return Err("变量名不能超过 200 个字符".to_string());
        }

        Ok(())
    }

    /// 检查是否为敏感变量 (需要隐藏值)
    pub fn is_sensitive(&self) -> bool {
        let sensitive_keywords = ["API_KEY", "SECRET", "PASSWORD", "TOKEN", "PRIVATE"];
        let key_upper = self.key.to_uppercase();

        sensitive_keywords
            .iter()
            .any(|keyword| key_upper.contains(keyword))
    }

    /// 获取掩码后的值 (用于显示)
    pub fn masked_value(&self) -> String {
        if self.is_sensitive() {
            let len = self.value.len();
            if len <= 4 {
                "*".repeat(len)
            } else {
                format!("{}...{}", &self.value[..2], &self.value[len - 2..])
            }
        } else {
            self.value.clone()
        }
    }

    /// 检查是否为常用的 Claude 环境变量
    pub fn is_claude_related(&self) -> bool {
        let claude_vars = [
            "ANTHROPIC_API_KEY",
            "ANTHROPIC_BASE_URL",
            "CLAUDE_API_KEY",
            "CLAUDE_BASE_URL",
        ];

        claude_vars.contains(&self.key.as_str())
    }
}

impl SetEnvironmentVariableInput {
    /// 验证输入
    pub fn validate(&self) -> Result<(), String> {
        EnvironmentVariable::validate_key(&self.key)?;

        // 值可以为空字符串
        Ok(())
    }
}

impl EnvironmentVariableDetail {
    /// 从 EnvironmentVariable 创建详情对象
    pub fn from_env_var(env_var: EnvironmentVariable, mask_sensitive: bool) -> Self {
        let is_masked = mask_sensitive && env_var.is_sensitive();
        let value = if is_masked {
            env_var.masked_value()
        } else {
            env_var.value.clone()
        };

        EnvironmentVariableDetail {
            id: env_var.id,
            key: env_var.key,
            value,
            is_active: env_var.is_active,
            set_at: env_var.set_at,
            is_masked,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_key() {
        assert!(EnvironmentVariable::validate_key("API_KEY").is_ok());
        assert!(EnvironmentVariable::validate_key("my_var_123").is_ok());
        assert!(EnvironmentVariable::validate_key("").is_err());
        assert!(EnvironmentVariable::validate_key("123_var").is_err());
        assert!(EnvironmentVariable::validate_key("my-var").is_err());
        assert!(EnvironmentVariable::validate_key(&"a".repeat(201)).is_err());
    }

    #[test]
    fn test_is_sensitive() {
        let env_var = EnvironmentVariable {
            id: 1,
            key: "ANTHROPIC_API_KEY".to_string(),
            value: "sk-1234567890".to_string(),
            is_active: true,
            set_at: None,
            unset_at: None,
        };
        assert!(env_var.is_sensitive());

        let normal_var = EnvironmentVariable {
            key: "MY_VAR".to_string(),
            ..env_var.clone()
        };
        assert!(!normal_var.is_sensitive());
    }

    #[test]
    fn test_masked_value() {
        let env_var = EnvironmentVariable {
            id: 1,
            key: "API_SECRET".to_string(),
            value: "sk-1234567890abcdef".to_string(),
            is_active: true,
            set_at: None,
            unset_at: None,
        };

        assert_eq!(env_var.masked_value(), "sk...ef");

        let short_var = EnvironmentVariable {
            value: "abc".to_string(),
            ..env_var.clone()
        };
        assert_eq!(short_var.masked_value(), "***");

        let normal_var = EnvironmentVariable {
            key: "PATH".to_string(),
            value: "/usr/bin".to_string(),
            ..env_var.clone()
        };
        assert_eq!(normal_var.masked_value(), "/usr/bin");
    }

    #[test]
    fn test_is_claude_related() {
        let claude_var = EnvironmentVariable {
            id: 1,
            key: "ANTHROPIC_API_KEY".to_string(),
            value: "test".to_string(),
            is_active: true,
            set_at: None,
            unset_at: None,
        };
        assert!(claude_var.is_claude_related());

        let other_var = EnvironmentVariable {
            key: "MY_VAR".to_string(),
            ..claude_var
        };
        assert!(!other_var.is_claude_related());
    }
}
