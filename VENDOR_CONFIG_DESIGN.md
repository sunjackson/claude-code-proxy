# 供应商配置系统设计方案

## 修改日期
2025-11-10

## 设计目标

参考 cc-switch 项目的供应商配置设计，将当前项目的 API 配置系统改造为功能完善的供应商配置系统，提供更好的用户体验和扩展性。

## cc-switch 供应商配置核心特性分析

### 1. 供应商分类系统

```typescript
type ProviderCategory =
  | "official"      // 官方（Claude Official）
  | "cn_official"   // 开源官方（国产大模型官方）
  | "aggregator"    // 聚合网站（AiHubMix, DMXAPI）
  | "third_party"   // 第三方供应商（PackyCode, AnyRouter）
  | "custom";       // 自定义
```

**作用**：
- 差异化提示和能力开关
- UI 视觉区分
- 功能权限控制

### 2. 数据模型设计

```typescript
interface Provider {
  id: string;
  name: string;
  settingsConfig: Record<string, any>; // Claude Code settings.json 配置
  websiteUrl?: string;
  category?: ProviderCategory;
  createdAt?: number;
  sortIndex?: number;
  isPartner?: boolean; // 商业合作伙伴
  meta?: ProviderMeta;
}

interface ProviderMeta {
  custom_endpoints?: Record<string, CustomEndpoint>; // 自定义端点
  usage_script?: UsageScript; // 用量查询脚本
}

interface CustomEndpoint {
  url: string;
  addedAt: number;
  lastUsed?: number;
}
```

### 3. 预设供应商模板

```typescript
interface ProviderPreset {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string; // 获取 API Key 的链接
  settingsConfig: object;
  isOfficial?: boolean;
  isPartner?: boolean;
  partnerPromotionKey?: string; // 促销信息的 i18n key
  category?: ProviderCategory;
  apiKeyField?: "ANTHROPIC_AUTH_TOKEN" | "ANTHROPIC_API_KEY";
  templateValues?: Record<string, TemplateValueConfig>; // 模板变量
  endpointCandidates?: string[]; // 端点候选列表
  theme?: PresetTheme; // 视觉主题
}

interface PresetTheme {
  icon?: "claude" | "codex" | "generic";
  backgroundColor?: string;
  textColor?: string;
}
```

### 4. 端点测速功能

**核心功能**：
- 并发测试多个端点延迟
- 自动选择最快的端点
- 延迟颜色编码（绿<300ms, 黄<500ms, 橙<800ms, 红>800ms）
- 自定义端点管理
- 端点持久化到 meta

**UI 特点**：
- 实时显示测试状态
- 按延迟排序
- 支持添加/删除端点
- 自动选择最优端点选项

### 5. 模板变量系统

支持在配置中使用占位符，用户在表单中填写实际值：

```typescript
// 示例：KAT-Coder
settingsConfig: {
  env: {
    ANTHROPIC_BASE_URL: "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
  }
},
templateValues: {
  ENDPOINT_ID: {
    label: "Vanchin Endpoint ID",
    placeholder: "ep-xxx-xxx",
    defaultValue: "",
    editorValue: "",
  }
}
```

## 改造方案

### 阶段一：后端数据模型改造

#### 1. 数据库 Schema 更新

**新增字段到 ApiConfig 表**：

```sql
ALTER TABLE ApiConfig ADD COLUMN category TEXT DEFAULT 'custom';
ALTER TABLE ApiConfig ADD COLUMN is_partner INTEGER DEFAULT 0;
ALTER TABLE ApiConfig ADD COLUMN theme_icon TEXT;
ALTER TABLE ApiConfig ADD COLUMN theme_bg_color TEXT;
ALTER TABLE ApiConfig ADD COLUMN theme_text_color TEXT;
ALTER TABLE ApiConfig ADD COLUMN meta TEXT; -- JSON 格式存储元数据
```

**元数据 JSON 结构**：
```json
{
  "custom_endpoints": {
    "https://api.example.com": {
      "url": "https://api.example.com",
      "addedAt": 1699999999999,
      "lastUsed": 1699999999999
    }
  },
  "template_values": {
    "ENDPOINT_ID": "ep-xxx-xxx"
  }
}
```

#### 2. Rust 数据模型更新

**文件**：`src-tauri/src/models/api_config.rs`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum VendorCategory {
    #[serde(rename = "official")]
    Official,
    #[serde(rename = "cn_official")]
    CnOfficial,
    #[serde(rename = "aggregator")]
    Aggregator,
    #[serde(rename = "third_party")]
    ThirdParty,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VendorTheme {
    pub icon: Option<String>,
    pub bg_color: Option<String>,
    pub text_color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomEndpoint {
    pub url: String,
    pub added_at: i64,
    pub last_used: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VendorMeta {
    pub custom_endpoints: Option<HashMap<String, CustomEndpoint>>,
    pub template_values: Option<HashMap<String, String>>,
}

// 更新 ApiConfig 结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiConfig {
    pub id: i64,
    pub name: String,
    pub api_key: String,
    pub server_url: String,
    pub server_port: i32,
    pub group_id: i64,
    pub sort_order: i32,
    pub is_available: bool,
    pub category: VendorCategory, // 新增
    pub is_partner: bool, // 新增
    pub theme: Option<VendorTheme>, // 新增
    pub meta: Option<VendorMeta>, // 新增
    // ... 其他字段
}
```

#### 3. 端点测速功能实现

**新增 Tauri 命令**：`src-tauri/src/commands/endpoint_test.rs`

```rust
use hyper::Client;
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize)]
pub struct EndpointTestResult {
    pub url: String,
    pub latency: Option<i32>, // 毫秒
    pub status: Option<u16>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_api_endpoints(
    urls: Vec<String>,
    timeout_secs: u64,
) -> AppResult<Vec<EndpointTestResult>> {
    let mut results = Vec::new();

    for url in urls {
        let start = Instant::now();
        let result = test_single_endpoint(&url, timeout_secs).await;
        let latency = start.elapsed().as_millis() as i32;

        results.push(match result {
            Ok(status) => EndpointTestResult {
                url: url.clone(),
                latency: Some(latency),
                status: Some(status),
                error: None,
            },
            Err(e) => EndpointTestResult {
                url: url.clone(),
                latency: None,
                status: None,
                error: Some(e.to_string()),
            },
        });
    }

    Ok(results)
}

async fn test_single_endpoint(url: &str, timeout_secs: u64) -> AppResult<u16> {
    // 发送简单的 OPTIONS 或 GET 请求测试连通性和延迟
    // 实现 HTTP 请求并返回状态码
    // ...
}
```

### 阶段二：供应商预设配置

#### 1. 创建预设配置文件

**文件**：`src-ui/src/config/vendorPresets.ts`

```typescript
export interface VendorPreset {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  category: VendorCategory;
  isOfficial?: boolean;
  isPartner?: boolean;
  serverUrl: string;
  serverPort: number;
  defaultModels?: {
    default?: string;
    haiku?: string;
    sonnet?: string;
    opus?: string;
  };
  endpointCandidates?: string[];
  theme?: {
    icon?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  templateValues?: Record<string, {
    label: string;
    placeholder: string;
    defaultValue?: string;
  }>;
}

export const vendorPresets: VendorPreset[] = [
  {
    name: "Claude Official",
    websiteUrl: "https://www.anthropic.com/claude-code",
    category: "official",
    isOfficial: true,
    serverUrl: "api.anthropic.com",
    serverPort: 443,
    theme: {
      icon: "claude",
      backgroundColor: "#D97757",
      textColor: "#FFFFFF",
    },
  },
  {
    name: "DeepSeek",
    websiteUrl: "https://platform.deepseek.com",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    category: "cn_official",
    serverUrl: "api.deepseek.com",
    serverPort: 443,
    defaultModels: {
      default: "DeepSeek-V3",
      haiku: "DeepSeek-V3",
      sonnet: "DeepSeek-V3",
      opus: "DeepSeek-V3",
    },
  },
  {
    name: "智谱 GLM",
    websiteUrl: "https://open.bigmodel.cn",
    apiKeyUrl: "https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII",
    category: "cn_official",
    isPartner: true,
    serverUrl: "open.bigmodel.cn",
    serverPort: 443,
    defaultModels: {
      default: "glm-4.6",
      haiku: "glm-4.5-air",
      sonnet: "glm-4.6",
      opus: "glm-4.6",
    },
  },
  {
    name: "AiHubMix",
    websiteUrl: "https://aihubmix.com",
    apiKeyUrl: "https://aihubmix.com",
    category: "aggregator",
    serverUrl: "aihubmix.com",
    serverPort: 443,
    endpointCandidates: [
      "https://aihubmix.com",
      "https://api.aihubmix.com",
    ],
  },
  {
    name: "自定义供应商",
    websiteUrl: "",
    category: "custom",
    serverUrl: "",
    serverPort: 443,
  },
];
```

### 阶段三：前端组件改造

#### 1. 端点测速组件

**文件**：`src-ui/src/components/EndpointSpeedTest.tsx`

参考 cc-switch 的实现，创建端点测速对话框：

**核心功能**：
- 端点列表显示（带延迟和状态）
- 添加/删除自定义端点
- 运行测速按钮
- 自动选择最优端点
- 结果排序（按延迟）

**UI 设计**：
```tsx
<Dialog>
  <DialogHeader>端点测速</DialogHeader>
  <DialogContent>
    {/* 控制栏 */}
    <div>
      <Checkbox checked={autoSelect}>自动选择最快端点</Checkbox>
      <Button onClick={runTest}>开始测速</Button>
    </div>

    {/* 添加端点 */}
    <div>
      <Input placeholder="https://api.example.com" />
      <Button>添加</Button>
    </div>

    {/* 端点列表 */}
    {endpoints.map(endpoint => (
      <EndpointRow
        url={endpoint.url}
        latency={endpoint.latency}
        isSelected={endpoint.url === selected}
        onSelect={() => handleSelect(endpoint.url)}
        onRemove={() => handleRemove(endpoint.url)}
      />
    ))}
  </DialogContent>
</Dialog>
```

#### 2. 供应商预设选择器

**文件**：`src-ui/src/components/VendorPresetSelector.tsx`

```tsx
interface VendorPresetSelectorProps {
  onSelect: (preset: VendorPreset) => void;
  selectedId?: string;
}

export function VendorPresetSelector({ onSelect, selectedId }: VendorPresetSelectorProps) {
  // 按分类分组显示预设
  const groupedPresets = useMemo(() => {
    return {
      official: presets.filter(p => p.category === 'official'),
      cn_official: presets.filter(p => p.category === 'cn_official'),
      aggregator: presets.filter(p => p.category === 'aggregator'),
      third_party: presets.filter(p => p.category === 'third_party'),
    };
  }, []);

  return (
    <div className="space-y-4">
      <CategorySection title="官方" presets={groupedPresets.official} />
      <CategorySection title="国产官方" presets={groupedPresets.cn_official} />
      <CategorySection title="聚合平台" presets={groupedPresets.aggregator} />
      <CategorySection title="第三方" presets={groupedPresets.third_party} />
    </div>
  );
}
```

#### 3. 配置表单改造

**文件**：`src-ui/src/components/ConfigEditor.tsx`

**新增功能**：
1. 预设选择器（顶部）
2. 模板变量输入字段（如果预设有模板变量）
3. 端点管理按钮（打开测速对话框）
4. 分类选择（自定义供应商）
5. 视觉主题配置（自定义供应商）

```tsx
<Dialog>
  {/* 预设选择器（仅新建模式） */}
  {!config && (
    <VendorPresetSelector
      selectedId={selectedPreset}
      onSelect={handlePresetSelect}
    />
  )}

  {/* 基本信息 */}
  <Input label="供应商名称" value={name} onChange={setName} />
  <Input label="官网地址" value={websiteUrl} onChange={setWebsiteUrl} />

  {/* 模板变量（如果有） */}
  {templateValues && Object.entries(templateValues).map(([key, config]) => (
    <Input
      key={key}
      label={config.label}
      placeholder={config.placeholder}
      value={config.editorValue}
      onChange={(v) => handleTemplateValueChange(key, v)}
    />
  ))}

  {/* 服务器配置 */}
  <div className="flex gap-2">
    <Input label="服务器地址" value={serverUrl} onChange={setServerUrl} />
    <Button onClick={() => setEndpointModalOpen(true)}>
      <Zap /> 端点测速
    </Button>
  </div>
  <Input label="端口" type="number" value={serverPort} onChange={setServerPort} />

  {/* API 密钥 */}
  <ApiKeySection
    value={apiKey}
    onChange={setApiKey}
    apiKeyUrl={preset?.apiKeyUrl}
  />

  {/* 模型配置 */}
  <ModelSection
    defaultModel={defaultModel}
    haikuModel={haikuModel}
    sonnetModel={sonnetModel}
    opusModel={opusModel}
  />

  {/* 分类和主题（自定义供应商） */}
  {category === 'custom' && (
    <>
      <Select label="分类" value={category} onChange={setCategory}>
        <option value="custom">自定义</option>
        <option value="third_party">第三方</option>
      </Select>
      <ThemeEditor theme={theme} onChange={setTheme} />
    </>
  )}

  {/* 端点测速对话框 */}
  <EndpointSpeedTest
    visible={endpointModalOpen}
    onClose={() => setEndpointModalOpen(false)}
    initialEndpoints={endpointCandidates}
    value={serverUrl}
    onChange={setServerUrl}
    onCustomEndpointsChange={handleCustomEndpointsChange}
  />
</Dialog>
```

#### 4. 配置列表 UI 更新

**文件**：`src-ui/src/components/ConfigList.tsx`

**新增显示元素**：
1. 分类徽章（category badge）
2. 合作伙伴标识
3. 主题颜色（卡片背景）
4. 供应商图标

```tsx
<ConfigCard
  config={config}
  className={cn(
    "border rounded-lg p-4",
    config.theme?.backgroundColor && `bg-[${config.theme.backgroundColor}]`
  )}
>
  <div className="flex items-center gap-2">
    {/* 图标 */}
    {config.theme?.icon && <VendorIcon type={config.theme.icon} />}

    {/* 名称 */}
    <h3 className="font-semibold">{config.name}</h3>

    {/* 分类徽章 */}
    <CategoryBadge category={config.category} />

    {/* 合作伙伴 */}
    {config.isPartner && <Badge>合作伙伴</Badge>}
  </div>

  {/* 服务器地址 */}
  <p className="text-sm text-gray-500">{config.serverUrl}</p>

  {/* 操作按钮 */}
  <div className="flex gap-2">
    <Button onClick={() => handleTest(config.id)}>测试</Button>
    <Button onClick={() => handleEdit(config.id)}>编辑</Button>
    <Button onClick={() => handleDelete(config.id)}>删除</Button>
  </div>
</ConfigCard>
```

### 阶段四：数据库迁移

#### 迁移脚本

**文件**：`src-tauri/src/db/migrations.rs`

```rust
fn migrate_to_vendor_config(conn: &Connection) -> AppResult<()> {
    // 1. 添加新字段
    conn.execute_batch(
        "ALTER TABLE ApiConfig ADD COLUMN category TEXT DEFAULT 'custom';
         ALTER TABLE ApiConfig ADD COLUMN is_partner INTEGER DEFAULT 0;
         ALTER TABLE ApiConfig ADD COLUMN theme_icon TEXT;
         ALTER TABLE ApiConfig ADD COLUMN theme_bg_color TEXT;
         ALTER TABLE ApiConfig ADD COLUMN theme_text_color TEXT;
         ALTER TABLE ApiConfig ADD COLUMN meta TEXT;"
    )?;

    // 2. 根据 server_url 推断分类
    conn.execute(
        "UPDATE ApiConfig SET category = CASE
            WHEN server_url LIKE '%anthropic.com%' THEN 'official'
            WHEN server_url LIKE '%deepseek.com%' THEN 'cn_official'
            WHEN server_url LIKE '%bigmodel.cn%' THEN 'cn_official'
            WHEN server_url LIKE '%aihubmix.com%' THEN 'aggregator'
            ELSE 'custom'
         END",
        [],
    )?;

    // 3. 初始化 meta 为空 JSON
    conn.execute(
        "UPDATE ApiConfig SET meta = '{}' WHERE meta IS NULL",
        [],
    )?;

    Ok(())
}
```

## UI/UX 改进

### 1. 分类颜色编码

```typescript
const categoryColors = {
  official: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  cn_official: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  aggregator: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  third_party: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  custom: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};
```

### 2. 端点延迟颜色

```typescript
function getLatencyColor(latency: number) {
  if (latency < 300) return 'text-green-600';
  if (latency < 500) return 'text-yellow-600';
  if (latency < 800) return 'text-orange-600';
  return 'text-red-600';
}
```

### 3. 测试状态指示

```typescript
enum TestStatus {
  Idle = 'idle',
  Testing = 'testing',
  Success = 'success',
  Failed = 'failed',
}
```

## 实施步骤

### 第1步：后端基础（2-3小时）
1. ✅ 更新数据模型（VendorCategory, VendorTheme, VendorMeta）
2. ✅ 数据库迁移脚本
3. ✅ 更新 CRUD 服务方法
4. ✅ 实现端点测速 Tauri 命令

### 第2步：预设配置（1小时）
1. ✅ 创建 vendorPresets.ts
2. ✅ 添加常用供应商预设（10-15个）
3. ✅ 配置主题和端点候选

### 第3步：端点测速组件（2-3小时）
1. ✅ 创建 EndpointSpeedTest 组件
2. ✅ 实现测速逻辑
3. ✅ 自定义端点管理
4. ✅ UI 优化（延迟颜色、排序）

### 第4步：配置表单改造（3-4小时）
1. ✅ 添加预设选择器
2. ✅ 集成端点测速
3. ✅ 模板变量支持
4. ✅ 主题配置
5. ✅ 表单验证

### 第5步：列表 UI 更新（2小时）
1. ✅ 添加分类徽章
2. ✅ 主题颜色应用
3. ✅ 图标显示
4. ✅ 筛选和排序

### 第6步：测试和优化（2小时）
1. ✅ 功能测试
2. ✅ 性能优化
3. ✅ 文档更新

**总计**：约 12-15 小时

## 技术难点和解决方案

### 难点1：端点测速的性能

**问题**：同时测试多个端点可能造成阻塞

**解决方案**：
- 使用 Rust 的 async/await 并发测试
- 设置合理的超时时间（8-12秒）
- 限制并发数量（最多10个）

### 难点2：模板变量替换

**问题**：配置中的占位符需要在保存前替换

**解决方案**：
```typescript
function applyTemplateValues(
  config: Record<string, any>,
  values: Record<string, string>
): Record<string, any> {
  const jsonStr = JSON.stringify(config);
  let result = jsonStr;

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `\${${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }

  return JSON.parse(result);
}
```

### 难点3：数据库迁移的兼容性

**问题**：需要保持旧数据兼容

**解决方案**：
- 使用 ALTER TABLE 添加新字段（带默认值）
- 根据 server_url 自动推断分类
- 提供手动分类调整功能

## 预期效果

### 用户体验改进
1. ✅ **快速配置**：选择预设，一键填充配置
2. ✅ **智能优化**：端点测速自动选择最快节点
3. ✅ **视觉区分**：分类颜色和主题让配置一目了然
4. ✅ **专业感**：合作伙伴标识提升信任度

### 开发体验改进
1. ✅ **易维护**：预设配置集中管理
2. ✅ **易扩展**：新增供应商只需添加预设
3. ✅ **易测试**：端点测速功能独立

### 性能改进
1. ✅ **更快连接**：自动选择低延迟端点
2. ✅ **容错能力**：支持多个备用端点

## 后续优化方向

1. **用量查询脚本**（参考 cc-switch）：
   - 支持自定义 JavaScript 脚本查询用量
   - 显示套餐余额和使用情况

2. **供应商评分系统**：
   - 根据测试成功率、平均延迟等指标评分
   - 推荐最优供应商

3. **自动故障转移**：
   - 当前供应商失败时自动切换到同组备用供应商
   - 记录切换日志

4. **供应商社区预设**：
   - 允许用户分享自己的供应商配置
   - 从社区导入预设配置

## 参考文件

**cc-switch 关键文件**：
- `/Users/sunjackson/Project/cc-switch/src/types.ts` - 类型定义
- `/Users/sunjackson/Project/cc-switch/src/config/claudeProviderPresets.ts` - 预设配置
- `/Users/sunjackson/Project/cc-switch/src/components/providers/forms/EndpointSpeedTest.tsx` - 端点测速
- `/Users/sunjackson/Project/cc-switch/src/components/providers/forms/ProviderForm.tsx` - 供应商表单

**当前项目需修改文件**：
- `src-tauri/src/models/api_config.rs` - 数据模型
- `src-tauri/src/db/migrations.rs` - 数据库迁移
- `src-tauri/src/commands/` - 新增端点测速命令
- `src-ui/src/config/vendorPresets.ts` - 新建预设配置
- `src-ui/src/components/EndpointSpeedTest.tsx` - 新建测速组件
- `src-ui/src/components/ConfigEditor.tsx` - 改造表单
- `src-ui/src/components/ConfigList.tsx` - 更新列表

## 总结

这次改造将把当前的 API 配置系统升级为功能完善的供应商配置系统，参考 cc-switch 的成熟设计，提供：

1. **分类管理**：官方、国产官方、聚合、第三方、自定义
2. **预设模板**：快速配置常用供应商
3. **端点优化**：测速选择最快节点
4. **视觉增强**：主题颜色和图标
5. **扩展性**：模板变量、元数据支持

改造后的系统将更加专业、易用、高效。
