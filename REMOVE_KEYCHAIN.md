# 移除钥匙串存储，改用数据库直接存储 API Key

## 修改日期
2025-11-10

## 问题描述

### 用户反馈
在配置管理中点击测试时，macOS 会提示使用系统钥匙串，需要用户授权。这给用户带来了不便。

**原始设计**：
- API Key 存储在系统钥匙串中（macOS Keychain、Windows DPAPI、Linux Secret Service）
- 数据库中只存储 `[ENCRYPTED]` 占位符
- 每次测试或使用配置时，需要从钥匙串读取 API Key

**问题**：
- macOS 每次读取钥匙串都会弹出授权提示
- 用户体验不佳

## 解决方案

将 API Key 直接存储在数据库中，不再使用系统钥匙串。

**修改后的设计**：
- API Key 直接存储在数据库的 `api_key` 字段中
- 创建、更新、删除配置时，直接操作数据库
- 测试或使用配置时，直接从数据库读取

## 修改的文件

### 1. 后端文件（Rust）

#### 1.1 `src-tauri/src/services/api_config.rs`

**修改内容**：

1. **移除 KeychainManager 导入**（第 3 行）
   ```rust
   // 删除
   use crate::services::KeychainManager;
   ```

2. **创建配置方法**（第 86-112 行）
   - 将 `'[ENCRYPTED]'` 占位符改为实际的 API key
   - 删除钥匙串存储调用
   ```rust
   // 修改前
   VALUES (?1, '[ENCRYPTED]', ?2, ...)
   KeychainManager::set_api_key(id, &input.api_key)?;

   // 修改后
   VALUES (?1, ?2, ?3, ...)  // 直接存储 api_key
   // 删除钥匙串调用
   ```

3. **更新配置方法**（第 409-413 行）
   - 将钥匙串更新改为数据库更新
   ```rust
   // 修改前
   if let Some(ref api_key) = input.api_key {
       KeychainManager::set_api_key(input.id, api_key)?;
   }

   // 修改后
   if let Some(ref api_key) = input.api_key {
       updates.push("api_key = ?");
       params.push(Box::new(api_key.clone()));
   }
   ```

4. **删除配置方法**（第 459-470 行）
   - 删除钥匙串删除操作
   ```rust
   // 删除这部分代码
   if let Err(e) = KeychainManager::delete_api_key(config_id) {
       log::warn!("删除配置 {} 的 API 密钥失败: {}", config_id, e);
   }
   ```

5. **get_api_key 方法**（第 558-576 行）
   - 从钥匙串读取改为从数据库读取
   - 添加数据库连接参数
   ```rust
   // 修改前
   pub fn get_api_key(config_id: i64) -> AppResult<String> {
       KeychainManager::get_api_key(config_id)
   }

   // 修改后
   pub fn get_api_key(conn: &Connection, config_id: i64) -> AppResult<String> {
       conn.query_row(
           "SELECT api_key FROM ApiConfig WHERE id = ?1",
           [config_id],
           |row| row.get(0),
       )
       .map_err(|e| AppError::DatabaseError {
           message: format!("获取 API 密钥失败: {}", e),
       })
   }
   ```

#### 1.2 `src-tauri/src/services/api_test.rs`

**修改内容**：

1. **移除 KeychainManager 导入**（第 15 行）
   ```rust
   // 删除
   use crate::services::keychain::KeychainManager;
   ```

2. **test_single_config 方法**（第 72-78 行）
   - 直接从 config 对象读取 API key
   ```rust
   // 修改前
   let api_key = match KeychainManager::get_api_key(config_id) {
       Ok(key) => key,
       Err(e) => {
           log::error!("Failed to get API key for config {}: {}", config_id, e);
           return Ok(self.create_failed_result(
               config_id,
               &format!("无法获取 API 密钥: {}", e),
           ));
       }
   };

   // 修改后
   let api_key = &config.api_key;
   ```

#### 1.3 `src-tauri/src/services/config_manager.rs`

**修改内容**：

**删除分组方法**（第 267-284 行）
- 删除批量删除钥匙串的代码
```rust
// 删除这部分代码
let config_ids: Vec<i64> = conn
    .prepare("SELECT id FROM ApiConfig WHERE group_id = ?1")
    .and_then(|mut stmt| {
        stmt.query_map([group_id], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()
    })
    .map_err(|e| AppError::DatabaseError {
        message: format!("查询配置ID列表失败: {}", e),
    })?;

for config_id in &config_ids {
    if let Err(e) = crate::services::KeychainManager::delete_api_key(*config_id) {
        log::warn!("删除配置 {} 的 API 密钥失败: {}", config_id, e);
    }
}
```

#### 1.4 `src-tauri/src/commands/api_config.rs`

**修改内容**：

**get_api_key 命令**（第 98-111 行）
- 添加数据库连接池参数
- 使用连接调用服务方法
```rust
// 修改前
#[tauri::command]
pub fn get_api_key(config_id: i64) -> AppResult<String> {
    log::debug!("获取 API 密钥: config_id {}", config_id);
    ApiConfigService::get_api_key(config_id)
}

// 修改后
#[tauri::command]
pub fn get_api_key(config_id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<String> {
    log::debug!("获取 API 密钥: config_id {}", config_id);
    pool.with_connection(|conn| ApiConfigService::get_api_key(conn, config_id))
}
```

#### 1.5 `src-tauri/src/proxy/router.rs`

**修改内容**：

**try_forward 方法**（第 143-155 行）
- 在同一个数据库连接中同时获取配置和 API key
```rust
// 修改前
let config = self.db_pool.with_connection(|conn| {
    ApiConfigService::get_config_by_id(conn, config_id)
})?;
let api_key = ApiConfigService::get_api_key(config_id)?;

// 修改后
let (config, api_key) = self.db_pool.with_connection(|conn| {
    let config = ApiConfigService::get_config_by_id(conn, config_id)?;
    let api_key = ApiConfigService::get_api_key(conn, config_id)?;
    Ok((config, api_key))
})?;
```

## 数据迁移

如果现有数据库中有配置使用了 `[ENCRYPTED]` 占位符，需要进行数据迁移：

### 检查现有配置

```bash
cd ~ && sqlite3 "Library/Application Support/com.claude-code-router/database.db" \
  "SELECT id, name, api_key FROM ApiConfig WHERE api_key = '[ENCRYPTED]';"
```

### 迁移方案

由于之前的 API key 存储在系统钥匙串中，现在改为数据库存储，有以下几种处理方式：

1. **推荐方式**：要求用户重新输入 API key
   - 在 UI 中提示用户："系统升级后需要重新配置 API Key"
   - 用户在配置管理页面重新输入 API key
   - 优点：简单、安全
   - 缺点：用户需要手动操作

2. **自动迁移**（如果需要）：
   - 需要在应用启动时检测 `[ENCRYPTED]` 占位符
   - 从钥匙串读取并更新到数据库
   - 然后删除钥匙串中的条目
   - 优点：对用户透明
   - 缺点：需要额外的迁移代码

## 编译和测试

### 编译检查

```bash
cd /Users/sunjackson/Project/claude-code-router/src-tauri
~/.cargo/bin/cargo check
```

**结果**：✅ 编译成功，无错误

### 测试验证

1. **创建新配置**：
   - 打开应用
   - 进入 "配置管理" 页面
   - 创建新的 API 配置
   - 验证数据库中 `api_key` 字段存储了实际的 key

2. **测试配置**：
   - 在配置列表中点击 "测试" 按钮
   - 验证不再弹出钥匙串授权提示
   - 测试应该能够正常进行

3. **更新配置**：
   - 修改配置的 API key
   - 验证数据库中的 key 被正确更新

4. **删除配置**：
   - 删除配置
   - 验证数据库记录被删除
   - 不需要清理钥匙串

### 数据库验证

```bash
# 检查配置的 api_key 字段
cd ~ && sqlite3 "Library/Application Support/com.claude-code-router/database.db" \
  "SELECT id, name, LENGTH(api_key) as key_length FROM ApiConfig;"

# 应该看到 key_length 不再是 11（"[ENCRYPTED]" 的长度）
# 而是实际 API key 的长度
```

## 安全考虑

### 之前的设计
- ✅ API key 存储在系统钥匙串中，利用操作系统的加密机制
- ❌ 每次访问需要系统授权，用户体验差

### 现在的设计
- ✅ 用户体验好，不需要额外授权
- ⚠️ API key 直接存储在 SQLite 数据库文件中

### 安全建议

1. **文件权限**：
   - 确保数据库文件只有当前用户可读写
   - macOS: `chmod 600 ~/Library/Application\ Support/com.claude-code-router/database.db`

2. **未来增强**（可选）：
   - 可以考虑对数据库文件进行加密
   - 或者对 `api_key` 字段使用应用级加密
   - 使用用户密码或设备密钥加密

3. **访问控制**：
   - 限制 `get_api_key` 命令的调用
   - 只在必要时暴露明文 API key

## 影响范围

### 用户影响
- ✅ 不再有钥匙串授权提示
- ✅ 测试配置更加流畅
- ⚠️ 可能需要重新输入 API key（如果有使用 `[ENCRYPTED]` 占位符的旧配置）

### 代码影响
- 删除了对 `keyring` crate 的依赖（可以在 `Cargo.toml` 中移除）
- 简化了代码逻辑，减少了钥匙串操作的错误处理

## 相关文档

- [配置预览功能](./CHANGES_CONFIG_PREVIEW.md)
- [NoConfigAvailable 错误修复](./BUGFIX_NO_CONFIG_AVAILABLE.md)
- [代理配置说明](./PROXY_CONFIG_EXPLANATION.md)

## 总结

### 修改文件列表
1. ✅ `src-tauri/src/services/api_config.rs` - 移除钥匙串调用，改用数据库存储
2. ✅ `src-tauri/src/services/api_test.rs` - 直接从配置对象读取 API key
3. ✅ `src-tauri/src/services/config_manager.rs` - 删除批量清理钥匙串的代码
4. ✅ `src-tauri/src/commands/api_config.rs` - 更新命令签名，添加数据库连接参数
5. ✅ `src-tauri/src/proxy/router.rs` - 优化数据库查询，同时获取配置和 API key

### 核心改进
1. ✅ 用户体验：不再有钥匙串授权提示
2. ✅ 代码简化：移除了系统钥匙串的复杂性
3. ✅ 性能优化：减少了系统调用
4. ✅ 编译成功：所有修改通过编译检查

### 后续工作
- 可选：添加数据库加密功能
- 可选：实现旧数据自动迁移
- 建议：更新用户文档，说明新的存储机制
