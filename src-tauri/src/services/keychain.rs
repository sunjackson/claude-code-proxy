#![allow(dead_code)]

use crate::models::error::{AppError, AppResult};
#[cfg(not(test))]
use keyring::Entry;

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::{Mutex as StdMutex, OnceLock};

/// 密钥链服务标识符
const SERVICE_NAME: &str = "claude-code-proxy";

#[cfg(test)]
static TEST_KEYCHAIN_STORE: OnceLock<StdMutex<HashMap<String, String>>> = OnceLock::new();

/// 密钥链管理器
/// 提供跨平台的密钥存储和检索功能
/// - Windows: 使用 DPAPI (Data Protection API)
/// - macOS: 使用 Keychain
/// - Linux: 使用 Secret Service API (libsecret)
pub struct KeychainManager;

impl KeychainManager {
    #[cfg(test)]
    fn test_store_key(account: &str) -> String {
        format!("{}:{}", SERVICE_NAME, account)
    }

    #[cfg(test)]
    fn test_store() -> &'static StdMutex<HashMap<String, String>> {
        TEST_KEYCHAIN_STORE.get_or_init(|| StdMutex::new(HashMap::new()))
    }

    /// 存储 API 密钥到系统密钥链
    ///
    /// # 参数
    /// - `config_id`: API 配置 ID
    /// - `api_key`: 要存储的 API 密钥
    ///
    /// # 返回
    /// - `Ok(())`: 成功存储
    /// - `Err(AppError)`: 存储失败
    pub fn set_api_key(config_id: i64, api_key: &str) -> AppResult<()> {
        let account = Self::get_account_name(config_id);

        log::info!("正在存储 API 密钥到系统密钥链: {}", account);

        #[cfg(test)]
        {
            let key = Self::test_store_key(&account);
            let mut store = Self::test_store().lock().map_err(|_| AppError::KeychainError {
                message: "存储 API 密钥失败: 测试密钥链存储锁定失败".to_string(),
            })?;
            store.insert(key, api_key.to_string());
            return Ok(());
        }

        #[cfg(not(test))]
        {
            let entry = Entry::new(SERVICE_NAME, &account).map_err(|e| AppError::KeychainError {
                message: format!("创建密钥链条目失败: {}", e),
            })?;

            entry
                .set_password(api_key)
                .map_err(|e| AppError::KeychainError {
                    message: format!("存储 API 密钥失败: {}", e),
                })?;

            log::info!("API 密钥已成功存储到系统密钥链");
            Ok(())
        }
    }

    /// 从系统密钥链读取 API 密钥
    ///
    /// # 参数
    /// - `config_id`: API 配置 ID
    ///
    /// # 返回
    /// - `Ok(String)`: API 密钥
    /// - `Err(AppError)`: 读取失败或密钥不存在
    pub fn get_api_key(config_id: i64) -> AppResult<String> {
        let account = Self::get_account_name(config_id);

        log::debug!("正在从系统密钥链读取 API 密钥: {}", account);

        #[cfg(test)]
        {
            let key = Self::test_store_key(&account);
            let store = Self::test_store().lock().map_err(|_| AppError::KeychainError {
                message: "读取 API 密钥失败: 测试密钥链存储锁定失败".to_string(),
            })?;
            return store.get(&key).cloned().ok_or_else(|| AppError::KeychainError {
                message: "读取 API 密钥失败: 密钥可能不存在".to_string(),
            });
        }

        #[cfg(not(test))]
        {
            let entry = Entry::new(SERVICE_NAME, &account).map_err(|e| AppError::KeychainError {
                message: format!("创建密钥链条目失败: {}", e),
            })?;

            let api_key = entry
                .get_password()
                .map_err(|e| AppError::KeychainError {
                    message: format!("读取 API 密钥失败: {}. 密钥可能不存在", e),
                })?;

            log::debug!("成功从系统密钥链读取 API 密钥");
            Ok(api_key)
        }
    }

    /// 从系统密钥链删除 API 密钥
    ///
    /// # 参数
    /// - `config_id`: API 配置 ID
    ///
    /// # 返回
    /// - `Ok(())`: 成功删除
    /// - `Err(AppError)`: 删除失败
    pub fn delete_api_key(config_id: i64) -> AppResult<()> {
        let account = Self::get_account_name(config_id);

        log::info!("正在从系统密钥链删除 API 密钥: {}", account);

        #[cfg(test)]
        {
            let key = Self::test_store_key(&account);
            let mut store = Self::test_store().lock().map_err(|_| AppError::KeychainError {
                message: "删除 API 密钥失败: 测试密钥链存储锁定失败".to_string(),
            })?;
            if store.remove(&key).is_some() {
                return Ok(());
            }
            return Err(AppError::KeychainError {
                message: "删除 API 密钥失败: 密钥可能不存在".to_string(),
            });
        }

        #[cfg(not(test))]
        {
            let entry = Entry::new(SERVICE_NAME, &account).map_err(|e| AppError::KeychainError {
                message: format!("创建密钥链条目失败: {}", e),
            })?;

            entry
                .delete_password()
                .map_err(|e| AppError::KeychainError {
                    message: format!("删除 API 密钥失败: {}", e),
                })?;

            log::info!("API 密钥已成功从系统密钥链删除");
            Ok(())
        }
    }

    /// 检查 API 密钥是否存在
    ///
    /// # 参数
    /// - `config_id`: API 配置 ID
    ///
    /// # 返回
    /// - `true`: 密钥存在
    /// - `false`: 密钥不存在
    pub fn has_api_key(config_id: i64) -> bool {
        Self::get_api_key(config_id).is_ok()
    }

    /// 更新 API 密钥 (实际上是重新存储)
    ///
    /// # 参数
    /// - `config_id`: API 配置 ID
    /// - `new_api_key`: 新的 API 密钥
    ///
    /// # 返回
    /// - `Ok(())`: 成功更新
    /// - `Err(AppError)`: 更新失败
    pub fn update_api_key(config_id: i64, new_api_key: &str) -> AppResult<()> {
        // 直接调用 set_password 会自动覆盖旧密钥
        Self::set_api_key(config_id, new_api_key)
    }

    /// 批量删除 API 密钥
    ///
    /// # 参数
    /// - `config_ids`: API 配置 ID 列表
    ///
    /// # 返回
    /// - 成功删除的配置 ID 列表和失败的配置 ID 列表
    pub fn batch_delete_api_keys(config_ids: &[i64]) -> (Vec<i64>, Vec<i64>) {
        let mut succeeded = Vec::new();
        let mut failed = Vec::new();

        for &config_id in config_ids {
            match Self::delete_api_key(config_id) {
                Ok(_) => succeeded.push(config_id),
                Err(e) => {
                    log::warn!("删除配置 {} 的 API 密钥失败: {}", config_id, e);
                    failed.push(config_id);
                }
            }
        }

        (succeeded, failed)
    }

    /// 获取密钥链账户名称
    /// 格式: api_config_{config_id}
    fn get_account_name(config_id: i64) -> String {
        format!("api_config_{}", config_id)
    }

    /// 获取服务名称
    pub fn get_service_name() -> &'static str {
        SERVICE_NAME
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_account_name() {
        assert_eq!(KeychainManager::get_account_name(1), "api_config_1");
        assert_eq!(KeychainManager::get_account_name(123), "api_config_123");
    }

    #[test]
    fn test_get_service_name() {
        assert_eq!(KeychainManager::get_service_name(), "claude-code-proxy");
    }

    #[test]
    fn test_set_and_get_api_key() {
        let config_id = 999;
        let api_key = "sk-test-key-12345";

        // 清理可能存在的旧数据
        let _ = KeychainManager::delete_api_key(config_id);

        // 存储密钥
        let result = KeychainManager::set_api_key(config_id, api_key);
        assert!(result.is_ok(), "存储 API 密钥失败: {:?}", result);

        // 读取密钥
        let retrieved = KeychainManager::get_api_key(config_id);
        assert!(retrieved.is_ok(), "读取 API 密钥失败: {:?}", retrieved);
        assert_eq!(retrieved.unwrap(), api_key);

        // 清理
        let result = KeychainManager::delete_api_key(config_id);
        assert!(result.is_ok(), "删除 API 密钥失败: {:?}", result);
    }

    #[test]
    fn test_has_api_key() {
        let config_id = 998;

        // 清理
        let _ = KeychainManager::delete_api_key(config_id);

        // 密钥不存在
        assert!(!KeychainManager::has_api_key(config_id));

        // 存储密钥
        KeychainManager::set_api_key(config_id, "test-key").unwrap();

        // 密钥存在
        assert!(KeychainManager::has_api_key(config_id));

        // 清理
        KeychainManager::delete_api_key(config_id).unwrap();
    }

    #[test]
    fn test_update_api_key() {
        let config_id = 997;
        let old_key = "sk-old-key";
        let new_key = "sk-new-key";

        // 清理
        let _ = KeychainManager::delete_api_key(config_id);

        // 存储旧密钥
        KeychainManager::set_api_key(config_id, old_key).unwrap();

        // 更新密钥
        KeychainManager::update_api_key(config_id, new_key).unwrap();

        // 验证新密钥
        let retrieved = KeychainManager::get_api_key(config_id).unwrap();
        assert_eq!(retrieved, new_key);

        // 清理
        KeychainManager::delete_api_key(config_id).unwrap();
    }

    #[test]
    fn test_delete_nonexistent_key() {
        let config_id = 996;

        // 确保密钥不存在
        let _ = KeychainManager::delete_api_key(config_id);

        // 尝试删除不存在的密钥
        let result = KeychainManager::delete_api_key(config_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_delete() {
        let config_ids = vec![991, 992, 993];

        // 清理并创建测试数据
        for &id in &config_ids {
            let _ = KeychainManager::delete_api_key(id);
            KeychainManager::set_api_key(id, "test-key").unwrap();
        }

        // 批量删除
        let (succeeded, failed) = KeychainManager::batch_delete_api_keys(&config_ids);

        assert_eq!(succeeded.len(), 3);
        assert_eq!(failed.len(), 0);

        // 验证已删除
        for &id in &config_ids {
            assert!(!KeychainManager::has_api_key(id));
        }
    }
}
