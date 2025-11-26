# 更新日志

## [1.0.3] - 2025-11-26

### ✨ 新增功能

- **健康检查调度器** - 定时通过代理接口发送请求，监控 API 健康状态
  - 每分钟自动发送测试请求
  - 通过本地代理接口请求，记录真实延迟
  - 支持启动/停止/配置检查间隔
  - 结果自动保存到 ProxyRequestLog 表

- **代理请求日志记录** - 完整的请求生命周期追踪
  - 记录所有通过代理的 API 请求
  - 包含请求时间、延迟、状态码、配置信息
  - 支持查询和统计分析
  - 数据库迁移 v8 新增 proxy_request_log 表

- **服务商监控大屏** - 可视化监控组件
  - 实时热力图展示 API 健康状态
  - 区分"连通性测试"和"实际请求"两种数据
  - 使用不同色系区分数据类型（暖色系 vs 冷色系）
  - 延迟统计和趋势分析

### 🎨 UI/UX 改进

- **系统托盘优化** - 更友好的托盘交互
  - 动态启停服务切换
  - 更好的状态信息显示
  - 显示当前活跃配置和分组
  - 显示实时延迟信息

- **概念清晰化** - 明确区分两种数据概念
  - "连通性测试": 手动/定时的 API 可用性检查（暖色系）
  - "实际请求": 真实通过代理的 API 调用（冷色系）
  - 更新所有相关标签和文档

### 🔧 技术改进

- 修复所有 Rust 编译警告
- 添加 `#[allow(dead_code)]` 注解保留未来功能
- 清理未使用的导入和代码
- 完善错误处理和日志输出

### 📝 文档更新

- 删除过时的设计文档（LAYOUT_DESIGNS.md, UNIFIED_DASHBOARD_DESIGN.md）
- 更新 README.md 添加最新功能说明
- 更新版本号至 1.0.3
- 完善健康检查和监控功能说明

### 🗄️ 数据库

- 新增 proxy_request_log 表（migration v8）
  - 记录代理请求的完整信息
  - 支持按配置、分组查询
  - 包含延迟、状态码、时间戳等字段

## [1.0.2] - 2025-11-25

### 改进

- 优化配置管理界面
- 提升系统稳定性

## [1.0.1] - 2025-11-19

### 🐛 Bug 修复

- **系统托盘显示问题** - 修复切换配置后托盘菜单展开显示"未选择配置"的问题
  - 优化托盘状态更新逻辑
  - 确保配置名称在菜单中正确显示
  - 修复 `update_tray_menu` 函数参数传递

- **CI/CD 构建问题** - 修复 GitHub Actions 多平台构建失败
  - 修复 Tauri CLI 安装问题
  - 修复 Windows 构建验证步骤兼容性
  - 修复 Linux 构建缺少 JavaScriptCore 依赖
  - 修复 Windows ICO 文件格式错误

### 📝 文档更新

- 添加界面预览截图展示（5张系统截图）
- 统一项目名称为 "Claude Code Proxy"
- 完善 README.md 文档

### 🔧 配置优化

- 添加 GitHub Actions 写入权限以创建 Release
- 优化 Rust 编译缓存策略

## [1.0.0] - 2025-11-18

### 🎉 首次发布

详见下文...

---

## [2025-11-13] - 项目改名为 Claude Code Proxy

### 重要变更

#### 🎯 项目改名
- 项目名称从 "Claude Code Router" 更改为 "Claude Code Proxy"
- 更新所有配置文件、源代码和文档中的项目名称
- Bundle ID 更新为 `com.claudecodeproxy.app`
- 应用数据目录更新为 `com.claude-code-proxy`

#### 🗄️ 数据库打包策略调整
- **移除打包时的数据库备份/恢复逻辑**
- 打包时不再包含数据库文件
- 用户安装后首次启动时自动创建新的空数据库
- 确保分发的安装包不包含任何测试数据

### 技术细节

#### 更新的文件
- `src-tauri/tauri.conf.json` - 产品名称和 Bundle ID
- `src-tauri/Cargo.toml` - 包名称
- `src-ui/package.json` - 前端包名称
- `src-ui/index.html` - 页面标题
- `src-tauri/src/utils/paths.rs` - 应用数据路径
- `build.sh` - 构建脚本（移除数据库备份逻辑）
- 所有 Markdown 文档

#### 路径变更
- macOS: `~/Library/Application Support/com.claude-code-proxy/`
- Windows: `%APPDATA%\claude-code-proxy\`
- Linux: `~/.local/share/claude-code-proxy/`

---

## [2025-11-13] - Logo 替换脚本和完整构建文档

### 新增功能

#### 🎨 Logo 替换脚本 (`replace-logo.sh`)
一键替换项目中所有平台的应用图标：

**功能特性**：
- ✅ 自动验证输入图片
- ✅ 自动备份现有图标（带时间戳）
- ✅ 生成所有平台需要的图标尺寸：
  - macOS: `.icns` + 各种 PNG 尺寸
  - Windows: `.ico` + Store 图标
  - iOS: 所有 @1x, @2x, @3x 尺寸
  - Android: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
- ✅ 彩色终端输出，清晰易懂
- ✅ 完整的错误处理和帮助信息

**使用方法**：
```bash
./replace-logo.sh /path/to/your-logo.png
```

**技术实现**：
- 使用 `sips` (macOS 内置) 进行图片处理
- 使用 `iconutil` 生成 `.icns` 文件
- 可选支持 `ImageMagick` 生成完整的 `.ico` 文件
- 包含完整的依赖检查和验证

#### 📦 构建脚本增强 (`build.sh`)

**已有功能**：
- Cargo 路径自动检测（支持非 PATH 环境）
- 使用 `cargo tauri build` 生成完整安装包
- 支持多平台交叉编译
- 自动构建前端和后端
- 清理构建产物
- 彩色日志输出

**默认行为更新**：
- 默认使用 Tauri CLI 构建（生成安装包）
- 添加 `--current` 参数用于只编译可执行文件

### 新增文档

#### 1. [LOGO_REPLACEMENT_GUIDE.md](./LOGO_REPLACEMENT_GUIDE.md)
Logo 替换完整指南：
- 使用说明
- 生成的图标列表
- 依赖说明
- 恢复备份方法
- 最佳实践和设计建议
- 故障排除
- 技术细节（各平台图标格式要求）

#### 2. [SCRIPTS_README.md](./SCRIPTS_README.md)
项目脚本使用指南：
- 所有可用脚本列表
- 快速工作流示例
- 常见任务说明
- 目录结构说明
- 系统要求

#### 3. [QUICK_START.md](./QUICK_START.md)
5分钟快速上手指南：
- 三步快速构建
- 各平台安装说明
- 自定义 Logo 方法
- 常用命令参考
- 故障排除

#### 4. [BUILD_AND_PACKAGE.md](./BUILD_AND_PACKAGE.md) (更新)
完整的构建和打包指南

#### 5. [TYPESCRIPT_FIXES.md](./TYPESCRIPT_FIXES.md)
TypeScript 错误修复详细报告

### 文档更新

#### 更新 [README.md](./README.md)
- ✅ 添加"一键构建"部分
- ✅ 添加"替换应用 Logo"部分
- ✅ 更新文档索引（分类为"开发指南"和"构建与部署"）
- ✅ 添加"快速命令参考"
- ✅ 更新最后修改时间

### 修复问题

#### TypeScript 编译错误修复
- ✅ 修复 `ConfigEditor.tsx` apiKey 类型推断问题
- ✅ 完善 `vite-env.d.ts` 环境类型声明
- ✅ 修复 `ImportMeta.env` 访问错误
- ✅ 修复 `NodeJS.Timeout` 类型定义
- ✅ 清理编译器缓存解决误报
- ✅ 成功构建前端（0 错误）

#### 构建脚本修复
- ✅ 修复 Cargo 路径查找问题
- ✅ 从 `cargo build` 更改为 `cargo tauri build`
- ✅ 修复 bundle identifier 警告

### 构建结果

✅ **成功生成安装包**：
- macOS DMG: `Claude Code Proxy_1.0.0_aarch64.dmg` (14MB)
- macOS APP: `Claude Code Proxy.app` (27MB)
- 应用正常启动，无白屏问题

### 文件清单

#### 新增文件
```
./replace-logo.sh              # Logo 替换脚本（可执行）
./LOGO_REPLACEMENT_GUIDE.md    # Logo 替换指南
./SCRIPTS_README.md            # 脚本使用说明
./QUICK_START.md               # 快速开始指南
./TYPESCRIPT_FIXES.md          # TypeScript 修复报告
./CHANGELOG.md                 # 本文件
```

#### 更新文件
```
./build.sh                     # 构建脚本（更新）
./BUILD_AND_PACKAGE.md         # 构建指南（更新）
./README.md                    # 项目主文档（更新）
./src-tauri/tauri.conf.json    # 修复 bundle identifier
./src-ui/src/vite-env.d.ts     # 完善类型声明
./src-ui/src/components/ConfigEditor.tsx  # 修复类型问题
```

### 技术细节

#### Logo 替换脚本技术实现
```bash
# 使用 sips 调整大小
sips -z height width input.png --out output.png

# 生成 .icns 文件
iconutil -c icns icon.iconset -o icon.icns

# 可选：使用 ImageMagick 生成 .ico
magick input.png -define icon:auto-resize=256,128,64,48,32,16 output.ico
```

#### 构建流程优化
```bash
# 旧方法（只生成可执行文件）
cargo build --release

# 新方法（生成完整安装包）
cargo tauri build
```

### 依赖要求

#### Logo 替换脚本
- ✅ `sips` - macOS 内置（必需）
- ✅ `iconutil` - macOS 内置（必需）
- ⭕ `ImageMagick` - 可选，用于生成完整的 .ico 文件

安装 ImageMagick：
```bash
brew install imagemagick
```

### 使用示例

#### 替换 Logo
```bash
# 1. 准备 logo（1024x1024 PNG）
# 2. 运行替换脚本
./replace-logo.sh ~/Downloads/my-logo.png

# 3. 重新构建应用
./build.sh
```

#### 构建应用
```bash
# 生成安装包（推荐）
./build.sh

# 只编译可执行文件
./build.sh --current

# 清理并重建
./build.sh --clean && ./build.sh
```

### 已知问题

无重大已知问题。

### 后续计划

- [ ] 支持 Windows 平台的图标生成（非 macOS 环境）
- [ ] 添加图标预览功能
- [ ] 支持从 URL 下载 logo
- [ ] CI/CD 集成自动构建

### 贡献者

本次更新由 Claude (AI Assistant) 协助完成。

---

## [2025-11-12] - 构建系统建立

### 新增
- 创建 `build.sh` 构建脚本
- 创建 `BUILD_AND_PACKAGE.md` 文档
- 配置 Tauri 打包系统

---

## [2025-11-10] - 项目初始化

### 新增
- 项目基础结构
- React + TypeScript 前端
- Rust + Tauri 后端
- 代理服务器实现
- 数据库模型
- 基础 UI 组件

---

**注意**：本文档记录项目的主要更新和变更。详细的技术变更请参考 Git 提交历史。
