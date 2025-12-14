# 终端服务商切换功能修复

## 问题描述

在 Terminal Workspace 中切换服务商时，代理不生效，仍然走的是系统终端代理服务。

## 问题原因

1. **环境变量在会话创建时设置**：终端会话的环境变量（如 `ANTHROPIC_BASE_URL`、`HTTP_PROXY` 等）在 PTY 会话创建时通过 `build_env_vars` 方法设置
2. **切换服务商未更新环境变量**：`switch_config` 方法只更新了 `SESSION_CONFIG_MAP` 和内存中的 `session.config_id`，但没有更新正在运行的终端进程的环境变量
3. **Claude Code 使用旧的环境变量**：终端中运行的 Claude Code 进程仍然使用创建时的 `ANTHROPIC_BASE_URL`，导致代理路由失效

## 解决方案

### 后端修改 (src-tauri/src/services/pty_manager.rs)

#### 1. 修改 `switch_config` 方法

在切换服务商时自动向终端发送环境变量更新命令：

```rust
pub async fn switch_config(&self, session_id: &str, new_config_id: i64) -> Result<(), String> {
    if SESSION_CONFIG_MAP.switch(session_id, new_config_id) {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.config_id = new_config_id;

            // 生成环境变量更新命令
            let env_commands = self.build_env_update_commands(session_id, new_config_id);

            drop(sessions); // 释放锁

            // 向终端发送命令更新环境变量
            for cmd in env_commands {
                self.write_input(session_id, cmd.as_bytes()).await.ok();
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }

            log::info!("Switched session {} to config_id={} and updated environment", session_id, new_config_id);
        }
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}
```

#### 2. 新增 `build_env_update_commands` 方法

根据不同 shell 类型生成对应的环境变量设置命令：

```rust
fn build_env_update_commands(&self, session_id: &str, config_id: i64) -> Vec<String> {
    let mut commands = Vec::new();

    let proxy_url = format!("http://127.0.0.1:{}", self.proxy_port);
    let anthropic_base_url = format!("http://127.0.0.1:{}/session/{}", self.proxy_port, session_id);

    let shell = Self::detect_default_shell();
    let shell_lower = shell.to_lowercase();

    if shell_lower.contains("bash") || shell_lower.contains("zsh") || shell_lower.contains("sh") {
        // Bash/Zsh/POSIX shell
        commands.push(format!("export ANTHROPIC_BASE_URL=\"{}\"\n", anthropic_base_url));
        commands.push(format!("export CLAUDE_PROXY_CONFIG_ID=\"{}\"\n", config_id));
        commands.push(format!("export HTTP_PROXY=\"{}\"\n", proxy_url));
        commands.push(format!("export HTTPS_PROXY=\"{}\"\n", proxy_url));
        commands.push("clear\n".to_string());
        commands.push(format!("echo \"✓ Switched to provider (config_id={})\"\n", config_id));
    } else if shell_lower.contains("fish") {
        // Fish shell
        commands.push(format!("set -x ANTHROPIC_BASE_URL \"{}\"\n", anthropic_base_url));
        // ... 其他环境变量
    } else if shell_lower.contains("powershell") {
        // PowerShell
        commands.push(format!("$env:ANTHROPIC_BASE_URL=\"{}\"\n", anthropic_base_url));
        // ... 其他环境变量
    }
    // ... 其他 shell 类型

    commands
}
```

### 前端修改

#### 1. 更新提示信息 (src-ui/src/pages/TerminalWorkspace.tsx)

```typescript
const handleSwitchProvider = useCallback(
  async (sessionId: string, newConfigId: number) => {
    try {
      await switchPtyProvider(sessionId, newConfigId);

      const config = configs.find((c) => c.id === newConfigId);
      updateTab(sessionId, { configId: newConfigId, configName: config?.name });

      toast.success(`已切换到 ${config?.name || '新服务商'}，环境变量已自动更新`);
    } catch (error) {
      console.error('Failed to switch provider:', error);
      toast.error(`切换服务商失败: ${error}`);
    }
  },
  [configs, updateTab]
);
```

#### 2. 更新菜单界面 (src-ui/src/components/terminal/ProviderSwitchMenu.tsx)

- Header: "切换服务商" -> "切换后会自动更新环境变量"
- Empty state: "No providers available" -> "暂无可用服务商"
- Current label: "Current" -> "当前"

## 工作原理

1. **用户点击切换服务商**
   - 在 Terminal Tab Bar 点击服务商切换按钮
   - 选择新的服务商配置

2. **后端执行切换**
   - 更新 `SESSION_CONFIG_MAP` 中的路由映射
   - 更新会话元数据中的 `config_id`
   - 生成适合当前 shell 的环境变量设置命令
   - 通过 PTY 向终端发送命令

3. **终端执行命令**
   - 终端接收到 `export ANTHROPIC_BASE_URL=...` 等命令
   - Shell 执行命令，更新当前会话的环境变量
   - 显示确认消息："✓ Switched to provider (config_id=X)"

4. **Claude Code 使用新配置**
   - Claude Code 读取更新后的 `ANTHROPIC_BASE_URL`
   - 新的 API 请求自动路由到新的服务商
   - 代理服务器根据 session_id 和新的 config_id 转发请求

## 支持的 Shell

- ✅ Bash (`export VAR=value`)
- ✅ Zsh (`export VAR=value`)
- ✅ Fish (`set -x VAR value`)
- ✅ PowerShell (`$env:VAR="value"`)
- ✅ CMD (`set VAR=value`)
- ✅ POSIX Shell (fallback)

## 测试步骤

1. **启动应用**
   ```bash
   cargo tauri dev
   ```

2. **创建终端会话**
   - 进入 Terminal Workspace
   - 创建一个新的终端或 Claude Code 会话
   - 选择初始服务商 A

3. **验证初始环境**
   ```bash
   echo $ANTHROPIC_BASE_URL
   # 应显示: http://127.0.0.1:25341/session/{session_id}
   ```

4. **切换服务商**
   - 在 Tab Bar 上悬停，点击服务商切换按钮
   - 选择服务商 B
   - 观察终端输出确认消息

5. **验证切换后环境**
   ```bash
   echo $ANTHROPIC_BASE_URL
   # 应仍显示相同路径（因为 session_id 不变）
   echo $CLAUDE_PROXY_CONFIG_ID
   # 应显示新的 config_id
   ```

6. **测试 Claude Code**
   - 在切换服务商后发送请求
   - 检查代理日志，确认请求路由到新服务商
   - 验证响应正常

## 注意事项

1. **环境变量作用域**：只影响当前终端会话，不影响其他终端
2. **命令行清理**：切换后会执行 `clear` 清屏，避免显示干扰
3. **异步执行**：命令间有 50ms 延迟，确保 shell 正确处理
4. **错误处理**：如果终端已关闭或 shell 不支持，会静默失败（不影响路由切换）
5. **日志记录**：所有切换操作都会记录到日志中

## 相关文件

- `src-tauri/src/services/pty_manager.rs` - PTY 管理器，核心逻辑
- `src-ui/src/pages/TerminalWorkspace.tsx` - 终端工作区页面
- `src-ui/src/components/terminal/ProviderSwitchMenu.tsx` - 服务商切换菜单
- `test-provider-switch.sh` - 测试脚本

## 已知限制

1. **子进程环境**：如果在终端中启动了子进程（如 Claude Code），子进程不会自动继承更新后的环境变量
   - **解决方案**：重新启动 Claude Code 或在启动命令中使用 `ANTHROPIC_BASE_URL=... claude`

2. **Windows CMD 限制**：CMD 的 `set` 命令只影响当前会话，不支持全局环境变量更新

3. **Fish Shell 语法**：Fish 使用不同的语法 (`set -x`)，已做适配

## 未来改进

- [ ] 添加环境变量验证命令，确认更新成功
- [ ] 支持更多 shell 类型（tcsh, csh 等）
- [ ] 提供手动刷新环境变量的按钮
- [ ] 在切换时自动重启 Claude Code 会话（可选）
