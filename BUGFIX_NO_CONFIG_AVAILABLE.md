# 修复分组切换"NoConfigAvailable"错误

## 问题描述

### 错误现象
在主页选择分组时出现错误，无法启动代理服务：
```
Failed to switch group: {error: "NoConfigAvailable"}
```

### 错误原因
数据库中的 API 配置的 `is_available` 字段被设置为 `0`（不可用）。当切换到该分组时，系统找不到任何可用的配置，导致报错。

## 问题分析

### 数据库状态
```sql
-- 分组数据
SELECT id, name FROM ConfigGroup;
-- 结果：
-- 1|未分组
-- 2|Cc

-- API配置数据
SELECT id, name, group_id, is_available FROM ApiConfig;
-- 结果（修复前）：
-- 1|88|2|0  ← is_available = 0 (不可用)
```

### 代码逻辑
在 `src-tauri/src/services/proxy_service.rs` 的 `switch_group()` 方法中：

```rust
// 获取分组中第一个可用的配置
let first_config = configs
    .into_iter()
    .find(|c| c.is_available)  // ← 只选择 is_available = true 的配置
    .ok_or(AppError::NoConfigAvailable)?;  // ← 找不到就报错
```

当分组中所有配置的 `is_available` 都是 `false` 时，就会抛出 `NoConfigAvailable` 错误。

## 解决方案

### 1. 立即修复：更新数据库
将现有配置的 `is_available` 设置为 `1`：

```bash
cd ~ && sqlite3 "Library/Application Support/com.claude-code-router/database.db" \
  "UPDATE ApiConfig SET is_available = 1 WHERE id = 1;"
```

**验证修复**：
```bash
cd ~ && sqlite3 "Library/Application Support/com.claude-code-router/database.db" \
  "SELECT id, name, group_id, is_available FROM ApiConfig;"
# 结果：
# 1|88|2|1  ← is_available = 1 (可用)
```

### 2. 改进：优化错误提示

更新 `src-ui/src/pages/Dashboard.tsx`，提供更友好的错误信息：

#### 切换分组错误处理
```typescript
const handleSwitchGroup = async (groupId: number) => {
  try {
    // ...
  } catch (err: any) {
    console.error('Failed to switch group:', err);

    let errorMessage = '切换分组失败';

    if (err && typeof err === 'object') {
      if (err.error === 'NoConfigAvailable') {
        errorMessage = '该分组中没有可用的配置。请先在"配置管理"页面添加或启用配置。';
      } else if (err.error === 'EmptyGroup') {
        errorMessage = '该分组为空。请先在"配置管理"页面添加配置。';
      } else if (err.message) {
        errorMessage = err.message;
      }
    }

    setError(errorMessage);
  }
};
```

#### 启动代理服务错误处理
```typescript
const handleStartProxy = async () => {
  try {
    // ...
  } catch (err: any) {
    console.error('Failed to start proxy:', err);

    let errorMessage = '启动代理服务失败';

    if (err && typeof err === 'object') {
      if (err.error === 'NoConfigAvailable') {
        errorMessage = '当前分组中没有可用的配置。请先在"配置管理"页面添加或启用配置。';
      } else if (err.error === 'EmptyGroup') {
        errorMessage = '当前分组为空。请先在"配置管理"页面添加配置。';
      } else if (err.error === 'PortInUse') {
        errorMessage = '代理端口已被占用。请检查是否有其他程序使用了该端口，或修改代理配置的端口号。';
      } else if (err.message) {
        errorMessage = err.message;
      }
    }

    setError(errorMessage);
  }
};
```

#### 切换配置错误处理
```typescript
const handleSwitchConfig = async (configId: number) => {
  try {
    // ...
  } catch (err: any) {
    console.error('Failed to switch config:', err);

    let errorMessage = '切换配置失败';

    if (err && typeof err === 'object') {
      if (err.error === 'ConfigUnavailable') {
        errorMessage = '该配置不可用。请先在"配置管理"页面启用该配置。';
      } else if (err.error === 'ConfigNotInGroup') {
        errorMessage = '该配置不属于当前分组。请先切换到对应的分组。';
      } else if (err.message) {
        errorMessage = err.message;
      }
    }

    setError(errorMessage);
  }
};
```

## 修改的文件

### 1. Dashboard.tsx
**路径**：`src-ui/src/pages/Dashboard.tsx`

**修改内容**：
- `handleStartProxy()` 方法：第 65-93 行
- `handleSwitchGroup()` 方法：第 95-124 行
- `handleSwitchConfig()` 方法：第 126-155 行

**修改类型**：改进错误处理，提供友好的错误提示

## 错误码对照表

| 错误码 | 含义 | 友好提示 | 解决方法 |
|--------|------|---------|---------|
| `NoConfigAvailable` | 分组中没有可用配置 | 该分组中没有可用的配置 | 在"配置管理"页面添加或启用配置 |
| `EmptyGroup` | 分组为空 | 该分组为空 | 在"配置管理"页面添加配置 |
| `ConfigUnavailable` | 配置不可用 | 该配置不可用 | 在"配置管理"页面启用该配置 |
| `ConfigNotInGroup` | 配置不在分组中 | 该配置不属于当前分组 | 先切换到对应的分组 |
| `PortInUse` | 端口被占用 | 代理端口已被占用 | 检查端口占用或修改端口号 |

## 预防措施

### 1. UI层面
在配置管理页面：
- 提供明显的"启用/禁用"开关
- 显示配置的可用状态
- 在删除或禁用最后一个可用配置时给出警告

### 2. 业务逻辑层面
在创建配置时：
- 默认设置 `is_available = 1`
- 确保至少有一个可用配置

### 3. 错误提示层面
- 提供清晰的错误信息
- 给出具体的解决方案
- 提供快捷操作链接

## 测试验证

### 测试步骤

1. **验证数据库修复**：
   ```bash
   cd ~ && sqlite3 "Library/Application Support/com.claude-code-router/database.db" \
     "SELECT id, name, group_id, is_available FROM ApiConfig;"
   ```
   确认 `is_available = 1`

2. **测试分组切换**：
   - 打开应用
   - 在主页选择分组 "Cc"
   - 应该能成功切换，不再报错

3. **测试启动代理**：
   - 选择分组后
   - 点击"启动代理"
   - 应该能成功启动

4. **测试错误提示**（可选）：
   - 手动将配置设置为不可用：
     ```sql
     UPDATE ApiConfig SET is_available = 0 WHERE id = 1;
     ```
   - 尝试切换分组
   - 应显示友好的错误提示
   - 恢复配置：
     ```sql
     UPDATE ApiConfig SET is_available = 1 WHERE id = 1;
     ```

## WebSocket 错误说明

错误信息中还包含 WebSocket 连接错误：
```
WebSocket connection to 'ws://localhost:5173/?token=...' failed
```

这是开发环境的热重载 WebSocket 连接问题，与代理功能无关：
- **原因**：Vite 开发服务器的 HMR (Hot Module Replacement) 连接中断
- **影响**：仅影响开发时的热重载功能，不影响应用核心功能
- **解决**：刷新页面或重启开发服务器即可

## 相关文档

- [代理配置说明](./PROXY_CONFIG_EXPLANATION.md)
- [热配置切换说明](./HOT_CONFIG_SWAP.md)
- [配置预览功能](./CHANGES_CONFIG_PREVIEW.md)

## 总结

### 问题根源
API 配置的 `is_available` 字段被设置为 `0`，导致系统找不到可用配置。

### 解决方案
1. ✅ 更新数据库，将配置设置为可用
2. ✅ 改进错误处理，提供友好的错误提示
3. ✅ 给出具体的解决方案和操作指引

### 改进效果
- **之前**：显示晦涩的错误码 `{error: "NoConfigAvailable"}`
- **现在**：显示清晰的提示 "该分组中没有可用的配置。请先在'配置管理'页面添加或启用配置。"

这样用户可以清楚地知道问题所在和如何解决。
