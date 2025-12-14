# 终端服务商真正静默切换 - 零干扰方案

## 问题回顾

**之前的误区**：
- 认为切换服务商需要更新终端的环境变量
- 尝试通过 `export` 命令或 `source` 脚本更新环境变量
- **结果**：所有方案都会在终端显示命令，干扰 Claude Code 使用体验

**用户期望**：
- 切换服务商应该是**完全静默**的后台操作
- **零终端干扰**：不显示任何命令、不清屏、不输出
- 环境变量自动路由，无需用户感知

## 核心发现：环境变量不需要更新！

### 代理路由的真实机制

经过深入分析代码，发现了一个关键事实：

**代理服务器的路由决策完全不依赖环境变量！**

#### 路由流程（src-tauri/src/proxy/server.rs:333-601）

```rust
// 1. 从 URL 提取 session_id
let session_id = Self::extract_session_id(&uri);  // 例如：/session/abc123 → "abc123"

// 2. 查询 SESSION_CONFIG_MAP 获取当前 session 应该使用的 config_id
let (config_id, routing_source) = if let Some(ref sid) = session_id {
    if let Some(session_config_id) = SESSION_CONFIG_MAP.get_config_id(sid) {
        (Some(session_config_id), format!("session:{}", sid))  // ← 从映射表获取！
    } else {
        (global_config_id, "global".to_string())
    }
} else {
    (global_config_id, "global".to_string())
};

// 3. 使用查到的 config_id 转发请求
router.forward_request(req, config_id, group_id).await
```

**关键洞察**：
- Claude Code 使用的 `ANTHROPIC_BASE_URL` 包含 session_id（例如：`http://127.0.0.1:25341/session/abc123`）
- 代理服务器从 URL 中提取 `session_id`
- 通过 `SESSION_CONFIG_MAP.get_config_id(session_id)` 查表获取最新的 config_id
- **session_id 不变，但映射的 config_id 可以动态改变！**

### SESSION_CONFIG_MAP 的作用

`SESSION_CONFIG_MAP` 是一个全局的 session → config_id 映射表（src-tauri/src/services/session_config.rs）：

```rust
pub struct SessionConfigMap {
    map: RwLock<HashMap<String, SessionConfigEntry>>,  // session_id → config_id
}

impl SessionConfigMap {
    /// 切换 session 使用的配置
    pub fn switch(&self, session_id: &str, new_config_id: i64) -> bool {
        let mut map = self.map.write().unwrap();
        if let Some(entry) = map.get_mut(session_id) {
            entry.config_id = new_config_id;  // ← 只需要更新这里！
            entry.last_used_at = Utc::now();
            log::info!("Session config switched: {} from {} to {}",
                session_id, old_config_id, new_config_id);
            true
        } else {
            false
        }
    }

    /// 获取 session 当前的 config_id
    pub fn get_config_id(&self, session_id: &str) -> Option<i64> {
        let mut map = self.map.write().unwrap();
        if let Some(entry) = map.get_mut(session_id) {
            entry.last_used_at = Utc::now();
            Some(entry.config_id)  // ← 代理路由查询这里！
        } else {
            None
        }
    }
}
```

## 真正的静默切换方案

### 实现（src-tauri/src/services/pty_manager.rs:436-454）

```rust
/// Switch the config ID for a session (runtime provider switch)
///
/// This method updates the session's config mapping in SESSION_CONFIG_MAP,
/// which is used by the proxy server for routing decisions.
/// No terminal commands are sent - the switch is completely silent.
pub async fn switch_config(&self, session_id: &str, new_config_id: i64) -> Result<(), String> {
    // Update SessionConfigMap (proxy routing will use this)
    if SESSION_CONFIG_MAP.switch(session_id, new_config_id) {
        // Also update our local session record
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.config_id = new_config_id;

            log::info!(
                "Switched session {} to config_id={} (silent switch - no terminal commands sent)",
                session_id,
                new_config_id
            );
        }
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}
```

**核心要点**：
1. ✅ 只更新 `SESSION_CONFIG_MAP` 映射表
2. ✅ 更新本地 session 记录（元数据）
3. ✅ **不发送任何终端命令**
4. ✅ **完全静默，零干扰**

### 工作流程

```
用户点击切换服务商（Config A → Config B）
         ↓
前端调用：switchPtyProvider(session_id, new_config_id)
         ↓
后端执行：SESSION_CONFIG_MAP.switch(session_id, new_config_id)
         ↓
映射表更新：session_abc123 → Config B
         ↓
下一个 API 请求：
  1. Claude Code → http://127.0.0.1:25341/session/abc123
  2. 代理提取 session_id = "abc123"
  3. 查表：SESSION_CONFIG_MAP.get_config_id("abc123") → Config B
  4. 转发：使用 Config B 的配置转发到对应的上游服务商
         ↓
✅ 切换完成，用户完全无感知！
```

## 为什么之前的方案是错误的？

### 错误理解 1：需要更新环境变量

**误区**：认为 Claude Code 会检查环境变量来决定连接哪个服务商

**事实**：
- Claude Code 在启动时读取 `ANTHROPIC_BASE_URL`（例如：`http://127.0.0.1:25341/session/abc123`）
- 之后一直使用这个 URL，不会重新读取环境变量
- URL 中的 session_id 不变，所以环境变量也不需要变

### 错误理解 2：环境变量影响路由

**误区**：认为代理服务器使用环境变量来决定路由

**事实**：
- 代理服务器通过 `SESSION_CONFIG_MAP` 动态查表决定路由
- 环境变量（如 `CLAUDE_PROXY_CONFIG_ID`）只是个标识，不参与路由决策
- `HTTP_PROXY` / `HTTPS_PROXY` 是可选的系统代理设置，与服务商切换无关

### 错误理解 3：PTY 输入可以隐藏

**误区**：认为可以通过某种技巧（输出重定向、后台执行等）隐藏终端命令

**事实**：
- PTY（伪终端）的设计就是会显示所有输入
- `write_input()` 方法发送的任何数据都会在终端显示
- 这是操作系统级别的限制，无法绕过
- **结论：不应该向终端发送任何东西！**

## 环境变量的真实作用

虽然不需要动态更新环境变量，但它们在会话**创建时**仍然很重要：

### 创建会话时设置（src-tauri/src/services/pty_manager.rs:230-275）

```rust
fn build_env_vars(&self, session_id: &str, config_id: i64) -> HashMap<String, String> {
    let mut env = HashMap::new();

    // 代理 URL（session_id 固定）
    let anthropic_base_url = format!(
        "http://127.0.0.1:{}/session/{}",
        self.proxy_port,
        session_id
    );

    // Claude Code 启动时读取这些环境变量
    env.insert("ANTHROPIC_BASE_URL".to_string(), anthropic_base_url);
    env.insert("CLAUDE_PROXY_CONFIG_ID".to_string(), config_id.to_string());
    env.insert("HTTP_PROXY".to_string(), proxy_url.clone());
    env.insert("HTTPS_PROXY".to_string(), proxy_url.clone());

    env
}
```

**作用**：
- 告诉 Claude Code 连接到哪个代理地址（包含 session_id）
- Claude Code 启动后，一直使用这个地址
- **session_id 不变，所以环境变量也不需要更新**

## 优势对比

| 特性 | 旧方案（发送命令） | 新方案（只更新映射表） |
|------|-------------------|----------------------|
| **终端干扰** | ❌ 显示命令（1-8行） | ✅ 完全无干扰 |
| **清屏操作** | ❌ 需要 clear | ✅ 不需要 |
| **执行速度** | 🐌 需要等待 shell 执行 | ⚡ 瞬间完成（内存操作） |
| **跨平台兼容性** | ⚠️ 需要适配不同 shell | ✅ 完全通用 |
| **临时文件** | ❌ 需要创建和清理 | ✅ 不需要 |
| **安全性** | ⚠️ 临时文件可能被读取 | ✅ 内存操作，安全 |
| **错误处理** | ⚠️ shell 执行可能失败 | ✅ 简单可靠 |
| **代码复杂度** | ❌ 高（200+ 行） | ✅ 低（20 行） |

## 测试验证

### 1. 启动应用并创建终端

```bash
cargo tauri dev
# 进入 Terminal Workspace，创建 Claude Code 会话
```

### 2. 验证初始路由

```bash
# 在终端中检查环境变量（可选）
echo $ANTHROPIC_BASE_URL
# 输出：http://127.0.0.1:25341/session/{session_id}

echo $CLAUDE_PROXY_CONFIG_ID
# 输出：初始的 config_id（例如：3）
```

### 3. 切换服务商

- 在 Tab Bar 点击服务商切换按钮
- 选择另一个服务商（例如从 Config A 切换到 Config B）
- **观察**：终端界面完全没有任何变化，没有命令闪现 ✅

### 4. 验证路由生效

- 在 Claude Code 中发送一个 API 请求
- 检查代理日志（`~/.claude-code-proxy/logs/proxy.log`）：
  ```
  [INFO] Session config switched: {session_id} from 3 to 5
  [INFO] Using session config: session={session_id}, config_id=5
  [INFO] Forwarding request to config_id=5
  ```

### 5. 确认环境变量未变（可选）

```bash
# 切换后再次检查
echo $ANTHROPIC_BASE_URL
# 输出：http://127.0.0.1:25341/session/{session_id}  （session_id 未变）

echo $CLAUDE_PROXY_CONFIG_ID
# 输出：还是旧的 config_id（例如：3）
# 但这不影响路由！代理服务器使用 SESSION_CONFIG_MAP 而不是环境变量
```

## 技术原理总结

### 1. 双层路由架构

```
┌─────────────────────────────────────────────────┐
│ Claude Code 进程                                 │
│ - 启动时读取：ANTHROPIC_BASE_URL                 │
│ - 固定连接：http://127.0.0.1:25341/session/abc123│
└───────────────────┬─────────────────────────────┘
                    │ (session_id 不变)
                    ↓
┌─────────────────────────────────────────────────┐
│ 代理服务器 (src-tauri/src/proxy/server.rs)      │
│ 1. 提取：session_id = "abc123"                  │
│ 2. 查表：SESSION_CONFIG_MAP.get_config_id()     │
│ 3. 路由：使用最新的 config_id                    │
└───────────────────┬─────────────────────────────┘
                    │ (config_id 动态变化)
                    ↓
┌─────────────────────────────────────────────────┐
│ 上游服务商                                       │
│ - Config A: api.example.com                     │
│ - Config B: api.another.com     ← 切换到这里！   │
└─────────────────────────────────────────────────┘
```

### 2. SESSION_CONFIG_MAP 的关键作用

- **解耦**：将 session_id（不变）与 config_id（可变）分离
- **动态性**：支持运行时切换，无需重启终端或进程
- **高效性**：内存操作，零延迟
- **静默性**：不需要任何终端交互

### 3. 为什么环境变量不重要

- **只用一次**：环境变量只在进程启动时读取
- **内容不变**：`ANTHROPIC_BASE_URL` 中的 session_id 固定
- **不参与路由**：代理服务器查 `SESSION_CONFIG_MAP`，不查环境变量

## 相关文件

- ✅ `src-tauri/src/services/pty_manager.rs:436-454`
  - `switch_config()` - 真正静默的切换逻辑（只更新映射表）

- ✅ `src-tauri/src/services/session_config.rs:43-183`
  - `SessionConfigMap` - session → config_id 映射表
  - `switch()` - 更新映射
  - `get_config_id()` - 查询映射

- ✅ `src-tauri/src/proxy/server.rs:333-601`
  - `handle_request()` - HTTP 请求处理
  - 提取 session_id，查 SESSION_CONFIG_MAP，决定路由

- ✅ `src-ui/src/pages/TerminalWorkspace.tsx:303-317`
  - `handleSwitchProvider()` - 前端切换逻辑

- ✅ `src-ui/src/components/terminal/ProviderSwitchMenu.tsx`
  - 服务商切换菜单 UI

## 总结

### 旧方案的根本问题

❌ **架构误解**：认为需要更新终端环境变量才能切换路由
❌ **技术选择错误**：尝试通过 PTY 发送命令来更新环境变量
❌ **无法解决的矛盾**：PTY 机制决定了所有输入都会显示

### 新方案的核心优势

✅ **架构正确**：利用 `SESSION_CONFIG_MAP` 动态路由机制
✅ **完全静默**：零终端干扰，无任何命令或输出
✅ **实现简单**：只需更新内存映射表，无需复杂的 shell 交互
✅ **高效可靠**：内存操作，瞬间生效，无失败风险
✅ **跨平台通用**：不依赖 shell 类型，所有平台完全一致

### 关键认知转变

**从**："如何静默地更新环境变量？"
**到**："为什么要更新环境变量？根本不需要！"

这是一个经典的 **XY 问题**：
- **X 问题**（真正的问题）：如何切换服务商路由？
- **Y 问题**（错误的方法）：如何更新终端环境变量？

通过深入理解代码架构，我们发现解决 X 问题根本不需要 Y 方法！

---

**最后更新**: 2025-12-13
**版本**: 1.2.1
**状态**: ✅ 已实现并测试
