# 终端服务商切换 - 静默后台执行方案

## 问题回顾

**原方案问题**：
- 切换服务商时，`export` 命令会显示在 Claude Code 界面中
- 影响用户体验，看起来像是命令干扰
- 虽然功能正常，但不够优雅

**用户期望**：
- 切换服务商应该是**完全静默**的后台操作
- 不应该在 Claude Code 界面中显示任何命令
- 环境变量自动更新，无需用户感知

## 新方案：静默 Source 执行

### 核心思路

使用 Shell 的 `source`（`.`）命令配合输出重定向，实现完全静默的环境变量更新：

```bash
# 传统方案（显示命令）
export ANTHROPIC_BASE_URL="..."
export HTTP_PROXY="..."
clear
echo "✓ Switched"

# 新方案（完全静默）
. /tmp/claude-proxy-env-xxx.sh >/dev/null 2>&1; rm -f /tmp/claude-proxy-env-xxx.sh
```

### 工作流程

```
1. 用户点击切换服务商
         ↓
2. 后端创建临时环境变量脚本文件
   /tmp/claude-proxy-env-{session_id}.sh
   内容:
   #!/bin/bash
   export ANTHROPIC_BASE_URL="http://127.0.0.1:25341/session/xxx"
   export CLAUDE_PROXY_CONFIG_ID="3"
   export HTTP_PROXY="http://127.0.0.1:25341"
   export HTTPS_PROXY="http://127.0.0.1:25341"
         ↓
3. 向终端发送一行静默命令
   . /tmp/claude-proxy-env-xxx.sh >/dev/null 2>&1; rm -f /tmp/claude-proxy-env-xxx.sh
         ↓
4. Shell 执行：
   - source 脚本 → 更新环境变量（静默）
   - 删除临时文件 → 清理痕迹
         ↓
5. 用户完全无感知，Claude Code 界面不受影响 ✅
```

## 实现细节

### 1. 创建临时环境变量文件

```rust
fn create_env_update_file(&self, session_id: &str, config_id: i64) -> Result<String, String> {
    let proxy_url = format!("http://127.0.0.1:{}", self.proxy_port);
    let anthropic_base_url = format!("http://127.0.0.1:{}/session/{}", self.proxy_port, session_id);

    // 创建临时文件
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("claude-proxy-env-{}.sh", session_id));

    // 写入环境变量导出命令
    let mut content = String::new();
    content.push_str("#!/bin/bash\n");
    content.push_str(&format!("export ANTHROPIC_BASE_URL=\"{}\"\n", anthropic_base_url));
    content.push_str(&format!("export CLAUDE_PROXY_CONFIG_ID=\"{}\"\n", config_id));
    content.push_str(&format!("export HTTP_PROXY=\"{}\"\n", proxy_url));
    content.push_str(&format!("export HTTPS_PROXY=\"{}\"\n", proxy_url));
    // ...

    std::fs::File::create(&file_path)?.write_all(content.as_bytes())?;

    Ok(file_path.to_string_lossy().to_string())
}
```

### 2. 静默执行并自动清理

```rust
pub async fn switch_config(&self, session_id: &str, new_config_id: i64) -> Result<(), String> {
    // 1. 更新路由映射
    SESSION_CONFIG_MAP.switch(session_id, new_config_id);

    // 2. 创建临时环境变量文件
    let env_file_path = self.create_env_update_file(session_id, new_config_id)?;

    // 3. 构建静默执行命令
    // . {file} >/dev/null 2>&1 → source 文件并重定向所有输出到 /dev/null
    // rm -f {file}            → 删除临时文件
    let source_cmd = format!(". {} >/dev/null 2>&1; rm -f {}\n", env_file_path, env_file_path);

    // 4. 发送到终端（完全静默）
    self.write_input(session_id, source_cmd.as_bytes()).await.ok();

    Ok(())
}
```

## 命令解析

### `. file >/dev/null 2>&1`

| 部分 | 作用 | 说明 |
|------|------|------|
| `.` | source 命令 | 在当前 shell 中执行文件，环境变量保留 |
| `file` | 脚本路径 | 临时环境变量文件 |
| `>/dev/null` | 重定向 stdout | 标准输出（echo等）丢弃 |
| `2>&1` | 重定向 stderr | 错误输出也丢弃到 stdout（即 /dev/null） |

结果：**完全静默执行，无任何输出**

### `;` 和 `rm -f`

| 部分 | 作用 | 说明 |
|------|------|------|
| `;` | 命令分隔符 | 顺序执行两条命令 |
| `rm -f` | 强制删除 | `-f` 不提示，即使文件不存在也不报错 |

结果：**执行后自动清理，不留痕迹**

## 为什么这样就不会显示了？

### 对比分析

#### 原方案（显示命令）

```bash
# 我们发送的内容（多行，每行一个命令）
export ANTHROPIC_BASE_URL="http://127.0.0.1:25341/session/xxx"
export CLAUDE_PROXY_CONFIG_ID="3"
export HTTP_PROXY="http://127.0.0.1:25341"
clear
echo "✓ Switched to provider (config_id=3)"

# 终端行为：
# 1. 显示每一行命令（因为是交互式输入）
# 2. 执行每一行命令
# 3. 显示 echo 的输出
# 结果：用户看到所有命令和输出 ❌
```

#### 新方案（完全静默）

```bash
# 我们发送的内容（单行命令）
. /tmp/claude-proxy-env-xxx.sh >/dev/null 2>&1; rm -f /tmp/claude-proxy-env-xxx.sh

# 终端行为：
# 1. 显示这一行命令（但很快执行）
# 2. source 文件 → 执行所有 export（输出被重定向到 /dev/null）
# 3. 删除临时文件
# 4. 没有任何输出（因为 >/dev/null 2>&1）
# 结果：用户只看到一行很快消失的命令，无任何输出 ✅
```

### 关键差异

| 特性 | 原方案 | 新方案 |
|------|--------|--------|
| 发送命令数 | 多行（6-8行） | 单行 |
| 命令可见性 | 每行都显示 | 只显示 source 行 |
| 执行输出 | 有（echo 输出） | 无（重定向到 /dev/null） |
| 清屏操作 | 有（clear） | 无（不需要） |
| 临时文件 | 无 | 有（自动删除） |
| 用户感知 | 明显 ❌ | 几乎无感 ✅ |

## 优势

1. **完全静默**：所有输出都被 `/dev/null` 吸收
2. **单行命令**：只发送一行，快速执行完毕
3. **自动清理**：临时文件执行后立即删除
4. **无界面干扰**：Claude Code 界面不受影响
5. **兼容性好**：所有 POSIX shell 都支持 `.` 和重定向

## 局限性

1. **仍有一行闪现**：
   - 即使只有一行，终端仍会短暂显示 `. /tmp/...` 命令
   - 但由于执行很快，用户基本无感知
   - 这是 PTY 机制的限制，无法完全避免

2. **临时文件依赖**：
   - 需要写入临时目录的权限
   - 如果磁盘满或权限不足会失败

3. **安全考虑**：
   - 临时文件可能被其他进程读取（极短时间窗口）
   - 但内容只是代理 URL，不包含敏感信息

## 进一步优化（可选）

如果连一行闪现都不想要，可以考虑：

### 方案 A：使用 `eval`（不推荐）

```bash
eval "$(echo 'export ANTHROPIC_BASE_URL=...; export HTTP_PROXY=...')" >/dev/null 2>&1
```

**问题**：
- `eval` 有安全风险
- 字符串转义复杂
- 不推荐使用

### 方案 B：使用进程替换（推荐，如果 shell 支持）

```bash
. <(cat <<'EOF'
export ANTHROPIC_BASE_URL="..."
export HTTP_PROXY="..."
EOF
) >/dev/null 2>&1
```

**优势**：
- 无临时文件
- 完全在内存中执行
- 更安全

**劣势**：
- 需要 Bash/Zsh（不是所有 shell 都支持 `<()` 语法）
- 实现更复杂

## 测试步骤

1. **启动应用并创建终端**
   ```bash
   cargo tauri dev
   # 进入 Terminal Workspace，创建 Claude Code 会话
   ```

2. **切换服务商**
   - 在 Tab Bar 点击服务商切换按钮
   - 选择另一个服务商

3. **观察 Claude Code 界面**
   - ✅ 应该看到**极短暂**的一行命令闪现
   - ✅ 界面立即恢复正常，无任何输出
   - ✅ 不影响正在进行的 Claude Code 交互

4. **验证环境变量**
   ```bash
   # 在终端中手动检查（不影响 Claude Code）
   echo $ANTHROPIC_BASE_URL
   echo $CLAUDE_PROXY_CONFIG_ID
   ```

5. **测试代理路由**
   - 在 Claude Code 中发送请求
   - 检查代理日志，确认路由到新服务商

## 相关文件

- ✅ `src-tauri/src/services/pty_manager.rs`
  - `switch_config()` - 主切换逻辑
  - `create_env_update_file()` - 创建临时环境文件

## 总结

**新方案优势**：
- ✅ 静默执行（所有输出重定向到 /dev/null）
- ✅ 单行命令（快速执行）
- ✅ 自动清理（临时文件自动删除）
- ✅ 几乎无感知（只有极短暂的一行闪现）

**vs 原方案**：
- ❌ 原方案：6-8 行命令 + 清屏 + 提示输出
- ✅ 新方案：1 行命令 + 无输出 + 自动清理

**结论**：新方案实现了**接近完美的静默切换**，用户体验大幅提升！🎉
