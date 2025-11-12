#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 应用错误类型
/// 定义18种错误类型(见 contracts/tauri-commands.md 第10节)
#[derive(Error, Debug, Serialize, Deserialize)]
#[serde(tag = "error", content = "details")]
pub enum AppError {
    /// 资源不存在
    #[error("资源不存在: {resource} (id: {id})")]
    NotFound { resource: String, id: String },

    /// 输入参数验证失败
    #[error("输入参数验证失败: {field} - {message}")]
    ValidationError { field: String, message: String },

    /// 重复条目
    #[error("重复条目: {field} = {value}")]
    DuplicateEntry { field: String, value: String },

    /// 权限不足
    #[error("权限不足: {message}")]
    PermissionDenied { message: String },

    /// 数据库操作失败
    #[error("数据库操作失败: {message}")]
    DatabaseError { message: String },

    /// 系统密钥链操作失败
    #[error("系统密钥链操作失败: {message}")]
    KeychainError { message: String },

    /// 代理服务错误
    #[error("代理服务错误: {message}")]
    ServiceError { message: String },

    /// 系统调用失败
    #[error("系统调用失败: {message}")]
    SystemError { message: String },

    /// IO 错误
    #[error("IO 错误: {message}")]
    IoError { message: String },

    /// 无效状态
    #[error("无效状态: {message}")]
    InvalidState { message: String },

    /// 无效数据
    #[error("无效数据: {message}")]
    InvalidData { message: String },

    /// 端口被占用
    #[error("端口被占用: {port}")]
    PortInUse { port: u16 },

    /// 服务已运行
    #[error("服务已运行")]
    AlreadyRunning,

    /// 服务已停止
    #[error("服务已停止")]
    AlreadyStopped,

    /// 资源正在使用中
    #[error("资源正在使用中: {message}")]
    InUse { message: String },

    /// 分组为空
    #[error("分组为空: {group_id}")]
    EmptyGroup { group_id: i64 },

    /// 配置数量不足
    #[error("配置数量不足: 需要至少 {required} 个配置")]
    InsufficientConfigs { required: usize },

    /// 配置不属于指定分组
    #[error("配置不属于指定分组: config_id={config_id}, group_id={group_id}")]
    ConfigNotInGroup { config_id: i64, group_id: i64 },

    /// 配置不可用
    #[error("配置不可用: config_id={config_id}")]
    ConfigUnavailable { config_id: i64 },

    /// 测试超时
    #[error("测试超时: {timeout_seconds} 秒")]
    TestTimeout { timeout_seconds: u64 },

    /// 远程加载失败
    #[error("远程加载失败: {url}")]
    RemoteLoadFailed { url: String },

    /// 本地加载失败
    #[error("本地加载失败: {path}")]
    LocalLoadFailed { path: String },

    /// 解析错误
    #[error("解析错误: {message}")]
    ParseError { message: String },

    /// 文件写入失败
    #[error("文件写入失败: {path}")]
    FileWriteError { path: String },

    /// 备份失败
    #[error("备份失败: {message}")]
    BackupFailed { message: String },

    /// 路径不存在
    #[error("路径不存在: {path}")]
    PathNotFound { path: String },

    /// 没有可用配置
    #[error("没有可用配置")]
    NoConfigAvailable,
}

/// 错误响应格式
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl From<AppError> for ErrorResponse {
    fn from(error: AppError) -> Self {
        ErrorResponse {
            error: error.error_type(),
            message: error.to_string(),
            details: None,
        }
    }
}

impl AppError {
    /// 获取错误类型字符串
    pub fn error_type(&self) -> String {
        match self {
            AppError::NotFound { .. } => "NotFound".to_string(),
            AppError::ValidationError { .. } => "ValidationError".to_string(),
            AppError::DuplicateEntry { .. } => "DuplicateEntry".to_string(),
            AppError::PermissionDenied { .. } => "PermissionDenied".to_string(),
            AppError::DatabaseError { .. } => "DatabaseError".to_string(),
            AppError::KeychainError { .. } => "KeychainError".to_string(),
            AppError::ServiceError { .. } => "ServiceError".to_string(),
            AppError::SystemError { .. } => "SystemError".to_string(),
            AppError::IoError { .. } => "IoError".to_string(),
            AppError::InvalidState { .. } => "InvalidState".to_string(),
            AppError::InvalidData { .. } => "InvalidData".to_string(),
            AppError::PortInUse { .. } => "PortInUse".to_string(),
            AppError::AlreadyRunning => "AlreadyRunning".to_string(),
            AppError::AlreadyStopped => "AlreadyStopped".to_string(),
            AppError::InUse { .. } => "InUse".to_string(),
            AppError::EmptyGroup { .. } => "EmptyGroup".to_string(),
            AppError::InsufficientConfigs { .. } => "InsufficientConfigs".to_string(),
            AppError::ConfigNotInGroup { .. } => "ConfigNotInGroup".to_string(),
            AppError::ConfigUnavailable { .. } => "ConfigUnavailable".to_string(),
            AppError::TestTimeout { .. } => "TestTimeout".to_string(),
            AppError::RemoteLoadFailed { .. } => "RemoteLoadFailed".to_string(),
            AppError::LocalLoadFailed { .. } => "LocalLoadFailed".to_string(),
            AppError::ParseError { .. } => "ParseError".to_string(),
            AppError::FileWriteError { .. } => "FileWriteError".to_string(),
            AppError::BackupFailed { .. } => "BackupFailed".to_string(),
            AppError::PathNotFound { .. } => "PathNotFound".to_string(),
            AppError::NoConfigAvailable => "NoConfigAvailable".to_string(),
        }
    }
}

/// Result 类型别名
pub type AppResult<T> = Result<T, AppError>;

/// 从 String 转换为 AppError
impl From<String> for AppError {
    fn from(message: String) -> Self {
        AppError::SystemError { message }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serialization() {
        let error = AppError::NotFound {
            resource: "配置".to_string(),
            id: "123".to_string(),
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("NotFound"));
    }

    #[test]
    fn test_error_type() {
        let error = AppError::ValidationError {
            field: "name".to_string(),
            message: "参数错误".to_string(),
        };
        assert_eq!(error.error_type(), "ValidationError");
    }

    #[test]
    fn test_error_response() {
        let error = AppError::DatabaseError {
            message: "连接失败".to_string(),
        };
        let response: ErrorResponse = error.into();
        assert_eq!(response.error, "DatabaseError");
    }
}
