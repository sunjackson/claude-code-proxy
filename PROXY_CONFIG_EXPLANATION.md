# Claude Code 代理配置说明

## 修改内容

修改了 Claude Code 代理配置的实现方式，使其正确地将 Claude Code 的 API 请求指向本地代理服务器。

## 工作原理

### 启用代理时

当启用本地代理配置时，系统会：

1. **自动创建备份**：在修改前自动创建配置备份
2. **保存原始 URL**：如果存在 `ANTHROPIC_BASE_URL`，先保存到 `_ORIGINAL_ANTHROPIC_BASE_URL`
3. **修改 Base URL**：将 `env.ANTHROPIC_BASE_URL` 修改为 `http://127.0.0.1:25341`
4. **设置 HTTP 代理**：同时设置 `http.proxy` 为 `http://127.0.0.1:25341`（备用）

**配置示例**（启用代理后）：
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-token",
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:25341",
    "_ORIGINAL_ANTHROPIC_BASE_URL": "https://www.88code.org/api",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001",
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929"
  },
  "http.proxy": "http://127.0.0.1:25341"
}
```

### 禁用代理时

当禁用本地代理配置时，系统会：

1. **自动创建备份**：在修改前自动创建配置备份
2. **移除 HTTP 代理**：删除 `http.proxy` 配置
3. **恢复原始 URL**：
   - 如果存在 `_ORIGINAL_ANTHROPIC_BASE_URL`，恢复到 `ANTHROPIC_BASE_URL`
   - 否则直接删除 `ANTHROPIC_BASE_URL`（使用默认值）
4. **清理备份字段**：移除 `_ORIGINAL_ANTHROPIC_BASE_URL`

**配置示例**（禁用代理后）：
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-token",
    "ANTHROPIC_BASE_URL": "https://www.88code.org/api",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001",
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929"
  }
}
```

## 请求流程

### 启用代理后的请求流程

```
Claude Code
    ↓
env.ANTHROPIC_BASE_URL = http://127.0.0.1:25341
    ↓
本地代理服务器 (Claude Code Router)
    ↓
根据配置的 API 分组和规则
    ↓
选择最优的 API 配置
    ↓
真实的 Anthropic API 服务器（或第三方 API）
```

### 禁用代理后的请求流程

```
Claude Code
    ↓
env.ANTHROPIC_BASE_URL = https://www.88code.org/api (或默认值)
    ↓
直接连接到配置的 API 服务器
```

## 关键特性

1. **智能保存与恢复**：
   - 自动保存用户原始的 `ANTHROPIC_BASE_URL` 配置
   - 禁用代理时自动恢复，不会丢失用户配置

2. **自动备份机制**：
   - 每次修改前自动创建配置备份
   - 可以随时通过备份列表恢复到任意历史状态

3. **兼容性**：
   - 同时设置 `env.ANTHROPIC_BASE_URL` 和 `http.proxy`
   - 优先使用 `ANTHROPIC_BASE_URL`，确保 API 请求正确路由

4. **安全性**：
   - 只在本地地址（127.0.0.1 或 localhost）时才识别为代理配置
   - 避免误判其他远程 API 地址

## 相关文件

- `src-tauri/src/services/claude_config.rs` - 代理配置服务
- `src-tauri/src/services/backup.rs` - 备份服务
- `~/.claude/settings.json` - Claude Code 配置文件
- `~/.claude/backups/` - 配置备份目录

## 使用建议

1. **首次启用代理**：
   - 点击"启用本地代理"按钮
   - 系统会自动创建备份并修改配置
   - 查看配置预览确认 `ANTHROPIC_BASE_URL` 为 `http://127.0.0.1:25341`

2. **切换代理状态**：
   - 可以随时启用/禁用代理
   - 每次切换都会自动备份，确保可以恢复

3. **恢复配置**：
   - 在备份列表中查看所有历史备份
   - 点击"预览"查看备份内容
   - 点击"恢复"恢复到该备份状态
   - 点击"清空所有"删除所有备份（谨慎操作）

## 故障排除

### 代理不生效

1. 检查 `~/.claude/settings.json` 中的 `ANTHROPIC_BASE_URL` 是否为 `http://127.0.0.1:25341`
2. 确认本地代理服务器已启动（端口 25341）
3. 查看应用日志是否有错误信息

### 配置丢失

1. 进入"Claude Code 集成"页面
2. 在备份列表中找到合适的备份
3. 点击"预览"查看备份内容
4. 点击"恢复"恢复配置

### 无法启用代理

1. 检查 `~/.claude/settings.json` 文件权限
2. 确认配置文件格式正确（有效的 JSON）
3. 查看错误提示，可能需要手动创建配置文件
