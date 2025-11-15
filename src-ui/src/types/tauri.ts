/**
 * Tauri 命令类型定义
 * 对应后端 Rust 结构体
 */

/**
 * Claude Code 配置路径检测结果
 */
export interface ClaudeCodePath {
  /** 配置文件路径 */
  settings_path: string;
  /** 配置目录路径 */
  config_dir: string;
  /** 操作系统平台 */
  platform: string;
  /** 配置文件是否存在 */
  exists: boolean;
  /** 是否可读 */
  readable: boolean;
  /** 是否可写 */
  writable: boolean;
}

/**
 * 配置备份信息
 */
export interface ConfigBackup {
  /** 备份 ID */
  id: number;
  /** 备份时间 */
  backup_time: string;
  /** 备份文件名 */
  file_name: string;
  /** 文件大小(字节) */
  file_size: number;
  /** 备份原因 */
  reason: string;
}

/**
 * 代理配置
 */
export interface ProxyConfig {
  /** 代理服务器地址 */
  host: string;
  /** 代理服务器端口 */
  port: number;
}

/**
 * 应用错误
 */
export interface AppError {
  /** 错误类型 */
  type: string;
  /** 错误消息 */
  message: string;
}

/**
 * Tauri 命令返回结果
 */
export type TauriResult<T> = {
  Ok: T;
} | {
  Err: AppError;
};

/**
 * 配置分组
 */
export interface ConfigGroup {
  /** 分组 ID */
  id: number;
  /** 分组名称 */
  name: string;
  /** 分组描述 */
  description: string | null;
  /** 是否启用自动切换 */
  auto_switch_enabled: boolean;
  /** 延迟阈值(毫秒) */
  latency_threshold_ms: number;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 供应商分类
 */
export type VendorCategory = 'official' | 'cn_official' | 'aggregator' | 'third_party' | 'custom';
// ProviderCategory 是 VendorCategory 的别名，用于兼容
export type ProviderCategory = VendorCategory;

/**
 * API 配置
 */
export interface ApiConfig {
  /** 配置 ID */
  id: number;
  /** 配置名称 */
  name: string;
  /** API 密钥(加密后显示为 [ENCRYPTED]) */
  api_key: string;
  /** 服务器地址 */
  server_url: string;
  /** 服务器端口 */
  server_port: number;
  /** 所属分组 ID */
  group_id: number | null;
  /** 排序顺序 */
  sort_order: number;
  /** 是否可用 */
  is_available: boolean;
  /** 最后测试时间 */
  last_test_at: string | null;
  /** 最后测试延迟(毫秒) */
  last_latency_ms: number | null;

  /** 供应商分类 */
  category: VendorCategory;
  /** 是否为合作伙伴 */
  is_partner: boolean;

  // 视觉主题配置
  /** 图标类型 */
  theme_icon: string | null;
  /** 背景色 */
  theme_bg_color: string | null;
  /** 文字色 */
  theme_text_color: string | null;

  /** 元数据（JSON字符串） */
  meta: string;

  // Claude 模型配置
  /** 默认模型 */
  default_model: string | null;
  /** Haiku 模型（快速、低成本） */
  haiku_model: string | null;
  /** Sonnet 模型（平衡） */
  sonnet_model: string | null;
  /** Opus 模型（最强） */
  opus_model: string | null;
  /** 小型快速模型 */
  small_fast_model: string | null;

  // API 高级设置
  /** API 超时时间（毫秒） */
  api_timeout_ms: number | null;
  /** 最大输出令牌数 */
  max_output_tokens: number | null;

  // 余额查询相关
  /** 余额查询URL */
  balance_query_url: string | null;
  /** 最后查询到的余额 */
  last_balance: number | null;
  /** 余额货币单位 */
  balance_currency: string | null;
  /** 最后余额查询时间 */
  last_balance_check_at: string | null;
  /** 余额查询状态 */
  balance_query_status: 'success' | 'failed' | 'pending' | null;
  /** 余额查询错误信息 */
  balance_query_error: string | null;
  /** 是否启用自动余额查询 */
  auto_balance_check: boolean;
  /** 余额查询间隔（秒） */
  balance_check_interval_sec: number | null;

  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 创建 API 配置的输入参数
 */
export interface CreateApiConfigInput {
  name: string;
  api_key: string;
  server_url: string;
  server_port?: number;
  group_id?: number | null;
  sort_order?: number;

  // 供应商分类和主题
  category?: VendorCategory;
  is_partner?: boolean;
  theme_icon?: string;
  theme_bg_color?: string;
  theme_text_color?: string;
  meta?: string;

  // Claude 模型配置
  default_model?: string;
  haiku_model?: string;
  sonnet_model?: string;
  opus_model?: string;
  small_fast_model?: string;

  // API 高级设置
  api_timeout_ms?: number;
  max_output_tokens?: number;

  // 余额查询配置
  balance_query_url?: string;
  auto_balance_check?: boolean;
  balance_check_interval_sec?: number;
  balance_currency?: string;
}

/**
 * 更新 API 配置的输入参数
 */
export interface UpdateApiConfigInput {
  id: number;
  name?: string;
  api_key?: string;
  server_url?: string;
  server_port?: number;
  group_id?: number | null;
  sort_order?: number;
  is_available?: boolean;

  // 供应商分类和主题
  category?: VendorCategory;
  is_partner?: boolean;
  theme_icon?: string;
  theme_bg_color?: string;
  theme_text_color?: string;
  meta?: string;

  // Claude 模型配置
  default_model?: string;
  haiku_model?: string;
  sonnet_model?: string;
  opus_model?: string;
  small_fast_model?: string;

  // API 高级设置
  api_timeout_ms?: number;
  max_output_tokens?: number;

  // 余额查询配置
  balance_query_url?: string;
  auto_balance_check?: boolean;
  balance_check_interval_sec?: number;
  balance_currency?: string;
}

/**
 * 代理服务状态
 */
export type ProxyStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * 代理服务信息
 */
export interface ProxyService {
  /** 运行状态 */
  status: ProxyStatus;
  /** 监听地址 */
  listen_host: string;
  /** 监听端口 */
  listen_port: number;
  /** 当前使用的分组 ID */
  active_group_id: number | null;
  /** 当前使用的分组名称 */
  active_group_name: string | null;
  /** 当前使用的 API 配置 ID */
  active_config_id: number | null;
  /** 当前使用的配置名称 */
  active_config_name: string | null;
}

/**
 * 测试状态
 */
export type TestStatus = 'success' | 'failed' | 'timeout';

/**
 * API 测试结果
 */
export interface TestResult {
  /** 测试结果 ID */
  id: number;
  /** API 配置 ID */
  config_id: number;
  /** 所属分组 ID */
  group_id: number | null;
  /** 测试时间 */
  test_at: string;
  /** 连接状态 */
  status: TestStatus;
  /** 延迟(毫秒) */
  latency_ms: number | null;
  /** 错误信息 */
  error_message: string | null;
  /** API 密钥是否有效 */
  is_valid_key: boolean | null;
  /** API 响应内容 */
  response_text: string | null;
  /** 测试使用的模型 */
  test_model: string | null;
  /** 尝试次数 */
  attempt: number | null;
}

/**
 * 切换原因类型
 */
export type SwitchReason =
  | 'connection_failed'
  | 'timeout'
  | 'quota_exceeded'
  | 'high_latency'
  | 'manual'
  | 'retry_failed'
  | 'unrecoverable_error'
  | 'rate_limit_exceeded';

/**
 * 切换日志
 */
export interface SwitchLog {
  /** 日志 ID */
  id: number;
  /** 切换时间 */
  switch_at: string;
  /** 切换原因 */
  reason: SwitchReason;
  /** 源配置名称(可能已删除) */
  source_config_name: string | null;
  /** 目标配置名称 */
  target_config_name: string;
  /** 所属分组名称 */
  group_name: string;
  /** 切换前延迟(毫秒) */
  latency_before_ms: number | null;
  /** 切换后延迟(毫秒) */
  latency_after_ms: number | null;
  /** 延迟改善(毫秒) */
  latency_improvement_ms: number | null;
  /** 错误信息 */
  error_message: string | null;
  /** 重试次数 */
  retry_count: number;
  /** 错误类型 */
  error_type: ErrorType | null;
  /** 错误详情 */
  error_details: string | null;
}

/**
 * 错误类型
 */
export type ErrorType =
  | 'network'
  | 'timeout'
  | 'authentication'
  | 'insufficient_balance'
  | 'account_banned'
  | 'rate_limit'
  | 'server_error'
  | 'unknown';

/**
 * 服务数据源
 */
export type ServiceSource = 'remote' | 'local';

/**
 * 推荐服务
 */
export interface RecommendedService {
  /** 服务 ID */
  id: number;
  /** 站点名称 */
  site_name: string;
  /** 推广链接 */
  promotion_url: string;
  /** 是否为推荐服务 */
  is_recommended: boolean;
  /** 热度指标(0-100) - 用于排序，不显示 */
  hotness_score: number;
  /** 服务区域：domestic(国内) 或 international(国外) */
  region: string;
  /** 服务商简介 */
  description: string;
  /** 数据源 */
  source: ServiceSource;
  /** 加载时间 */
  loaded_at: string;
}

/**
 * 环境变量信息
 */
export interface EnvironmentVariable {
  /** 变量名 */
  key: string;
  /** 变量值 */
  value: string;
  /** 是否为 Anthropic 相关变量 */
  is_anthropic: boolean;
}

/**
 * 余额查询状态
 */
export type BalanceQueryStatus = 'success' | 'failed' | 'pending';

/**
 * 余额查询结果
 */
export interface BalanceInfo {
  /** 配置ID */
  config_id: number;
  /** 配置名称 */
  config_name: string;
  /** 余额 */
  balance: number | null;
  /** 货币单位 */
  currency: string | null;
  /** 查询状态 */
  status: BalanceQueryStatus;
  /** 查询时间 */
  checked_at: string;
  /** 错误信息 */
  error_message: string | null;
}
