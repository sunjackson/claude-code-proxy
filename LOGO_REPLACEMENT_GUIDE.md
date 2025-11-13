# Logo 替换指南

## 快速开始

使用提供的脚本一键替换项目中所有的 logo 和图标：

```bash
./replace-logo.sh /path/to/your-logo.png
```

## 使用说明

### 1. 准备 Logo 图片

**推荐规格**:
- 格式：PNG（带透明背景）或 JPG
- 尺寸：至少 1024x1024 像素
- 形状：正方形
- 背景：透明（PNG）或纯色

**示例**:
```bash
# 如果你的 logo 在下载文件夹
./replace-logo.sh ~/Downloads/new-logo.png

# 如果 logo 在当前目录
./replace-logo.sh ./my-logo.png

# 使用绝对路径
./replace-logo.sh /Users/username/Desktop/company-logo.png
```

### 2. 运行替换脚本

```bash
# 查看帮助信息
./replace-logo.sh --help

# 执行替换
./replace-logo.sh <logo图片路径>
```

脚本会：
1. ✅ 验证输入的图片文件
2. ✅ 自动备份现有图标到 `src-tauri/icons/backup_<时间戳>/`
3. ✅ 生成所有平台需要的图标尺寸
4. ✅ 显示详细的生成过程

### 3. 验证并重新构建

```bash
# 检查生成的图标
ls -la src-tauri/icons/

# 重新构建应用
./build.sh
```

## 生成的图标列表

### macOS
- `icon.icns` - macOS 应用图标（包含多个尺寸）
- `32x32.png` - 小尺寸图标
- `64x64.png` - 中等尺寸图标
- `128x128.png` - 标准尺寸图标
- `128x128@2x.png` - Retina 显示屏图标
- `icon.png` - 512x512 主图标

### Windows
- `icon.ico` - Windows 应用图标（多尺寸嵌入）
- `Square*.png` - Windows Store 图标（多种尺寸）
- `StoreLogo.png` - 商店 Logo

### iOS
所有 iOS 设备需要的图标尺寸（@1x, @2x, @3x）：
- 20x20, 29x29, 40x40, 60x60
- 76x76, 83.5x83.5
- 1024x1024（App Store）

位置：`src-tauri/icons/ios/`

### Android
所有 Android 密度的图标：
- mdpi: 48x48
- hdpi: 72x72
- xhdpi: 96x96
- xxhdpi: 144x144
- xxxhdpi: 192x192

位置：`src-tauri/icons/android/mipmap-*/`

## 依赖说明

### 必需（macOS 内置）
- `sips` - 图片处理工具
- `iconutil` - 生成 .icns 文件

### 可选（推荐安装）
- `ImageMagick` - 用于生成 Windows .ico 文件

```bash
# 安装 ImageMagick
brew install imagemagick
```

**注意**: 如果没有安装 ImageMagick，脚本会生成简化版的 .ico 文件（仅包含32x32尺寸）。

## 恢复备份

如果替换后的图标不满意，可以从备份恢复：

```bash
# 查看所有备份
ls -la src-tauri/icons/backup_*

# 恢复最新的备份（替换时间戳）
cp -r src-tauri/icons/backup_20250113_104530/* src-tauri/icons/
```

## 手动替换（不推荐）

如果需要手动替换某个特定尺寸的图标：

```bash
# 使用 sips 调整大小
sips -z 128 128 source.png --out src-tauri/icons/128x128.png

# 生成 .icns（需要先创建 .iconset 目录）
iconutil -c icns icon.iconset -o icon.icns
```

## 最佳实践

### Logo 设计建议
1. **简洁明了**: 图标应该在小尺寸下清晰可辨
2. **适配性**: 在浅色和深色背景下都应该清晰
3. **无复杂文字**: 避免小字体文字，在小尺寸下难以辨认
4. **留白空间**: 边缘保留适当留白（约10-15%）

### 颜色建议
- 主色调：选择与应用主题一致的颜色
- 对比度：确保图标在任何背景下都清晰可见
- 品牌识别：使用能代表品牌的颜色和元素

### 测试建议
替换图标后，建议测试：
1. macOS 不同分辨率屏幕（普通和 Retina）
2. Windows 任务栏和开始菜单
3. 应用商店展示效果

## 故障排除

### 问题1: 脚本无权限执行
```bash
chmod +x replace-logo.sh
```

### 问题2: sips 命令未找到
确保在 macOS 系统上运行此脚本。sips 是 macOS 内置工具。

### 问题3: 生成的 .ico 文件不完整
安装 ImageMagick：
```bash
brew install imagemagick
```

### 问题4: 图标变形或模糊
- 确保源图片是正方形
- 使用至少 1024x1024 的高分辨率图片
- 使用 PNG 格式以保持透明度

### 问题5: 构建后图标未更新
```bash
# 清理构建缓存
./build.sh --clean

# 重新构建
./build.sh
```

## 相关文档
- [BUILD_AND_PACKAGE.md](./BUILD_AND_PACKAGE.md) - 构建和打包指南
- [Tauri 图标指南](https://tauri.app/v1/guides/features/icons)

## 技术细节

### macOS .icns 格式
包含以下尺寸：
- 16x16, 32x32 (@1x 和 @2x)
- 128x128, 256x256 (@1x 和 @2x)
- 512x512 (@1x 和 @2x)

### Windows .ico 格式
包含以下尺寸：
- 16x16, 32x32, 48x48, 64x64, 128x128, 256x256

### iOS 图标要求
- 必须是 PNG 格式
- 不能包含 Alpha 通道（除了某些特殊用途）
- 边角会被系统自动圆角化

### Android 图标要求
- PNG 格式，支持透明背景
- 需要提供圆形版本（ic_launcher_round.png）
- 自适应图标（Adaptive Icons）支持前景和背景分离

## 更新日志

### 2025-11-13
- 创建初始版本的 logo 替换脚本
- 支持 macOS、Windows、iOS、Android 全平台图标生成
- 添加自动备份功能
- 集成 sips 和 iconutil 工具
