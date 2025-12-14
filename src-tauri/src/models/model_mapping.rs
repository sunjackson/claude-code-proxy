/**
 * 模型映射配置数据模型
 *
 * 用于自定义 Claude ↔ OpenAI 模型映射关系
 */

use serde::{Deserialize, Serialize};

/// 模型映射方向
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MappingDirection {
    /// Claude → OpenAI
    ClaudeToOpenai,
    /// OpenAI → Claude
    OpenaiToClaude,
    /// Claude → Gemini
    ClaudeToGemini,
    /// Gemini → Claude
    GeminiToClaude,
    /// OpenAI → Gemini
    OpenaiToGemini,
    /// Gemini → OpenAI
    GeminiToOpenai,
    /// 双向映射
    Bidirectional,
}

impl MappingDirection {
    pub fn as_str(&self) -> &str {
        match self {
            Self::ClaudeToOpenai => "claude_to_openai",
            Self::OpenaiToClaude => "openai_to_claude",
            Self::ClaudeToGemini => "claude_to_gemini",
            Self::GeminiToClaude => "gemini_to_claude",
            Self::OpenaiToGemini => "openai_to_gemini",
            Self::GeminiToOpenai => "gemini_to_openai",
            Self::Bidirectional => "bidirectional",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "claude_to_openai" => Ok(Self::ClaudeToOpenai),
            "openai_to_claude" => Ok(Self::OpenaiToClaude),
            "claude_to_gemini" => Ok(Self::ClaudeToGemini),
            "gemini_to_claude" => Ok(Self::GeminiToClaude),
            "openai_to_gemini" => Ok(Self::OpenaiToGemini),
            "gemini_to_openai" => Ok(Self::GeminiToOpenai),
            "bidirectional" => Ok(Self::Bidirectional),
            _ => Err(format!("Invalid mapping direction: {}", s)),
        }
    }

    /// 获取映射方向的分组键（用于 UI 分组显示）
    pub fn group_key(&self) -> &str {
        match self {
            Self::ClaudeToOpenai | Self::OpenaiToClaude => "claude_openai",
            Self::ClaudeToGemini | Self::GeminiToClaude => "claude_gemini",
            Self::OpenaiToGemini | Self::GeminiToOpenai => "openai_gemini",
            Self::Bidirectional => "bidirectional",
        }
    }
}

/// 模型映射类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MappingType {
    /// 系统内置映射
    Builtin,
    /// 用户自定义映射
    UserDefined,
}

impl MappingType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Builtin => "builtin",
            Self::UserDefined => "user_defined",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "builtin" => Ok(Self::Builtin),
            "user_defined" => Ok(Self::UserDefined),
            _ => Err(format!("Invalid mapping type: {}", s)),
        }
    }
}

/// 模型提供商
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModelProvider {
    Claude,
    OpenAI,
    Gemini,
}

impl ModelProvider {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Claude => "Claude",
            Self::OpenAI => "OpenAI",
            Self::Gemini => "Gemini",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "Claude" => Ok(Self::Claude),
            "OpenAI" => Ok(Self::OpenAI),
            "Gemini" => Ok(Self::Gemini),
            _ => Err(format!("Invalid provider: {}", s)),
        }
    }
}

/// 模型映射配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMapping {
    /// 主键
    pub id: i64,

    /// 源模型名称
    pub source_model: String,

    /// 目标模型名称
    pub target_model: String,

    /// 映射方向
    pub direction: MappingDirection,

    /// 映射类型
    pub mapping_type: MappingType,

    /// 源模型提供商
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_provider: Option<ModelProvider>,

    /// 目标模型提供商
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_provider: Option<ModelProvider>,

    /// 优先级 (0-100, 数字越大优先级越高)
    pub priority: i32,

    /// 描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// 备注
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// 是否启用
    pub is_enabled: bool,

    /// 是否为自定义映射
    pub is_custom: bool,

    /// 创建时间
    pub created_at: String,

    /// 更新时间
    pub updated_at: String,
}

/// 创建模型映射请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateModelMappingRequest {
    pub source_model: String,
    pub target_model: String,
    pub direction: MappingDirection,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_provider: Option<ModelProvider>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_provider: Option<ModelProvider>,

    #[serde(default = "default_priority")]
    pub priority: i32,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default = "default_enabled")]
    pub is_enabled: bool,
}

fn default_priority() -> i32 {
    50
}

fn default_enabled() -> bool {
    true
}

/// 更新模型映射请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateModelMappingRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_model: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_enabled: Option<bool>,
}

/// 模型映射查询参数
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelMappingQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_model: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_model: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<MappingDirection>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub mapping_type: Option<MappingType>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_custom: Option<bool>,
}

/// 批量导入/导出格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMappingExport {
    /// 版本号
    pub version: String,

    /// 导出时间
    pub exported_at: String,

    /// 映射列表
    pub mappings: Vec<ModelMappingExportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMappingExportItem {
    pub source_model: String,
    pub target_model: String,
    pub direction: MappingDirection,
    pub source_provider: Option<ModelProvider>,
    pub target_provider: Option<ModelProvider>,
    pub priority: i32,
    pub description: Option<String>,
    pub notes: Option<String>,
}

impl From<ModelMapping> for ModelMappingExportItem {
    fn from(mapping: ModelMapping) -> Self {
        Self {
            source_model: mapping.source_model,
            target_model: mapping.target_model,
            direction: mapping.direction,
            source_provider: mapping.source_provider,
            target_provider: mapping.target_provider,
            priority: mapping.priority,
            description: mapping.description,
            notes: mapping.notes,
        }
    }
}
