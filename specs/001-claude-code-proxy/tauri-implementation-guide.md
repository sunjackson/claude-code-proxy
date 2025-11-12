# Tauri 技术栈实现指南

**项目**: Claude Code 代理服务管理应用
**推荐框架**: Tauri + React + Rust
**日期**: 2025-11-08

---

## 快速开始

### 前置条件

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js 18+
node --version  # v18.0.0+

# 安装 pnpm (可选，但推荐)
npm install -g pnpm

# 安装 Tauri CLI
npm install -g @tauri-apps/cli
```

### 项目初始化

```bash
# 使用 Tauri 官方模板
npm create tauri-app@latest -- \
  --project-name claude-code-router \
  --package-name com.sunjackson.claude-code-router \
  --typescript \
  --react \
  --window-data

cd claude-code-router

# 安装依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建发布
pnpm tauri build
```

---

## 项目结构详解

### 完整项目树

```
claude-code-router/
├── src/                              # 前端 React 代码
│   ├── components/
│   │   ├── Dashboard.tsx            # 主控制面板
│   │   ├── ConfigManager.tsx        # 配置管理界面
│   │   ├── GroupSelector.tsx        # 分组选择器
│   │   ├── ApiTestPanel.tsx         # API 测试面板
│   │   ├── EnvironmentVars.tsx      # 环境变量管理
│   │   ├── Recommendations.tsx      # 推荐服务导航
│   │   ├── ProxyStatus.tsx          # 代理状态显示
│   │   └── SettingsPanel.tsx        # 应用设置
│   ├── pages/
│   │   ├── Home.tsx                 # 首页
│   │   ├── Logs.tsx                 # 日志页面
│   │   └── About.tsx                # 关于页面
│   ├── services/
│   │   ├── api.ts                   # 与后端通信 (IPC)
│   │   ├── i18n.ts                  # 国际化配置
│   │   └── store.ts                 # 全局状态 (Zustand)
│   ├── types/
│   │   └── index.ts                 # TypeScript 类型定义
│   ├── styles/
│   │   └── globals.css              # 全局样式 (黑金配色)
│   ├── locales/
│   │   ├── zh-CN.json               # 中文语言包
│   │   └── en-US.json               # 英文语言包
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                        # Tauri 后端代码 (Rust)
│   ├── src/
│   │   ├── main.rs                  # 应用入口
│   │   ├── proxy/
│   │   │   ├── mod.rs               # 代理模块
│   │   │   ├── server.rs            # HTTP 代理服务器
│   │   │   ├── router.rs            # 请求路由
│   │   │   └── health_check.rs      # 健康检查
│   │   ├── config/
│   │   │   ├── mod.rs               # 配置管理模块
│   │   │   ├── manager.rs           # 配置 CRUD
│   │   │   └── storage.rs           # 文件持久化
│   │   ├── claude/
│   │   │   ├── mod.rs               # Claude Code 集成
│   │   │   ├── detector.rs          # 配置文件检测
│   │   │   ├── modifier.rs          # 配置文件修改
│   │   │   └── backup.rs            # 备份和恢复
│   │   ├── system/
│   │   │   ├── mod.rs               # 系统集成模块
│   │   │   ├── env.rs               # 环境变量管理
│   │   │   └── paths.rs             # 跨平台路径
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── test.rs              # API 测试服务
│   │   │   ├── switcher.rs          # 自动切换服务
│   │   │   └── recommendations.rs   # 推荐服务加载
│   │   └── commands.rs              # Tauri IPC 命令
│   ├── Cargo.toml                   # Rust 依赖配置
│   ├── tauri.conf.json              # Tauri 配置文件
│   ├── build.rs                     # 构建脚本
│   └── icons/                       # 应用图标
├── .github/
│   └── workflows/
│       └── publish.yml              # CI/CD 发布流程
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 前端技术栈配置

### package.json 配置

```json
{
  "name": "claude-code-router",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@tauri-apps/api": "^1.5.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.1",
    "react-i18next": "^13.4.0",
    "i18next": "^23.7.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.292.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^0.34.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.5.0",
    "eslint": "^8.54.0",
    "@typescript-eslint/parser": "^6.10.0",
    "@typescript-eslint/eslint-plugin": "^6.10.0"
  }
}
```

### Tailwind CSS 黑金配色主题

```javascript
// tailwind.config.js
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 黑金配色方案
        dark: {
          50: "#f5f5f5",
          100: "#e0e0e0",
          200: "#bdbdbd",
          300: "#9e9e9e",
          400: "#757575",
          500: "#616161",
          600: "#424242",
          700: "#212121",
          800: "#121212",
          900: "#000000",
        },
        gold: {
          50: "#fef9f0",
          100: "#fdf0d8",
          200: "#fce1b8",
          300: "#fad697",
          400: "#f8c657",
          500: "#d4af37", // 经典黄金色
          600: "#c99f2e",
          700: "#b8911f",
          800: "#947c1f",
          900: "#6b5a1f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
}
```

### 全局样式

```css
/* src/styles/globals.css */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

:root {
  /* 颜色变量 */
  --color-dark: #121212;
  --color-darker: #000000;
  --color-gold: #d4af37;
  --color-gold-light: #f8c657;
  --color-text: #e0e0e0;
  --color-text-secondary: #9e9e9e;
  --color-border: #424242;
  --color-bg-secondary: #212121;
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-error: #f44336;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* 阴影 */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: linear-gradient(135deg, #121212 0%, #1a1a1a 100%);
  color: var(--color-text);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--color-gold);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-gold-light);
}

/* 按钮样式基类 */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  user-select: none;
}

.btn-primary {
  background: var(--color-gold);
  color: var(--color-dark);
}

.btn-primary:hover {
  background: var(--color-gold-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  border-color: var(--color-gold);
  color: var(--color-gold);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 输入框样式 */
input, select, textarea {
  background: var(--color-bg-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--color-gold);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}

/* 卡片样式 */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.card:hover {
  border-color: var(--color-gold);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.1);
}
```

### 国际化配置

```typescript
// src/services/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: 'zh-CN', // 默认语言
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
```

```json
// src/locales/zh-CN.json
{
  "app": {
    "title": "Claude Code 代理服务管理",
    "version": "v0.1.0"
  },
  "nav": {
    "dashboard": "仪表盘",
    "config": "配置管理",
    "settings": "设置",
    "logs": "日志",
    "about": "关于"
  },
  "proxy": {
    "status": "代理状态",
    "running": "运行中",
    "stopped": "已停止",
    "port": "监听端口",
    "start": "启动代理",
    "stop": "停止代理"
  },
  "config": {
    "title": "API 配置管理",
    "add": "添加配置",
    "edit": "编辑",
    "delete": "删除",
    "name": "配置名称",
    "apiKey": "API 密钥",
    "server": "服务器地址",
    "port": "端口",
    "group": "分组"
  },
  "group": {
    "title": "分组管理",
    "createNew": "创建新分组",
    "ungrouped": "未分组",
    "autoSwitch": "启用自动切换",
    "latencyThreshold": "延迟阈值 (ms)"
  },
  "test": {
    "title": "API 测试",
    "testConnection": "测试连接",
    "testing": "测试中...",
    "latency": "延迟",
    "status": "状态",
    "success": "成功",
    "failed": "失败"
  }
}
```

```json
// src/locales/en-US.json
{
  "app": {
    "title": "Claude Code Proxy Manager",
    "version": "v0.1.0"
  },
  "nav": {
    "dashboard": "Dashboard",
    "config": "Configurations",
    "settings": "Settings",
    "logs": "Logs",
    "about": "About"
  },
  "proxy": {
    "status": "Proxy Status",
    "running": "Running",
    "stopped": "Stopped",
    "port": "Listen Port",
    "start": "Start Proxy",
    "stop": "Stop Proxy"
  },
  "config": {
    "title": "API Configuration",
    "add": "Add Config",
    "edit": "Edit",
    "delete": "Delete",
    "name": "Config Name",
    "apiKey": "API Key",
    "server": "Server Address",
    "port": "Port",
    "group": "Group"
  },
  "group": {
    "title": "Group Management",
    "createNew": "Create Group",
    "ungrouped": "Ungrouped",
    "autoSwitch": "Enable Auto Switch",
    "latencyThreshold": "Latency Threshold (ms)"
  },
  "test": {
    "title": "API Test",
    "testConnection": "Test Connection",
    "testing": "Testing...",
    "latency": "Latency",
    "status": "Status",
    "success": "Success",
    "failed": "Failed"
  }
}
```

### 全局状态管理 (Zustand)

```typescript
// src/services/store.ts
import create from 'zustand';

export interface ApiConfig {
  id: string;
  name: string;
  apiKey: string;
  server: string;
  port: number;
  groupId: string;
  order: number;
  lastTestLatency?: number;
  lastTestTime?: string;
}

export interface ConfigGroup {
  id: string;
  name: string;
  description: string;
  enableAutoSwitch: boolean;
  configs: ApiConfig[];
}

export interface AppState {
  groups: ConfigGroup[];
  currentGroupId: string;
  currentConfigId: string;
  proxyStatus: 'running' | 'stopped';
  language: 'zh-CN' | 'en-US';

  // 操作
  addGroup: (group: ConfigGroup) => void;
  deleteGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<ConfigGroup>) => void;
  setCurrentGroup: (groupId: string) => void;

  addConfig: (groupId: string, config: ApiConfig) => void;
  deleteConfig: (groupId: string, configId: string) => void;
  updateConfig: (groupId: string, configId: string, updates: Partial<ApiConfig>) => void;
  setCurrentConfig: (configId: string) => void;

  setProxyStatus: (status: 'running' | 'stopped') => void;
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
}

export const useStore = create<AppState>((set) => ({
  groups: [],
  currentGroupId: 'default',
  currentConfigId: '',
  proxyStatus: 'stopped',
  language: 'zh-CN',

  addGroup: (group) => set((state) => ({
    groups: [...state.groups, group]
  })),

  deleteGroup: (groupId) => set((state) => ({
    groups: state.groups.filter(g => g.id !== groupId)
  })),

  updateGroup: (groupId, updates) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId ? { ...g, ...updates } : g
    )
  })),

  setCurrentGroup: (groupId) => set({ currentGroupId: groupId }),

  addConfig: (groupId, config) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId
        ? { ...g, configs: [...g.configs, config] }
        : g
    )
  })),

  deleteConfig: (groupId, configId) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId
        ? { ...g, configs: g.configs.filter(c => c.id !== configId) }
        : g
    )
  })),

  updateConfig: (groupId, configId, updates) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId
        ? {
            ...g,
            configs: g.configs.map(c =>
              c.id === configId ? { ...c, ...updates } : c
            )
          }
        : g
    )
  })),

  setCurrentConfig: (configId) => set({ currentConfigId: configId }),
  setProxyStatus: (status) => set({ proxyStatus: status }),
  setLanguage: (lang) => set({ language: lang }),
}));
```

### IPC 通信 API

```typescript
// src/services/api.ts
import { invoke } from '@tauri-apps/api/tauri';
import { ApiConfig, ConfigGroup } from './store';

export const api = {
  // 代理服务
  proxy: {
    start: async (groupId: string, configId: string) => {
      return invoke<{ port: number }>('proxy_start', {
        groupId,
        configId,
      });
    },
    stop: async () => {
      return invoke<void>('proxy_stop');
    },
    status: async () => {
      return invoke<{ running: boolean; port: number }>('proxy_status');
    },
  },

  // 配置管理
  config: {
    loadAll: async () => {
      return invoke<{ groups: ConfigGroup[] }>('config_load_all');
    },
    saveAll: async (groups: ConfigGroup[]) => {
      return invoke<void>('config_save_all', { groups });
    },
    addGroup: async (group: ConfigGroup) => {
      return invoke<void>('config_add_group', { group });
    },
    deleteGroup: async (groupId: string) => {
      return invoke<void>('config_delete_group', { groupId });
    },
  },

  // Claude Code 集成
  claude: {
    detectConfigPath: async () => {
      return invoke<{ path: string | null }>('claude_detect_config_path');
    },
    applyLocalProxy: async (port: number) => {
      return invoke<{ success: boolean; error?: string }>(
        'claude_apply_local_proxy',
        { port }
      );
    },
    restoreOriginalConfig: async () => {
      return invoke<{ success: boolean; error?: string }>(
        'claude_restore_original_config'
      );
    },
  },

  // API 测试
  test: {
    testConnection: async (config: ApiConfig) => {
      return invoke<{
        success: boolean;
        latency: number;
        error?: string;
      }>('test_connection', { config });
    },
    testAll: async (groupId: string) => {
      return invoke<{ results: Array<{ configId: string; latency: number; success: boolean }> }>(
        'test_all',
        { groupId }
      );
    },
  },

  // 环境变量
  env: {
    getAll: async () => {
      return invoke<Record<string, string>>('env_get_all');
    },
    set: async (key: string, value: string) => {
      return invoke<void>('env_set', { key, value });
    },
    delete: async (key: string) => {
      return invoke<void>('env_delete', { key });
    },
  },

  // 推荐服务
  recommendations: {
    load: async () => {
      return invoke<{
        services: Array<{
          name: string;
          url: string;
          recommended: boolean;
          hotness: number;
        }>;
      }>('recommendations_load');
    },
  },

  // 系统
  system: {
    openUrl: async (url: string) => {
      return invoke<void>('system_open_url', { url });
    },
  },
};
```

---

## 后端 Rust 技术栈配置

### Cargo.toml 配置

```toml
# src-tauri/Cargo.toml
[package]
name = "claude-code-router"
version = "0.1.0"
description = "Claude Code Proxy Manager"
authors = ["Your Name"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["shell-open", "fs-all"] }
tokio = { version = "1.35", features = ["full"] }
hyper = { version = "0.14", features = ["full"] }
tower = { version = "0.4" }
tower-http = { version = "0.5", features = ["trace", "cors"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio-util = "0.7"
bytes = "1.5"
http = "0.2"
http-body-util = "0.1"
reqwest = { version = "0.11", features = ["json"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
tracing-subscriber = "0.3"
thiserror = "1.0"
anyhow = "1.0"
regex = "1.10"

[profile.release]
opt-level = "z"        # 最小化体积
lto = true              # 链接时间优化
codegen-units = 1
```

### HTTP 代理服务器核心实现

```rust
// src-tauri/src/proxy/server.rs
use hyper::{
    service::{make_service_fn, service_fn},
    Body, Client, Request, Response, Server, StatusCode,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;

pub type SharedConfig = Arc<RwLock<CurrentConfig>>;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CurrentConfig {
    pub target_url: String,
    pub api_key: String,
}

pub struct ProxyServer {
    addr: SocketAddr,
    config: SharedConfig,
}

impl ProxyServer {
    pub fn new(port: u16, config: SharedConfig) -> Self {
        let addr = ([127, 0, 0, 1], port).into();
        Self { addr, config }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.clone();

        let make_svc = make_service_fn(move |_conn| {
            let config = config.clone();
            async move {
                Ok::<_, hyper::Error>(service_fn(move |req| {
                    let config = config.clone();
                    handle_request(req, config)
                }))
            }
        });

        let server = Server::bind(&self.addr)
            .serve(make_svc)
            .with_graceful_shutdown(async {
                // 优雅关闭信号
                tokio::signal::ctrl_c().await.ok();
            });

        println!("代理服务运行在 http://{}", self.addr);

        server.await?;
        Ok(())
    }
}

async fn handle_request(
    mut req: Request<Body>,
    config: SharedConfig,
) -> Result<Response<Body>, hyper::Error> {
    let config_guard = config.read().await;
    let target_url = &config_guard.target_url;
    let api_key = &config_guard.api_key;

    // 构建目标请求 URL
    let path_query = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");
    let new_uri = format!("{}{}", target_url, path_query);

    // 添加认证头
    req.headers_mut().insert(
        "authorization",
        format!("Bearer {}", api_key)
            .parse()
            .unwrap_or_else(|_| "".parse().unwrap()),
    );

    // 转发请求
    let client = Client::new();
    match client.request(req).await {
        Ok(res) => {
            // 记录请求信息用于日志
            println!("请求成功: {} -> {}", path_query, target_url);
            Ok(res)
        }
        Err(e) => {
            eprintln!("代理转发错误: {}", e);
            // 返回 502 Bad Gateway
            Ok(Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::from(format!("代理错误: {}", e)))
                .unwrap())
        }
    }
}
```

### 配置管理模块

```rust
// src-tauri/src/config/manager.rs
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub id: String,
    pub name: String,
    pub api_key: String,
    pub server: String,
    pub port: u16,
    pub group_id: String,
    pub order: u32,
    pub last_test_latency: Option<u32>,
    pub last_test_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigGroup {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enable_auto_switch: bool,
    pub configs: Vec<ApiConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub app_settings: AppSettings,
    pub groups: Vec<ConfigGroup>,
    pub current_group_id: String,
    pub current_config_id: String,
    pub backups: Vec<BackupRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: String,
    pub default_port: u16,
    pub latency_threshold: u32,
    pub remote_recommendations_url: Option<String>,
    pub local_recommendations_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub timestamp: String,
    pub path: String,
}

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(config_dir: PathBuf) -> Self {
        let config_path = config_dir.join("config.json");
        Self { config_path }
    }

    pub fn load(&self) -> Result<AppConfig, Box<dyn std::error::Error>> {
        if self.config_path.exists() {
            let content = fs::read_to_string(&self.config_path)?;
            let config = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            Ok(AppConfig::default())
        }
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(config)?;
        fs::create_dir_all(self.config_path.parent().unwrap())?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    pub fn add_group(&self, mut config: AppConfig, group: ConfigGroup) -> AppConfig {
        config.groups.push(group);
        config
    }

    pub fn delete_group(&self, mut config: AppConfig, group_id: &str) -> AppConfig {
        config.groups.retain(|g| g.id != group_id);
        config
    }

    pub fn add_config(
        &self,
        mut config: AppConfig,
        group_id: &str,
        new_config: ApiConfig,
    ) -> AppConfig {
        if let Some(group) = config.groups.iter_mut().find(|g| g.id == group_id) {
            group.configs.push(new_config);
        }
        config
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        let default_group = ConfigGroup {
            id: Uuid::new_v4().to_string(),
            name: "未分组".to_string(),
            description: "默认分组".to_string(),
            enable_auto_switch: false,
            configs: vec![],
        };

        Self {
            app_settings: AppSettings {
                language: "zh-CN".to_string(),
                default_port: 25341,
                latency_threshold: 3000,
                remote_recommendations_url: None,
                local_recommendations_path: None,
            },
            groups: vec![default_group],
            current_group_id: String::new(),
            current_config_id: String::new(),
            backups: vec![],
        }
    }
}
```

### Claude Code 集成模块

```rust
// src-tauri/src/claude/detector.rs
use std::path::PathBuf;

#[cfg(target_os = "windows")]
pub fn detect_claude_config_path() -> Option<PathBuf> {
    use std::env;

    // Windows: %APPDATA%\.claude-code\config.json
    if let Ok(app_data) = env::var("APPDATA") {
        let path = PathBuf::from(app_data)
            .join(".claude-code")
            .join("config.json");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

#[cfg(target_os = "macos")]
pub fn detect_claude_config_path() -> Option<PathBuf> {
    use std::env;

    // macOS: ~/Library/Application Support/.claude-code/config.json
    if let Ok(home) = env::var("HOME") {
        let path = PathBuf::from(home)
            .join("Library/Application Support/.claude-code/config.json");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

#[cfg(target_os = "linux")]
pub fn detect_claude_config_path() -> Option<PathBuf> {
    use std::env;

    // Linux: ~/.config/.claude-code/config.json
    if let Ok(home) = env::var("HOME") {
        let path = PathBuf::from(home)
            .join(".config/.claude-code/config.json");
        if path.exists() {
            return Some(path);
        }
    }
    None
}
```

### Tauri IPC 命令

```rust
// src-tauri/src/commands.rs
use tauri::State;
use crate::config::AppConfig;
use crate::proxy::SharedConfig;

#[tauri::command]
pub async fn proxy_start(
    group_id: String,
    config_id: String,
    app_state: State<'_, Arc<RwLock<AppConfig>>>,
    proxy_config: State<'_, SharedConfig>,
) -> Result<serde_json::Value, String> {
    // 实现代理启动逻辑
    Ok(serde_json::json!({ "port": 25341 }))
}

#[tauri::command]
pub async fn proxy_stop() -> Result<(), String> {
    // 实现代理停止逻辑
    Ok(())
}

#[tauri::command]
pub async fn config_load_all(
    app_state: State<'_, Arc<RwLock<AppConfig>>>,
) -> Result<serde_json::Value, String> {
    let config = app_state.read().await;
    Ok(serde_json::to_value(&*config).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn claude_detect_config_path() -> Result<Option<String>, String> {
    use crate::claude::detector::detect_claude_config_path;

    Ok(detect_claude_config_path().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn test_connection(config: serde_json::Value) -> Result<serde_json::Value, String> {
    // 实现连接测试逻辑
    Ok(serde_json::json!({ "success": true, "latency": 250 }))
}
```

---

## 项目初始化步骤

### 1. 创建项目

```bash
npm create tauri-app@latest -- \
  --project-name claude-code-router \
  --package-name com.sunjackson.claude-code-router \
  --typescript true \
  --react true

cd claude-code-router
```

### 2. 安装前端依赖

```bash
pnpm install
pnpm add -D tailwindcss postcss autoprefixer
pnpm add zustand react-i18next i18next axios lucide-react clsx
pnpm add -D @testing-library/react @testing-library/user-event vitest
```

### 3. 配置 Tailwind CSS

```bash
npx tailwindcss init -p
```

编辑 `tailwind.config.js` 使用上述黑金配色方案

### 4. 构建 Rust 后端

```bash
cd src-tauri
cargo add tokio --features full
cargo add hyper --features full
cargo add serde_json
cargo add uuid --features v4,serde
cargo add chrono --features serde
cargo add reqwest --features json
```

### 5. 启动开发环境

```bash
cd ..
pnpm tauri dev
```

---

## 测试策略

### 后端单元测试

```rust
// src-tauri/src/proxy/server.rs 底部
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_proxy_request_forwarding() {
        // 测试代理转发逻辑
    }

    #[tokio::test]
    async fn test_api_key_injection() {
        // 测试 API 密钥注入
    }
}
```

### 前端集成测试

```typescript
// src/__tests__/api.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { api } from '../services/api';

describe('API Integration', () => {
  it('should load all configs', async () => {
    const result = await api.config.loadAll();
    expect(result.groups).toBeDefined();
  });

  it('should detect claude config path', async () => {
    const result = await api.claude.detectConfigPath();
    expect(typeof result.path === 'string' || result.path === null).toBe(true);
  });
});
```

---

## 性能优化建议

### 代理服务性能优化

1. **异步请求处理**: 使用 tokio 充分利用多核
2. **连接池**: 实现 HTTP 连接复用
3. **缓存**: 缓存常用配置避免重复加载
4. **日志级别**: 生产环境使用 WARN 级别日志

### UI 性能优化

1. **虚拟列表**: 大量配置时使用虚拟滚动
2. **React.memo**: 避免不必要的重新渲染
3. **代码分割**: 按需加载各个页面组件
4. **资源优化**: 压缩图片和资源文件

---

## 部署和发布

### 打包应用

```bash
pnpm tauri build

# 输出文件位置:
# src-tauri/target/release/bundle/
#   ├── macos/          # macOS .dmg
#   ├── deb/            # Linux .deb
#   ├── rpm/            # Linux .rpm
#   ├── appimage/       # Linux AppImage
#   └── msi/            # Windows .msi
```

### 配置自动更新

```json
// src-tauri/tauri.conf.json
{
  "build": {
    "beforeBuildCommand": "",
    "beforeDevCommand": "",
    "devPath": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "updater": {
    "active": true,
    "endpoints": [
      "https://releases.example.com/updates/{{target}}/{{current_version}}"
    ],
    "dialog": true,
    "pubkey": "your_public_key_here"
  }
}
```

---

## 总结

这个 Tauri + React + Rust 的技术栈提供了:

✅ **性能**: 启动 <1 秒, 内存占用 30-80MB
✅ **包体积**: 50-80MB (相比 Electron 节省 70%)
✅ **UI 开发效率**: 使用熟悉的 React + Tailwind CSS
✅ **系统集成**: Rust 提供最强大的系统 API 访问
✅ **跨平台**: 完美支持 Windows/macOS/Linux
✅ **国际化**: react-i18next 提供完整的 i18n 解决方案

**预计开发周期**: 28-38 天 (单人全栈开发)
