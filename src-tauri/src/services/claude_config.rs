use crate::models::error::{AppError, AppResult};
use crate::services::BackupService;
use crate::utils::paths;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;

/// Claude Code 配置管理服务
pub struct ClaudeConfigService;

/// 代理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// 代理服务器地址
    pub host: String,

    /// 代理服务器端口
    pub port: u16,
}

impl ClaudeConfigService {
    /// 启用 Claude Code 代理
    ///
    /// 修改 settings.json 中的 http.proxy 配置
    ///
    /// # 参数
    /// - `proxy_config`: 代理配置
    ///
    /// # 返回
    /// - `Ok(())`: 配置成功
    /// - `Err(AppError)`: 配置失败
    pub fn enable_proxy(proxy_config: &ProxyConfig) -> AppResult<()> {
        log::info!(
            "开始启用 Claude Code 代理: {}:{}",
            proxy_config.host,
            proxy_config.port
        );

        // 创建备份
        BackupService::create_backup("启用代理前自动备份")?;

        // 获取配置文件路径
        let settings_path = paths::get_claude_code_settings_path()?;

        // 读取当前配置
        let mut settings = if settings_path.exists() {
            let content = fs::read_to_string(&settings_path).map_err(|e| AppError::IoError {
                message: format!("读取配置文件失败: {}", e),
            })?;

            serde_json::from_str::<Value>(&content).map_err(|e| AppError::InvalidData {
                message: format!("解析配置文件失败: {}", e),
            })?
        } else {
            // 如果配置文件不存在,创建一个空对象
            serde_json::json!({})
        };

        // 设置代理配置 - 修改 ANTHROPIC_BASE_URL 指向本地代理服务器
        let proxy_url = format!("http://{}:{}", proxy_config.host, proxy_config.port);

        if let Some(obj) = settings.as_object_mut() {
            // 确保 env 对象存在
            if !obj.contains_key("env") {
                obj.insert("env".to_string(), serde_json::json!({}));
            }

            // 保存原始的 ANTHROPIC_BASE_URL（如果存在的话）
            if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
                // 如果存在原始的 ANTHROPIC_BASE_URL，先保存到备用字段
                if let Some(original_url) = env.get("ANTHROPIC_BASE_URL") {
                    // 只有当不是本地代理地址时才保存
                    if let Some(url_str) = original_url.as_str() {
                        if !url_str.starts_with("http://127.0.0.1:")
                            && !url_str.starts_with("http://localhost:")
                        {
                            env.insert(
                                "_ORIGINAL_ANTHROPIC_BASE_URL".to_string(),
                                original_url.clone(),
                            );
                        }
                    }
                }

                // 修改 ANTHROPIC_BASE_URL 为本地代理地址
                env.insert(
                    "ANTHROPIC_BASE_URL".to_string(),
                    Value::String(proxy_url.clone()),
                );
            } else {
                return Err(AppError::InvalidData {
                    message: "env 配置格式错误,必须是对象".to_string(),
                });
            }

            // 同时设置 http.proxy（可选，作为备用）
            obj.insert("http.proxy".to_string(), Value::String(proxy_url.clone()));
        } else {
            return Err(AppError::InvalidData {
                message: "配置文件格式错误,根节点必须是对象".to_string(),
            });
        }

        // 写入配置文件
        let content = serde_json::to_string_pretty(&settings).map_err(|e| {
            AppError::InvalidData {
                message: format!("序列化配置失败: {}", e),
            }
        })?;

        fs::write(&settings_path, content).map_err(|e| AppError::IoError {
            message: format!("写入配置文件失败: {}", e),
        })?;

        log::info!("Claude Code 代理已启用: {}", proxy_url);
        Ok(())
    }

    /// 禁用 Claude Code 代理
    ///
    /// 从 settings.json 中删除 http.proxy 配置
    ///
    /// # 返回
    /// - `Ok(())`: 配置成功
    /// - `Err(AppError)`: 配置失败
    pub fn disable_proxy() -> AppResult<()> {
        log::info!("开始禁用 Claude Code 代理");

        // 创建备份
        BackupService::create_backup("禁用代理前自动备份")?;

        // 获取配置文件路径
        let settings_path = paths::get_claude_code_settings_path()?;

        if !settings_path.exists() {
            log::info!("配置文件不存在,无需禁用代理");
            return Ok(());
        }

        // 读取当前配置
        let content = fs::read_to_string(&settings_path).map_err(|e| AppError::IoError {
            message: format!("读取配置文件失败: {}", e),
        })?;

        let mut settings = serde_json::from_str::<Value>(&content).map_err(|e| {
            AppError::InvalidData {
                message: format!("解析配置文件失败: {}", e),
            }
        })?;

        // 删除代理配置
        if let Some(obj) = settings.as_object_mut() {
            // 移除 http.proxy
            obj.remove("http.proxy");

            // 恢复原始的 ANTHROPIC_BASE_URL（如果存在的话）
            if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
                // 检查是否保存了原始的 ANTHROPIC_BASE_URL
                if let Some(original_url) = env.remove("_ORIGINAL_ANTHROPIC_BASE_URL") {
                    // 恢复原始值
                    env.insert("ANTHROPIC_BASE_URL".to_string(), original_url);
                    log::info!("已恢复原始的 ANTHROPIC_BASE_URL");
                } else {
                    // 如果没有保存原始值，则直接删除（恢复为默认行为）
                    env.remove("ANTHROPIC_BASE_URL");
                }

                // 如果 env 对象为空，则移除整个 env 对象
                if env.is_empty() {
                    obj.remove("env");
                }
            }
        }

        // 写入配置文件
        let content = serde_json::to_string_pretty(&settings).map_err(|e| {
            AppError::InvalidData {
                message: format!("序列化配置失败: {}", e),
            }
        })?;

        fs::write(&settings_path, content).map_err(|e| AppError::IoError {
            message: format!("写入配置文件失败: {}", e),
        })?;

        log::info!("Claude Code 代理已禁用");
        Ok(())
    }

    /// 获取当前代理配置
    ///
    /// # 返回
    /// - `Ok(Some(ProxyConfig))`: 当前代理配置
    /// - `Ok(None)`: 未配置代理
    /// - `Err(AppError)`: 读取失败
    pub fn get_proxy_config() -> AppResult<Option<ProxyConfig>> {
        log::debug!("读取当前 Claude Code 代理配置");

        let settings_path = paths::get_claude_code_settings_path()?;

        if !settings_path.exists() {
            log::debug!("配置文件不存在,返回空代理配置");
            return Ok(None);
        }

        let content = fs::read_to_string(&settings_path).map_err(|e| AppError::IoError {
            message: format!("读取配置文件失败: {}", e),
        })?;

        let settings: Value = serde_json::from_str(&content).map_err(|e| {
            AppError::InvalidData {
                message: format!("解析配置文件失败: {}", e),
            }
        })?;

        // 优先读取 env.ANTHROPIC_BASE_URL 配置
        if let Some(base_url) = settings
            .get("env")
            .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
            .and_then(|v| v.as_str())
        {
            // 检查是否是本地代理地址
            if base_url.starts_with("http://127.0.0.1:")
                || base_url.starts_with("http://localhost:")
            {
                if let Some(parsed) = Self::parse_proxy_url(base_url) {
                    log::debug!(
                        "当前代理配置（来自 ANTHROPIC_BASE_URL）: {}:{}",
                        parsed.host,
                        parsed.port
                    );
                    return Ok(Some(parsed));
                }
            }
        }

        // 兼容旧配置：读取 http.proxy 配置
        if let Some(proxy_url) = settings.get("http.proxy").and_then(|v| v.as_str()) {
            // 解析代理 URL: http://host:port
            if let Some(parsed) = Self::parse_proxy_url(proxy_url) {
                log::debug!("当前代理配置（来自 http.proxy）: {}:{}", parsed.host, parsed.port);
                return Ok(Some(parsed));
            }
        }

        log::debug!("未配置代理");
        Ok(None)
    }

    /// 恢复配置文件
    ///
    /// 这是 restore_claude_code_backup 的别名,用于保持 API 一致性
    ///
    /// # 参数
    /// - `backup_filename`: 备份文件名
    pub fn restore_config(backup_filename: &str) -> AppResult<()> {
        BackupService::restore_backup(backup_filename)
    }

    /// 解析代理 URL
    ///
    /// 支持格式:
    /// - http://host:port
    /// - host:port
    fn parse_proxy_url(url: &str) -> Option<ProxyConfig> {
        // 去除 http:// 或 https:// 前缀
        let url = url
            .trim_start_matches("http://")
            .trim_start_matches("https://");

        // 分割 host 和 port
        let parts: Vec<&str> = url.split(':').collect();
        if parts.len() != 2 {
            return None;
        }

        let host = parts[0].to_string();
        let port = parts[1].parse::<u16>().ok()?;

        Some(ProxyConfig { host, port })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_proxy_url() {
        // 测试标准格式
        let config = ClaudeConfigService::parse_proxy_url("http://127.0.0.1:8080");
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 8080);

        // 测试不带协议的格式
        let config = ClaudeConfigService::parse_proxy_url("localhost:3000");
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.host, "localhost");
        assert_eq!(config.port, 3000);

        // 测试 https 协议
        let config = ClaudeConfigService::parse_proxy_url("https://proxy.example.com:443");
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.host, "proxy.example.com");
        assert_eq!(config.port, 443);

        // 测试无效格式
        assert!(ClaudeConfigService::parse_proxy_url("invalid").is_none());
        assert!(ClaudeConfigService::parse_proxy_url("host:port:extra").is_none());
        assert!(ClaudeConfigService::parse_proxy_url("host:abc").is_none());
    }

    #[test]
    fn test_proxy_config_serialization() {
        let config = ProxyConfig {
            host: "127.0.0.1".to_string(),
            port: 8080,
        };

        // 测试序列化
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("127.0.0.1"));
        assert!(json.contains("8080"));

        // 测试反序列化
        let decoded: ProxyConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.host, "127.0.0.1");
        assert_eq!(decoded.port, 8080);
    }
}
