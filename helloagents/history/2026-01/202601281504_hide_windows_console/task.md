# 任务清单: Windows 启动黑框修复（隐藏控制台窗口）

目录: `helloagents/plan/202601281504_hide_windows_console/`

---

## 1. Windows 启动行为
- [√] 1.1 在 `src-tauri/src/main.rs` 中将 `windows_subsystem = "windows"` 调整为 Windows 平台始终启用（避免安装版启动时弹出黑色控制台窗口）

## 2. 文档更新
- [√] 2.1 更新 `helloagents/wiki/modules/environment-setup.md`
- [√] 2.2 更新 `helloagents/CHANGELOG.md`

## 3. 验证
- [√] 3.1 运行 `cargo check -q` 确认编译通过
