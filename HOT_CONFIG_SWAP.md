# 热配置切换功能说明

## 📋 功能概述

当在仪表盘中**启动代理服务**时，系统会自动执行以下操作：

1. ✅ **启动本地代理服务器**（默认监听 `127.0.0.1:25341`）
2. ✅ **自动配置 Claude Code** - 修改 `~/.claude/settings.json`
3. ✅ **创建配置备份** - 在修改前自动备份原始配置

当**停止代理服务**时，系统会自动：

1. ✅ **停止本地代理服务器**
2. ✅ **恢复原始配置** - 恢复 Claude Code 的原始设置

## 🔧 技术实现

### 配置修改

启动代理时，系统会修改 `~/.claude/settings.json` 中的 `ANTHROPIC_BASE_URL`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:25341",
    "_ORIGINAL_ANTHROPIC_BASE_URL": "https://co-cdn.yes.vg"
  }
}
```

### 请求流程

```
Claude Code 应用
    ↓
    发送 API 请求到 http://127.0.0.1:25341
    ↓
本地代理服务器（Claude Code Router）
    ↓
    根据当前配置路由到对应的服务商
    ↓
实际服务商 API（如 co-cdn.yes.vg）
```

### 配置备份机制

- **自动备份时机**:
  - 启动代理前
  - 停止代理前
  
- **备份文件位置**: `~/.claude/backups/`
  
- **备份文件名格式**: `settings_YYYYMMDD_HHMMSS.json`

## 🎯 使用场景

### 场景 1: 开发调试
启动代理后，Claude Code 的所有请求都会经过本地代理，方便：
- 查看请求日志
- 监控 API 调用
- 测试不同服务商
- 调试请求问题

### 场景 2: 服务商切换
可以在不重启 Claude Code 的情况下：
- 切换不同的 API 服务商
- 测试服务商可用性
- 比较不同服务商的响应速度

### 场景 3: 自动故障转移
当前服务商不可用时：
- 自动切换到备用服务商
- 无需手动修改配置
- Claude Code 无感知

## 📝 操作步骤

### 启动代理模式

1. 打开 Claude Code Router 仪表盘
2. 选择要使用的配置（配置管理页面）
3. 点击"启动代理"按钮
4. 系统自动配置 Claude Code
5. 开始使用 Claude Code（所有请求自动路由）

### 停止代理模式

1. 在仪表盘点击"停止代理"按钮
2. 系统自动恢复 Claude Code 原始配置
3. Claude Code 恢复直连模式

## ⚠️ 注意事项

### 1. Claude Code 需要重启
修改 `settings.json` 后，**需要重启 Claude Code** 才能生效。

### 2. 配置文件权限
确保有读写权限：
- macOS/Linux: `~/.claude/settings.json`
- Windows: `%USERPROFILE%\.claude\settings.json`

### 3. 备份保留策略
- 自动备份会保留所有历史记录
- 建议定期清理旧备份文件
- 可在"配置备份"页面管理备份

### 4. 端口占用
默认使用端口 `25341`，如果被占用：
- 系统会提示端口冲突
- 需要关闭占用该端口的其他程序
- 或在设置中修改监听端口

## 🔍 故障排查

### 问题 1: 配置没有生效
**解决方案**:
1. 检查 `~/.claude/settings.json` 是否已修改
2. 重启 Claude Code 应用
3. 查看应用日志中是否有错误信息

### 问题 2: 代理连接失败
**解决方案**:
1. 确认代理服务器是否正在运行
2. 检查端口 25341 是否监听
3. 查看代理服务器日志

### 问题 3: 无法恢复原始配置
**解决方案**:
1. 进入"配置备份"页面
2. 选择最近的备份
3. 手动恢复配置

## 📊 日志查看

启动/停止代理时，可以在日志中看到：

```
✅ 已自动配置 Claude Code 指向本地代理: 127.0.0.1:25341
   Claude Code 的所有请求将通过本地代理路由转发
```

停止代理时：

```
✅ 已恢复 Claude Code 原始配置
```

## 🎁 优势

1. **无缝切换** - 不需要手动修改配置文件
2. **自动备份** - 每次修改前自动备份，安全可靠
3. **透明路由** - Claude Code 无感知，体验一致
4. **便于调试** - 所有请求都经过本地代理，方便监控
5. **故障恢复** - 出问题可随时恢复原始配置

## 📚 相关文件

- **代理服务**: `src-tauri/src/services/proxy_service.rs`
- **配置服务**: `src-tauri/src/services/claude_config.rs`
- **备份服务**: `src-tauri/src/services/backup.rs`
- **配置文件**: `~/.claude/settings.json`
- **备份目录**: `~/.claude/backups/`

## 🔗 相关功能

- [配置管理](./README.md#配置管理)
- [配置备份与恢复](./REMOVE_KEYCHAIN.md)
- [代理服务架构](./PROXY_CONFIG_EXPLANATION.md)
