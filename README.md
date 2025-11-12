# Claude Code 代理服务管理应用

一个跨平台桌面应用程序,用于管理 Claude Code 的本地代理服务,实现 API 请求的智能路由、自动故障切换和配置管理。

## 功能特性

- 🔌 **一键配置** - 自动检测并配置 Claude Code 使用本地代理
- 🗂️ **分组管理** - 支持多个 API 中转站配置的分组隔离
- ⚡ **自动切换** - 分组内自动负载均衡和故障切换
- 🧪 **连接测试** - API 连接性和延迟测试
- 💾 **配置备份** - Claude Code 配置自动备份和恢复
- 🌐 **国际化** - 支持中文/英文界面
- 🌟 **服务导航** - 推荐服务导航页面

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Vite
- **后端**: Rust + Tauri
- **代理服务器**: Hyper + Tokio (异步 HTTP 代理)
- **数据库**: SQLite
- **密钥存储**: System Keychain (DPAPI/Keychain/Secret Service)
- **状态管理**: Zustand
- **国际化**: i18next

## 快速开始

### 环境要求

- **Node.js** 18+ 和 npm/pnpm
- **Rust** 1.70+ 和 Cargo
- **操作系统**: Windows 10+, macOS 11+, 或 Linux

### 安装依赖

#### 1. 安装 Rust

**macOS / Linux**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Windows**:
下载并运行 [rustup-init.exe](https://rustup.rs/)

验证安装:
```bash
rustc --version
cargo --version
```

#### 2. 安装 Node.js

推荐使用 [nvm](https://github.com/nvm-sh/nvm):
```bash
nvm install 18
nvm use 18
```

验证安装:
```bash
node --version  # v18.x.x
npm --version   # 9.x.x
```

#### 3. 安装 Tauri CLI

```bash
cargo install tauri-cli
```

> **注意**: Tauri CLI 首次安装需要 5-10 分钟，因为需要从源码编译。

#### 4. 安装系统依赖

**macOS**: 无需额外依赖

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libsqlite3-dev
```

**Windows**:
安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
选择 "Desktop development with C++" 工作负载

### 安装项目依赖

```bash
# 克隆仓库
git clone https://github.com/your-org/claude-code-router.git
cd claude-code-router

# 安装前端依赖
cd src-ui
npm install  # 或 pnpm install

cd ..
```

### 开发模式运行

#### 方式 1: 一键启动（推荐）

使用项目根目录的启动脚本:

```bash
./start-dev.sh
```

此脚本会自动:
- ✅ 检查开发环境 (Node.js, npm, Rust, Cargo)
- ✅ 检查并安装前端依赖
- ✅ 清理端口占用
- ✅ 启动 Vite 开发服务器
- ✅ 启动 Tauri 应用窗口

#### 方式 2: 手动启动

**选项 A - 使用 Tauri CLI（自动启动前端）**:
```bash
cd src-tauri
cargo tauri dev
```

**选项 B - 分别启动前后端**:

**终端 1 - 启动前端开发服务器**:
```bash
cd src-ui
npm run dev
```

**终端 2 - 启动 Tauri 应用**:
```bash
cd src-tauri
cargo tauri dev
```

> **注意**: 首次运行时,Rust 依赖编译可能需要 5-10 分钟。

### 构建生产版本

```bash
# 构建前端
cd src-ui
npm run build

# 构建 Tauri 应用
cd ../src-tauri
cargo tauri build
```

构建输出:
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/deb/`

## 项目结构

```
claude-code-router/
├── src-tauri/              # Rust 后端(Tauri)
│   ├── src/
│   │   ├── main.rs         # 应用入口
│   │   ├── commands/       # Tauri Commands(IPC 接口)
│   │   ├── services/       # 业务服务
│   │   ├── models/         # 数据模型
│   │   ├── db/             # SQLite 数据库
│   │   ├── proxy/          # HTTP 代理服务器
│   │   └── utils/          # 工具函数
│   ├── Cargo.toml          # Rust 依赖配置
│   └── tauri.conf.json     # Tauri 应用配置
│
├── src-ui/                 # React 前端
│   ├── src/
│   │   ├── App.tsx         # 应用根组件
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用组件
│   │   ├── hooks/          # React Hooks
│   │   ├── store/          # Zustand 状态管理
│   │   ├── locales/        # 国际化文件
│   │   └── styles/         # Tailwind CSS
│   ├── package.json        # Node.js 依赖配置
│   └── vite.config.ts      # Vite 构建配置
│
└── specs/                  # 规格文档
```

## 开发指南

### 代码规范

- **Rust**: 使用 `cargo fmt` 格式化代码,`cargo clippy` 检查代码质量
- **TypeScript**: 使用 `npm run lint` 和 `npm run format`

### 运行测试

```bash
# Rust 单元测试
cd src-tauri
cargo test

# 前端单元测试
cd src-ui
npm run test

# 测试覆盖率
npm run test:coverage
```

### 调试技巧

查看详细调试指南: [quickstart.md](./specs/001-claude-code-proxy/quickstart.md)

## 文档

- [功能规格说明](./specs/001-claude-code-proxy/spec.md)
- [实施计划](./specs/001-claude-code-proxy/plan.md)
- [数据模型](./specs/001-claude-code-proxy/data-model.md)
- [API 合约](./specs/001-claude-code-proxy/contracts/)
- [任务分解](./specs/001-claude-code-proxy/tasks.md)
- [快速开始指南](./specs/001-claude-code-proxy/quickstart.md)

## 贡献

欢迎贡献!请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

## 许可证

[MIT License](./LICENSE)

## 联系方式

如有问题,请在项目 Issues 中提问。

---

**版本**: 1.0.0
**状态**: 开发中
**最后更新**: 2025-11-09
