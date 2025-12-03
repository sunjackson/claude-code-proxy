/**
 * Claude Code Test Request Builder
 * 构建与真实 Claude Code 完全相同格式的测试请求
 *
 * 用于：
 * - 配置列表页的 API 测试
 * - 服务商监控页面的健康检查
 */

use serde_json::json;

/// 生成与真实 Claude Code 相同格式的 user_id
pub fn generate_user_id() -> String {
    let hash = uuid::Uuid::new_v4().simple().to_string() + &uuid::Uuid::new_v4().simple().to_string();
    let session = uuid::Uuid::new_v4().to_string();
    format!("user_{}_account__session_{}", hash, session)
}

/// 构建与真实 Claude Code 完全相同格式的测试请求体
///
/// 包含：
/// - system: 两个元素的数组，包含 Claude Code 标识和基本指令
/// - tools: 3 个基本工具定义（Bash, Read, Write）
/// - messages: 使用数组格式的 content
/// - metadata.user_id: 正确格式的用户 ID
pub fn build_test_request_body() -> serde_json::Value {
    let user_id = generate_user_id();

    json!({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 128,
        "stream": true,
        "system": [
            {
                "type": "text",
                "text": "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
                "cache_control": {
                    "type": "ephemeral"
                }
            },
            {
                "type": "text",
                "text": "You are an interactive CLI tool that helps users with coding tasks. Use the instructions below and the tools available to you to assist the user.\n\nIMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts.\n\n# Tool usage policy\n- When doing file search, prefer to use the Task tool in order to reduce context usage.\n- You can call multiple tools in a single response.",
                "cache_control": {
                    "type": "ephemeral"
                }
            }
        ],
        "tools": [
            {
                "name": "Bash",
                "description": "Executes a given bash command in a persistent shell session with optional timeout.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "description": "The command to execute",
                            "type": "string"
                        },
                        "timeout": {
                            "description": "Optional timeout in milliseconds",
                            "type": "number"
                        }
                    },
                    "required": ["command"],
                    "additionalProperties": false,
                    "$schema": "http://json-schema.org/draft-07/schema#"
                }
            },
            {
                "name": "Read",
                "description": "Reads a file from the local filesystem.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "description": "The absolute path to the file to read",
                            "type": "string"
                        },
                        "offset": {
                            "description": "The line number to start reading from",
                            "type": "number"
                        },
                        "limit": {
                            "description": "The number of lines to read",
                            "type": "number"
                        }
                    },
                    "required": ["file_path"],
                    "additionalProperties": false,
                    "$schema": "http://json-schema.org/draft-07/schema#"
                }
            },
            {
                "name": "Write",
                "description": "Writes a file to the local filesystem.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "description": "The absolute path to the file to write",
                            "type": "string"
                        },
                        "content": {
                            "description": "The content to write to the file",
                            "type": "string"
                        }
                    },
                    "required": ["file_path", "content"],
                    "additionalProperties": false,
                    "$schema": "http://json-schema.org/draft-07/schema#"
                }
            }
        ],
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Hello, please respond with a brief greeting."
                    }
                ]
            }
        ],
        "metadata": {
            "user_id": user_id
        }
    })
}

/// 添加 Claude Code 特有的请求头到 reqwest RequestBuilder
/// 注意：使用 Authorization: Bearer 格式，与代理转发保持一致
/// 同时也添加 x-api-key 以兼容 Anthropic 官方 API
pub fn add_claude_code_headers(builder: reqwest::RequestBuilder, api_key: &str) -> reqwest::RequestBuilder {
    builder
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        // 使用 Bearer Token 格式（代理服务商通常使用这种格式）
        .header("Authorization", format!("Bearer {}", api_key))
        // 同时添加 x-api-key 以兼容 Anthropic 官方 API
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        // Claude Code 特有的 beta 功能标识
        .header("anthropic-beta", "claude-code-20250219,interleaved-thinking-2025-05-14")
        // 允许直接浏览器访问（重要）
        .header("anthropic-dangerous-direct-browser-access", "true")
        // 模拟真实的 Claude Code User-Agent
        .header("User-Agent", "claude-cli/2.0.55 (external, claude-vscode, agent-sdk/0.1.55)")
        // Stainless SDK 请求头（Claude Code 使用的 SDK）
        .header("x-stainless-lang", "js")
        .header("x-stainless-runtime", "node")
        .header("x-stainless-runtime-version", "v24.3.0")
        .header("x-stainless-package-version", "0.70.0")
        .header("x-stainless-arch", "arm64")
        .header("x-stainless-os", "MacOS")
        .header("x-stainless-retry-count", "0")
        .header("x-app", "cli")
}

/// 测试请求超时时间（秒）
pub const TEST_REQUEST_TIMEOUT_SECS: u64 = 30;
