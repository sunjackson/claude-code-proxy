# 代理服务测试指南

**编写时间**: 2025-11-11 23:16
**状态**: ✅ 代码已修复并编译完成，等待测试

## 📋 修复内容总结

已完成以下两个关键修复：

### 1. ✅ HTTPS后端支持
- 添加了TLS/SSL握手功能
- 支持连接到HTTPS后端服务器（如 `https://www.88code.org/api`）
- 详见：`BUGFIX_HTTPS_PROXY_SUPPORT.md`

### 2. ✅ URI路径正确处理
- 正确提取客户端请求路径（如 `/v1/messages`）
- 正确解析后端URL路径前缀（如 `/api`）
- 正确组合完整目标路径（如 `/api/v1/messages`）
- 详见：`BUGFIX_PROXY_URI_PATH.md`

## 🚀 测试步骤

### 第一步：确认应用已启动

检查应用是否正在运行：

```bash
# 检查前端
curl http://localhost:5173
# 应该返回HTML内容

# 检查后端进程
ps aux | grep claude-code-router | grep -v grep
```

如果没有运行，启动应用：

```bash
cd /Users/sunjackson/Project/claude-code-router
./start-dev.sh
```

### 第二步：打开浏览器并配置

1. **打开应用UI**
   ```
   打开浏览器访问: http://localhost:5173
   ```

2. **检查API配置**
   - 进入"配置管理"页面
   - 确认已有至少一个API配置（如 88Code）
   - 配置示例：
     ```
     名称: 88Code
     服务器URL: https://www.88code.org/api
     服务器端口: 443
     API Key: sk-xxx...
     ```

3. **激活配置**
   - 选择要使用的配置
   - 点击"激活"按钮
   - 确认配置已设置为活跃状态（应该有高亮或标识）

### 第三步：启动代理服务

1. **在UI中找到代理服务控制**
   - 通常在顶部或侧边栏有"代理服务"、"启动代理"等按钮
   - 或者在"配置管理"页面有代理控制区域

2. **点击"启动代理"按钮**
   - 观察UI反馈，应该显示"代理服务已启动"
   - 状态应该从"已停止"变为"运行中"

3. **验证代理端口**
   ```bash
   lsof -i :25341
   ```
   应该看到类似输出：
   ```
   COMMAND     PID       USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
   claude-co 12345 sunjackson   25u  IPv4   ...      0t0  TCP localhost:25341 (LISTEN)
   ```

### 第四步：配置Claude Code

1. **找到Claude Code配置文件**
   ```bash
   open ~/.claude/settings.json
   ```

2. **添加或修改代理配置**
   ```json
   {
     "ANTHROPIC_BASE_URL": "http://127.0.0.1:25341"
   }
   ```

3. **保存并重启Claude Code**

### 第五步：测试连接

#### 方式1：使用curl测试（推荐先做）

```bash
curl -v -m 10 http://127.0.0.1:25341/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

**预期结果**:
- ✅ **成功**: 返回JSON响应，包含AI回复
- ❌ **失败**（连接被拒绝）: 代理服务未启动
- ❌ **失败**（超时）: 请求转发有问题，查看日志

#### 方式2：使用Claude Code测试

1. **打开Claude Code**
2. **发送一个简单问题**: "Hi"
3. **观察响应**:
   - ✅ 正常回复 → 代理工作正常
   - ❌ 超时错误 → 查看应用日志
   - ❌ 403/404错误 → 查看应用日志

### 第六步：查看日志

如果测试失败，查看详细日志：

#### 应用控制台日志

在启动应用的终端中，你应该能看到类似日志：

**成功的日志示例**:
```
[2025-11-11 23:15:37 INFO] 代理服务已初始化
[2025-11-11 23:16:00 DEBUG] Client request path: /v1/messages
[2025-11-11 23:16:00 DEBUG] Target address: www.88code.org:443, Target path: /api/v1/messages
[2025-11-11 23:16:00 DEBUG] Performing TLS handshake for HTTPS connection to www.88code.org
[2025-11-11 23:16:00 DEBUG] Modified request URI to: /api/v1/messages
[2025-11-11 23:16:01 INFO] Received response: status=200, headers={...}
```

**失败的日志示例**:
```
[ERROR] Connection timeout to target server: www.88code.org:443
# 或
[ERROR] TLS handshake failed: ...
# 或
[ERROR] Failed to send request: ...
```

#### 数据库状态检查

```bash
sqlite3 ~/Library/Application\ Support/com.claude-code-router/database.db \
  "SELECT status, current_config_id, error_message FROM ProxyService WHERE id = 1;"
```

## 🔧 故障排查

### 问题1: 代理端口未监听

**症状**: `curl: (7) Failed to connect to 127.0.0.1 port 25341: Connection refused`

**解决方案**:
1. 确认应用已启动
2. 在UI中手动点击"启动代理"按钮
3. 检查数据库中是否有活跃配置：
   ```bash
   sqlite3 ~/Library/Application\ Support/com.claude-code-router/database.db \
     "SELECT current_config_id FROM ProxyService WHERE id = 1;"
   ```
   如果返回空，设置活跃配置：
   ```bash
   sqlite3 ~/Library/Application\ Support/com.claude-code-router/database.db \
     "UPDATE ProxyService SET current_config_id = 1, current_group_id = 1 WHERE id = 1;"
   ```

### 问题2: 连接超时

**症状**: `curl: (28) Connection timed out` 或 Claude Code报告"API_TIMEOUT"

**可能原因**:
1. 后端服务器不可达
2. TLS握手失败
3. 请求URI不正确

**解决方案**:
1. 测试后端是否可达：
   ```bash
   curl -v https://www.88code.org/api/v1/messages \
     -H "x-api-key: your-api-key" \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-sonnet-4","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
   ```

2. 查看应用日志中的错误信息

3. 确认API Key正确

### 问题3: 403 Forbidden

**症状**: `HTTP/1.1 403 Forbidden`

**解决方案**:
- 这个问题已经修复（添加了User-Agent等请求头）
- 如果仍然出现，检查API Key是否有效
- 检查后端服务器是否有IP限制

### 问题4: 404 Not Found

**症状**: `HTTP/1.1 404 Not Found`

**解决方案**:
- 这个问题已经修复（URI路径处理）
- 检查后端URL配置是否正确
- 查看日志中的"Target path"是否正确

### 问题5: Empty reply from server

**症状**: `curl: (52) Empty reply from server`

**解决方案**:
- 代理服务可能崩溃了
- 查看应用日志中的panic或error信息
- 重启应用

## 📊 验证清单

完成测试后，确认以下所有项目：

- [ ] 应用已成功启动（前端+后端）
- [ ] 至少有一个API配置
- [ ] API配置已激活
- [ ] 代理服务已启动（端口25341正在监听）
- [ ] curl测试成功返回响应
- [ ] Claude Code配置了代理URL
- [ ] Claude Code可以正常对话
- [ ] 应用日志中没有错误信息

## 🎯 成功标志

如果一切正常，你应该看到：

1. **curl测试返回成功**:
   ```json
   {
     "id": "msg_xxx",
     "type": "message",
     "role": "assistant",
     "content": [
       {
         "type": "text",
         "text": "Hello! How can I help you today?"
       }
     ],
     ...
   }
   ```

2. **Claude Code正常对话**:
   ```
   You: Hi
   Assistant: Hello! How can I help you today?
   ```

3. **应用日志显示成功**:
   ```
   [INFO] Forwarding request to config: 88Code (https://www.88code.org/api)
   [DEBUG] Client request path: /v1/messages
   [DEBUG] Target path: /api/v1/messages
   [DEBUG] TLS handshake successful
   [INFO] Received response: status=200
   ```

## 📝 测试报告模板

完成测试后，请报告以下信息：

```markdown
### 测试环境
- 操作系统: macOS / Linux / Windows
- 应用版本: (git commit hash或版本号)
- 后端服务商: 88Code / yesCode / 其他

### 测试结果
- [ ] 应用启动: 成功/失败
- [ ] 代理启动: 成功/失败
- [ ] curl测试: 成功/失败
- [ ] Claude Code测试: 成功/失败

### curl测试输出
\`\`\`
(粘贴curl命令的完整输出)
\`\`\`

### 应用日志
\`\`\`
(粘贴相关日志，特别是ERROR和DEBUG信息)
\`\`\`

### 问题描述
(如果有问题，详细描述)

### 截图
(如果有UI相关问题，提供截图)
\`\`\`

## 🆘 获取帮助

如果遇到问题：

1. **查看详细文档**:
   - `BUGFIX_HTTPS_PROXY_SUPPORT.md` - HTTPS支持说明
   - `BUGFIX_PROXY_URI_PATH.md` - URI路径处理说明
   - `PROXY_COMPLETE_FIX_SUMMARY.md` - 完整修复总结

2. **检查日志文件**:
   - 应用控制台输出
   - 浏览器控制台（F12）

3. **数据库状态**:
   ```bash
   sqlite3 ~/Library/Application\ Support/com.claude-code-router/database.db ".dump"
   ```

4. **提供完整信息**:
   - 错误信息
   - 日志输出
   - 测试步骤
   - 环境信息

---

**祝测试顺利！** 🎉

如果测试成功，恭喜你！代理服务现在应该能够正常工作了。
如果遇到问题，请按照故障排查步骤操作，或者提供详细的测试报告以便进一步诊断。
