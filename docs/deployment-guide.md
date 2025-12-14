# ClaudeCodeProxy 部署指南

> **重要说明**: 这是一个 **Tauri 桌面应用**，后端是嵌入在应用中的 Rust 代码，而不是独立部署的服务器。

---

## 📋 目录

1. [开发环境运行](#1-开发环境运行)
2. [生产环境构建](#2-生产环境构建)
3. [安装和分发](#3-安装和分发)
4. [自动化发布](#4-自动化发布)
5. [常见问题](#5-常见问题)

---

## 1. 开发环境运行

### 📦 环境准备

**必需工具：**
- Node.js 18+ 和 npm
- Rust 1.70+ 和 Cargo
- Tauri CLI

**系统依赖（Linux）：**
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.0-dev build-essential libssl-dev libgtk-3-dev libsqlite3-dev

# Fedora/RHEL
sudo dnf install webkit2gtk3-devel openssl-devel gtk3-devel sqlite-devel

# Arch Linux
sudo pacman -S webkit2gtk base-devel openssl gtk3 sqlite
```

### 🚀 一键启动（推荐）

**最简单的方式 - 使用自动化脚本：**

```bash
# 克隆项目
git clone https://github.com/sunjackson/claude-code-proxy.git
cd claude-code-proxy

# 一键启动开发环境（会自动检测和安装依赖）
./start-dev.sh
```

**脚本功能：**
- ✅ 自动检测操作系统
- ✅ 自动检查并安装缺失的工具（Node.js、Rust、Tauri CLI）
- ✅ 自动安装前端依赖
- ✅ 自动清理端口占用
- ✅ 自动启动前端开发服务器（Vite）
- ✅ 自动启动后端（Rust）
- ✅ 自动打开应用窗口

**启动后访问：**
- 前端开发服务器：`http://localhost:5173`
- 代理服务端口：`15341`（开发环境）
- 应用窗口自动打开

**停止服务：**
```bash
# 按 Ctrl+C 停止，脚本会自动清理进程
```

### 🔧 手动启动

如果你想手动控制启动过程：

```bash
# 1. 安装前端依赖
cd src-ui
npm install
cd ..

# 2. 启动 Tauri 开发环境
cd src-tauri
cargo tauri dev
```

---

## 2. 生产环境构建

### 🏗️ 使用构建脚本（推荐）

**完整构建（前端+后端+打包）：**

```bash
# 默认构建当前平台的安装包
./build.sh

# 这会执行：
# 1. 检查依赖
# 2. 构建前端（npm run build）
# 3. 构建后端（cargo build --release）
# 4. 打包成安装包（.dmg/.msi/.deb/.AppImage）
```

**构建选项：**

```bash
# 只查看帮助
./build.sh --help

# 清理构建产物
./build.sh --clean

# 只安装依赖
./build.sh --deps

# 只编译可执行文件（不打包）
./build.sh --current

# 交叉编译指定平台
./build.sh --platform macos    # macOS (x86_64 + ARM64)
./build.sh --platform windows  # Windows (x64)
./build.sh --platform linux    # Linux (x64)
./build.sh --platform all      # 所有平台

# 安装已构建的应用到系统
./build.sh --install
```

### 📦 构建产物位置

构建完成后，安装包位于：

```
src-tauri/target/release/bundle/
├── dmg/                    # macOS 磁盘镜像
│   └── *.dmg
├── macos/                  # macOS 应用包
│   └── ClaudeCodeProxy.app
├── msi/                    # Windows 安装包
│   └── *.msi
├── deb/                    # Debian/Ubuntu 包
│   └── *.deb
├── rpm/                    # RedHat/Fedora 包
│   └── *.rpm
└── appimage/              # Linux AppImage
    └── *.AppImage
```

### 🔨 手动构建

如果需要手动控制每个步骤：

```bash
# 1. 构建前端
cd src-ui
npm install
npm run build
cd ..

# 2. 使用 Tauri CLI 构建
cd src-tauri
cargo tauri build

# 或者只构建后端可执行文件
cargo build --release
```

---

## 3. 安装和分发

### 💻 macOS

**方式 1: 使用 DMG（推荐）**
```bash
# 1. 构建 DMG
./build.sh

# 2. 打开 DMG
open src-tauri/target/release/bundle/dmg/*.dmg

# 3. 拖拽到 Applications 文件夹
```

**方式 2: 直接安装**
```bash
# 构建并自动安装
./build.sh && ./build.sh --install

# 这会：
# 1. 关闭正在运行的应用
# 2. 删除旧版本
# 3. 复制新版本到 /Applications
# 4. 询问是否启动
```

**签名和公证（可选）：**
```bash
# 需要 Apple Developer 账号
# 在 tauri.conf.json 中配置：
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name",
        "entitlements": "entitlements.plist"
      }
    }
  }
}
```

### 🪟 Windows

**方式 1: MSI 安装包**
```bash
# 1. 构建 MSI
./build.sh

# 2. 分发安装包
src-tauri/target/release/bundle/msi/*.msi

# 用户双击安装即可
```

**方式 2: 便携版**
```bash
# 只构建可执行文件
./build.sh --current

# 分发单个 exe 文件
src-tauri/target/release/claude-code-proxy.exe
```

### 🐧 Linux

**Debian/Ubuntu (.deb):**
```bash
# 1. 构建 deb 包
./build.sh

# 2. 安装
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb

# 或自动安装脚本
./build.sh --install
```

**RedHat/Fedora (.rpm):**
```bash
sudo rpm -i src-tauri/target/release/bundle/rpm/*.rpm
```

**AppImage（通用）:**
```bash
# 1. 构建
./build.sh

# 2. 添加执行权限
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage

# 3. 直接运行
./src-tauri/target/release/bundle/appimage/*.AppImage
```

---

## 4. 自动化发布

### 🤖 GitHub Actions 自动构建

项目配置了 GitHub Actions，在推送 tag 时自动构建所有平台版本。

**发布新版本：**

```bash
# 1. 更新版本号（3个文件）
# - src-tauri/tauri.conf.json
# - src-tauri/Cargo.toml
# - src-ui/package.json

# 2. 提交代码
git add .
git commit -m "chore: bump version to 1.2.1"
git push

# 3. 使用发布脚本（自动检查+创建tag）
./release.sh v1.2.1

# 这会：
# ✅ 检查当前分支（必须在 master/main）
# ✅ 检查工作区是否干净
# ✅ 验证版本号格式
# ✅ 创建 git tag
# ✅ 推送到 GitHub
# ✅ 触发 GitHub Actions 构建
```

**GitHub Actions 自动执行：**
1. ✅ 构建 macOS (Intel + Apple Silicon)
2. ✅ 构建 Windows (x64)
3. ✅ 构建 Linux (x64)
4. ✅ 创建 GitHub Release (草稿)
5. ✅ 上传所有安装包

**查看构建进度：**
- Actions: https://github.com/sunjackson/claude-code-proxy/actions
- Releases: https://github.com/sunjackson/claude-code-proxy/releases

**发布流程：**
1. 推送 tag 后，等待 45-60 分钟自动构建
2. 访问 Releases 页面
3. 编辑草稿 Release
4. 添加 Release Notes
5. 点击 "Publish release" 发布

---

## 5. 常见问题

### ❓ 数据库文件在哪里？

**开发环境：**
```
~/.claude-code-proxy/database.db
```

**生产环境（不同平台）：**
```
macOS:   ~/Library/Application Support/com.sunjackson.claude-code-proxy/
Windows: C:\Users\<用户>\AppData\Roaming\com.sunjackson.claude-code-proxy\
Linux:   ~/.local/share/com.sunjackson.claude-code-proxy/
```

**注意：**
- 构建时不包含数据库文件
- 用户首次启动应用时会自动创建新数据库
- 数据库会自动执行迁移到最新版本

### ❓ 如何修改代理端口？

**开发环境：**
在 `start-dev.sh` 中修改：
```bash
DEV_PROXY_PORT=15341  # 修改这里
```

**生产环境：**
在 `src-tauri/src/utils/constants.rs` 中修改：
```rust
pub fn default_proxy_port() -> u16 {
    25341  // 修改这里
}
```

然后重新构建。

### ❓ 跨平台构建失败？

**问题：** 在 macOS 上无法构建 Windows 版本

**解决方案：**
1. 使用 GitHub Actions 自动构建（推荐）
2. 在对应平台上构建
3. 使用 Docker 容器进行交叉编译

### ❓ 构建后应用无法启动？

**检查清单：**
1. ✅ 是否安装了必需的系统依赖？
2. ✅ 端口是否被占用？（默认 25341）
3. ✅ 是否有权限访问数据目录？
4. ✅ 查看日志文件（通常在数据目录）

### ❓ 如何减小安装包体积？

**优化建议：**

```bash
# 1. 前端优化
cd src-ui
npm run build  # 已启用压缩

# 2. 后端优化（Cargo.toml）
[profile.release]
opt-level = "z"      # 优化体积
lto = true           # 启用 LTO
codegen-units = 1    # 单编译单元
strip = true         # 去除符号表

# 3. 重新构建
./build.sh
```

### ❓ 如何调试生产构建？

```bash
# 1. 构建 Debug 版本
cd src-tauri
cargo tauri build --debug

# 2. 查看日志
# macOS
tail -f ~/Library/Logs/com.sunjackson.claude-code-proxy/claude-code-proxy.log

# Linux
journalctl -f -u claude-code-proxy
```

---

## 🔗 相关资源

- **项目地址**: https://github.com/sunjackson/claude-code-proxy
- **问题反馈**: https://github.com/sunjackson/claude-code-proxy/issues
- **Tauri 文档**: https://tauri.app/v1/guides/building/
- **发布页面**: https://github.com/sunjackson/claude-code-proxy/releases

---

## 📝 快速命令参考

```bash
# 开发环境
./start-dev.sh                      # 一键启动开发环境

# 构建
./build.sh                          # 构建当前平台安装包
./build.sh --current                # 只构建可执行文件
./build.sh --install                # 安装到系统
./build.sh --clean                  # 清理构建产物

# 发布
./release.sh v1.2.1                 # 发布新版本（自动触发CI）

# 手动操作
cd src-ui && npm run build          # 构建前端
cd src-tauri && cargo tauri dev     # 启动开发环境
cd src-tauri && cargo tauri build   # 构建安装包
```

---

**最后更新**: 2025-12-14
**当前版本**: v1.2.1
