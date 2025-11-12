#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// ProxyService (代理服务) 数据模型
/// 代表本地运行的代理服务实例
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyService {
    /// 运行状态
    pub status: ProxyStatus,

    /// 监听地址
    pub listen_host: String,

    /// 监听端口
    pub listen_port: i32,

    /// 当前使用的分组 ID
    pub active_group_id: Option<i64>,

    /// 当前使用的分组名称
    pub active_group_name: Option<String>,

    /// 当前使用的 API 配置 ID
    pub active_config_id: Option<i64>,

    /// 当前使用的配置名称
    pub active_config_name: Option<String>,
}

/// 代理服务运行状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyStatus {
    /// 已停止
    Stopped,

    /// 启动中
    Starting,

    /// 运行中
    Running,

    /// 停止中
    Stopping,

    /// 错误
    Error,
}

impl ProxyStatus {
    /// 从字符串解析状态
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "stopped" => Ok(ProxyStatus::Stopped),
            "starting" => Ok(ProxyStatus::Starting),
            "running" => Ok(ProxyStatus::Running),
            "stopping" => Ok(ProxyStatus::Stopping),
            "error" => Ok(ProxyStatus::Error),
            _ => Err(format!("无效的代理状态: {}", s)),
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            ProxyStatus::Stopped => "stopped",
            ProxyStatus::Starting => "starting",
            ProxyStatus::Running => "running",
            ProxyStatus::Stopping => "stopping",
            ProxyStatus::Error => "error",
        }
    }

    /// 检查是否可以启动
    pub fn can_start(&self) -> bool {
        matches!(self, ProxyStatus::Stopped | ProxyStatus::Error)
    }

    /// 检查是否可以停止
    pub fn can_stop(&self) -> bool {
        matches!(self, ProxyStatus::Starting | ProxyStatus::Running)
    }

    /// 检查是否正在运行
    pub fn is_running(&self) -> bool {
        matches!(self, ProxyStatus::Running)
    }

    /// 检查是否已停止
    pub fn is_stopped(&self) -> bool {
        matches!(self, ProxyStatus::Stopped)
    }
}

/// 代理状态详情 (用于前端展示)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyStatusDetail {
    /// 服务 ID
    pub id: i64,

    /// 监听端口
    pub listen_port: i32,

    /// 运行状态
    pub status: ProxyStatus,

    /// 当前分组名称
    pub current_group_name: Option<String>,

    /// 当前配置名称
    pub current_config_name: Option<String>,

    /// 当前服务器地址
    pub current_server_url: Option<String>,

    /// 当前服务器端口
    pub current_server_port: Option<i32>,

    /// 错误信息
    pub error_message: Option<String>,

    /// 启动时间
    pub started_at: Option<String>,

    /// 运行时长 (秒)
    pub uptime_seconds: Option<i64>,
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_status_from_str() {
        assert_eq!(ProxyStatus::from_str("stopped").unwrap(), ProxyStatus::Stopped);
        assert_eq!(ProxyStatus::from_str("starting").unwrap(), ProxyStatus::Starting);
        assert_eq!(ProxyStatus::from_str("running").unwrap(), ProxyStatus::Running);
        assert_eq!(ProxyStatus::from_str("error").unwrap(), ProxyStatus::Error);
        assert!(ProxyStatus::from_str("invalid").is_err());
    }

    #[test]
    fn test_proxy_status_as_str() {
        assert_eq!(ProxyStatus::Stopped.as_str(), "stopped");
        assert_eq!(ProxyStatus::Starting.as_str(), "starting");
        assert_eq!(ProxyStatus::Running.as_str(), "running");
        assert_eq!(ProxyStatus::Error.as_str(), "error");
    }

    #[test]
    fn test_can_start() {
        assert!(ProxyStatus::Stopped.can_start());
        assert!(ProxyStatus::Error.can_start());
        assert!(!ProxyStatus::Starting.can_start());
        assert!(!ProxyStatus::Running.can_start());
    }

    #[test]
    fn test_can_stop() {
        assert!(ProxyStatus::Starting.can_stop());
        assert!(ProxyStatus::Running.can_stop());
        assert!(!ProxyStatus::Stopped.can_stop());
        assert!(!ProxyStatus::Error.can_stop());
    }

    #[test]
    fn test_is_running() {
        assert!(ProxyStatus::Running.is_running());
        assert!(!ProxyStatus::Stopped.is_running());
        assert!(!ProxyStatus::Starting.is_running());
        assert!(!ProxyStatus::Error.is_running());
    }

}
