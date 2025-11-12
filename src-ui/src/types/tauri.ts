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

  // Claude 模型配置
  default_model?: string;
  haiku_model?: string;
  sonnet_model?: string;
  opus_model?: string;
  small_fast_model?: string;

  // API 高级设置
  api_timeout_ms?: number;
  max_output_tokens?: number;
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

  // Claude 模型配置
  default_model?: string;
  haiku_model?: string;
  sonnet_model?: string;
  opus_model?: string;
  small_fast_model?: string;

  // API 高级设置
  api_timeout_ms?: number;
  max_output_tokens?: number;
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
 * API 测试结果
 */
export interface TestResult {
  /** 测试结果 ID */
  id: number;
  /** API 配置 ID */
  config_id: number;
  /** 测试时间(Unix 时间戳) */
  test_time: number;
  /** 是否成功 */
  is_success: boolean;
  /** 延迟(毫秒) */
  latency_ms: number | null;
  /** 错误信息 */
  error_message: string | null;
}

/**
 * 切换原因类型
 */
export type SwitchReason = 'connection_failed' | 'timeout' | 'quota_exceeded' | 'high_latency' | 'manual';

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
  /** 源配置(可能已删除) */
  source_config: ApiConfig | null;
  /** 目标配置 */
  target_config: ApiConfig;
  /** 所属分组 */
  group: ConfigGroup;
  /** 是否跨分组切换(应始终为 false) */
  is_cross_group: boolean;
  /** 切换前延迟(毫秒) */
  latency_before_ms: number | null;
  /** 切换后延迟(毫秒) */
  latency_after_ms: number | null;
  /** 错误信息 */
  error_message: string | null;
}

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
