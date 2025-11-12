# 配置编辑时显示 API 密钥功能

## 修改日期
2025-11-10

## 问题描述

用户反馈：保存完 API 配置后，再次点击编辑时不会显示 API 秘钥。

### 原因分析

在 `src-ui/src/components/ConfigEditor.tsx` 第 94 行，编辑模式下故意将 API key 设置为空字符串：

```typescript
setApiKey(''); // 编辑模式不显示原密钥
```

这是出于安全考虑的原始设计：
- **优点**：防止 API key 在编辑界面上意外暴露
- **缺点**：用户无法查看和确认当前使用的 API key
- **问题**：用户体验不佳，特别是在需要确认或修改 API key 时

## 解决方案

在编辑模式下添加一个"显示当前密钥"按钮，让用户可以选择性地查看当前的 API key。

### 设计要点

1. **默认隐藏**：编辑时默认不显示 API key（保持安全性）
2. **按需显示**：提供"显示当前密钥"按钮，用户点击后加载并显示
3. **自动显示**：加载密钥后自动切换到明文显示模式
4. **状态提示**：显示加载状态（"加载中..."）

## 修改内容

### 文件：`src-ui/src/components/ConfigEditor.tsx`

#### 1. 导入配置 API（第 15 行）

```typescript
import * as configApi from '../api/config';
```

#### 2. 添加加载状态（第 58 行）

```typescript
const [loadingApiKey, setLoadingApiKey] = useState(false);
```

#### 3. 添加加载函数（第 92-107 行）

```typescript
// 加载当前API密钥
const loadCurrentApiKey = async () => {
  if (!config) return;

  try {
    setLoadingApiKey(true);
    const key = await configApi.getApiKey(config.id);
    setApiKey(key);
    setShowApiKey(true); // 加载后自动显示
  } catch (err) {
    console.error('Failed to load API key:', err);
    setErrors({ ...errors, apiKey: '加载API密钥失败' });
  } finally {
    setLoadingApiKey(false);
  }
};
```

#### 4. 更新 UI - 添加"显示当前密钥"按钮（第 258-330 行）

**修改前**：
```tsx
<label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
  API 密钥 {!config && <span className="text-red-500">*</span>}
  {config && (
    <span className="text-gray-500 text-xs ml-2">
      (留空表示不修改)
    </span>
  )}
</label>
```

**修改后**：
```tsx
<div className="flex items-center justify-between mb-2">
  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300">
    API 密钥 {!config && <span className="text-red-500">*</span>}
    {config && (
      <span className="text-gray-500 text-xs ml-2">
        (留空表示不修改)
      </span>
    )}
  </label>
  {config && !apiKey && (
    <button
      type="button"
      onClick={loadCurrentApiKey}
      disabled={loadingApiKey}
      className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors disabled:opacity-50"
    >
      {loadingApiKey ? '加载中...' : '显示当前密钥'}
    </button>
  )}
</div>
```

## 功能说明

### 使用流程

1. **编辑配置**：
   - 在配置列表中点击"编辑"按钮
   - 打开编辑对话框

2. **查看密钥**（可选）：
   - API 密钥输入框默认为空
   - 点击右上角的"显示当前密钥"按钮
   - 系统从后端加载当前的 API key
   - 自动切换到明文显示模式

3. **修改或保留**：
   - 如果不需要修改，留空即可（保持原密钥）
   - 如果需要修改，输入新的密钥
   - 点击"保存"提交更改

### 按钮显示逻辑

"显示当前密钥"按钮只在以下条件下显示：
- `config` 存在（编辑模式）
- `apiKey` 为空（尚未加载密钥）

一旦加载了密钥，按钮会消失，因为密钥已经显示在输入框中。

### 安全考虑

1. **按需加载**：
   - 不自动加载 API key
   - 只在用户明确点击时才加载
   - 减少密钥暴露的机会

2. **明文显示控制**：
   - 加载后自动显示明文
   - 用户可以随时切换显示/隐藏
   - 使用眼睛图标切换按钮

3. **错误处理**：
   - 加载失败时显示错误提示
   - 不影响其他功能的使用

## 相关 API

### 前端 API：`getApiKey(configId: number)`

**位置**：`src-ui/src/api/config.ts` 第 144-146 行

```typescript
/**
 * 获取 API 密钥(明文)
 *
 * ⚠️ 安全提示: 此函数返回明文 API 密钥,请谨慎使用
 */
export async function getApiKey(configId: number): Promise<string> {
  return await invoke('get_api_key', { configId });
}
```

### 后端命令：`get_api_key`

**位置**：`src-tauri/src/commands/api_config.rs` 第 98-111 行

```rust
/// 获取 API 密钥(明文)
///
/// # 参数
/// - `config_id`: 配置ID
/// - `pool`: 数据库连接池
///
/// # 安全提示
/// 此命令返回明文 API 密钥,请谨慎使用
#[tauri::command]
pub fn get_api_key(config_id: i64, pool: State<'_, Arc<DbPool>>) -> AppResult<String> {
    log::debug!("获取 API 密钥: config_id {}", config_id);
    pool.with_connection(|conn| ApiConfigService::get_api_key(conn, config_id))
}
```

### 服务方法：`ApiConfigService::get_api_key`

**位置**：`src-tauri/src/services/api_config.rs` 第 558-576 行

```rust
/// 获取 API 密钥(从数据库读取)
///
/// # 参数
/// - `conn`: 数据库连接
/// - `config_id`: 配置ID
///
/// # 返回
/// - `Ok(String)`: API密钥明文
/// - `Err(AppError)`: 获取失败
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

## UI 截图说明

### 编辑模式 - 未加载密钥

```
┌─────────────────────────────────────────────┐
│ 编辑 API 配置                                │
├─────────────────────────────────────────────┤
│                                             │
│ 配置名称 *                                   │
│ ┌─────────────────────────────────────┐    │
│ │ 公司 API 1                           │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ API 密钥 * (留空表示不修改)  [显示当前密钥]  │
│ ┌─────────────────────────────────────┐ 👁  │
│ │ ••••••••••••••••••••••••••••••••••  │    │
│ └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### 编辑模式 - 已加载密钥

```
┌─────────────────────────────────────────────┐
│ 编辑 API 配置                                │
├─────────────────────────────────────────────┤
│                                             │
│ 配置名称 *                                   │
│ ┌─────────────────────────────────────┐    │
│ │ 公司 API 1                           │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ API 密钥 * (留空表示不修改)                  │
│ ┌─────────────────────────────────────┐ 👁  │
│ │ sk-ant-api03-xxxxx...               │    │
│ └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

## 测试验证

### 测试步骤

1. **创建新配置**：
   - 打开应用
   - 进入"配置管理"页面
   - 点击"新建配置"
   - 输入配置信息和 API key
   - 保存配置

2. **编辑配置 - 不查看密钥**：
   - 点击配置的"编辑"按钮
   - 验证 API 密钥字段为空
   - 验证显示"显示当前密钥"按钮
   - 修改其他字段（如名称）
   - 点击"保存"
   - 验证配置更新成功，API key 未改变

3. **编辑配置 - 查看密钥**：
   - 点击配置的"编辑"按钮
   - 点击"显示当前密钥"按钮
   - 验证按钮显示"加载中..."
   - 验证密钥成功加载并显示在输入框中
   - 验证自动切换到明文显示
   - 验证"显示当前密钥"按钮消失

4. **编辑配置 - 修改密钥**：
   - 点击"显示当前密钥"加载密钥
   - 修改 API key
   - 点击"保存"
   - 验证新密钥保存成功

5. **错误处理**：
   - 尝试加载不存在的配置的密钥
   - 验证显示错误提示

### 预期结果

- ✅ 默认不显示 API key（保持安全性）
- ✅ 点击按钮可以加载并显示当前密钥
- ✅ 加载时显示"加载中..."状态
- ✅ 加载后自动显示明文
- ✅ 留空保存不会改变原密钥
- ✅ 输入新密钥可以成功更新

## 相关文档

- [移除钥匙串存储](./REMOVE_KEYCHAIN.md)
- [配置预览功能](./CHANGES_CONFIG_PREVIEW.md)

## 总结

### 改进效果

**之前**：
- ❌ 编辑时无法查看当前 API key
- ❌ 不知道当前使用的是哪个密钥
- ❌ 需要重新输入密钥才能确认

**现在**：
- ✅ 可以按需查看当前密钥
- ✅ 默认隐藏保持安全性
- ✅ 加载状态清晰可见
- ✅ 用户体验更好

### 技术要点

1. **按需加载**：只在用户点击时才从后端加载 API key
2. **状态管理**：使用 `loadingApiKey` 状态跟踪加载过程
3. **自动显示**：加载成功后自动切换到明文显示模式
4. **条件渲染**：按钮只在需要时显示（编辑模式 + 密钥未加载）
5. **错误处理**：加载失败时显示友好的错误提示

### 安全建议

虽然现在可以查看密钥，但仍然建议：

1. **谨慎使用**：只在必要时查看密钥
2. **屏幕隐私**：查看密钥时注意周围环境
3. **及时隐藏**：查看完成后点击眼睛图标隐藏
4. **定期更新**：定期更换 API key 提高安全性
