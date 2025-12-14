/**
 * 模型映射系统
 *
 * 提供 Claude 和 OpenAI 模型之间的双向映射:
 * - Claude → OpenAI 模型名称转换
 * - OpenAI → Claude 模型名称转换
 * - 模型能力识别与验证
 * - 默认模型配置
 */

use std::collections::HashMap;

// ════════════════════════════════════════════════════════════════════════════
// 模型能力定义
// ════════════════════════════════════════════════════════════════════════════

/// 模型能力标识
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ModelCapability {
    /// 文本生成
    TextGeneration,
    /// 代码生成
    CodeGeneration,
    /// 视觉理解 (多模态)
    Vision,
    /// 函数调用
    FunctionCalling,
    /// 长上下文
    LongContext,
    /// 流式输出
    Streaming,
}

/// 模型信息
#[derive(Debug, Clone)]
pub struct ModelInfo {
    /// 模型标识符
    pub id: String,
    /// 显示名称
    pub display_name: String,
    /// 提供商
    pub provider: ModelProvider,
    /// 最大上下文长度
    pub max_context_tokens: i32,
    /// 最大输出 token 数
    pub max_output_tokens: i32,
    /// 支持的能力
    pub capabilities: Vec<ModelCapability>,
    /// 是否已弃用
    pub deprecated: bool,
}

/// 模型提供商
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelProvider {
    Claude,
    OpenAI,
}

// ════════════════════════════════════════════════════════════════════════════
// 模型映射器
// ════════════════════════════════════════════════════════════════════════════

/// 模型映射器 - 提供 Claude ↔ OpenAI 模型名称双向转换
pub struct ModelMapper {
    /// Claude → OpenAI 映射表
    claude_to_openai: HashMap<String, String>,
    /// OpenAI → Claude 映射表
    openai_to_claude: HashMap<String, String>,
    /// 模型信息缓存
    model_info: HashMap<String, ModelInfo>,
}

impl Default for ModelMapper {
    fn default() -> Self {
        Self::new()
    }
}

impl ModelMapper {
    /// 创建新的模型映射器
    pub fn new() -> Self {
        let mut mapper = Self {
            claude_to_openai: HashMap::new(),
            openai_to_claude: HashMap::new(),
            model_info: HashMap::new(),
        };
        mapper.init_default_mappings();
        mapper.init_model_info();
        mapper
    }

    /// 初始化默认映射关系
    fn init_default_mappings(&mut self) {
        // Claude Sonnet 4.5 (最新版本)
        self.add_mapping("claude-sonnet-4-5-20250929", "gpt-4o");

        // Claude 3.5 系列 → OpenAI 等价模型
        self.add_mapping("claude-3-5-sonnet-20241022", "gpt-4o");
        self.add_mapping("claude-3-5-sonnet-latest", "gpt-4o");
        self.add_mapping("claude-3-5-haiku-20241022", "gpt-4o-mini");
        self.add_mapping("claude-3-5-haiku-latest", "gpt-4o-mini");

        // Claude 3 系列 → OpenAI 等价模型
        self.add_mapping("claude-3-opus-20240229", "gpt-4-turbo");
        self.add_mapping("claude-3-opus-latest", "gpt-4-turbo");
        self.add_mapping("claude-3-sonnet-20240229", "gpt-4");
        self.add_mapping("claude-3-haiku-20240307", "gpt-3.5-turbo");

        // Claude 2 系列 (已弃用但仍支持)
        self.add_mapping("claude-2.1", "gpt-4");
        self.add_mapping("claude-2.0", "gpt-4");
        self.add_mapping("claude-instant-1.2", "gpt-3.5-turbo");

        // OpenAI → Claude 反向映射 (使用最新稳定版本)
        self.add_reverse_mapping("gpt-4o", "claude-sonnet-4-5-20250929");
        self.add_reverse_mapping("gpt-4o-2024-08-06", "claude-sonnet-4-5-20250929");
        self.add_reverse_mapping("gpt-4o-2024-05-13", "claude-sonnet-4-5-20250929");
        self.add_reverse_mapping("gpt-4o-mini", "claude-3-5-haiku-20241022");
        self.add_reverse_mapping("gpt-4o-mini-2024-07-18", "claude-3-5-haiku-20241022");
        self.add_reverse_mapping("gpt-4-turbo", "claude-3-opus-20240229");
        self.add_reverse_mapping("gpt-4-turbo-2024-04-09", "claude-3-opus-20240229");
        self.add_reverse_mapping("gpt-4-turbo-preview", "claude-3-opus-20240229");
        self.add_reverse_mapping("gpt-4", "claude-3-sonnet-20240229");
        self.add_reverse_mapping("gpt-4-0613", "claude-3-sonnet-20240229");
        self.add_reverse_mapping("gpt-4-0314", "claude-3-sonnet-20240229");
        self.add_reverse_mapping("gpt-3.5-turbo", "claude-3-haiku-20240307");
        self.add_reverse_mapping("gpt-3.5-turbo-0125", "claude-3-haiku-20240307");
        self.add_reverse_mapping("gpt-3.5-turbo-1106", "claude-3-haiku-20240307");
    }

    /// 初始化模型信息
    fn init_model_info(&mut self) {
        // Claude Sonnet 4.5 (最新版本)
        self.model_info.insert(
            "claude-sonnet-4-5-20250929".to_string(),
            ModelInfo {
                id: "claude-sonnet-4-5-20250929".to_string(),
                display_name: "Claude Sonnet 4.5".to_string(),
                provider: ModelProvider::Claude,
                max_context_tokens: 200000,
                max_output_tokens: 8192,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // Claude 3.5 Sonnet
        self.model_info.insert(
            "claude-3-5-sonnet-20241022".to_string(),
            ModelInfo {
                id: "claude-3-5-sonnet-20241022".to_string(),
                display_name: "Claude 3.5 Sonnet".to_string(),
                provider: ModelProvider::Claude,
                max_context_tokens: 200000,
                max_output_tokens: 8192,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // Claude 3.5 Haiku
        self.model_info.insert(
            "claude-3-5-haiku-20241022".to_string(),
            ModelInfo {
                id: "claude-3-5-haiku-20241022".to_string(),
                display_name: "Claude 3.5 Haiku".to_string(),
                provider: ModelProvider::Claude,
                max_context_tokens: 200000,
                max_output_tokens: 8192,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // Claude 3 Opus
        self.model_info.insert(
            "claude-3-opus-20240229".to_string(),
            ModelInfo {
                id: "claude-3-opus-20240229".to_string(),
                display_name: "Claude 3 Opus".to_string(),
                provider: ModelProvider::Claude,
                max_context_tokens: 200000,
                max_output_tokens: 4096,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // Claude 3 Sonnet
        self.model_info.insert(
            "claude-3-sonnet-20240229".to_string(),
            ModelInfo {
                id: "claude-3-sonnet-20240229".to_string(),
                display_name: "Claude 3 Sonnet".to_string(),
                provider: ModelProvider::Claude,
                max_context_tokens: 200000,
                max_output_tokens: 4096,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // Claude 3 Haiku
        self.model_info.insert(
            "claude-3-haiku-20240307".to_string(),
            ModelInfo {
                id: "claude-3-haiku-20240307".to_string(),
                display_name: "Claude 3 Haiku".to_string(),
                provider: ModelProvider::Claude,
                max_context_tokens: 200000,
                max_output_tokens: 4096,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // GPT-4o
        self.model_info.insert(
            "gpt-4o".to_string(),
            ModelInfo {
                id: "gpt-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                provider: ModelProvider::OpenAI,
                max_context_tokens: 128000,
                max_output_tokens: 16384,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // GPT-4o Mini
        self.model_info.insert(
            "gpt-4o-mini".to_string(),
            ModelInfo {
                id: "gpt-4o-mini".to_string(),
                display_name: "GPT-4o Mini".to_string(),
                provider: ModelProvider::OpenAI,
                max_context_tokens: 128000,
                max_output_tokens: 16384,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // GPT-4 Turbo
        self.model_info.insert(
            "gpt-4-turbo".to_string(),
            ModelInfo {
                id: "gpt-4-turbo".to_string(),
                display_name: "GPT-4 Turbo".to_string(),
                provider: ModelProvider::OpenAI,
                max_context_tokens: 128000,
                max_output_tokens: 4096,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::Vision,
                    ModelCapability::FunctionCalling,
                    ModelCapability::LongContext,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // GPT-4
        self.model_info.insert(
            "gpt-4".to_string(),
            ModelInfo {
                id: "gpt-4".to_string(),
                display_name: "GPT-4".to_string(),
                provider: ModelProvider::OpenAI,
                max_context_tokens: 8192,
                max_output_tokens: 4096,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::FunctionCalling,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );

        // GPT-3.5 Turbo
        self.model_info.insert(
            "gpt-3.5-turbo".to_string(),
            ModelInfo {
                id: "gpt-3.5-turbo".to_string(),
                display_name: "GPT-3.5 Turbo".to_string(),
                provider: ModelProvider::OpenAI,
                max_context_tokens: 16385,
                max_output_tokens: 4096,
                capabilities: vec![
                    ModelCapability::TextGeneration,
                    ModelCapability::CodeGeneration,
                    ModelCapability::FunctionCalling,
                    ModelCapability::Streaming,
                ],
                deprecated: false,
            },
        );
    }

    /// 添加 Claude → OpenAI 映射
    fn add_mapping(&mut self, claude_model: &str, openai_model: &str) {
        self.claude_to_openai
            .insert(claude_model.to_string(), openai_model.to_string());
    }

    /// 添加 OpenAI → Claude 反向映射
    fn add_reverse_mapping(&mut self, openai_model: &str, claude_model: &str) {
        self.openai_to_claude
            .insert(openai_model.to_string(), claude_model.to_string());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 公共 API
    // ════════════════════════════════════════════════════════════════════════

    /// 将 Claude 模型名称转换为 OpenAI 等价模型
    ///
    /// # Arguments
    /// * `claude_model` - Claude 模型名称
    ///
    /// # Returns
    /// * 对应的 OpenAI 模型名称，如果没有映射则返回原模型名
    pub fn claude_to_openai(&self, claude_model: &str) -> String {
        // 首先尝试精确匹配
        if let Some(openai_model) = self.claude_to_openai.get(claude_model) {
            return openai_model.clone();
        }

        // 尝试模糊匹配 (处理 -latest 后缀)
        let normalized = self.normalize_claude_model(claude_model);
        if let Some(openai_model) = self.claude_to_openai.get(&normalized) {
            return openai_model.clone();
        }

        // 返回默认值
        self.default_openai_model().to_string()
    }

    /// 将 OpenAI 模型名称转换为 Claude 等价模型
    ///
    /// # Arguments
    /// * `openai_model` - OpenAI 模型名称
    ///
    /// # Returns
    /// * 对应的 Claude 模型名称，如果没有映射则返回原模型名
    pub fn openai_to_claude(&self, openai_model: &str) -> String {
        // 首先尝试精确匹配
        if let Some(claude_model) = self.openai_to_claude.get(openai_model) {
            return claude_model.clone();
        }

        // 尝试去除版本后缀匹配
        let base_model = self.normalize_openai_model(openai_model);
        if let Some(claude_model) = self.openai_to_claude.get(&base_model) {
            return claude_model.clone();
        }

        // 返回默认值
        self.default_claude_model().to_string()
    }

    /// 获取模型信息
    pub fn get_model_info(&self, model: &str) -> Option<&ModelInfo> {
        self.model_info.get(model)
    }

    /// 检查模型是否支持特定能力
    pub fn supports_capability(&self, model: &str, capability: ModelCapability) -> bool {
        self.model_info
            .get(model)
            .map(|info| info.capabilities.contains(&capability))
            .unwrap_or(false)
    }

    /// 获取模型的最大输出 token 数
    pub fn get_max_output_tokens(&self, model: &str) -> Option<i32> {
        self.model_info.get(model).map(|info| info.max_output_tokens)
    }

    /// 获取模型的最大上下文长度
    pub fn get_max_context_tokens(&self, model: &str) -> Option<i32> {
        self.model_info.get(model).map(|info| info.max_context_tokens)
    }

    /// 检查是否为已知的 Claude 模型
    pub fn is_claude_model(&self, model: &str) -> bool {
        model.starts_with("claude-")
    }

    /// 检查是否为已知的 OpenAI 模型
    pub fn is_openai_model(&self, model: &str) -> bool {
        model.starts_with("gpt-") || model.starts_with("o1-") || model.starts_with("chatgpt-")
    }

    /// 获取默认 Claude 模型
    pub fn default_claude_model(&self) -> &str {
        "claude-sonnet-4-5-20250929"
    }

    /// 获取默认 OpenAI 模型
    pub fn default_openai_model(&self) -> &str {
        "gpt-4o"
    }

    /// 获取所有已知的 Claude 模型列表
    pub fn list_claude_models(&self) -> Vec<&str> {
        self.claude_to_openai.keys().map(|s| s.as_str()).collect()
    }

    /// 获取所有已知的 OpenAI 模型列表
    pub fn list_openai_models(&self) -> Vec<&str> {
        self.openai_to_claude.keys().map(|s| s.as_str()).collect()
    }

    // ════════════════════════════════════════════════════════════════════════
    // 私有辅助方法
    // ════════════════════════════════════════════════════════════════════════

    /// 规范化 Claude 模型名称
    fn normalize_claude_model(&self, model: &str) -> String {
        // 处理 -latest 后缀
        if model.ends_with("-latest") {
            let base = model.trim_end_matches("-latest");
            // 尝试找到对应的具体版本
            for key in self.claude_to_openai.keys() {
                if key.starts_with(base) && !key.ends_with("-latest") {
                    return key.clone();
                }
            }
        }
        model.to_string()
    }

    /// 规范化 OpenAI 模型名称
    fn normalize_openai_model(&self, model: &str) -> String {
        // 去除日期版本后缀 (如 gpt-4o-2024-08-06 → gpt-4o)
        let parts: Vec<&str> = model.split('-').collect();

        // 检测是否有日期后缀 (4位数字开头)
        if parts.len() >= 3 {
            if let Some(last) = parts.last() {
                if last.len() == 4 && last.chars().all(|c| c.is_ascii_digit()) {
                    // 可能是日期前缀，取前面的部分
                    let date_idx = parts.len() - 3; // 假设日期是 YYYY-MM-DD 格式
                    if date_idx > 0 {
                        return parts[..date_idx].join("-");
                    }
                }
            }
        }

        // 去除常见后缀
        let suffixes = ["-preview", "-0613", "-0314", "-0125", "-1106"];
        for suffix in suffixes {
            if model.ends_with(suffix) {
                return model.trim_end_matches(suffix).to_string();
            }
        }

        model.to_string()
    }
}

// ════════════════════════════════════════════════════════════════════════════
// 全局单例
// ════════════════════════════════════════════════════════════════════════════

use std::sync::LazyLock;

/// 全局模型映射器实例
pub static MODEL_MAPPER: LazyLock<ModelMapper> = LazyLock::new(ModelMapper::new);

/// 便捷函数: Claude 模型转 OpenAI
pub fn claude_to_openai(model: &str) -> String {
    MODEL_MAPPER.claude_to_openai(model)
}

/// 便捷函数: OpenAI 模型转 Claude
pub fn openai_to_claude(model: &str) -> String {
    MODEL_MAPPER.openai_to_claude(model)
}

// ════════════════════════════════════════════════════════════════════════════
// 测试
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_to_openai_mapping() {
        let mapper = ModelMapper::new();

        // 精确匹配
        assert_eq!(
            mapper.claude_to_openai("claude-sonnet-4-5-20250929"),
            "gpt-4o"
        );
        assert_eq!(
            mapper.claude_to_openai("claude-3-5-sonnet-20241022"),
            "gpt-4o"
        );
        assert_eq!(
            mapper.claude_to_openai("claude-3-opus-20240229"),
            "gpt-4-turbo"
        );
        assert_eq!(
            mapper.claude_to_openai("claude-3-haiku-20240307"),
            "gpt-3.5-turbo"
        );

        // -latest 后缀
        assert_eq!(
            mapper.claude_to_openai("claude-3-5-sonnet-latest"),
            "gpt-4o"
        );
    }

    #[test]
    fn test_openai_to_claude_mapping() {
        let mapper = ModelMapper::new();

        // 精确匹配
        assert_eq!(
            mapper.openai_to_claude("gpt-4o"),
            "claude-sonnet-4-5-20250929"
        );
        assert_eq!(
            mapper.openai_to_claude("gpt-4-turbo"),
            "claude-3-opus-20240229"
        );
        assert_eq!(
            mapper.openai_to_claude("gpt-3.5-turbo"),
            "claude-3-haiku-20240307"
        );

        // 带版本后缀
        assert_eq!(
            mapper.openai_to_claude("gpt-4o-2024-08-06"),
            "claude-sonnet-4-5-20250929"
        );
    }

    #[test]
    fn test_model_info() {
        let mapper = ModelMapper::new();

        let info = mapper.get_model_info("claude-3-5-sonnet-20241022");
        assert!(info.is_some());

        let info = info.unwrap();
        assert_eq!(info.max_context_tokens, 200000);
        assert_eq!(info.max_output_tokens, 8192);
        assert!(info.capabilities.contains(&ModelCapability::Vision));
    }

    #[test]
    fn test_capability_check() {
        let mapper = ModelMapper::new();

        assert!(mapper.supports_capability("gpt-4o", ModelCapability::Vision));
        assert!(mapper.supports_capability("gpt-4", ModelCapability::FunctionCalling));
        assert!(!mapper.supports_capability("gpt-4", ModelCapability::Vision));
    }

    #[test]
    fn test_model_detection() {
        let mapper = ModelMapper::new();

        assert!(mapper.is_claude_model("claude-3-5-sonnet-20241022"));
        assert!(mapper.is_claude_model("claude-2.1"));
        assert!(!mapper.is_claude_model("gpt-4"));

        assert!(mapper.is_openai_model("gpt-4o"));
        assert!(mapper.is_openai_model("gpt-3.5-turbo"));
        assert!(!mapper.is_openai_model("claude-3-opus"));
    }

    #[test]
    fn test_unknown_model_fallback() {
        let mapper = ModelMapper::new();

        // 未知 Claude 模型应回退到默认 OpenAI 模型
        assert_eq!(mapper.claude_to_openai("claude-unknown"), "gpt-4o");

        // 未知 OpenAI 模型应回退到默认 Claude 模型
        assert_eq!(
            mapper.openai_to_claude("gpt-unknown"),
            "claude-sonnet-4-5-20250929"
        );
    }

    #[test]
    fn test_global_convenience_functions() {
        assert_eq!(claude_to_openai("claude-3-5-sonnet-20241022"), "gpt-4o");
        assert_eq!(
            openai_to_claude("gpt-4o"),
            "claude-sonnet-4-5-20250929"
        );
    }

    #[test]
    fn test_list_models() {
        let mapper = ModelMapper::new();

        let claude_models = mapper.list_claude_models();
        assert!(!claude_models.is_empty());
        assert!(claude_models.contains(&"claude-3-5-sonnet-20241022"));

        let openai_models = mapper.list_openai_models();
        assert!(!openai_models.is_empty());
        assert!(openai_models.contains(&"gpt-4o"));
    }

    #[test]
    fn test_max_tokens() {
        let mapper = ModelMapper::new();

        assert_eq!(
            mapper.get_max_output_tokens("claude-3-5-sonnet-20241022"),
            Some(8192)
        );
        assert_eq!(mapper.get_max_output_tokens("gpt-4o"), Some(16384));
        assert_eq!(mapper.get_max_output_tokens("unknown-model"), None);
    }
}
