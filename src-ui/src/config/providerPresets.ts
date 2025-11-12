/**
 * Provider Preset 系统
 * 预定义的 API 供应商配置模板
 */

/**
 * 供应商分类
 */
export type ProviderCategory = 'official' | 'cn_official' | 'third_party' | 'aggregator' | 'custom';

/**
 * 供应商分类标签
 */
export const categoryLabels: Record<ProviderCategory, string> = {
  official: '官方',
  cn_official: '国内官方',
  third_party: '第三方',
  aggregator: '聚合平台',
  custom: '自定义',
};

/**
 * 供应商分类颜色
 */
export const categoryColors: Record<ProviderCategory, { bg: string; text: string; border: string }> = {
  official: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-500',
    border: 'border-purple-500',
  },
  cn_official: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-500',
    border: 'border-blue-500',
  },
  third_party: {
    bg: 'bg-green-500/20',
    text: 'text-green-500',
    border: 'border-green-500',
  },
  aggregator: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-500',
    border: 'border-orange-500',
  },
  custom: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500',
  },
};

/**
 * Provider Preset 接口
 */
export interface ProviderPreset {
  /** 供应商 ID (唯一标识) */
  id: string;
  /** 供应商名称 */
  name: string;
  /** 供应商分类 */
  category: ProviderCategory;
  /** 供应商网站 */
  websiteUrl: string;
  /** API Key 获取地址 (可选,如果与 websiteUrl 不同) */
  apiKeyUrl?: string;
  /** 描述 */
  description?: string;
  /** 是否为推荐供应商 */
  isRecommended?: boolean;
  /** 是否为合作伙伴 */
  isPartner?: boolean;

  // 配置模板
  /** 服务器地址 (端口会自动从 URL 推断) */
  serverUrl: string;
  /** 默认模型 */
  defaultModel?: string;
  /** Haiku 模型 (快速、低成本) */
  haikuModel?: string;
  /** Sonnet 模型 (平衡) */
  sonnetModel?: string;
  /** Opus 模型 (最强) */
  opusModel?: string;
  /** 小型快速模型 */
  smallFastModel?: string;
  /** API 超时时间 (毫秒) */
  apiTimeoutMs?: number;
  /** 最大输出令牌数 */
  maxOutputTokens?: number;

  /** 备选服务器地址列表 (用于故障切换) */
  endpointCandidates?: string[];
}

/**
 * 预设供应商配置列表
 */
export const providerPresets: ProviderPreset[] = [
  // ==================== 官方 ====================
  {
    id: 'claude-official',
    name: 'Claude Official',
    category: 'official',
    websiteUrl: 'https://www.anthropic.com/claude-code',
    description: 'Anthropic 官方 Claude API',
    isRecommended: true,
    serverUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-5-20250929',
    haikuModel: 'claude-haiku-4-5-20251001',
    sonnetModel: 'claude-sonnet-4-5-20250929',
    opusModel: 'claude-opus-4-20250514',
    smallFastModel: 'claude-haiku-4-5-20251001',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },

  // ==================== 国内官方 ====================
  {
    id: 'deepseek',
    name: 'DeepSeek',
    category: 'cn_official',
    websiteUrl: 'https://platform.deepseek.com',
    description: 'DeepSeek 官方 API - 支持 DeepSeek-V3.2-Exp 模型',
    isRecommended: true,
    serverUrl: 'https://api.deepseek.com/anthropic',
    defaultModel: 'DeepSeek-V3.2-Exp',
    haikuModel: 'DeepSeek-V3.2-Exp',
    sonnetModel: 'DeepSeek-V3.2-Exp',
    opusModel: 'DeepSeek-V3.2-Exp',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'zhipu-glm',
    name: 'Zhipu GLM',
    category: 'cn_official',
    websiteUrl: 'https://open.bigmodel.cn',
    apiKeyUrl: 'https://www.bigmodel.cn/claude-code',
    description: '智谱 AI 官方 API - 支持 GLM-4.6 模型',
    isRecommended: true,
    isPartner: true,
    serverUrl: 'https://open.bigmodel.cn/api/anthropic',
    defaultModel: 'glm-4.6',
    haikuModel: 'glm-4.5-air',
    sonnetModel: 'glm-4.6',
    opusModel: 'glm-4.6',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'qwen-coder',
    name: 'Qwen Coder',
    category: 'cn_official',
    websiteUrl: 'https://bailian.console.aliyun.com',
    description: '阿里云通义千问官方 API - 支持 Qwen3-Max 模型',
    serverUrl: 'https://dashscope.aliyuncs.com/api/v2/apps/claude-code-proxy',
    defaultModel: 'qwen3-max',
    haikuModel: 'qwen3-max',
    sonnetModel: 'qwen3-max',
    opusModel: 'qwen3-max',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    category: 'cn_official',
    websiteUrl: 'https://platform.moonshot.cn/console',
    description: 'Moonshot AI 官方 API - 支持 Kimi K2 Thinking 模型',
    serverUrl: 'https://api.moonshot.cn/anthropic',
    defaultModel: 'kimi-k2-thinking',
    haikuModel: 'kimi-k2-thinking',
    sonnetModel: 'kimi-k2-thinking',
    opusModel: 'kimi-k2-thinking',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    category: 'cn_official',
    websiteUrl: 'https://platform.minimaxi.com',
    apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information',
    description: 'MiniMax 官方 API - 支持 MiniMax-M2 模型',
    serverUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2',
    haikuModel: 'MiniMax-M2',
    sonnetModel: 'MiniMax-M2',
    opusModel: 'MiniMax-M2',
    apiTimeoutMs: 3000000,
    maxOutputTokens: 65000,
  },
  {
    id: 'longcat',
    name: 'Longcat（龙猫）',
    category: 'cn_official',
    websiteUrl: 'https://longcat.chat',
    description: '龙猫官方 API',
    serverUrl: 'https://longcat.chat/anthropic',
    defaultModel: 'claude-sonnet-4-5-20250929',
    haikuModel: 'claude-haiku-4-5-20251001',
    sonnetModel: 'claude-sonnet-4-5-20250929',
    opusModel: 'claude-opus-4-20250514',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'streamlake',
    name: 'StreamLake（火山方舟）',
    category: 'cn_official',
    websiteUrl: 'https://www.streamlake.ai',
    description: '字节跳动火山方舟官方 API',
    serverUrl: 'https://api.streamlake.ai/anthropic',
    defaultModel: 'claude-sonnet-4-5-20250929',
    haikuModel: 'claude-haiku-4-5-20251001',
    sonnetModel: 'claude-sonnet-4-5-20250929',
    opusModel: 'claude-opus-4-20250514',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },

  // ==================== 第三方服务 ====================
  {
    id: '88code',
    name: '88Code',
    category: 'third_party',
    websiteUrl: 'https://www.88code.org',
    description: '88Code API 中转服务',
    serverUrl: 'https://www.88code.org/api',
    defaultModel: 'claude-sonnet-4-5-20250929',
    haikuModel: 'claude-haiku-4-5-20251001',
    sonnetModel: 'claude-sonnet-4-5-20250929',
    opusModel: 'claude-sonnet-4-5-20250929',
    smallFastModel: 'claude-haiku-4-5-20251001',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'co-cdn',
    name: 'CO-CDN',
    category: 'third_party',
    websiteUrl: 'https://co-cdn.yes.vg',
    description: 'CO-CDN API 中转服务',
    serverUrl: 'https://co-cdn.yes.vg',
    defaultModel: 'claude-sonnet-4-5-20250929',
    haikuModel: 'claude-haiku-4-5-20251001',
    sonnetModel: 'claude-sonnet-4-5-20250929',
    opusModel: 'claude-opus-4-20250514',
    smallFastModel: 'claude-haiku-4-5-20251001',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'packycode',
    name: 'PackyCode',
    category: 'third_party',
    websiteUrl: 'https://www.packyapi.com',
    description: 'PackyCode API 中转服务',
    serverUrl: 'https://www.packyapi.com',
    endpointCandidates: [
      'https://www.packyapi.com',
      'https://api-slb.packyapi.com',
    ],
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'anyrouter',
    name: 'AnyRouter',
    category: 'third_party',
    websiteUrl: 'https://anyrouter.top',
    apiKeyUrl: 'https://anyrouter.top/register?aff=PCel',
    description: 'AnyRouter API 路由服务',
    serverUrl: 'https://anyrouter.top',
    endpointCandidates: [
      'https://anyrouter.top',
      'https://q.quuvv.cn',
      'https://pmpjfbhq.cn-nb1.rainapp.top',
    ],
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },

  // ==================== 聚合平台 ====================
  {
    id: 'modelscope',
    name: 'ModelScope',
    category: 'aggregator',
    websiteUrl: 'https://modelscope.cn',
    description: '魔搭社区 - 模型聚合平台',
    serverUrl: 'https://api-inference.modelscope.cn',
    defaultModel: 'ZhipuAI/GLM-4.6',
    haikuModel: 'ZhipuAI/GLM-4.6',
    sonnetModel: 'ZhipuAI/GLM-4.6',
    opusModel: 'ZhipuAI/GLM-4.6',
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
  {
    id: 'aihubmix',
    name: 'AiHubMix',
    category: 'aggregator',
    websiteUrl: 'https://aihubmix.com',
    description: 'AI 模型聚合平台',
    serverUrl: 'https://aihubmix.com',
    endpointCandidates: [
      'https://aihubmix.com',
      'https://api.aihubmix.com',
    ],
    apiTimeoutMs: 600000,
    maxOutputTokens: 65000,
  },
];

/**
 * 根据 ID 获取预设
 */
export function getPresetById(id: string): ProviderPreset | undefined {
  return providerPresets.find((p) => p.id === id);
}

/**
 * 根据分类获取预设列表
 */
export function getPresetsByCategory(category: ProviderCategory): ProviderPreset[] {
  return providerPresets.filter((p) => p.category === category);
}

/**
 * 获取推荐的预设列表
 */
export function getRecommendedPresets(): ProviderPreset[] {
  return providerPresets.filter((p) => p.isRecommended);
}

/**
 * 获取所有分类
 */
export function getAllCategories(): ProviderCategory[] {
  return Array.from(new Set(providerPresets.map((p) => p.category)));
}
