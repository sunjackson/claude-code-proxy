use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// GitHub Release 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub name: String,
    pub body: String,
    pub html_url: String,
    pub published_at: String,
    pub assets: Vec<GithubAsset>,
}

/// GitHub Release Asset 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: i64,
    pub content_type: String,
}

/// 应用版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppVersionInfo {
    /// 当前版本
    pub current_version: String,
    /// 最新版本
    pub latest_version: Option<String>,
    /// 是否有更新
    pub has_update: bool,
    /// 发布说明
    pub release_notes: Option<String>,
    /// 下载链接
    pub download_url: Option<String>,
    /// 发布页面链接
    pub release_page_url: Option<String>,
    /// 发布时间
    pub published_at: Option<String>,
}

/// 应用更新服务
pub struct AppUpdater {
    /// GitHub 仓库 owner
    owner: String,
    /// GitHub 仓库名称
    repo: String,
    /// 当前版本
    current_version: String,
}

impl AppUpdater {
    /// 创建新的更新服务实例
    pub fn new(owner: String, repo: String, current_version: String) -> Self {
        Self {
            owner,
            repo,
            current_version,
        }
    }

    /// 检查更新
    pub async fn check_for_updates(&self) -> Result<AppVersionInfo, String> {
        log::info!("开始检查应用更新...");

        // 获取最新的 Release
        let latest_release = self.fetch_latest_release().await?;

        // 提取版本号（去掉 'v' 前缀）
        let latest_version = latest_release.tag_name.trim_start_matches('v').to_string();

        // 比较版本
        let has_update = self.compare_versions(&self.current_version, &latest_version)?;

        // 获取适合当前平台的下载链接
        let download_url = self.get_platform_download_url(&latest_release.assets);

        log::info!(
            "版本检查完成: 当前={}, 最新={}, 有更新={}",
            self.current_version,
            latest_version,
            has_update
        );

        Ok(AppVersionInfo {
            current_version: self.current_version.clone(),
            latest_version: Some(latest_version),
            has_update,
            release_notes: Some(latest_release.body),
            download_url,
            release_page_url: Some(latest_release.html_url),
            published_at: Some(latest_release.published_at),
        })
    }

    /// 从 GitHub API 获取最新 Release
    async fn fetch_latest_release(&self) -> Result<GithubRelease, String> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/releases/latest",
            self.owner, self.repo
        );

        log::debug!("请求 GitHub API: {}", url);

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("User-Agent", "claude-code-proxy")
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await
            .map_err(|e| format!("请求 GitHub API 失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("GitHub API 返回错误状态: {}", response.status()));
        }

        let release: GithubRelease = response
            .json()
            .await
            .map_err(|e| format!("解析 GitHub Release 数据失败: {}", e))?;

        Ok(release)
    }

    /// 比较两个版本号
    /// 返回 true 表示 latest 版本更新
    fn compare_versions(&self, current: &str, latest: &str) -> Result<bool, String> {
        let current_parts = self.parse_version(current)?;
        let latest_parts = self.parse_version(latest)?;

        let cmp = Self::version_cmp(&current_parts, &latest_parts);
        Ok(cmp == Ordering::Less)
    }

    /// 解析版本号字符串为数字数组
    fn parse_version(&self, version: &str) -> Result<Vec<u32>, String> {
        version
            .split('.')
            .map(|part| {
                part.parse::<u32>()
                    .map_err(|_| format!("无效的版本号格式: {}", version))
            })
            .collect()
    }

    /// 比较版本号数组
    fn version_cmp(v1: &[u32], v2: &[u32]) -> Ordering {
        let max_len = v1.len().max(v2.len());

        for i in 0..max_len {
            let part1 = v1.get(i).copied().unwrap_or(0);
            let part2 = v2.get(i).copied().unwrap_or(0);

            match part1.cmp(&part2) {
                Ordering::Less => return Ordering::Less,
                Ordering::Greater => return Ordering::Greater,
                Ordering::Equal => continue,
            }
        }

        Ordering::Equal
    }

    /// 获取适合当前平台的下载链接
    fn get_platform_download_url(&self, assets: &[GithubAsset]) -> Option<String> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        log::debug!("当前平台: OS={}, ARCH={}", platform, arch);

        // 根据平台选择对应的安装包
        let pattern = match platform {
            "macos" => {
                if arch == "aarch64" {
                    vec!["aarch64.dmg", "arm64.dmg", "darwin-aarch64", "macos-arm"]
                } else {
                    vec!["x64.dmg", "x86_64.dmg", "darwin-x64", "macos-x64"]
                }
            }
            "windows" => {
                if arch == "x86_64" {
                    vec!["x64-setup.exe", "x64.msi", "win64", "windows-x64"]
                } else {
                    vec!["x86-setup.exe", "x86.msi", "win32", "windows-x86"]
                }
            }
            "linux" => {
                if arch == "x86_64" {
                    vec![".AppImage", "amd64.deb", "x86_64.rpm", "linux-x64"]
                } else if arch == "aarch64" {
                    vec!["arm64.deb", "aarch64.rpm", "linux-arm64"]
                } else {
                    vec!["linux"]
                }
            }
            _ => {
                log::warn!("未知平台: {}", platform);
                return None;
            }
        };

        // 查找匹配的资源
        for asset in assets {
            let name_lower = asset.name.to_lowercase();
            for p in &pattern {
                if name_lower.contains(p) {
                    log::info!("找到匹配的安装包: {}", asset.name);
                    return Some(asset.browser_download_url.clone());
                }
            }
        }

        log::warn!("未找到适合当前平台的安装包");
        None
    }

    /// 下载更新包
    pub async fn download_update(&self, url: &str, save_path: &str) -> Result<(), String> {
        log::info!("开始下载更新: {} -> {}", url, save_path);

        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("下载失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("下载失败,状态码: {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("读取下载内容失败: {}", e))?;

        std::fs::write(save_path, bytes)
            .map_err(|e| format!("保存文件失败: {}", e))?;

        log::info!("下载完成: {}", save_path);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        let updater = AppUpdater::new(
            "test".to_string(),
            "test".to_string(),
            "1.0.0".to_string(),
        );

        // 测试版本比较
        assert!(updater.compare_versions("1.0.0", "1.0.1").unwrap());
        assert!(updater.compare_versions("1.0.0", "1.1.0").unwrap());
        assert!(updater.compare_versions("1.0.0", "2.0.0").unwrap());
        assert!(!updater.compare_versions("1.0.1", "1.0.0").unwrap());
        assert!(!updater.compare_versions("1.0.0", "1.0.0").unwrap());
    }

    #[test]
    fn test_parse_version() {
        let updater = AppUpdater::new(
            "test".to_string(),
            "test".to_string(),
            "1.0.0".to_string(),
        );

        let parts = updater.parse_version("1.2.3").unwrap();
        assert_eq!(parts, vec![1, 2, 3]);

        let parts = updater.parse_version("1.0.0").unwrap();
        assert_eq!(parts, vec![1, 0, 0]);
    }
}
