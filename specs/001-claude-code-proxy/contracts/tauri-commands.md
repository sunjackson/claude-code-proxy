# Tauri Commands API 合约

**特性分支**: `001-claude-code-proxy` | **日期**: 2025-11-08
**架构**: Tauri (Rust 后端 + React 前端)
**通信协议**: Tauri IPC Commands

---

## 概述

本文档定义了 Tauri 应用中前端(React)与后端(Rust)之间的 IPC 通信接口合约。所有命令遵循 Tauri 的 `#[tauri::command]` 模式,使用 JSON 序列化传输数据。

**调用示例** (前端 React):
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke<ConfigGroup>('get_config_group', { groupId: 1 });
```

---

## 1. 配置分组管理 (Config Group Management)

### 1.1 列出所有配置分组

**命令**: `list_config_groups`

**输入**: 无

**输出**:
```typescript
interface ConfigGroup {
  id: number;
  name: string;
  description: string | null;
  auto_switch_enabled: boolean;
  latency_threshold_ms: number;
  created_at: string;  // ISO 8601 格式
  updated_at: string;
}

type Output = ConfigGroup[];
```

**错误**:
- `DatabaseError`: 数据库查询失败

**对应功能需求**: FR-005

---

### 1.2 创建配置分组

**命令**: `create_config_group`

**输入**:
```typescript
interface CreateConfigGroupInput {
  name: string;                    // 必填,唯一
  description?: string;            // 可选
  auto_switch_enabled?: boolean;   // 默认 false
  latency_threshold_ms?: number;   // 默认 3000
}
```

**输出**:
```typescript
type Output = ConfigGroup;  // 新创建的分组
```

**错误**:
- `ValidationError`: name 为空或已存在
- `DatabaseError`: 插入失败

**对应功能需求**: FR-005

---

### 1.3 更新配置分组

**命令**: `update_config_group`

**输入**:
```typescript
interface UpdateConfigGroupInput {
  id: number;                      // 必填
  name?: string;                   // 可选,唯一
  description?: string | null;     // 可选,null 表示清空
  auto_switch_enabled?: boolean;
  latency_threshold_ms?: number;
}
```

**输出**:
```typescript
type Output = ConfigGroup;  // 更新后的分组
```

**错误**:
- `NotFound`: 分组 ID 不存在
- `ValidationError`: name 已被其他分组使用
- `PermissionDenied`: 尝试修改"未分组"的系统保留分组
- `DatabaseError`: 更新失败

**对应功能需求**: FR-005

---

### 1.4 删除配置分组

**命令**: `delete_config_group`

**输入**:
```typescript
interface DeleteConfigGroupInput {
  id: number;
  delete_configs: boolean;  // true: 同时删除分组下的所有配置, false: 配置移到"未分组"
}
```

**输出**:
```typescript
interface DeleteConfigGroupOutput {
  deleted_group_id: number;
  affected_config_count: number;  // 被删除或移动的配置数量
}
```

**错误**:
- `NotFound`: 分组 ID 不存在
- `PermissionDenied`: 尝试删除"未分组"
- `InUse`: 分组正在被代理服务使用(current_group_id)
- `DatabaseError`: 删除失败

**对应功能需求**: FR-005

---

## 2. API 配置管理 (API Config Management)

### 2.1 列出配置(可按分组过滤)

**命令**: `list_api_configs`

**输入**:
```typescript
interface ListApiConfigsInput {
  group_id?: number | null;  // 可选,null 表示"未分组",undefined 表示所有配置
}
```

**输出**:
```typescript
interface ApiConfig {
  id: number;
  name: string;
  server_url: string;
  server_port: number;
  group_id: number | null;
  sort_order: number;
  is_available: boolean;
  last_test_at: string | null;
  last_latency_ms: number | null;
  created_at: string;
  updated_at: string;
  // 注意: api_key 不在输出中(安全考虑)
}

type Output = ApiConfig[];
```

**错误**:
- `DatabaseError`: 查询失败

**对应功能需求**: FR-006

---

### 2.2 创建 API 配置

**命令**: `create_api_config`

**输入**:
```typescript
interface CreateApiConfigInput {
  name: string;                // 必填,唯一
  api_key: string;             // 必填,将存储到系统密钥链
  server_url: string;          // 必填,HTTP/HTTPS URL
  server_port?: number;        // 默认 443
  group_id?: number | null;    // 可选,null 表示"未分组"
  sort_order?: number;         // 默认 0,系统自动调整为分组内最大值+1
}
```

**输出**:
```typescript
type Output = ApiConfig;  // 新创建的配置(不含 api_key)
```

**错误**:
- `ValidationError`: name 为空或已存在,server_url 格式不正确,api_key 为空
- `NotFound`: group_id 不存在
- `KeychainError`: 存储 API 密钥到系统密钥链失败
- `DatabaseError`: 插入失败

**对应功能需求**: FR-006

---

### 2.3 更新 API 配置

**命令**: `update_api_config`

**输入**:
```typescript
interface UpdateApiConfigInput {
  id: number;                      // 必填
  name?: string;                   // 可选,唯一
  api_key?: string;                // 可选,更新密钥链
  server_url?: string;
  server_port?: number;
  group_id?: number | null;        // 可选,null 移到"未分组"
  sort_order?: number;
}
```

**输出**:
```typescript
type Output = ApiConfig;  // 更新后的配置(不含 api_key)
```

**错误**:
- `NotFound`: 配置 ID 不存在
- `ValidationError`: name 已被其他配置使用,server_url 格式不正确
- `KeychainError`: 更新 API 密钥失败
- `InUse`: 配置正在被代理服务使用,无法修改(某些敏感字段)
- `DatabaseError`: 更新失败

**对应功能需求**: FR-006

---

### 2.4 删除 API 配置

**命令**: `delete_api_config`

**输入**:
```typescript
interface DeleteApiConfigInput {
  id: number;
}
```

**输出**:
```typescript
interface DeleteApiConfigOutput {
  deleted_config_id: number;
}
```

**错误**:
- `NotFound`: 配置 ID 不存在
- `InUse`: 配置正在被代理服务使用(current_config_id)
- `KeychainError`: 删除密钥链中的 API 密钥失败
- `DatabaseError`: 删除失败

**对应功能需求**: FR-006

---

### 2.5 调整配置顺序(拖拽)

**命令**: `reorder_api_configs`

**输入**:
```typescript
interface ReorderApiConfigsInput {
  group_id: number | null;  // 所属分组,null 表示"未分组"
  config_ids: number[];     // 新的顺序(配置 ID 数组)
}
```

**输出**:
```typescript
type Output = ApiConfig[];  // 重新排序后的配置列表
```

**错误**:
- `ValidationError`: config_ids 中的配置不全属于指定分组
- `DatabaseError`: 更新失败

**对应功能需求**: FR-037

---

## 3. 代理服务管理 (Proxy Service Management)

### 3.1 获取代理服务状态

**命令**: `get_proxy_status`

**输入**: 无

**输出**:
```typescript
interface ProxyStatus {
  id: number;
  listen_port: number;
  current_group: ConfigGroup | null;
  current_config: ApiConfig | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error_message: string | null;
  started_at: string | null;
  updated_at: string;
}
```

**错误**:
- `DatabaseError`: 查询失败

**对应功能需求**: FR-010

---

### 3.2 启动代理服务

**命令**: `start_proxy_service`

**输入**:
```typescript
interface StartProxyServiceInput {
  listen_port?: number;  // 可选,默认 25341
}
```

**输出**:
```typescript
type Output = ProxyStatus;  // 启动后的状态(status = 'running')
```

**错误**:
- `AlreadyRunning`: 代理服务已在运行
- `PortInUse`: 监听端口被占用(FR-025)
- `NoConfigAvailable`: 当前分组没有可用配置
- `ServiceError`: 代理服务启动失败

**对应功能需求**: FR-010

---

### 3.3 停止代理服务

**命令**: `stop_proxy_service`

**输入**: 无

**输出**:
```typescript
type Output = ProxyStatus;  // 停止后的状态(status = 'stopped')
```

**错误**:
- `AlreadyStopped`: 代理服务已停止
- `ServiceError`: 停止失败

**对应功能需求**: FR-010

---

### 3.4 切换当前分组

**命令**: `switch_proxy_group`

**输入**:
```typescript
interface SwitchProxyGroupInput {
  group_id: number;
}
```

**输出**:
```typescript
type Output = ProxyStatus;  // 切换后的状态
```

**错误**:
- `NotFound`: 分组 ID 不存在
- `EmptyGroup`: 分组没有任何配置(FR-036)
- `NoConfigAvailable`: 分组内没有可用配置
- `ServiceError`: 切换失败

**对应功能需求**: FR-008, FR-035, FR-036

---

### 3.5 切换当前配置(同一分组内)

**命令**: `switch_proxy_config`

**输入**:
```typescript
interface SwitchProxyConfigInput {
  config_id: number;
}
```

**输出**:
```typescript
type Output = ProxyStatus;  // 切换后的状态
```

**错误**:
- `NotFound`: 配置 ID 不存在
- `ConfigNotInGroup`: 配置不属于当前分组
- `ConfigUnavailable`: 配置不可用(is_available = false)
- `ServiceError`: 切换失败

**对应功能需求**: FR-009

---

## 4. API 测试 (API Testing)

### 4.1 测试单个配置

**命令**: `test_api_config`

**输入**:
```typescript
interface TestApiConfigInput {
  config_id: number;
}
```

**输出**:
```typescript
interface TestResult {
  id: number;
  config_id: number;
  group_id: number | null;
  test_at: string;
  status: 'success' | 'failed' | 'timeout';
  latency_ms: number | null;
  error_message: string | null;
  is_valid_key: boolean | null;
}
```

**错误**:
- `NotFound`: 配置 ID 不存在
- `TestTimeout`: 测试超时(默认 5 秒)
- `KeychainError`: 无法从密钥链读取 API 密钥

**对应功能需求**: FR-011, FR-012

---

### 4.2 批量测试分组内所有配置

**命令**: `test_group_configs`

**输入**:
```typescript
interface TestGroupConfigsInput {
  group_id: number | null;  // null 表示"未分组"
}
```

**输出**:
```typescript
type Output = TestResult[];  // 所有配置的测试结果
```

**错误**:
- `NotFound`: 分组 ID 不存在
- `EmptyGroup`: 分组没有任何配置

**对应功能需求**: FR-013

---

## 5. 自动切换 (Auto Switch)

### 5.1 启用/禁用分组的自动切换

**命令**: `toggle_auto_switch`

**输入**:
```typescript
interface ToggleAutoSwitchInput {
  group_id: number;
  enabled: boolean;
}
```

**输出**:
```typescript
type Output = ConfigGroup;  // 更新后的分组(auto_switch_enabled 字段)
```

**错误**:
- `NotFound`: 分组 ID 不存在
- `InsufficientConfigs`: 分组内可用配置少于 2 个(建议至少 2 个才启用自动切换)

**对应功能需求**: FR-014

---

### 5.2 获取切换日志

**命令**: `get_switch_logs`

**输入**:
```typescript
interface GetSwitchLogsInput {
  group_id?: number;        // 可选,按分组过滤
  limit?: number;           // 默认 50
  offset?: number;          // 默认 0(用于分页)
}
```

**输出**:
```typescript
interface SwitchLog {
  id: number;
  switch_at: string;
  reason: 'connection_failed' | 'timeout' | 'quota_exceeded' | 'high_latency' | 'manual';
  source_config: ApiConfig | null;  // 可能已删除
  target_config: ApiConfig;
  group: ConfigGroup;
  is_cross_group: boolean;  // 应始终为 false
  latency_before_ms: number | null;
  latency_after_ms: number | null;
  error_message: string | null;
}

type Output = SwitchLog[];
```

**错误**:
- `DatabaseError`: 查询失败

**对应功能需求**: FR-018

---

## 6. Claude Code 集成 (Claude Code Integration)

### 6.1 检测 Claude Code 配置路径

**命令**: `detect_claude_code_path`

**输入**: 无

**输出**:
```typescript
interface ClaudeCodePath {
  settings_path: string;      // settings.json 路径
  backup_dir: string;         // 备份目录路径
  platform: 'Windows' | 'macOS' | 'Linux';
  exists: boolean;            // 配置文件是否存在
}
```

**错误**:
- `PathNotFound`: 无法检测到 Claude Code 配置路径
- `PermissionDenied`: 没有读取权限

**对应功能需求**: FR-001

---

### 6.2 启用本地代理(修改 Claude Code 配置)

**命令**: `enable_claude_code_proxy`

**输入**:
```typescript
interface EnableClaudeCodeProxyInput {
  proxy_port: number;  // 本地代理端口(如 25341)
}
```

**输出**:
```typescript
interface EnableClaudeCodeProxyOutput {
  backup_id: number;           // 备份记录 ID
  original_path: string;       // 原始配置路径
  backup_path: string;         // 备份文件路径
  modified_settings: object;   // 修改后的配置(JSON)
}
```

**错误**:
- `PathNotFound`: Claude Code 配置文件不存在
- `PermissionDenied`: 没有写入权限
- `BackupFailed`: 备份失败
- `FileWriteError`: 写入配置失败

**对应功能需求**: FR-002, FR-003

---

### 6.3 恢复原始配置

**命令**: `restore_claude_code_config`

**输入**:
```typescript
interface RestoreClaudeCodeConfigInput {
  backup_id?: number;  // 可选,默认使用最新备份
}
```

**输出**:
```typescript
interface RestoreClaudeCodeConfigOutput {
  backup_id: number;
  restored_path: string;
  restored_at: string;
}
```

**错误**:
- `NotFound`: 备份 ID 不存在或无备份记录
- `PermissionDenied`: 没有写入权限
- `FileWriteError`: 恢复失败

**对应功能需求**: FR-004

---

### 6.4 列出所有备份

**命令**: `list_claude_code_backups`

**输入**: 无

**输出**:
```typescript
interface ConfigBackup {
  id: number;
  file_path: string;
  original_path: string;
  backup_at: string;
  platform: 'Windows' | 'macOS' | 'Linux';
  is_restored: boolean;
}

type Output = ConfigBackup[];
```

**错误**:
- `DatabaseError`: 查询失败

**对应功能需求**: FR-002

---

## 7. 环境变量管理 (Environment Variable Management)

### 7.1 列出所有环境变量

**命令**: `list_environment_variables`

**输入**: 无

**输出**:
```typescript
interface EnvironmentVariable {
  id: number;
  key: string;
  value: string;
  is_active: boolean;
  set_at: string | null;
  unset_at: string | null;
}

type Output = EnvironmentVariable[];
```

**错误**:
- `DatabaseError`: 查询失败

**对应功能需求**: FR-019

---

### 7.2 设置环境变量

**命令**: `set_environment_variable`

**输入**:
```typescript
interface SetEnvironmentVariableInput {
  key: string;
  value: string;
}
```

**输出**:
```typescript
type Output = EnvironmentVariable;  // 设置后的环境变量(is_active = true)
```

**错误**:
- `ValidationError`: key 为空或格式不正确
- `PermissionDenied`: 没有设置环境变量的权限
- `SystemError`: 系统调用失败

**对应功能需求**: FR-020

---

### 7.3 删除环境变量

**命令**: `unset_environment_variable`

**输入**:
```typescript
interface UnsetEnvironmentVariableInput {
  key: string;
}
```

**输出**:
```typescript
type Output = EnvironmentVariable;  // 删除后的环境变量(is_active = false)
```

**错误**:
- `NotFound`: 环境变量不存在
- `PermissionDenied`: 没有删除权限
- `SystemError`: 系统调用失败

**对应功能需求**: FR-019

---

### 7.4 从配置应用环境变量

**命令**: `apply_config_to_env`

**输入**:
```typescript
interface ApplyConfigToEnvInput {
  config_id: number;
}
```

**输出**:
```typescript
interface ApplyConfigToEnvOutput {
  applied_variables: EnvironmentVariable[];  // 应用的环境变量列表
}
```

**错误**:
- `NotFound`: 配置 ID 不存在
- `KeychainError`: 无法读取 API 密钥
- `PermissionDenied`: 没有设置环境变量的权限

**对应功能需求**: FR-020

---

## 8. 推荐服务 (Recommended Services)

### 8.1 加载推荐服务列表

**命令**: `load_recommended_services`

**输入**:
```typescript
interface LoadRecommendedServicesInput {
  force_refresh?: boolean;  // 默认 false,true 则忽略缓存重新加载
}
```

**输出**:
```typescript
interface RecommendedService {
  id: number;
  site_name: string;
  promotion_url: string;
  is_recommended: boolean;
  hotness_score: number;
  source: 'remote' | 'local';
  loaded_at: string;
}

type Output = RecommendedService[];
```

**错误**:
- `RemoteLoadFailed`: 远程 JSON 加载失败,已回退到本地
- `LocalLoadFailed`: 本地 JSON 加载失败
- `ParseError`: JSON 格式不正确

**对应功能需求**: FR-027, FR-028, FR-029, FR-030

---

### 8.2 刷新推荐服务列表

**命令**: `refresh_recommended_services`

**输入**: 无

**输出**:
```typescript
type Output = RecommendedService[];  // 刷新后的列表
```

**错误**:
- 同 `load_recommended_services`

**对应功能需求**: FR-032

---

## 9. 应用设置 (App Settings)

### 9.1 获取应用设置

**命令**: `get_app_settings`

**输入**: 无

**输出**:
```typescript
interface AppSettings {
  id: number;
  language: 'zh-CN' | 'en-US';
  default_latency_threshold_ms: number;
  default_proxy_port: number;
  remote_recommendation_url: string | null;
  local_recommendation_path: string | null;
  recommendation_cache_ttl_sec: number;
  updated_at: string;
}
```

**错误**:
- `DatabaseError`: 查询失败

**对应功能需求**: FR-021

---

### 9.2 更新应用设置

**命令**: `update_app_settings`

**输入**:
```typescript
interface UpdateAppSettingsInput {
  language?: 'zh-CN' | 'en-US';
  default_latency_threshold_ms?: number;
  default_proxy_port?: number;
  remote_recommendation_url?: string | null;
  local_recommendation_path?: string | null;
  recommendation_cache_ttl_sec?: number;
}
```

**输出**:
```typescript
type Output = AppSettings;  // 更新后的设置
```

**错误**:
- `ValidationError`: 参数验证失败
- `DatabaseError`: 更新失败

**对应功能需求**: FR-021, FR-022

---

## 10. 系统诊断 (System Diagnostics)

### 10.1 检查端口占用

**命令**: `check_port_available`

**输入**:
```typescript
interface CheckPortAvailableInput {
  port: number;
}
```

**输出**:
```typescript
interface CheckPortAvailableOutput {
  port: number;
  is_available: boolean;
  process_name: string | null;  // 占用进程名称(如果可检测)
}
```

**错误**:
- `ValidationError`: 端口号不在 1-65535 范围内

**对应功能需求**: FR-025

---

### 10.2 获取系统信息

**命令**: `get_system_info`

**输入**: 无

**输出**:
```typescript
interface SystemInfo {
  platform: 'Windows' | 'macOS' | 'Linux';
  os_version: string;
  app_version: string;
  data_dir: string;
  config_dir: string;
}
```

**错误**: 无

**对应功能需求**: FR-026

---

## 通用错误响应格式

所有命令的错误都遵循以下格式:

```typescript
interface ErrorResponse {
  error: string;          // 错误类型(如 "NotFound", "ValidationError")
  message: string;        // 用户友好的错误消息(已本地化)
  details?: object;       // 可选的详细信息
}
```

**错误类型枚举**:
- `NotFound`: 资源不存在
- `ValidationError`: 输入参数验证失败
- `PermissionDenied`: 权限不足
- `DatabaseError`: 数据库操作失败
- `KeychainError`: 系统密钥链操作失败
- `ServiceError`: 代理服务错误
- `SystemError`: 系统调用失败
- `PortInUse`: 端口被占用
- `AlreadyRunning`: 服务已运行
- `AlreadyStopped`: 服务已停止
- `InUse`: 资源正在使用中
- `EmptyGroup`: 分组为空
- `InsufficientConfigs`: 配置数量不足
- `ConfigNotInGroup`: 配置不属于指定分组
- `ConfigUnavailable`: 配置不可用
- `TestTimeout`: 测试超时
- `RemoteLoadFailed`: 远程加载失败
- `LocalLoadFailed`: 本地加载失败
- `ParseError`: 解析错误
- `FileWriteError`: 文件写入失败
- `BackupFailed`: 备份失败
- `PathNotFound`: 路径不存在
- `NoConfigAvailable`: 没有可用配置

---

## 事件监听 (Event Listeners)

除了命令调用,Tauri 还支持后端向前端推送事件。以下是应用中使用的事件:

### 1. 代理服务状态变化

**事件名**: `proxy-status-changed`

**载荷**:
```typescript
interface ProxyStatusChangedEvent {
  old_status: 'stopped' | 'starting' | 'running' | 'error';
  new_status: 'stopped' | 'starting' | 'running' | 'error';
  timestamp: string;
}
```

**用途**: 实时更新 UI 中的代理服务状态指示器

---

### 2. 自动切换事件

**事件名**: `auto-switch-triggered`

**载荷**:
```typescript
interface AutoSwitchTriggeredEvent {
  reason: 'connection_failed' | 'timeout' | 'quota_exceeded' | 'high_latency';
  source_config_id: number | null;
  target_config_id: number;
  group_id: number;
  timestamp: string;
}
```

**用途**: 显示自动切换通知,更新切换日志列表

**对应功能需求**: FR-015, FR-016, FR-018

---

### 3. 测试完成事件

**事件名**: `test-completed`

**载荷**:
```typescript
interface TestCompletedEvent {
  config_id: number;
  result: TestResult;
}
```

**用途**: 批量测试时实时更新每个配置的测试结果

---

## 性能要求

根据 spec.md 的成功标准:

| 命令 | 性能要求 | 对应成功标准 |
|------|----------|--------------|
| `test_api_config` | < 5 秒 | SC-003 |
| `test_group_configs` | < 5 秒 × 配置数量 | SC-003 |
| `switch_proxy_group` | < 10 秒 | SC-002 |
| `switch_proxy_config` | < 10 秒 | SC-002 |
| 自动切换(事件) | < 3 秒 | SC-004 |
| UI 响应(所有命令) | < 200ms (不含实际操作时间) | SC-009 |

---

## 安全性

1. **API 密钥保护**:
   - API 密钥永不通过 IPC 返回给前端(除创建/更新时的输入)
   - 所有 API 密钥存储在系统密钥链,不在 SQLite 数据库中

2. **输入验证**:
   - 所有命令输入在 Rust 后端进行严格验证
   - URL 输入使用白名单验证(仅允许 HTTP/HTTPS)
   - 端口号限制在 1-65535 范围内

3. **权限检查**:
   - 文件操作前检查读写权限(FR-023)
   - 环境变量设置前检查系统权限

---

**文档版本**: v1.0.0
**生成时间**: 2025-11-08
**下一步**: 生成 quickstart.md
