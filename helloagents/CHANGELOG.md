# HelloAGENTS 变更日志

## 2026-01-27

- 禁用环境检测（`detect_environment`/`detect_environment_enhanced`/`check_can_install*`），安装流程不再因检测失败而被阻断。
- UI 下线安装/更新/验证入口，新增 skills/MCP “快速检测”主入口（仅可读/可解析/统计）。

## 2026-01-28

- Windows 终端适配：PTY 默认优先使用 PowerShell/pwsh，并注入 UTF-8 初始化（减少中文/Unicode 乱码）。
- Claude Code 配置页进一步收敛：移除安装/更新/验证/环境检测页内逻辑，仅保留快速检测与配置管理入口。
- Windows 启动体验：避免安装版启动时弹出黑色控制台窗口（强制 GUI 子系统）。
- 修复构建 doctest：`ProtocolDetector` 文档示例使用正确的 crate 路径。
