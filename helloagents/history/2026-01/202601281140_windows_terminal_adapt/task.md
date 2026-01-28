# 任务清单: Windows 终端适配（PTY + xterm）

目录: `helloagents/plan/202601281140_windows_terminal_adapt/`

---

## 1. Windows PTY 启动兼容
- [√] 1.1 在 `src-tauri/src/services/pty_manager.rs` 中优化 Windows 默认 shell 选择（优先 PowerShell/pwsh），避免 `cmd /K ... & cmd` 嵌套导致的异常交互
- [√] 1.2 在 `src-tauri/src/services/pty_manager.rs` 中为 Windows shell 注入 UTF-8 相关初始化（`chcp 65001` + PowerShell OutputEncoding），减少中文/Unicode 乱码
- [√] 1.3 在 `src-tauri/src/services/pty_manager.rs` 中为 Claude Code 会话构造 PowerShell 友好的启动脚本（参数安全拼装、claude 执行后保持交互）

## 2. 前端 xterm Windows 体验
- [√] 2.1 在 `src-ui/src/components/terminal/TerminalPanel.tsx` 中根据 OS 自动启用 `windowsMode`，并在非 macOS 禁用 `macOptionIsMeta`
- [√] 2.2 在 `src-ui/src/components/terminal/TerminalPanel.tsx` 中补充 Windows 常见字体 fallback（Consolas/Cascadia Mono 等）

## 3. 回归验证（快速检测 + MCP）
- [√] 3.1 验证 Claude Code 配置页“快速检测”在 MCP 条目缺失 `command` 时不再整体报错（仅标记 invalid）

## 4. 安全检查
- [√] 4.1 执行安全检查（按G9：避免明文密钥、避免危险命令与不可逆操作）

## 5. 文档更新
- [√] 5.1 更新 `helloagents/wiki/modules/environment-setup.md`
- [√] 5.2 更新 `helloagents/CHANGELOG.md`

## 6. 测试
- [√] 6.1 运行 `cargo test -q`（至少覆盖本次变更相关单测）
- [√] 6.2 运行 `pnpm -C src-ui build`
