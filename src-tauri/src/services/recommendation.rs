/**
 * 推荐服务管理服务
 * 负责加载、缓存和管理推荐服务列表
 */

use crate::models::error::{AppError, AppResult};
use crate::models::provider_preset::{ProviderConfig, ProviderPreset};
use crate::models::recommended_service::{RecommendedService, ServiceSource};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

/// 推荐服务列表容器（用于 JSON 反序列化）
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecommendedServiceList {
    services: Vec<RecommendedServiceItem>,
}

/// 推荐服务项目（JSON 格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecommendedServiceItem {
    site_name: String,
    promotion_url: String,
    #[serde(default)]
    is_recommended: bool,
    #[serde(default)]
    hotness_score: i32,
    #[serde(default = "default_region")]
    region: String,
    #[serde(default)]
    description: String,
}

fn default_region() -> String {
    "domestic".to_string()
}

/// 缓存数据
#[derive(Debug, Clone)]
struct CacheData {
    services: Vec<RecommendedService>,
    cached_at: u64,
    ttl_sec: u64,
}

impl CacheData {
    /// 检查缓存是否过期
    fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now - self.cached_at > self.ttl_sec
    }
}

/// 将 ProviderPreset 转换为 RecommendedService
fn provider_to_recommended(provider: &ProviderPreset, loaded_at: String, source: ServiceSource) -> RecommendedService {
    RecommendedService {
        id: provider.id.as_bytes().iter().fold(0i64, |acc, &b| acc.wrapping_add(b as i64)),
        site_name: provider.name.clone(),
        promotion_url: provider.website_url.clone(),
        is_recommended: provider.is_recommended,
        hotness_score: provider.hotness_score.clamp(0, 100),
        region: provider.region.clone(),
        description: provider.description.clone().unwrap_or_default(),
        source,
        loaded_at,
    }
}

/// 推荐服务管理服务
pub struct RecommendationService {
    /// 远程 JSON URL
    remote_url: Option<String>,
    /// 本地 JSON 路径
    local_path: Option<PathBuf>,
    /// 缓存 TTL (秒)
    cache_ttl: u64,
    /// 缓存数据
    cache: Arc<Mutex<Option<CacheData>>>,
}

impl RecommendationService {
    /// 创建新的推荐服务管理服务
    pub fn new(
        remote_url: Option<String>,
        local_path: Option<PathBuf>,
        cache_ttl: u64,
    ) -> Self {
        Self {
            remote_url,
            local_path,
            cache_ttl,
            cache: Arc::new(Mutex::new(None)),
        }
    }

    /// 加载推荐服务列表
    ///
    /// # Arguments
    /// - `force_refresh`: 是否强制刷新，忽略缓存
    ///
    /// # Returns
    /// - 推荐服务列表
    pub async fn load_services(&self, force_refresh: bool) -> AppResult<Vec<RecommendedService>> {
        // 检查缓存
        if !force_refresh {
            let cache = self.cache.lock().unwrap();
            if let Some(cached_data) = cache.as_ref() {
                if !cached_data.is_expired() {
                    log::info!("使用缓存的推荐服务列表");
                    return Ok(cached_data.services.clone());
                }
            }
        }

        // 尝试从远程加载
        let result = if let Some(url) = &self.remote_url {
            log::info!("尝试从远程加载推荐服务: {}", url);
            match self.load_remote(url).await {
                Ok(services) => {
                    log::info!("成功从远程加载 {} 个推荐服务", services.len());
                    self.update_cache(services.clone());
                    Ok(services)
                }
                Err(e) => {
                    log::error!("从远程加载失败: {}, 回退到本地", e);
                    // 回退到本地
                    self.load_local()
                }
            }
        } else {
            log::info!("未配置远程 URL，直接从本地加载");
            self.load_local()
        };

        result
    }

    /// 从远程 URL 加载推荐服务
    async fn load_remote(&self, url: &str) -> AppResult<Vec<RecommendedService>> {
        // 使用 reqwest 进行 HTTP 请求
        let response = reqwest::get(url).await.map_err(|e| AppError::ServiceError {
            message: format!("HTTP 请求失败: {}", e),
        })?;

        if !response.status().is_success() {
            return Err(AppError::ServiceError {
                message: format!("HTTP 请求失败: 状态码 {}", response.status()),
            });
        }

        let list: RecommendedServiceList = response.json().await.map_err(|e| {
            AppError::ServiceError {
                message: format!("解析 JSON 失败: {}", e),
            }
        })?;

        let loaded_at = chrono::Utc::now().to_rfc3339();
        let services = list
            .services
            .into_iter()
            .enumerate()
            .map(|(i, item)| RecommendedService {
                id: (i + 1) as i64,
                site_name: item.site_name,
                promotion_url: item.promotion_url,
                is_recommended: item.is_recommended,
                hotness_score: item.hotness_score.clamp(0, 100),
                region: item.region,
                description: item.description,
                source: ServiceSource::Remote,
                loaded_at: loaded_at.clone(),
            })
            .collect();

        Ok(services)
    }

    /// 从本地文件加载推荐服务
    fn load_local(&self) -> AppResult<Vec<RecommendedService>> {
        let path = self.local_path.as_ref().ok_or_else(|| AppError::ServiceError {
            message: "未配置本地推荐服务文件路径".to_string(),
        })?;

        if !path.exists() {
            return Err(AppError::ServiceError {
                message: format!("本地推荐服务文件不存在: {:?}", path),
            });
        }

        let content = std::fs::read_to_string(path).map_err(|e| AppError::ServiceError {
            message: format!("读取本地文件失败: {}", e),
        })?;

        let loaded_at = chrono::Utc::now().to_rfc3339();

        // 尝试解析为 ProviderConfig (新格式)
        if let Ok(provider_config) = serde_json::from_str::<ProviderConfig>(&content) {
            let services: Vec<RecommendedService> = provider_config
                .providers
                .iter()
                .filter(|provider| provider.show_in_recommendations)
                .map(|provider| provider_to_recommended(provider, loaded_at.clone(), ServiceSource::Local))
                .collect();

            log::info!("成功从本地加载 {} 个推荐服务 (providers.json 格式)", services.len());
            self.update_cache(services.clone());
            return Ok(services);
        }

        // 回退到旧格式 (recommendations.json)
        let list: RecommendedServiceList =
            serde_json::from_str(&content).map_err(|e| AppError::ServiceError {
                message: format!("解析本地 JSON 失败: {}", e),
            })?;

        let services: Vec<RecommendedService> = list
            .services
            .into_iter()
            .enumerate()
            .map(|(i, item)| RecommendedService {
                id: (i + 1) as i64,
                site_name: item.site_name,
                promotion_url: item.promotion_url,
                is_recommended: item.is_recommended,
                hotness_score: item.hotness_score.clamp(0, 100),
                region: item.region,
                description: item.description,
                source: ServiceSource::Local,
                loaded_at: loaded_at.clone(),
            })
            .collect();

        log::info!("成功从本地加载 {} 个推荐服务 (旧格式)", services.len());
        self.update_cache(services.clone());
        Ok(services)
    }

    /// 更新缓存
    fn update_cache(&self, services: Vec<RecommendedService>) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let cache_data = CacheData {
            services,
            cached_at: now,
            ttl_sec: self.cache_ttl,
        };

        let mut cache = self.cache.lock().unwrap();
        *cache = Some(cache_data);
    }

    /// 清空缓存
    pub fn clear_cache(&self) {
        let mut cache = self.cache.lock().unwrap();
        *cache = None;
        log::info!("已清空推荐服务缓存");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_expiration() {
        let cache = CacheData {
            services: vec![],
            cached_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
                - 3700, // 1 小时前
            ttl_sec: 3600,
        };

        assert!(cache.is_expired());

        let cache2 = CacheData {
            services: vec![],
            cached_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            ttl_sec: 3600,
        };

        assert!(!cache2.is_expired());
    }
}
