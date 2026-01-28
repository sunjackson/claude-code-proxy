# 模块：Claude Code 配置与快速检测

## 现状与定位

- 项目聚焦：Claude Code 快速代理转发 + skills/MCP 配置快速检测
- UI 策略：安装/更新/验证能力暂不作为主要入口展示（仅下线入口，保留后端能力以便回滚）

## 变更（2026-01-27）

- 前端新增“快速检测”主入口：只做 skills/MCP 的可读/可解析/统计展示。
- 前端下线安装/更新/验证相关入口（不删除后端实现）。
- 后端仍保留 MCP/Slash Commands 的读取能力，供快速检测与配置管理使用。

## 变更（2026-01-28）

- Windows 终端适配：PTY 默认优先使用 PowerShell/pwsh，并注入 UTF-8 初始化（减少中文/Unicode 乱码）。
- Claude Code 终端会话：PowerShell 下按参数数组方式执行 `claude`，避免空格/引号导致的参数解析问题；cmd 回退分支保留 `chcp 65001`。
- 前端终端：xterm 根据 OS 自动启用 `windowsMode`，并补充 Windows 字体 fallback。
- Claude Code 配置页进一步收敛：移除安装/更新/验证/环境检测页内逻辑，仅保留快速检测与配置管理入口。
- Windows 启动体验：强制使用 GUI 子系统构建（避免安装版启动时弹出黑色控制台窗口）。

## 影响范围

- 不再引导用户在应用内完成 Claude Code 安装/更新/验证。
- 可通过“快速检测”快速确认 skills 与 MCP 配置是否可被读取与解析。
