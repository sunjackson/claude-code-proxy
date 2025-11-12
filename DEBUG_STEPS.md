# 仪表盘加载失败调试步骤

## 1. 检查浏览器控制台错误

打开开发者工具（F12 或 Cmd+Option+I），查看 Console 选项卡：
- 查找红色错误信息
- 特别注意 "Failed to load dashboard data" 后面的详细错误

## 2. 检查后端日志

在运行 `./start-dev.sh` 的终端窗口中查找：
- 数据库初始化是否成功
- 是否有 Tauri command 调用失败的日志
- 查找包含 "error" 或 "failed" 的行

## 3. 检查数据库文件

数据库位置：`~/Library/Application Support/com.claude-code-router.app/database.db`

可以使用以下命令检查：
```bash
# 查看数据库文件是否存在
ls -lh ~/Library/Application\ Support/com.claude-code-router.app/

# 使用 sqlite3 检查表结构
sqlite3 ~/Library/Application\ Support/com.claude-code-router.app/database.db ".tables"

# 检查关键表的数据
sqlite3 ~/Library/Application\ Support/com.claude-code-router.app/database.db "SELECT * FROM AppSettings;"
sqlite3 ~/Library/Application\ Support/com.claude-code-router.app/database.db "SELECT * FROM ConfigGroup;"
sqlite3 ~/Library/Application\ Support/com.claude-code-router.app/database.db "SELECT * FROM ProxyService;"
```

## 4. 可能的失败原因

Dashboard 在启动时会调用以下 4 个 API：
1. `get_proxy_status` - 获取代理服务状态
2. `list_config_groups` - 获取配置分组列表
3. `list_api_configs` - 获取 API 配置列表
4. `get_switch_logs` - 获取切换日志（最近5条）

任何一个失败都会导致"加载数据失败"。

## 5. 快速测试

在浏览器控制台执行以下代码测试单个 API：

```javascript
// 测试获取代理状态
window.__TAURI__.core.invoke('get_proxy_status')
  .then(result => console.log('Proxy Status:', result))
  .catch(err => console.error('Proxy Status Error:', err));

// 测试获取配置分组
window.__TAURI__.core.invoke('list_config_groups')
  .then(result => console.log('Config Groups:', result))
  .catch(err => console.error('Config Groups Error:', err));

// 测试获取 API 配置
window.__TAURI__.core.invoke('list_api_configs', { groupId: null })
  .then(result => console.log('API Configs:', result))
  .catch(err => console.error('API Configs Error:', err));

// 测试获取切换日志
window.__TAURI__.core.invoke('get_switch_logs', { groupId: null, limit: 5, offset: 0 })
  .then(result => console.log('Switch Logs:', result))
  .catch(err => console.error('Switch Logs Error:', err));
```

## 6. 重置数据库（如果需要）

如果怀疑数据库损坏，可以删除并重新初始化：

```bash
# 备份旧数据库
mv ~/Library/Application\ Support/com.claude-code-router.app/database.db \
   ~/Library/Application\ Support/com.claude-code-router.app/database.db.backup

# 重新启动应用，会自动创建新数据库
```
