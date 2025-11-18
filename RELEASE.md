# 发布指南

本文档说明如何使用 GitHub Actions 自动发布新版本。

---

## 📋 发布前检查清单

在创建新版本之前，请确保完成以下步骤：

- [ ] 更新版本号
- [ ] 更新 CHANGELOG.md
- [ ] 本地测试通过
- [ ] 所有测试通过
- [ ] 代码已推送到 master 分支

---

## 🔢 更新版本号

需要在以下三个文件中同步更新版本号：

### 1. src-tauri/tauri.conf.json

```json
{
  "package": {
    "version": "1.1.0"
  }
}
```

### 2. src-tauri/Cargo.toml

```toml
[package]
name = "claude-code-proxy"
version = "1.1.0"
```

### 3. src-ui/package.json

```json
{
  "name": "claude-code-proxy-ui",
  "version": "1.1.0"
}
```

---

## 📝 更新 CHANGELOG.md

在 `CHANGELOG.md` 文件顶部添加新版本的更新日志：

```markdown
## [1.1.0] - 2025-01-XX

### Added
- 新功能 1
- 新功能 2

### Changed
- 变更 1
- 变更 2

### Fixed
- 修复 Bug 1
- 修复 Bug 2
```

---

## 🚀 发布流程

### 方式 1: 使用脚本（推荐）

创建并运行发布脚本：

```bash
#!/bin/bash
# release.sh - 自动发布脚本

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "用法: ./release.sh v1.1.0"
    exit 1
fi

echo "准备发布版本: $VERSION"

# 1. 确保在 master 分支
git checkout master
git pull origin master

# 2. 创建并推送 tag
git tag -a $VERSION -m "Release $VERSION"
git push origin $VERSION

echo "✅ 版本 $VERSION 已发布"
echo "🔗 GitHub Actions 将自动构建并创建 Release"
echo "🔗 查看进度: https://github.com/sunjackson/claude-code-proxy/actions"
```

使用方法：

```bash
chmod +x release.sh
./release.sh v1.1.0
```

### 方式 2: 手动发布

1. **提交所有更改**

```bash
git add .
git commit -m "chore: bump version to 1.1.0"
git push origin master
```

2. **创建 Git Tag**

```bash
git tag -a v1.1.0 -m "Release version 1.1.0"
```

3. **推送 Tag**

```bash
git push origin v1.1.0
```

4. **查看构建进度**

访问 [GitHub Actions](https://github.com/sunjackson/claude-code-proxy/actions) 查看自动构建进度。

---

## 🤖 GitHub Actions 自动化流程

推送 tag 后，GitHub Actions 将自动执行以下操作：

### 1. 多平台构建

构建以下平台的安装包：

- **macOS**
  - Apple Silicon (aarch64)
  - Intel (x86_64)
  - 格式：`.dmg`, `.app`

- **Windows**
  - x64
  - 格式：`.msi`, `.exe`

- **Linux**
  - x64
  - 格式：`.deb`, `.AppImage`

### 2. 创建 GitHub Release

自动创建 Draft Release，包含：
- 所有平台的安装包
- 自动生成的 Release Notes
- 版本标签

### 3. 编辑和发布

1. 访问 [Releases 页面](https://github.com/sunjackson/claude-code-proxy/releases)
2. 找到新创建的 Draft Release
3. 编辑 Release Notes（可选）
4. 点击 "Publish release" 发布

---

## ⏱️ 构建时间

不同平台的构建时间参考：

| 平台 | 预计时间 |
|------|---------|
| macOS (Apple Silicon) | ~10-15 分钟 |
| macOS (Intel) | ~10-15 分钟 |
| Windows (x64) | ~15-20 分钟 |
| Linux (x64) | ~10-15 分钟 |

**总计**: 约 45-60 分钟

---

## 🔍 验证发布

发布完成后，进行以下验证：

### 1. 检查 GitHub Release

- [ ] Release 已发布（不是 Draft）
- [ ] 所有平台的安装包都已上传
- [ ] Release Notes 正确
- [ ] 下载链接可用

### 2. 测试安装包

下载并测试每个平台的安装包：

- [ ] macOS (Apple Silicon) - 正常安装和启动
- [ ] macOS (Intel) - 正常安装和启动
- [ ] Windows - 正常安装和启动
- [ ] Linux (deb) - 正常安装和启动
- [ ] Linux (AppImage) - 正常启动

### 3. 更新文档

- [ ] README.md 中的版本号正确
- [ ] 下载链接指向新版本
- [ ] CHANGELOG.md 已更新

---

## ❌ 回滚版本

如果发现严重问题需要回滚：

### 1. 删除 Tag

```bash
# 删除本地 tag
git tag -d v1.1.0

# 删除远程 tag
git push origin :refs/tags/v1.1.0
```

### 2. 删除 Release

1. 访问 [Releases 页面](https://github.com/sunjackson/claude-code-proxy/releases)
2. 找到有问题的 Release
3. 点击 "Delete" 删除

### 3. 修复问题

1. 修复代码问题
2. 重新发布（使用新的版本号）

---

## 🐛 故障排除

### 构建失败

**查看日志**:
1. 访问 [GitHub Actions](https://github.com/sunjackson/claude-code-proxy/actions)
2. 点击失败的 workflow
3. 查看详细日志

**常见问题**:

1. **依赖问题**: 确保 `Cargo.toml` 和 `package.json` 正确
2. **版本号不匹配**: 确保三个文件中的版本号一致
3. **构建超时**: 检查是否有死循环或耗时操作

### Release 未创建

**可能原因**:
- Tag 格式不正确（必须是 `v*` 格式）
- GitHub Token 权限不足
- workflow 配置错误

**解决方法**:
1. 检查 tag 格式：`git tag -l`
2. 手动触发 workflow
3. 检查 `.github/workflows/build.yml` 配置

---

## 📚 相关资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Tauri 打包指南](https://tauri.app/v1/guides/building/)
- [语义化版本](https://semver.org/lang/zh-CN/)

---

## 📋 发布版本号规范

遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

- **主版本号 (MAJOR)**: 不兼容的 API 变更
- **次版本号 (MINOR)**: 向下兼容的功能新增
- **修订号 (PATCH)**: 向下兼容的问题修正

**示例**:
- `1.0.0` → `1.0.1`: Bug 修复
- `1.0.0` → `1.1.0`: 新功能
- `1.0.0` → `2.0.0`: 破坏性变更

---

## 🔐 安全注意事项

1. **不要在代码中包含敏感信息**
   - API 密钥
   - 密码
   - 私钥

2. **GitHub Token**
   - GitHub Actions 会自动提供 `GITHUB_TOKEN`
   - 无需手动配置

3. **代码签名**（可选）
   - macOS: 需要 Apple Developer 账号
   - Windows: 需要代码签名证书
   - 配置方法见 [BUILD_AND_PACKAGE.md](./BUILD_AND_PACKAGE.md)

---

## 📞 支持

遇到问题？

1. 查看 [GitHub Issues](https://github.com/sunjackson/claude-code-proxy/issues)
2. 加入 [GitHub Discussions](https://github.com/sunjackson/claude-code-proxy/discussions)
3. 联系维护者: jacksonsunjj@gmail.com

---

**最后更新**: 2025-01-18
