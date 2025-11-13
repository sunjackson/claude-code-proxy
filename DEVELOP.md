# Claude Code Proxy 开发文档

本文档提供详细的开发指南，帮助开发者理解项目架构、配置开发环境、编写和测试代码。

---

## 目录

- [技术栈](#技术栈)
- [开发环境配置](#开发环境配置)
- [项目架构](#项目架构)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)
- [API 文档](#api-文档)
- [常见开发问题](#常见开发问题)
- [发布流程](#发布流程)

---

## 技术栈

### 后端 (Rust + Tauri)

- **Tauri 2.0** - 跨平台桌面应用框架
- **Tokio** - 异步运行时
- **Hyper** - HTTP 代理服务器
- **SQLite / Rusqlite** - 本地数据库
- **Serde** - 序列化/反序列化
- **Keyring** - 系统密钥链集成
- **Anyhow** - 错误处理

### 前端 (React + TypeScript)

- **React 18** - UI 框架
- **TypeScript 5** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **React Router** - 路由管理
- **i18next** - 国际化
- **Zustand** - 状态管理（如需）

---

## 开发环境配置

### 1. 安装必需工具

#### Rust 工具链

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 配置环境变量
source $HOME/.cargo/env

# 验证安装
rustc --version  # 应显示 1.70+
cargo --version
```

#### Node.js 和 npm

```bash
# 使用 nvm 管理 Node.js 版本（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js 18
nvm install 18
nvm use 18

# 验证安装
node --version  # 应显示 v18.x.x
npm --version   # 应显示 9.x.x
```

#### Tauri CLI

```bash
# 全局安装 Tauri CLI
cargo install tauri-cli

# 验证安装
cargo tauri --version
```

### 2. 系统依赖

#### macOS

```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 安装 Homebrew（如果还没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libsqlite3-dev \
  pkg-config
```

#### Windows

1. 安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. 选择 "Desktop development with C++" 工作负载
3. 确保安装了 Windows 10 SDK

### 3. 克隆并初始化项目

```bash
# 克隆仓库
git clone https://github.com/your-org/claude-code-proxy.git
cd claude-code-proxy

# 安装前端依赖
cd src-ui
npm install
cd ..

# 首次运行（会自动编译 Rust 依赖）
./start-dev.sh
```

### 4. IDE 配置

#### VS Code（推荐）

推荐安装以下扩展：

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",      // Rust 语言支持
    "tauri-apps.tauri-vscode",      // Tauri 支持
    "dbaeumer.vscode-eslint",       // ESLint
    "esbenp.prettier-vscode",       // Prettier
    "bradlc.vscode-tailwindcss",    // Tailwind CSS
    "ms-vscode.vscode-typescript-next" // TypeScript
  ]
}
```

#### IntelliJ IDEA / CLion

1. 安装 Rust 插件
2. 安装 JavaScript 和 TypeScript 插件
3. 导入项目并选择 Cargo 构建系统

---

## 项目架构

### 目录结构

```
claude-code-proxy/
├── src-tauri/                 # Rust 后端
│   ├── src/
│   │   ├── main.rs            # 应用入口，初始化 Tauri
│   │   ├── tray.rs            # 系统托盘
│   │   ├── commands/          # Tauri Commands (前后端 IPC)
│   │   │   ├── mod.rs
│   │   │   ├── api_config.rs  # API 配置管理命令
│   │   │   ├── auto_switch.rs # 自动切换命令
│   │   │   ├── balance.rs     # 余额查询命令
│   │   │   └── env_var.rs     # 环境变量命令
│   │   ├── services/          # 业务逻辑层
│   │   │   ├── mod.rs
│   │   │   ├── api_config.rs  # API 配置服务
│   │   │   ├── api_test.rs    # API 测试服务
│   │   │   ├── auto_switch.rs # 自动切换服务
│   │   │   ├── balance_service.rs # 余额查询服务
│   │   │   ├── backup.rs      # 备份服务
│   │   │   ├── claude_config.rs # Claude Code 配置
│   │   │   ├── proxy_service.rs # 代理服务
│   │   │   └── keychain.rs    # 密钥链服务
│   │   ├── models/            # 数据模型
│   │   │   ├── mod.rs
│   │   │   ├── api_config.rs
│   │   │   ├── config_group.rs
│   │   │   ├── balance.rs
│   │   │   └── ...
│   │   ├── db/                # 数据库操作
│   │   │   ├── mod.rs
│   │   │   ├── init.rs        # 数据库初始化
│   │   │   ├── pool.rs        # 连接池
│   │   │   ├── schema.sql     # 数据库 schema
│   │   │   └── migrations/    # 数据库迁移
│   │   ├── proxy/             # HTTP 代理服务器
│   │   │   ├── mod.rs
│   │   │   ├── server.rs      # 代理服务器实现
│   │   │   └── router.rs      # 请求路由
│   │   └── utils/             # 工具函数
│   │       ├── mod.rs
│   │       └── paths.rs       # 路径工具
│   ├── Cargo.toml             # Rust 依赖配置
│   ├── tauri.conf.json        # Tauri 应用配置
│   └── capabilities/          # Tauri 权限配置
│
├── src-ui/                    # React 前端
│   ├── src/
│   │   ├── App.tsx            # 应用根组件
│   │   ├── main.tsx           # 前端入口
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ConfigManagement.tsx
│   │   │   ├── ClaudeCodeIntegration.tsx
│   │   │   ├── Recommendations.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/        # UI 组件
│   │   │   ├── AppLayout.tsx  # 应用布局
│   │   │   ├── Header.tsx     # 头部
│   │   │   ├── Sidebar.tsx    # 侧边栏
│   │   │   ├── ConfigEditor.tsx
│   │   │   ├── GroupEditor.tsx
│   │   │   └── ...
│   │   ├── hooks/             # React Hooks
│   │   │   ├── useAutoSwitch.ts
│   │   │   ├── useLanguage.ts
│   │   │   └── ...
│   │   ├── api/               # API 调用（与后端通信）
│   │   │   ├── config.ts      # 配置 API
│   │   │   ├── proxy.ts       # 代理 API
│   │   │   ├── balance.ts     # 余额 API
│   │   │   └── ...
│   │   ├── types/             # TypeScript 类型定义
│   │   │   └── tauri.ts
│   │   ├── locales/           # 国际化文件
│   │   │   ├── en.json        # 英文
│   │   │   └── zh-CN.json     # 中文
│   │   ├── styles/            # 全局样式
│   │   │   └── theme.css
│   │   └── utils/             # 工具函数
│   ├── package.json
│   ├── vite.config.ts         # Vite 配置
│   ├── tsconfig.json          # TypeScript 配置
│   └── tailwind.config.js     # Tailwind CSS 配置
│
├── config/                    # 应用配置
│   ├── providers.json         # 服务提供商预设
│   └── recommendations.json   # 推荐服务
│
├── scripts/                   # 开发脚本
│   ├── start-dev.sh           # 开发启动脚本
│   ├── start.sh               # 生产启动脚本
│   ├── build.sh               # 构建脚本
│   ├── migrate-database.sh    # 数据库迁移
│   └── replace-logo.sh        # Logo 替换
│
├── specs/                     # 设计文档
│   └── 001-claude-code-proxy/
│       ├── spec.md            # 功能规格
│       ├── plan.md            # 实施计划
│       ├── data-model.md      # 数据模型
│       ├── tasks.md           # 任务分解
│       └── quickstart.md      # 快速开始
│
├── .gitignore                 # Git 忽略配置
├── README.md                  # 项目说明
├── DEVELOP.md                 # 开发文档（本文件）
├── CHANGELOG.md               # 更新日志
├── BUILD_AND_PACKAGE.md       # 构建打包指南
└── LOGO_REPLACEMENT_GUIDE.md  # Logo 替换指南
```

### 架构模式

#### 后端架构 (Tauri + Rust)

```
┌─────────────────────────────────────────────────┐
│              Tauri Window (WebView)             │
│                   前端 React                     │
└─────────────────────────────────────────────────┘
                        ↕ IPC (Commands)
┌─────────────────────────────────────────────────┐
│              Commands Layer                     │
│      (api_config, proxy, balance, etc.)        │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│             Services Layer                      │
│    (业务逻辑、数据验证、错误处理)                 │
└─────────────────────────────────────────────────┘
                        ↓
┌──────────────┬──────────────┬───────────────────┐
│   Database   │  Keychain    │  HTTP Proxy       │
│   (SQLite)   │  (Secure)    │  (Hyper/Tokio)    │
└──────────────┴──────────────┴───────────────────┘
```

#### 前端架构 (React)

```
┌─────────────────────────────────────────────────┐
│                  App.tsx                        │
│            (路由和全局状态)                       │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│              Pages (页面组件)                     │
│   Dashboard, ConfigManagement, Settings, etc.   │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│          Components (UI 组件)                    │
│   Header, Sidebar, ConfigEditor, etc.          │
└─────────────────────────────────────────────────┘
                        ↓
┌──────────────┬──────────────┬───────────────────┐
│     API      │    Hooks     │     Utils         │
│  (Tauri IPC) │  (业务逻辑)   │   (工具函数)       │
└──────────────┴──────────────┴───────────────────┘
```

---

## 开发流程

### 1. 开发新功能

#### 步骤 1: 创建特性分支

```bash
git checkout -b feature/your-feature-name
```

#### 步骤 2: 后端开发 (Rust)

**a. 定义数据模型** (`src-tauri/src/models/`)

```rust
// src-tauri/src/models/your_model.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YourModel {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}
```

**b. 实现服务逻辑** (`src-tauri/src/services/`)

```rust
// src-tauri/src/services/your_service.rs
use crate::models::YourModel;
use crate::db::pool::DbPool;

pub fn create_item(pool: &DbPool, name: String) -> Result<YourModel, String> {
    // 实现业务逻辑
    Ok(YourModel {
        id: 1,
        name,
        created_at: chrono::Utc::now().to_string(),
    })
}
```

**c. 添加 Tauri Command** (`src-tauri/src/commands/`)

```rust
// src-tauri/src/commands/your_command.rs
use crate::services::your_service;
use crate::db::pool::DbPool;
use tauri::State;

#[tauri::command]
pub async fn create_item(
    name: String,
    pool: State<'_, DbPool>,
) -> Result<YourModel, String> {
    your_service::create_item(&pool, name)
}
```

**d. 注册 Command** (`src-tauri/src/main.rs`)

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... 其他 commands
            commands::your_command::create_item,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 步骤 3: 前端开发 (React + TypeScript)

**a. 定义 API 调用** (`src-ui/src/api/`)

```typescript
// src-ui/src/api/your-api.ts
import { invoke } from '@tauri-apps/api/tauri';
import type { YourModel } from '../types/tauri';

export async function createItem(name: string): Promise<YourModel> {
  return await invoke('create_item', { name });
}
```

**b. 创建组件** (`src-ui/src/components/`)

```typescript
// src-ui/src/components/YourComponent.tsx
import React, { useState } from 'react';
import * as yourApi from '../api/your-api';

export const YourComponent: React.FC = () => {
  const [name, setName] = useState('');

  const handleCreate = async () => {
    try {
      const item = await yourApi.createItem(name);
      console.log('Created:', item);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleCreate}>创建</button>
    </div>
  );
};
```

#### 步骤 4: 测试

```bash
# 后端测试
cd src-tauri
cargo test

# 前端测试
cd src-ui
npm run test

# 手动测试
./start-dev.sh
```

#### 步骤 5: 提交代码

```bash
# 格式化代码
cd src-tauri
cargo fmt
cd ../src-ui
npm run format

# 提交
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 2. 修复 Bug

```bash
# 创建 bugfix 分支
git checkout -b bugfix/issue-description

# 修复问题并添加测试
# ...

# 提交
git commit -m "fix: description of the fix"
git push origin bugfix/issue-description
```

---

## 代码规范

### Rust 代码规范

#### 格式化

使用 `rustfmt` 自动格式化：

```bash
cd src-tauri
cargo fmt
```

#### Lint

使用 `clippy` 进行代码检查：

```bash
cd src-tauri
cargo clippy -- -D warnings
```

#### 命名约定

- **文件名**: `snake_case.rs`
- **模块名**: `snake_case`
- **结构体**: `PascalCase`
- **函数**: `snake_case`
- **常量**: `SCREAMING_SNAKE_CASE`

#### 示例

```rust
// 好的示例
pub struct ApiConfig {
    pub id: i64,
    pub server_url: String,
}

pub fn create_api_config(name: String) -> Result<ApiConfig, String> {
    // ...
}

const MAX_RETRY_COUNT: u32 = 3;

// 避免的示例
struct apiconfig { ... }  // ❌ 应该用 PascalCase
fn CreateApiConfig() { ... }  // ❌ 应该用 snake_case
```

### TypeScript/React 代码规范

#### 格式化

使用 Prettier：

```bash
cd src-ui
npm run format
```

#### Lint

使用 ESLint：

```bash
cd src-ui
npm run lint
```

#### 命名约定

- **文件名**: `PascalCase.tsx` (组件), `camelCase.ts` (工具)
- **组件**: `PascalCase`
- **函数**: `camelCase`
- **常量**: `SCREAMING_SNAKE_CASE`
- **类型/接口**: `PascalCase`

#### 示例

```typescript
// 好的示例
interface ApiConfig {
  id: number;
  serverUrl: string;
}

export const ConfigEditor: React.FC<Props> = ({ config }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    // ...
  };

  return <div>...</div>;
};

const MAX_CONFIGS = 10;

// 避免的示例
interface apiconfig { ... }  // ❌ 应该用 PascalCase
function config_editor() { ... }  // ❌ 应该用 PascalCase
const Max_Configs = 10;  // ❌ 应该用 SCREAMING_SNAKE_CASE
```

---

## 测试指南

### Rust 单元测试

```rust
// src-tauri/src/services/your_service.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_item() {
        let result = create_item("test".to_string());
        assert!(result.is_ok());
    }
}
```

运行测试：

```bash
cd src-tauri
cargo test
```

### 前端单元测试

```typescript
// src-ui/src/components/YourComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { YourComponent } from './YourComponent';

test('renders component', () => {
  render(<YourComponent />);
  expect(screen.getByText(/创建/i)).toBeInTheDocument();
});
```

运行测试：

```bash
cd src-ui
npm run test
```

---

## 调试技巧

### 后端调试

#### 1. 使用 println! / dbg!

```rust
println!("Debug: value = {:?}", value);
dbg!(&value);
```

#### 2. 使用 Rust 调试器

VS Code `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Tauri",
      "cargo": {
        "args": ["build", "--manifest-path=src-tauri/Cargo.toml"]
      }
    }
  ]
}
```

### 前端调试

#### 1. Chrome DevTools

右键 → 检查元素 → Console/Sources

#### 2. VS Code 调试

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src-ui/src"
    }
  ]
}
```

### 日志配置

后端日志级别设置：

```rust
use log::{info, debug, error};

fn main() {
    env_logger::init();

    info!("Application started");
    debug!("Debug information");
    error!("Error occurred");
}
```

设置环境变量：

```bash
RUST_LOG=debug ./start-dev.sh
```

---

## API 文档

### Tauri Commands

所有前后端通信都通过 Tauri Commands 实现。

#### 配置管理 API

**创建配置**

```rust
#[tauri::command]
async fn create_api_config(
    name: String,
    server_url: String,
    api_key: String,
    // ...
) -> Result<ApiConfig, String>
```

**列出配置**

```rust
#[tauri::command]
async fn list_api_configs(
    group_id: Option<i64>,
) -> Result<Vec<ApiConfig>, String>
```

详细 API 文档请参阅：`specs/001-claude-code-proxy/contracts/`

---

## 常见开发问题

### Q: 修改 Rust 代码后不生效？

**A**: 重新编译 Tauri：

```bash
cd src-tauri
cargo clean
cargo tauri dev
```

### Q: 前端修改不生效？

**A**: 清除缓存并重启：

```bash
cd src-ui
rm -rf node_modules dist .vite
npm install
npm run dev
```

### Q: 数据库 schema 变更后如何迁移？

**A**: 创建新的迁移文件：

```bash
./migrate-database.sh
```

---

## 发布流程

### 1. 更新版本号

```bash
# 更新 src-tauri/tauri.conf.json
{
  "package": {
    "version": "1.1.0"
  }
}

# 更新 src-tauri/Cargo.toml
[package]
version = "1.1.0"

# 更新 src-ui/package.json
{
  "version": "1.1.0"
}
```

### 2. 更新 CHANGELOG.md

```markdown
## [1.1.0] - 2025-01-20

### Added
- 新功能 1
- 新功能 2

### Fixed
- 修复 Bug 1
- 修复 Bug 2
```

### 3. 构建发布版本

```bash
./build.sh
```

### 4. 创建 Git Tag

```bash
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin v1.1.0
```

### 5. 创建 GitHub Release

1. 访问 GitHub Releases 页面
2. 点击"Draft a new release"
3. 选择 tag: `v1.1.0`
4. 填写 Release notes
5. 上传构建产物（DMG, MSI, DEB）
6. 发布 Release

---

## 工具脚本说明

### start-dev.sh

开发模式启动脚本，自动完成：
- 环境检查
- 依赖安装
- 端口清理
- 启动开发服务器

```bash
./start-dev.sh
```

### build.sh

生产构建脚本：

```bash
# 默认：构建并打包
./build.sh

# 只编译，不打包
./build.sh --current

# 清理后构建
./build.sh --clean
```

### migrate-database.sh

数据库迁移脚本：

```bash
./migrate-database.sh
```

### replace-logo.sh

Logo 替换脚本：

```bash
./replace-logo.sh /path/to/your-logo.png
```

---

## 性能优化建议

### Rust 后端

1. 使用 `cargo build --release` 构建优化版本
2. 避免不必要的 `clone()`
3. 使用异步操作处理 I/O
4. 合理使用数据库连接池

### React 前端

1. 使用 `React.memo` 避免不必要的重渲染
2. 懒加载路由组件
3. 优化图片资源
4. 使用虚拟滚动处理长列表

---

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 遵循代码规范
4. 添加测试
5. 提交 Pull Request

---

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)

---

## 联系方式

- **开发者讨论**: [GitHub Discussions](https://github.com/your-org/claude-code-proxy/discussions)
- **Bug 报告**: [GitHub Issues](https://github.com/your-org/claude-code-proxy/issues)

---

**Happy Coding! 🚀**
