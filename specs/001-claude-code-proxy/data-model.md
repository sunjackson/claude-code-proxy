# 数据模型: Claude Code 代理服务管理应用

**特性分支**: `001-claude-code-proxy` | **日期**: 2025-11-08 | **规格**: [spec.md](./spec.md)

**输入**: 从功能规格说明中提取的关键实体 (spec.md lines 218-228)

---

## 核心实体

### 1. ConfigGroup (配置分组)

代表一组相关 API 配置的逻辑分组,用于隔离不同使用场景的配置集合和自动切换策略。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 分组唯一标识符 |
| `name` | TEXT | NOT NULL, UNIQUE | 分组名称(如"工作"、"个人") |
| `description` | TEXT | NULLABLE | 分组描述 |
| `auto_switch_enabled` | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否启用自动择优切换(FR-014) |
| `latency_threshold_ms` | INTEGER | NOT NULL, DEFAULT 3000 | 延迟阈值(毫秒),超过此值触发自动切换(FR-016) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 最后修改时间 |

**验证规则** (来自 spec.md):
- `name` 必须唯一 (FR-005)
- `name` 不能为空字符串
- `latency_threshold_ms` 必须 > 0 且 ≤ 60000 (1分钟)
- 系统保留 `name = "未分组"` 作为特殊分组 (FR-034)

**关系**:
- 一对多: 一个分组包含多个 `ApiConfig` (0..*)
- 一对多: 一个分组包含多个 `SwitchLog` (0..*)
- 一对多: 一个分组包含多个 `TestResult` (0..*)

**状态转换**: 无状态机(简单实体)

**索引**:
- `idx_group_name` (name) - UNIQUE

---

### 2. ApiConfig (API 配置)

代表一个 API 中转站的完整配置信息,包含认证密钥、服务器地址和优先级顺序。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 配置唯一标识符 |
| `name` | TEXT | NOT NULL, UNIQUE | 配置名称(如"公司API 1") |
| `api_key` | TEXT | NOT NULL | API 密钥(加密存储在系统密钥链)(FR-006) |
| `server_url` | TEXT | NOT NULL | 服务器地址(如"https://api.example.com") |
| `server_port` | INTEGER | NOT NULL, DEFAULT 443 | 服务器端口(1-65535) |
| `group_id` | INTEGER | NULLABLE, FOREIGN KEY | 所属分组 ID,NULL 表示"未分组"(FR-034) |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 | 分组内排序顺序,用于自动切换优先级(FR-037) |
| `is_available` | BOOLEAN | NOT NULL, DEFAULT TRUE | 可用状态(由测试和自动切换更新) |
| `last_test_at` | DATETIME | NULLABLE | 最后测试时间 |
| `last_latency_ms` | INTEGER | NULLABLE | 最后测试延迟(毫秒) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 最后修改时间 |

**验证规则** (来自 spec.md):
- `name` 必须唯一 (FR-006)
- `name` 不能为空字符串
- `api_key` 不能为空(存储时使用 keytar 加密,见 research.md 第 3.1 节)
- `server_url` 必须是有效的 HTTP/HTTPS URL
- `server_port` 必须在 1-65535 范围内
- `sort_order` 必须 ≥ 0
- 同一 `group_id` 内的 `sort_order` 应该唯一(自动调整)

**关系**:
- 多对一: 多个配置属于一个 `ConfigGroup` (NULLABLE,允许"未分组")
- 一对多: 一个配置有多个 `TestResult` (0..*)
- 一对多: 一个配置关联多个 `SwitchLog` (作为源或目标)(0..*)
- 一对一: 一个配置可能是 `ProxyService` 的当前配置 (0..1)

**状态转换**:

```
[新建] --测试--> [可用] (is_available = TRUE)
[可用] --测试失败/自动切换--> [不可用] (is_available = FALSE)
[不可用] --测试成功--> [可用]
```

**索引**:
- `idx_config_name` (name) - UNIQUE
- `idx_config_group` (group_id)
- `idx_config_group_sort` (group_id, sort_order)

---

### 3. ConfigBackup (配置备份)

代表 Claude Code 原始配置文件的备份,用于恢复功能。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 备份唯一标识符 |
| `file_path` | TEXT | NOT NULL | 备份文件路径(如"~/.claude-code-proxy/backups/settings_20251108_123456.json") |
| `original_path` | TEXT | NOT NULL | 原始配置文件路径(如"~/.claude/settings.json") |
| `content` | TEXT | NOT NULL | 备份内容(JSON 字符串) |
| `backup_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 备份时间 (FR-002) |
| `platform` | TEXT | NOT NULL | 操作系统平台(Windows/macOS/Linux) |
| `is_restored` | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否已恢复 |

**验证规则** (来自 spec.md):
- `file_path` 必须是有效的文件系统路径
- `original_path` 必须是有效的文件系统路径
- `content` 必须是有效的 JSON 格式 (FR-002, FR-006)
- `platform` 必须是 "Windows" | "macOS" | "Linux"

**关系**:
- 独立实体,无外键关系

**状态转换**:

```
[新建] (is_restored = FALSE)
[新建] --恢复操作--> [已恢复] (is_restored = TRUE)
```

**索引**:
- `idx_backup_time` (backup_at)
- `idx_backup_platform` (platform)

---

### 4. ProxyService (代理服务)

代表本地运行的代理服务实例,是应用的核心运行时状态。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 服务实例 ID(通常只有一个实例) |
| `listen_port` | INTEGER | NOT NULL, DEFAULT 25341 | 监听端口 (FR-010, spec.md 假设) |
| `current_group_id` | INTEGER | NULLABLE, FOREIGN KEY | 当前使用的分组 ID (FR-008) |
| `current_config_id` | INTEGER | NULLABLE, FOREIGN KEY | 当前使用的 API 配置 ID (FR-009) |
| `status` | TEXT | NOT NULL, DEFAULT 'stopped' | 运行状态: 'stopped' | 'starting' | 'running' | 'error' |
| `error_message` | TEXT | NULLABLE | 错误信息(当 status = 'error' 时) |
| `started_at` | DATETIME | NULLABLE | 启动时间 |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 最后更新时间 |

**验证规则** (来自 spec.md):
- `listen_port` 必须在 1-65535 范围内
- `listen_port` 不能被其他进程占用 (FR-025)
- `current_config_id` 必须属于 `current_group_id` (如果 `current_group_id` 不为 NULL)
- `status` 必须是枚举值之一

**关系**:
- 多对一: 一个服务实例指向一个 `ConfigGroup` (NULLABLE)
- 多对一: 一个服务实例指向一个 `ApiConfig` (NULLABLE)

**状态转换** (FR-010):

```
[stopped] --启动--> [starting] --成功--> [running]
[starting] --失败--> [error]
[running] --停止--> [stopped]
[running] --配置切换--> [running] (无需重启,FR-035)
[running] --错误--> [error]
[error] --重启--> [starting]
```

**索引**:
- `idx_proxy_status` (status)
- `idx_proxy_group` (current_group_id)
- `idx_proxy_config` (current_config_id)

---

### 5. TestResult (测试结果)

代表 API 配置的测试结果,用于连接性和延迟测试。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 测试结果唯一标识符 |
| `config_id` | INTEGER | NOT NULL, FOREIGN KEY | 被测试的 API 配置 ID |
| `group_id` | INTEGER | NULLABLE, FOREIGN KEY | 所属分组 ID(冗余,方便查询) |
| `test_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 测试时间 (FR-011) |
| `status` | TEXT | NOT NULL | 连接状态: 'success' | 'failed' | 'timeout' |
| `latency_ms` | INTEGER | NULLABLE | 响应延迟(毫秒),仅当 status = 'success' |
| `error_message` | TEXT | NULLABLE | 错误信息(当 status != 'success' 时) |
| `is_valid_key` | BOOLEAN | NULLABLE | API 密钥是否有效 (FR-012) |

**验证规则** (来自 spec.md):
- `config_id` 必须引用有效的 `ApiConfig`
- `status` 必须是枚举值之一
- `latency_ms` 必须 ≥ 0 (如果非 NULL)
- `is_valid_key` 仅当 status = 'success' 时有意义

**关系**:
- 多对一: 多个测试结果属于一个 `ApiConfig`
- 多对一: 多个测试结果属于一个 `ConfigGroup` (NULLABLE)

**状态转换**: 无状态机(历史记录)

**索引**:
- `idx_test_config` (config_id)
- `idx_test_time` (test_at)
- `idx_test_group` (group_id)

---

### 6. SwitchLog (切换日志)

代表自动切换事件的记录,用于审计和故障排查。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 日志唯一标识符 |
| `switch_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 切换时间 (FR-018) |
| `reason` | TEXT | NOT NULL | 切换原因: 'connection_failed' | 'timeout' | 'quota_exceeded' | 'high_latency' | 'manual' |
| `source_config_id` | INTEGER | NULLABLE, FOREIGN KEY | 源配置 ID(切换前) |
| `target_config_id` | INTEGER | NOT NULL, FOREIGN KEY | 目标配置 ID(切换后) |
| `group_id` | INTEGER | NOT NULL, FOREIGN KEY | 所属分组 ID (FR-017, FR-018) |
| `is_cross_group` | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否跨分组切换(应始终为 FALSE,FR-017) |
| `latency_before_ms` | INTEGER | NULLABLE | 切换前延迟(仅当 reason = 'high_latency') |
| `latency_after_ms` | INTEGER | NULLABLE | 切换后延迟 |
| `error_message` | TEXT | NULLABLE | 导致切换的错误信息 |

**验证规则** (来自 spec.md):
- `reason` 必须是枚举值之一
- `source_config_id` 和 `target_config_id` 必须引用有效的 `ApiConfig`
- `is_cross_group` 必须始终为 FALSE (FR-017)
- `source_config_id` 和 `target_config_id` 必须属于同一个 `group_id` (FR-017)
- `latency_before_ms` 和 `latency_after_ms` 必须 ≥ 0 (如果非 NULL)

**关系**:
- 多对一: 多个日志属于一个 `ConfigGroup`
- 多对一: 多个日志引用一个 `ApiConfig` (作为源或目标)

**状态转换**: 无状态机(历史记录)

**索引**:
- `idx_switch_time` (switch_at)
- `idx_switch_group` (group_id)
- `idx_switch_source` (source_config_id)
- `idx_switch_target` (target_config_id)

---

### 7. EnvironmentVariable (环境变量)

代表系统环境变量键值对,用于环境变量管理功能。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 环境变量唯一标识符 |
| `key` | TEXT | NOT NULL, UNIQUE | 变量名(如"ANTHROPIC_BASE_URL") |
| `value` | TEXT | NOT NULL | 变量值 |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否已应用到系统环境 |
| `set_at` | DATETIME | NULLABLE | 设置时间 (FR-019, FR-020) |
| `unset_at` | DATETIME | NULLABLE | 清除时间 |

**验证规则** (来自 spec.md):
- `key` 必须唯一且不能为空
- `key` 必须符合操作系统环境变量命名规则
- `value` 可以为空字符串(但不能为 NULL)

**关系**:
- 独立实体,无外键关系

**状态转换**:

```
[新建] (is_active = FALSE)
[新建] --应用到系统--> [已激活] (is_active = TRUE, set_at 记录)
[已激活] --清除--> [已清除] (is_active = FALSE, unset_at 记录)
```

**索引**:
- `idx_env_key` (key) - UNIQUE
- `idx_env_active` (is_active)

---

### 8. AppSettings (应用设置)

代表应用的全局设置,通常只有一条记录(单例)。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 设置记录 ID(固定为 1) |
| `language` | TEXT | NOT NULL, DEFAULT 'zh-CN' | 界面语言: 'zh-CN' | 'en-US' (FR-021) |
| `default_latency_threshold_ms` | INTEGER | NOT NULL, DEFAULT 3000 | 默认延迟阈值(毫秒)(spec.md 假设) |
| `default_proxy_port` | INTEGER | NOT NULL, DEFAULT 25341 | 默认代理端口 (spec.md 假设) |
| `remote_recommendation_url` | TEXT | NULLABLE | 远程推荐服务 JSON URL (FR-027) |
| `local_recommendation_path` | TEXT | NULLABLE | 本地推荐服务 JSON 路径 (FR-028) |
| `recommendation_cache_ttl_sec` | INTEGER | NOT NULL, DEFAULT 3600 | 推荐服务缓存时间(秒)(FR-033) |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 最后更新时间 |

**验证规则** (来自 spec.md):
- `language` 必须是支持的语言之一 (FR-021)
- `default_latency_threshold_ms` 必须 > 0 且 ≤ 60000
- `default_proxy_port` 必须在 1-65535 范围内
- `remote_recommendation_url` 必须是有效的 HTTP/HTTPS URL (如果非 NULL)
- `local_recommendation_path` 必须是有效的文件系统路径 (如果非 NULL)
- `recommendation_cache_ttl_sec` 必须 ≥ 0

**关系**:
- 独立实体,单例模式(id 固定为 1)

**状态转换**: 无状态机(设置实体)

**索引**:
- 无(只有一条记录)

---

### 9. RecommendedService (推荐服务)

代表导航页面展示的推荐中转服务站点,从远程或本地 JSON 加载。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 服务唯一标识符 |
| `site_name` | TEXT | NOT NULL | 站点名称(如"CloudAPI Pro") |
| `promotion_url` | TEXT | NOT NULL | 推广链接 URL (FR-030, FR-031) |
| `is_recommended` | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否推荐(显示推荐徽章) |
| `hotness_score` | INTEGER | NOT NULL, DEFAULT 0 | 热度指标(0-100) |
| `source` | TEXT | NOT NULL | 数据源: 'remote' | 'local' |
| `loaded_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 加载时间 |

**验证规则** (来自 spec.md):
- `site_name` 不能为空
- `promotion_url` 必须是有效的 HTTP/HTTPS URL
- `hotness_score` 必须在 0-100 范围内
- `source` 必须是 'remote' | 'local'

**关系**:
- 独立实体,从外部 JSON 加载(非用户创建)

**状态转换**: 无状态机(外部数据)

**索引**:
- `idx_service_hotness` (hotness_score DESC)
- `idx_service_source` (source)
- `idx_service_loaded` (loaded_at)

---

### 10. RecommendationSource (推荐服务源)

代表推荐服务列表的数据源配置,管理远程和本地 JSON 源。

**字段**:

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | 数据源唯一标识符 |
| `source_type` | TEXT | NOT NULL | 源类型: 'remote' | 'local' |
| `url` | TEXT | NULLABLE | 远程 JSON URL(仅当 source_type = 'remote') |
| `file_path` | TEXT | NULLABLE | 本地文件路径(仅当 source_type = 'local') |
| `priority` | INTEGER | NOT NULL, DEFAULT 0 | 优先级(越小优先级越高,0 = 最高)(FR-029) |
| `last_fetch_at` | DATETIME | NULLABLE | 最后获取时间 |
| `last_fetch_status` | TEXT | NULLABLE | 最后获取状态: 'success' | 'failed' | 'timeout' |
| `error_message` | TEXT | NULLABLE | 错误信息(当 last_fetch_status != 'success') |

**验证规则** (来自 spec.md):
- `source_type` 必须是 'remote' | 'local'
- 当 `source_type = 'remote'` 时,`url` 必须非 NULL 且为有效 HTTP/HTTPS URL
- 当 `source_type = 'local'` 时,`file_path` 必须非 NULL 且为有效文件系统路径
- `priority` 必须 ≥ 0
- `last_fetch_status` 必须是枚举值之一(如果非 NULL)

**关系**:
- 独立实体,无外键关系
- 逻辑关系: 优先级决定 `RecommendedService` 的加载顺序 (FR-029)

**状态转换**:

```
[新建] --首次获取--> [成功] (last_fetch_status = 'success')
[新建] --首次获取--> [失败] (last_fetch_status = 'failed')
[成功] --下次获取--> [成功] | [失败]
[失败] --重试--> [成功] | [失败]
```

**索引**:
- `idx_source_priority` (priority ASC)
- `idx_source_type` (source_type)

---

## 实体关系图 (ER Diagram)

```
┌─────────────────┐         ┌──────────────────┐
│   ConfigGroup   │1      *│    ApiConfig     │
│─────────────────│◄────────│──────────────────│
│ id (PK)         │         │ id (PK)          │
│ name (UNIQUE)   │         │ name (UNIQUE)    │
│ auto_switch_en..│         │ group_id (FK)    │
│ latency_thresho.│         │ sort_order       │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │1                          │*
         │                           │
         │*                          │1
┌────────▼────────┐         ┌────────▼─────────┐
│   SwitchLog     │         │   TestResult     │
│─────────────────│         │──────────────────│
│ id (PK)         │         │ id (PK)          │
│ group_id (FK)   │         │ config_id (FK)   │
│ source_config_..│         │ status           │
│ target_config_..│         │ latency_ms       │
│ is_cross_group  │         └──────────────────┘
└─────────────────┘

┌─────────────────┐         ┌──────────────────┐
│  ProxyService   │         │  ConfigBackup    │
│─────────────────│         │──────────────────│
│ id (PK)         │         │ id (PK)          │
│ current_group_..│         │ file_path        │
│ current_config..│         │ content          │
│ status          │         │ backup_at        │
└─────────────────┘         └──────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ EnvironmentVar..│         │   AppSettings    │
│─────────────────│         │──────────────────│
│ id (PK)         │         │ id (PK = 1)      │
│ key (UNIQUE)    │         │ language         │
│ value           │         │ remote_recomm... │
│ is_active       │         │ local_recomm...  │
└─────────────────┘         └──────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ RecommendedSer..│         │ Recommendation...│
│─────────────────│         │──────────────────│
│ id (PK)         │         │ id (PK)          │
│ site_name       │         │ source_type      │
│ promotion_url   │         │ url / file_path  │
│ hotness_score   │         │ priority         │
└─────────────────┘         └──────────────────┘
```

**关系说明**:
- `ConfigGroup` ─(1:*)→ `ApiConfig`: 一个分组包含多个配置
- `ConfigGroup` ─(1:*)→ `SwitchLog`: 一个分组有多个切换日志
- `ConfigGroup` ─(1:*)→ `TestResult`: 一个分组有多个测试结果
- `ApiConfig` ─(1:*)→ `TestResult`: 一个配置有多个测试结果
- `ApiConfig` ─(1:*)→ `SwitchLog`: 一个配置关联多个日志(作为源或目标)
- `ProxyService` ─(1:1)→ `ConfigGroup`: 代理服务指向当前分组
- `ProxyService` ─(1:1)→ `ApiConfig`: 代理服务指向当前配置
- 其他实体为独立实体,无外键关系

---

## 数据完整性约束

### 外键约束

1. **ApiConfig.group_id** → **ConfigGroup.id**
   - ON DELETE: SET NULL (删除分组时,配置移到"未分组")
   - ON UPDATE: CASCADE

2. **TestResult.config_id** → **ApiConfig.id**
   - ON DELETE: CASCADE (删除配置时,删除相关测试结果)
   - ON UPDATE: CASCADE

3. **TestResult.group_id** → **ConfigGroup.id**
   - ON DELETE: SET NULL (冗余字段,可为 NULL)
   - ON UPDATE: CASCADE

4. **SwitchLog.group_id** → **ConfigGroup.id**
   - ON DELETE: RESTRICT (不允许删除有日志的分组,除非先清理日志)
   - ON UPDATE: CASCADE

5. **SwitchLog.source_config_id** → **ApiConfig.id**
   - ON DELETE: SET NULL (允许历史日志保留,即使源配置已删除)
   - ON UPDATE: CASCADE

6. **SwitchLog.target_config_id** → **ApiConfig.id**
   - ON DELETE: RESTRICT (不允许删除作为切换目标的配置)
   - ON UPDATE: CASCADE

7. **ProxyService.current_group_id** → **ConfigGroup.id**
   - ON DELETE: SET NULL (删除分组时,代理服务停止)
   - ON UPDATE: CASCADE

8. **ProxyService.current_config_id** → **ApiConfig.id**
   - ON DELETE: SET NULL (删除配置时,代理服务停止)
   - ON UPDATE: CASCADE

### 业务约束

1. **分组内配置顺序唯一性**:
   - 同一 `group_id` 内的 `ApiConfig.sort_order` 应该唯一(通过应用层逻辑保证)

2. **跨分组切换禁止** (FR-017):
   - `SwitchLog.is_cross_group` 必须为 FALSE
   - `SwitchLog.source_config_id` 和 `SwitchLog.target_config_id` 必须属于同一个 `group_id`

3. **代理服务配置一致性**:
   - `ProxyService.current_config_id` 必须属于 `ProxyService.current_group_id` (如果 `current_group_id` 不为 NULL)

4. **空分组切换限制** (FR-036):
   - 不允许将 `ProxyService.current_group_id` 切换到没有任何 `ApiConfig` 的分组

5. **特殊分组保留**:
   - 系统保留 `ConfigGroup.name = "未分组"` 作为默认分组,不允许用户删除或重命名

6. **单例设置**:
   - `AppSettings` 表只允许一条记录 (`id = 1`)

---

## 查询模式 (常见查询)

### 1. 获取分组及其所有配置(按优先级排序)

```sql
SELECT
    g.id AS group_id,
    g.name AS group_name,
    g.auto_switch_enabled,
    c.id AS config_id,
    c.name AS config_name,
    c.sort_order,
    c.is_available,
    c.last_latency_ms
FROM ConfigGroup g
LEFT JOIN ApiConfig c ON g.id = c.group_id
ORDER BY g.id, c.sort_order ASC;
```

### 2. 获取当前代理服务状态及配置

```sql
SELECT
    ps.status,
    ps.listen_port,
    g.name AS current_group,
    c.name AS current_config,
    c.server_url,
    c.server_port
FROM ProxyService ps
LEFT JOIN ConfigGroup g ON ps.current_group_id = g.id
LEFT JOIN ApiConfig c ON ps.current_config_id = c.id
WHERE ps.id = 1;
```

### 3. 获取分组内下一个可用配置(自动切换逻辑)

```sql
SELECT id, name, server_url, server_port
FROM ApiConfig
WHERE group_id = :current_group_id
  AND is_available = TRUE
  AND sort_order > :current_sort_order
ORDER BY sort_order ASC
LIMIT 1;
```

### 4. 获取最近的切换日志(用于审计)

```sql
SELECT
    sl.switch_at,
    sl.reason,
    sc.name AS source_config,
    tc.name AS target_config,
    g.name AS group_name,
    sl.latency_before_ms,
    sl.latency_after_ms
FROM SwitchLog sl
LEFT JOIN ApiConfig sc ON sl.source_config_id = sc.id
LEFT JOIN ApiConfig tc ON sl.target_config_id = tc.id
LEFT JOIN ConfigGroup g ON sl.group_id = g.id
ORDER BY sl.switch_at DESC
LIMIT 50;
```

### 5. 获取推荐服务列表(按热度排序)

```sql
SELECT site_name, promotion_url, is_recommended, hotness_score
FROM RecommendedService
WHERE source = 'remote' OR source = 'local'
ORDER BY hotness_score DESC, is_recommended DESC;
```

---

## 数据迁移和版本控制

### 初始化脚本 (v1.0.0)

应用首次启动时创建所有表结构,并插入默认数据:

1. **创建表**: 按照上述 10 个实体的定义创建表和索引
2. **插入默认设置**: `AppSettings` 表插入 id=1 的默认记录
3. **创建特殊分组**: `ConfigGroup` 表插入 `name="未分组"` 的记录
4. **创建代理服务实例**: `ProxyService` 表插入 id=1 的初始记录(status='stopped')

### 版本升级策略

使用版本号管理数据库模式变更:
- v1.0.0 → v1.1.0: 添加新字段或索引时,使用 `ALTER TABLE` 并设置默认值
- v1.1.0 → v2.0.0: 破坏性变更时,使用数据迁移脚本转换旧数据

---

## 安全和隐私

### 敏感字段加密

**ApiConfig.api_key** 字段不直接存储在 SQLite 中,而是使用 **keytar** 库存储到系统密钥链:

- **Windows**: DPAPI (Data Protection API)
- **macOS**: Keychain
- **Linux**: Secret Service API (libsecret)

**存储方式** (见 research.md 第 3.1 节):
```javascript
// 保存时
await keytar.setPassword('claude-code-proxy', `api_config_${config.id}`, config.api_key);

// 数据库中只存储引用 ID,不存储实际密钥
INSERT INTO ApiConfig (name, api_key, ...) VALUES ('Config 1', '[ENCRYPTED]', ...);

// 读取时
const apiKey = await keytar.getPassword('claude-code-proxy', `api_config_${config.id}`);
```

**备份和恢复**:
- API 密钥不包含在配置备份中(ConfigBackup 表不包含 api_key)
- 恢复配置时,需要用户重新输入 API 密钥

---

## 性能优化

### 索引策略

已为所有常见查询添加索引(见各实体的"索引"部分),关键索引:
- `idx_config_group_sort`: 支持分组内配置排序查询(自动切换)
- `idx_test_config`: 支持配置测试历史查询
- `idx_switch_time`: 支持切换日志时间范围查询

### 数据清理

定期清理历史数据以避免数据库膨胀:
- **TestResult**: 保留最近 30 天的测试结果,删除更早的记录
- **SwitchLog**: 保留最近 90 天的切换日志,删除更早的记录
- **RecommendedService**: 每次加载远程/本地 JSON 时,清空旧数据并重新插入

---

## 数据一致性验证

### 应用启动时检查

1. **代理服务配置一致性**:
   - 验证 `ProxyService.current_config_id` 是否属于 `ProxyService.current_group_id`

2. **空分组检测**:
   - 检测 `ConfigGroup` 中是否有分组没有任何 `ApiConfig` (除"未分组"外)

3. **孤立配置清理**:
   - 检测 `ApiConfig` 中是否有 `group_id` 引用不存在的分组

4. **日志完整性**:
   - 验证 `SwitchLog.is_cross_group` 是否始终为 FALSE

---

## 扩展性

### 未来可能的扩展

1. **多代理服务实例**: 当前 `ProxyService` 是单例,未来可扩展为支持多个代理实例(不同端口)
2. **配置版本控制**: 为 `ApiConfig` 和 `ConfigGroup` 添加版本历史
3. **高级测试指标**: 在 `TestResult` 中添加更多性能指标(如 TTFB、TLS 握手时间)
4. **分组策略配置**: 为 `ConfigGroup` 添加更多自动切换策略(如轮询、加权轮询)
5. **用户账户系统**: 添加 `User` 实体,支持多用户配置隔离

---

**文档版本**: v1.0.0
**生成时间**: 2025-11-08
**下一步**: 进入 Phase 1 - 生成 API 合约 (contracts/)
