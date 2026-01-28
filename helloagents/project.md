# claude-code-proxy（项目知识库）

## 项目概述

- 形态：Tauri 桌面应用（`src-tauri/` + `src-ui/`）
- 目标：提供 Claude Code Proxy 的快速代理转发与配置检测（skills / MCP）

## 关键模块

- 代理服务：`src-tauri/src/proxy/`、`src-tauri/src/commands/proxy_service.rs`、`src-ui/src/api/proxy.ts`
- Claude Code 配置入口：`src-ui/src/pages/ClaudeCodeSetup.tsx`
- 快速检测（skills / MCP）：`src-ui/src/components/QuickCheckPanel.tsx`
- skills（Slash Commands）扫描：`src-tauri/src/services/slash_commands.rs`
- MCP 配置管理：`src-tauri/src/services/mcp_config.rs`

## 重要决策记录

- 2026-01-27：屏蔽环境检测功能，避免在多种系统/网络场景下误判导致安装流程被拦截。
- 2026-01-27：回归“代理转发 + 配置检测”，UI 下线安装/更新/验证入口，新增 skills/MCP 快速检测主入口。
