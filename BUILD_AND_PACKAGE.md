# Claude Code Proxy - 构建与打包指南

## 快速开始

### 一键打包（推荐）

直接运行构建脚本即可生成安装包：

```bash
./build.sh
```

这会自动：
1. 检查并安装依赖
2. 构建前端（React + TypeScript）
3. 构建后端（Rust + Tauri）
4. 打包生成安装包

### 构建产物位置

#### macOS
- **DMG 安装包**: `src-tauri/target/release/bundle/dmg/Claude Code Proxy_1.0.0_aarch64.dmg`
- **APP 应用包**: `src-tauri/target/release/bundle/macos/Claude Code Proxy.app`

#### Windows
- **MSI 安装包**: `src-tauri/target/release/bundle/msi/Claude Code Proxy_1.0.0_x64_en-US.msi`
- **EXE 安装程序**: `src-tauri/target/release/bundle/nsis/Claude Code Proxy_1.0.0_x64-setup.exe`

#### Linux
- **DEB 包**: `src-tauri/target/release/bundle/deb/claude-code-proxy_1.0.0_amd64.deb`
- **RPM 包**: `src-tauri/target/release/bundle/rpm/claude-code-proxy-1.0.0-1.x86_64.rpm`
- **AppImage**: `src-tauri/target/release/bundle/appimage/claude-code-proxy_1.0.0_amd64.AppImage`

## 其他构建选项

### 只编译可执行文件（不打包）

```bash
./build.sh --current
```

可执行文件位于: `src-tauri/target/release/claude-code-proxy`

### 交叉编译其他平台

```bash
# 构建 macOS 版本（需要在 macOS 上运行）
./build.sh --platform macos

# 构建 Windows 版本（需要交叉编译工具链）
./build.sh --platform windows

# 构建 Linux 版本（需要交叉编译工具链）
./build.sh --platform linux

# 构建所有平台
./build.sh --platform all
```

### 清理构建产物

```bash
./build.sh --clean
```

## 开发模式

启动开发服务器（支持热重载）：

```bash
./start.sh dev
# 或
npm run tauri dev
```

## 系统要求

### 开发环境依赖
- **Node.js**: >= 16.x（用于前端构建）
- **Rust**: >= 1.70（用于后端编译）
- **系统依赖**:
  - macOS: Xcode Command Line Tools
  - Windows: Microsoft Visual Studio C++ Build Tools
  - Linux: `build-essential`, `libwebkit2gtk-4.0-dev`, `libssl-dev`

### 安装依赖

#### macOS
```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 安装 Rust（如果未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js（使用 Homebrew）
brew install node
```

#### Windows
```bash
# 安装 Rust
# 访问 https://rustup.rs/ 下载安装器

# 安装 Visual Studio C++ Build Tools
# 访问 https://visualstudio.microsoft.com/downloads/

# 安装 Node.js
# 访问 https://nodejs.org/
```

#### Linux (Ubuntu/Debian)
```bash
# 安装系统依赖
sudo apt update
sudo apt install -y build-essential curl wget libssl-dev libwebkit2gtk-4.0-dev

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## 打包分发版本

### macOS DMG 打包

项目提供了专门的 DMG 打包脚本，创建带有"应用程序"文件夹链接的专业安装镜像。

#### 使用打包脚本（推荐）

```bash
# 1. 先构建应用
./build.sh

# 2. 使用简化脚本创建 DMG（推荐）
./create-dmg-simple.sh

# 或使用标准脚本
./create-dmg.sh
```

**脚本说明：**
- `create-dmg-simple.sh`: 推荐使用，创建带有 Applications 链接的标准 DMG
- `create-dmg.sh`: 基础版本，仅打包 .app 文件
- `create-dmg-enhanced.sh`: 增强版，尝试自定义窗口布局（可能需要额外配置）

**输出文件位置：**
- 标准 DMG: `dist/ClaudeCodeProxy_1.0.0_macOS.dmg`
- 安装版 DMG: `dist/ClaudeCodeProxy_1.0.0_macOS_Installer.dmg`

**DMG 特性：**
- ✅ 包含应用程序文件夹链接，方便用户拖拽安装
- ✅ UDZO 格式压缩，减小文件体积
- ✅ 自动验证 DMG 完整性
- ✅ 提供详细的安装说明

#### 手动创建 DMG

如果需要自定义 DMG 内容：

```bash
# 1. 创建临时目录
mkdir -p dmg_temp
cp -R src-tauri/target/release/bundle/macos/ClaudeCodeProxy.app dmg_temp/
ln -s /Applications dmg_temp/Applications

# 2. 创建 DMG
hdiutil create \
    -volname "ClaudeCodeProxy" \
    -srcfolder dmg_temp \
    -ov \
    -format UDZO \
    -imagekey zlib-level=9 \
    ClaudeCodeProxy_Installer.dmg

# 3. 清理
rm -rf dmg_temp
```

### macOS 分发指南
1. 使用打包脚本生成 DMG 文件
2. 分发 `ClaudeCodeProxy_x.x.x_macOS_Installer.dmg` 给用户
3. 用户双击 DMG 文件后，将应用拖拽到 Applications 文件夹
4. 首次运行需要右键点击选择"打开"（未签名应用）

### Windows
1. 分发 `.msi` 或 `.exe` 安装程序给用户
2. 用户双击运行安装程序
3. 按照安装向导完成安装

### Linux
#### Debian/Ubuntu (.deb)
```bash
sudo dpkg -i claude-code-proxy_1.0.0_amd64.deb
```

#### Fedora/RHEL (.rpm)
```bash
sudo rpm -i claude-code-proxy-1.0.0-1.x86_64.rpm
```

#### AppImage（通用）
```bash
# 添加执行权限
chmod +x claude-code-proxy_1.0.0_amd64.AppImage

# 直接运行
./claude-code-proxy_1.0.0_amd64.AppImage
```

## 代码签名（可选，用于分发）

### macOS
```bash
# 签名应用
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" "Claude Code Proxy.app"

# 公证应用（需要Apple Developer账号）
xcrun notarytool submit "Claude Code Proxy.dmg" --keychain-profile "AC_PASSWORD"
```

### Windows
使用 SignTool 或第三方代码签名服务签名 `.msi` 或 `.exe` 文件。

## 故障排除

### 白屏问题
如果启动后出现白屏，检查：
1. 前端是否正确构建：`ls -la src-ui/dist/`
2. Tauri 配置中的 `frontendDist` 路径是否正确
3. 使用开发模式启动查看控制台错误：`./start.sh dev`

### 构建失败
1. 确保所有依赖都已安装
2. 清理并重新构建：`./build.sh --clean && ./build.sh`
3. 检查 Rust 和 Node.js 版本是否符合要求

### 图标未显示
确保 `src-tauri/icons/` 目录包含所有必需的图标文件。

## 更多信息

- [Tauri 官方文档](https://tauri.app/)
- [项目 GitHub 仓库](https://github.com/your-repo/claude-code-proxy)
