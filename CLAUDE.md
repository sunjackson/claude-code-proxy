- 这是一个能支持windows、mac、linux等平台的客户端应用，整个设计思路以简洁高效方便操作为核心，UI设计以黑金样式为主

## Active Technologies
- 本地文件系统 (001-claude-code-proxy)
- Rust 1.70+ (Edition 2021), TypeScript 5.3+ (002-smart-switch-optimization)
- SQLite (embedded database via Rusqlite) (002-smart-switch-optimization)

## Recent Changes
- 001-claude-code-proxy: Added 本地文件系统
- 每次提交git前都要删除无用md文件以及测试代码，并且优化README文档。并且判断是否有必要更新版本号触发actions，如果是小的更新以及修复就不用更新版本号