# UI 组件接口合约

**特性分支**: `001-claude-code-proxy` | **日期**: 2025-11-08
**前端框架**: React 18 + TypeScript + Tailwind CSS
**UI 库**: shadcn/ui + Radix UI

---

## 概述

本文档定义了前端 React 组件的接口合约,包括组件 Props、State 和主要事件处理器。所有组件遵循 React 18 函数式组件模式,使用 TypeScript 类型定义。

**设计原则**:
- 黑金配色主题(#000000 背景,#FFD700 强调色)
- 响应式布局(最小宽度 1024px)
- 无障碍支持(ARIA 标签)
- 国际化支持(i18next)

---

## 1. 页面组件 (Page Components)

### 1.1 Dashboard (主控制面板)

**路径**: `/`

**Props**:
```typescript
interface DashboardProps {
  // 无 props,从全局状态获取数据
}
```

**子组件**:
- `ProxyStatusCard`: 代理服务状态卡片
- `QuickActionsPanel`: 快捷操作面板(启动/停止代理、切换分组)
- `CurrentConfigCard`: 当前配置信息卡片
- `RecentSwitchLogs`: 最近切换日志列表

**状态管理**:
```typescript
interface DashboardState {
  proxyStatus: ProxyStatus | null;
  currentGroup: ConfigGroup | null;
  currentConfig: ApiConfig | null;
  recentLogs: SwitchLog[];
  loading: boolean;
  error: string | null;
}
```

**主要交互**:
- 启动/停止代理服务(调用 `start_proxy_service` / `stop_proxy_service`)
- 快速切换分组(调用 `switch_proxy_group`)
- 查看切换日志详情

**对应用户故事**: User Story 1, User Story 4

---

### 1.2 ConfigManagement (配置管理页面)

**路径**: `/configs`

**Props**:
```typescript
interface ConfigManagementProps {
  // 无 props,从全局状态获取数据
}
```

**子组件**:
- `GroupSelector`: 分组选择器(左侧边栏)
- `ConfigList`: 配置列表(可拖拽排序)
- `ConfigEditor`: 配置编辑器(对话框)
- `GroupEditor`: 分组编辑器(对话框)
- `TestResultPanel`: 测试结果面板

**状态管理**:
```typescript
interface ConfigManagementState {
  groups: ConfigGroup[];
  selectedGroupId: number | null;
  configs: ApiConfig[];
  editingConfig: ApiConfig | null;
  editingGroup: ConfigGroup | null;
  testResults: Map<number, TestResult>;  // config_id -> TestResult
  loading: boolean;
}
```

**主要交互**:
- 创建/编辑/删除分组(调用 `create_config_group` 等)
- 创建/编辑/删除配置(调用 `create_api_config` 等)
- 拖拽调整配置顺序(调用 `reorder_api_configs`)
- 测试单个/全部配置(调用 `test_api_config` / `test_group_configs`)
- 切换分组的自动切换开关(调用 `toggle_auto_switch`)

**对应用户故事**: User Story 2, User Story 3, User Story 4

---

### 1.3 ClaudeCodeIntegration (Claude Code 集成页面)

**路径**: `/claude-code`

**Props**:
```typescript
interface ClaudeCodeIntegrationProps {
  // 无 props
}
```

**子组件**:
- `ClaudeCodePathDetector`: 配置路径检测器
- `ProxyEnableToggle`: 代理启用/禁用开关
- `BackupList`: 备份列表
- `ConfigPreview`: 配置文件预览(JSON 格式)

**状态管理**:
```typescript
interface ClaudeCodeIntegrationState {
  claudeCodePath: ClaudeCodePath | null;
  backups: ConfigBackup[];
  isProxyEnabled: boolean;
  currentConfig: object | null;  // 当前 Claude Code 配置(JSON)
  loading: boolean;
}
```

**主要交互**:
- 检测 Claude Code 路径(调用 `detect_claude_code_path`)
- 启用本地代理(调用 `enable_claude_code_proxy`)
- 恢复原始配置(调用 `restore_claude_code_config`)
- 查看备份列表(调用 `list_claude_code_backups`)

**对应用户故事**: User Story 1

---

### 1.4 Recommendations (推荐服务导航页面)

**路径**: `/recommendations`

**Props**:
```typescript
interface RecommendationsProps {
  // 无 props
}
```

**子组件**:
- `ServiceCard`: 服务卡片(显示站点名称、热度、推荐徽章)
- `FilterBar`: 筛选栏(按推荐状态、热度排序)

**状态管理**:
```typescript
interface RecommendationsState {
  services: RecommendedService[];
  filter: 'all' | 'recommended';
  sortBy: 'hotness' | 'name';
  loading: boolean;
  lastLoadedAt: string | null;
}
```

**主要交互**:
- 加载推荐服务(调用 `load_recommended_services`)
- 刷新服务列表(调用 `refresh_recommended_services`)
- 点击服务卡片打开推广链接(使用 `window.open`)

**对应用户故事**: User Story 6

---

### 1.5 Settings (设置页面)

**路径**: `/settings`

**Props**:
```typescript
interface SettingsProps {
  // 无 props
}
```

**子组件**:
- `LanguageSelector`: 语言选择器
- `DefaultsEditor`: 默认值编辑器(延迟阈值、代理端口)
- `RecommendationSourceEditor`: 推荐服务源配置
- `EnvironmentVariableManager`: 环境变量管理器

**状态管理**:
```typescript
interface SettingsState {
  appSettings: AppSettings | null;
  environmentVariables: EnvironmentVariable[];
  loading: boolean;
}
```

**主要交互**:
- 更新应用设置(调用 `update_app_settings`)
- 管理环境变量(调用 `set_environment_variable` / `unset_environment_variable`)
- 从配置应用环境变量(调用 `apply_config_to_env`)

**对应用户故事**: User Story 5, User Story 7

---

## 2. 通用组件 (Common Components)

### 2.1 ProxyStatusCard (代理状态卡片)

**Props**:
```typescript
interface ProxyStatusCardProps {
  status: ProxyStatus;
  onStart: () => void;
  onStop: () => void;
  onSwitchGroup: (groupId: number) => void;
  onSwitchConfig: (configId: number) => void;
}
```

**UI 元素**:
- 状态指示灯('running': 绿色, 'stopped': 灰色, 'error': 红色)
- 当前分组和配置名称
- 监听端口号
- 启动/停止按钮
- 快速切换下拉菜单

**响应事件**: `proxy-status-changed` (Tauri 事件)

---

### 2.2 ConfigList (配置列表)

**Props**:
```typescript
interface ConfigListProps {
  configs: ApiConfig[];
  selectedConfigId?: number | null;
  onEdit: (config: ApiConfig) => void;
  onDelete: (configId: number) => void;
  onTest: (configId: number) => void;
  onReorder: (configIds: number[]) => void;
  testResults?: Map<number, TestResult>;
}
```

**UI 元素**:
- 可拖拽的配置项(使用 `react-beautiful-dnd` 或 `dnd-kit`)
- 每个配置项显示:名称、服务器地址、端口、可用状态、最后延迟
- 编辑/删除/测试按钮
- 测试结果指示器(成功:绿色勾,失败:红色叉)

**拖拽逻辑**:
```typescript
const handleDragEnd = (result: DropResult) => {
  if (!result.destination) return;
  const reorderedIds = reorder(
    configs.map(c => c.id),
    result.source.index,
    result.destination.index
  );
  onReorder(reorderedIds);
};
```

---

### 2.3 ConfigEditor (配置编辑器对话框)

**Props**:
```typescript
interface ConfigEditorProps {
  config?: ApiConfig | null;  // undefined: 创建新配置, null: 关闭对话框
  groups: ConfigGroup[];
  onSave: (config: CreateApiConfigInput | UpdateApiConfigInput) => void;
  onCancel: () => void;
}
```

**UI 元素**:
- 表单字段:配置名称、API 密钥(密码输入)、服务器地址、端口、所属分组
- 保存/取消按钮
- 表单验证(必填字段、URL 格式、端口范围)

**表单验证**:
```typescript
const schema = z.object({
  name: z.string().min(1, t('validation.nameRequired')),
  api_key: z.string().min(1, t('validation.apiKeyRequired')),
  server_url: z.string().url(t('validation.invalidUrl')),
  server_port: z.number().int().min(1).max(65535),
  group_id: z.number().nullable(),
});
```

---

### 2.4 GroupSelector (分组选择器)

**Props**:
```typescript
interface GroupSelectorProps {
  groups: ConfigGroup[];
  selectedGroupId?: number | null;
  onSelect: (groupId: number | null) => void;
  onCreate: () => void;
  onEdit: (group: ConfigGroup) => void;
  onDelete: (groupId: number) => void;
}
```

**UI 元素**:
- 分组列表(包括"未分组")
- 每个分组显示:名称、配置数量、自动切换开关
- 新建分组按钮(+图标)
- 编辑/删除菜单(右键或三点菜单)

**样式**:
```css
.group-item {
  padding: 12px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
}

.group-item.selected {
  background: rgba(255, 215, 0, 0.1);
  border-left-color: #FFD700;
}

.group-item.auto-switch-enabled::after {
  content: '⚡';
  margin-left: 8px;
  color: #FFD700;
}
```

---

### 2.5 TestResultPanel (测试结果面板)

**Props**:
```typescript
interface TestResultPanelProps {
  results: Map<number, TestResult>;
  configs: ApiConfig[];
  onTestAll: () => void;
}
```

**UI 元素**:
- 测试全部按钮(带加载状态)
- 结果列表(每个配置一行)
- 每行显示:配置名称、状态图标、延迟(ms)、API 有效性

**样式示例**:
```tsx
<div className="flex items-center gap-2">
  {result.status === 'success' && <CheckCircle className="text-green-500" />}
  {result.status === 'failed' && <XCircle className="text-red-500" />}
  {result.status === 'timeout' && <Clock className="text-yellow-500" />}
  <span>{result.latency_ms ? `${result.latency_ms}ms` : '-'}</span>
</div>
```

---

### 2.6 SwitchLogTable (切换日志表格)

**Props**:
```typescript
interface SwitchLogTableProps {
  logs: SwitchLog[];
  onLoadMore: () => void;
  hasMore: boolean;
}
```

**UI 元素**:
- 表格列:时间、原因、源配置、目标配置、分组、延迟变化
- 分页加载(滚动到底部加载更多)
- 原因标签(不同颜色):
  - `connection_failed`: 红色
  - `timeout`: 黄色
  - `quota_exceeded`: 橙色
  - `high_latency`: 紫色
  - `manual`: 蓝色

**表格列定义**:
```typescript
const columns = [
  { key: 'switch_at', label: t('logs.time'), width: '180px' },
  { key: 'reason', label: t('logs.reason'), width: '150px' },
  { key: 'source_config', label: t('logs.from'), width: '200px' },
  { key: 'target_config', label: t('logs.to'), width: '200px' },
  { key: 'group', label: t('logs.group'), width: '150px' },
  { key: 'latency', label: t('logs.latency'), width: '150px' },
];
```

---

### 2.7 ServiceCard (推荐服务卡片)

**Props**:
```typescript
interface ServiceCardProps {
  service: RecommendedService;
  onClick: (url: string) => void;
}
```

**UI 元素**:
- 站点名称(大标题)
- 推荐徽章(is_recommended = true 时显示)
- 热度指标(星级或数值进度条)
- 点击打开链接

**样式**:
```css
.service-card {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 24px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.service-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(255, 215, 0, 0.2);
}

.recommended-badge {
  background: linear-gradient(90deg, #FFD700 0%, #FFA500 100%);
  color: #000;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}
```

---

### 2.8 EnvironmentVariableManager (环境变量管理器)

**Props**:
```typescript
interface EnvironmentVariableManagerProps {
  variables: EnvironmentVariable[];
  onSet: (key: string, value: string) => void;
  onUnset: (key: string) => void;
  onApplyFromConfig: (configId: number) => void;
}
```

**UI 元素**:
- 环境变量列表(表格)
- 新增/编辑对话框
- "从配置应用"按钮(打开配置选择器)
- 每行显示:变量名、变量值(可隐藏)、状态(激活/未激活)、操作按钮

---

## 3. 布局组件 (Layout Components)

### 3.1 AppLayout (应用主布局)

**Props**:
```typescript
interface AppLayoutProps {
  children: React.ReactNode;
}
```

**结构**:
```tsx
<div className="app-layout">
  <Sidebar />
  <main className="main-content">
    <Header />
    <div className="page-content">
      {children}
    </div>
  </main>
</div>
```

**样式**:
```css
.app-layout {
  display: flex;
  height: 100vh;
  background: #000;
  color: #fff;
}

.sidebar {
  width: 240px;
  background: #0a0a0a;
  border-right: 1px solid #1a1a1a;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
```

---

### 3.2 Sidebar (侧边栏导航)

**Props**:
```typescript
interface SidebarProps {
  // 无 props,使用 react-router 的 useLocation
}
```

**导航项**:
```typescript
const navItems = [
  { path: '/', icon: HomeIcon, label: t('nav.dashboard') },
  { path: '/configs', icon: SettingsIcon, label: t('nav.configs') },
  { path: '/claude-code', icon: CodeIcon, label: t('nav.claudeCode') },
  { path: '/recommendations', icon: StarIcon, label: t('nav.recommendations') },
  { path: '/settings', icon: CogIcon, label: t('nav.settings') },
];
```

**样式**:
```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: #999;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item.active {
  background: rgba(255, 215, 0, 0.1);
  color: #FFD700;
  border-left: 3px solid #FFD700;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
```

---

### 3.3 Header (页面头部)

**Props**:
```typescript
interface HeaderProps {
  title?: string;  // 页面标题,如果未提供则根据路由自动生成
}
```

**UI 元素**:
- 页面标题
- 代理服务状态指示器(迷你版)
- 语言切换器(下拉菜单)
- 系统诊断按钮(显示系统信息对话框)

---

## 4. 通知和反馈组件 (Notification & Feedback)

### 4.1 Toast 通知

**使用库**: `react-hot-toast` 或 `sonner`

**通知类型**:
```typescript
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  type: ToastType;
  title: string;
  message: string;
  duration?: number;  // 默认 3000ms
}
```

**调用示例**:
```typescript
import { toast } from 'react-hot-toast';

// 成功通知
toast.success(t('notifications.configSaved'));

// 错误通知
toast.error(t('notifications.proxyStartFailed'), {
  description: error.message,
  duration: 5000,
});

// 自动切换通知(监听 Tauri 事件)
listen<AutoSwitchTriggeredEvent>('auto-switch-triggered', (event) => {
  toast.warning(t('notifications.autoSwitchTriggered'), {
    description: t(`reasons.${event.payload.reason}`),
  });
});
```

---

### 4.2 ConfirmDialog (确认对话框)

**Props**:
```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}
```

**用途**:
- 删除配置/分组确认(FR-024)
- 修改 Claude Code 配置确认
- 恢复原始配置确认

**样式示例**:
```tsx
<Dialog open={open} onOpenChange={onCancel}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{message}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        {cancelText || t('common.cancel')}
      </Button>
      <Button variant={variant === 'danger' ? 'destructive' : 'default'} onClick={onConfirm}>
        {confirmText || t('common.confirm')}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 4.3 ErrorBoundary (错误边界)

**Props**:
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

**用途**: 捕获 React 组件树中的 JavaScript 错误(FR-023, SC-012)

**Fallback UI**:
```tsx
<div className="error-boundary">
  <h2>{t('errors.somethingWentWrong')}</h2>
  <p>{error.message}</p>
  <Button onClick={() => window.location.reload()}>
    {t('common.reload')}
  </Button>
</div>
```

---

## 5. 状态管理 (State Management)

### 5.1 全局状态 (Zustand Store)

**推荐使用 Zustand** (轻量级状态管理库)

```typescript
interface AppStore {
  // Proxy State
  proxyStatus: ProxyStatus | null;
  setProxyStatus: (status: ProxyStatus) => void;

  // Config State
  groups: ConfigGroup[];
  configs: ApiConfig[];
  selectedGroupId: number | null;
  setGroups: (groups: ConfigGroup[]) => void;
  setConfigs: (configs: ApiConfig[]) => void;
  selectGroup: (groupId: number | null) => void;

  // Settings
  appSettings: AppSettings | null;
  setAppSettings: (settings: AppSettings) => void;

  // Loading States
  loading: {
    proxy: boolean;
    configs: boolean;
    settings: boolean;
  };
  setLoading: (key: keyof AppStore['loading'], value: boolean) => void;

  // Actions
  refreshProxyStatus: () => Promise<void>;
  refreshConfigs: () => Promise<void>;
}

const useAppStore = create<AppStore>((set, get) => ({
  // ... 实现
}));
```

---

### 5.2 本地化状态 (i18next)

**配置**:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false,
    },
  });
```

**使用示例**:
```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();

// 翻译文本
<h1>{t('dashboard.title')}</h1>

// 切换语言
i18n.changeLanguage('en-US');
```

---

## 6. 性能优化

### 6.1 组件懒加载

```typescript
import { lazy, Suspense } from 'react';

const ConfigManagement = lazy(() => import('./pages/ConfigManagement'));

<Suspense fallback={<LoadingSpinner />}>
  <ConfigManagement />
</Suspense>
```

### 6.2 虚拟滚动(长列表)

对于切换日志表格和推荐服务列表,使用 `react-window` 或 `react-virtuoso`:

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={logs.length}
  itemSize={60}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <LogRow log={logs[index]} />
    </div>
  )}
</FixedSizeList>
```

### 6.3 防抖和节流

对于搜索和拖拽操作:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const handleSearch = useDebouncedCallback((query: string) => {
  // 执行搜索
}, 300);
```

---

## 7. 无障碍性 (Accessibility)

### 7.1 ARIA 标签

```tsx
<button
  aria-label={t('actions.startProxy')}
  aria-pressed={proxyStatus?.status === 'running'}
>
  {t('actions.start')}
</button>
```

### 7.2 键盘导航

所有交互元素支持键盘操作:
- `Tab` / `Shift+Tab`: 焦点移动
- `Enter` / `Space`: 激活按钮
- `Escape`: 关闭对话框

### 7.3 颜色对比度

确保文本和背景的对比度符合 WCAG AA 标准:
- 正常文本: 至少 4.5:1
- 大文本: 至少 3:1

---

**文档版本**: v1.0.0
**生成时间**: 2025-11-08
**下一步**: 生成 quickstart.md
