# Bug修复总结 - 2025-11-11

## 配置分组删除Bug修复

### 🐛 问题描述
用户报告：删除一个配置分组后，重新启动应用，该分组仍然存在，删除操作没有生效。

### 🔍 根本原因
代码中存在**硬编码ID与实际数据不一致**的问题：

```rust
// ❌ 错误的假设
if group_id == 0 {  // 假设"未分组" ID 是 0
    return Err(...);
}

// ❌ 错误的硬编码
conn.execute(
    "UPDATE ApiConfig SET group_id = 0 WHERE group_id = ?1",  // 移动到 ID 0
    [group_id],
)
```

**实际情况**：
- 数据库使用 `AUTOINCREMENT`
- "未分组"的实际 ID 是 **5**，不是 0
- 导致删除保护失效，配置移动失败

### ✅ 修复方案

**src-tauri/src/services/config_manager.rs** - `delete_group()` 函数

1. **通过名称识别"未分组"** (第 231-240 行):
```rust
let group_name: String = conn
    .query_row(
        "SELECT name FROM ConfigGroup WHERE id = ?1",
        [group_id],
        |row| row.get(0),
    )
    .map_err(|_| AppError::NotFound {...})?;

if group_name == "未分组" {
    return Err(AppError::ValidationError {...});
}
```

2. **动态获取"未分组" ID** (第 250-258 行):
```rust
let default_group_id: i64 = conn
    .query_row(
        "SELECT id FROM ConfigGroup WHERE name = '未分组'",
        [],
        |row| row.get(0),
    )
    .map_err(|e| AppError::DatabaseError {...})?;
```

3. **使用查询到的 ID** (第 263-265 行):
```rust
conn.execute(
    "UPDATE ApiConfig SET group_id = ?1 WHERE group_id = ?2",
    [default_group_id, group_id],  // 使用实际的 ID
)
```

### 📊 修复效果

| 修复前 | 修复后 |
|-------|--------|
| ❌ 可以删除"未分组"（ID=5） | ✅ 无法删除"未分组" |
| ❌ 配置移动到不存在的ID 0 | ✅ 配置移动到正确的ID 5 |
| ❌ 重启后分组"复活" | ✅ 删除操作正确持久化 |
| ❌ 硬编码依赖 | ✅ 动态查询，无依赖 |

### 🧪 测试状态

- ✅ **编译验证**: 通过，无警告
- ✅ **应用启动**: 正常运行
- ✅ **测试数据**: 已准备
- ⏳ **手动测试**: 等待用户验证

**测试文档**: `BUGFIX_GROUP_DELETE_TEST_GUIDE.md`
**测试脚本**: `test-delete-group.sh`

### 📝 相关文件

**修改的文件**:
- `src-tauri/src/services/config_manager.rs` (第 219-286 行)

**文档**:
- `BUGFIX_GROUP_DELETE.md` - 详细分析报告（332 行）
- `BUGFIX_GROUP_DELETE_TEST_GUIDE.md` - 测试指南（273 行）

**测试工具**:
- `test-delete-group.sh` - 交互式测试脚本

### 💡 技术要点

1. **不依赖硬编码 ID**
   - 使用名称识别系统分组
   - 动态查询实际 ID
   - 适应任何 AUTOINCREMENT 值

2. **错误处理**
   - 分组不存在时返回 NotFound
   - 无法查询"未分组"时返回 DatabaseError
   - 清晰的错误信息

3. **事务一致性**
   - 所有操作在同一连接中执行
   - 失败时自动回滚
   - 成功时自动提交

### 🔧 后续建议

1. **单元测试**
   - 测试删除"未分组"失败
   - 测试删除普通分组成功
   - 测试配置正确移动

2. **数据库迁移** (可选)
   - 固定"未分组" ID 为 1
   - 简化逻辑

3. **系统分组标记** (推荐)
   - 添加 `is_system BOOLEAN` 字段
   - 更通用的保护机制

---

**修复完成时间**: 2025-11-11 22:11
**修复验证状态**: ✅ 已编译，⏳ 等待测试
**影响范围**: 仅后端（Rust），无需前端修改
**需要迁移**: ❌ 否
