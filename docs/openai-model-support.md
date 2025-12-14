# OpenAI 模型支持 - 使用指南

> **功能概述**: Claude Code Proxy 支持将 Claude Code 发出的请求自动转换为 OpenAI 格式，并将 OpenAI 的响应转换回 Claude 格式，实现完全透明的跨平台模型调用。

---

## 目录

1. [功能特性](#功能特性)
2. [工作原理](#工作原理)
3. [配置方法](#配置方法)
4. [模型映射](#模型映射)
5. [请求转换示例](#请求转换示例)
6. [流式响应转换](#流式响应转换)
7. [测试验证](#测试验证)
8. [故障排查](#故障排查)

---

## 功能特性

### ✅ 已实现的功能

- **自动协议转换**: Claude API 格式 ↔ OpenAI API 格式
- **模型名称映射**: Claude 模型名 ↔ OpenAI 模型名
- **流式响应支持**: SSE (Server-Sent Events) 实时转换
- **双向转换**: 支持 Claude → OpenAI 和 OpenAI → Claude
- **透明代理**: 客户端无需任何修改
- **协议检测**: 自动识别请求格式

### 🎯 使用场景

1. **使用 OpenAI 模型**: 在 Claude Code 中调用 GPT-4、GPT-3.5 等 OpenAI 模型
2. **成本优化**: 在 OpenAI 和 Claude 之间根据价格/性能切换
3. **多服务商支持**: 同时管理 Claude、OpenAI、Gemini 等多个服务商
4. **格式兼容**: 无需修改 Claude Code 配置，自动处理格式差异

---

## 工作原理

### 架构流程图

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Code                                                  │
│ - 发送 Claude Messages API 格式请求                         │
│ - 期望接收 Claude 格式响应                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓ (Claude 格式请求)
┌─────────────────────────────────────────────────────────────┐
│ Proxy Server (src-tauri/src/proxy/router.rs)                │
│                                                              │
│ 1. 识别 provider_type = OpenAI                              │
│ 2. 调用 convert_claude_request_to_openai()                  │
│    - 转换消息格式                                           │
│    - 映射模型名称 (claude-sonnet → gpt-4)                   │
│    - 调整参数 (max_tokens → max_completion_tokens)          │
│ 3. 更新 URI: /v1/messages → /v1/chat/completions            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓ (OpenAI 格式请求)
┌─────────────────────────────────────────────────────────────┐
│ OpenAI API 服务器                                            │
│ - 接收标准 OpenAI Chat Completions 请求                     │
│ - 返回 OpenAI 格式响应/流                                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓ (OpenAI 格式响应)
┌─────────────────────────────────────────────────────────────┐
│ Proxy Server (响应转换)                                      │
│                                                              │
│ 4. 检测响应类型 (streaming / non-streaming)                 │
│ 5. 调用 convert_openai_response_to_claude()                 │
│    或 convert_openai_stream_to_claude()                     │
│    - 转换响应结构                                           │
│    - 映射模型名称回 Claude 格式                             │
│    - 转换 SSE 事件格式                                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓ (Claude 格式响应)
┌─────────────────────────────────────────────────────────────┐
│ Claude Code                                                  │
│ - 接收 Claude 格式响应                                      │
│ - 完全无感知 OpenAI 的存在                                  │
└─────────────────────────────────────────────────────────────┘
```

### 关键组件

| 组件 | 位置 | 职责 |
|------|------|------|
| **协议转换器** | `src-tauri/src/converters/openai_claude.rs` | 请求/响应格式转换 |
| **模型映射器** | `src-tauri/src/converters/model_mapper.rs` | 模型名称双向映射 |
| **协议检测器** | `src-tauri/src/proxy/protocol_detector.rs` | 自动识别请求格式 |
| **路由器集成** | `src-tauri/src/proxy/router.rs` | 在代理层集成转换逻辑 |

---

## 配置方法

### 1. 在配置管理中添加 OpenAI 服务商

**UI 操作**:
1. 打开 Claude Code Proxy 应用
2. 进入 "配置管理" 页面
3. 点击 "添加配置"
4. 填写以下信息：

| 字段 | 值 | 说明 |
|------|---|------|
| **名称** | OpenAI GPT-4 | 自定义名称 |
| **服务商类型** | `OpenAI` | **必须选择 OpenAI** |
| **服务器 URL** | `https://api.openai.com` | OpenAI 官方 API 地址 |
| **API Key** | `sk-xxxxx` | 你的 OpenAI API 密钥 |
| **模型** | `gpt-4` 或 `gpt-3.5-turbo` | OpenAI 模型名称 |
| **最大令牌数** | `4096` | 根据模型调整 |

### 2. 数据库配置示例

如果直接操作数据库（高级用户）：

```sql
INSERT INTO api_configs (
    name,
    server_url,
    api_key,
    model,
    max_tokens,
    provider_type,  -- ← 关键字段
    is_enabled,
    group_id
) VALUES (
    'OpenAI GPT-4',
    'https://api.openai.com',
    'sk-your-openai-api-key',
    'gpt-4',
    4096,
    'OpenAI',  -- ← 必须设置为 'OpenAI'
    1,
    1
);
```

### 3. 配置文件示例 (config/providers.json)

```json
{
  "name": "OpenAI",
  "providers": [
    {
      "name": "OpenAI GPT-4",
      "server_url": "https://api.openai.com",
      "provider_type": "OpenAI",
      "model": "gpt-4",
      "max_tokens": 4096,
      "description": "OpenAI 官方 GPT-4 模型"
    },
    {
      "name": "OpenAI GPT-3.5 Turbo",
      "server_url": "https://api.openai.com",
      "provider_type": "OpenAI",
      "model": "gpt-3.5-turbo",
      "max_tokens": 4096,
      "description": "更快速、更经济的选择"
    }
  ]
}
```

### 4. 切换到 OpenAI 服务商

**方法 1: Dashboard 全局切换**
- 在 Dashboard 页面选择 OpenAI 配置作为默认服务商

**方法 2: Terminal 标签页切换**
- 在 Terminal Workspace 的标签页上点击服务商切换按钮
- 选择 OpenAI 配置
- **完全静默切换，无终端干扰**

---

## 模型映射

### 模型映射表 (src-tauri/src/converters/model_mapper.rs)

代理会自动在 Claude 和 OpenAI 模型名称之间进行映射：

#### Claude → OpenAI

| Claude 模型名 | OpenAI 模型名 | 说明 |
|--------------|--------------|------|
| `claude-3-5-sonnet-20241022` | `gpt-4` | 性能对标 |
| `claude-3-5-sonnet-20240620` | `gpt-4` | 性能对标 |
| `claude-3-opus-20240229` | `gpt-4` | 最强模型 |
| `claude-3-sonnet-20240229` | `gpt-4` | 平衡性能 |
| `claude-3-haiku-20240307` | `gpt-3.5-turbo` | 快速模型 |
| `claude-sonnet-4-5-20250929` | `gpt-4` | 最新版本 |

#### OpenAI → Claude

| OpenAI 模型名 | Claude 模型名 | 说明 |
|--------------|--------------|------|
| `gpt-4` | `claude-3-5-sonnet-20241022` | 默认映射 |
| `gpt-4-turbo` | `claude-3-5-sonnet-20241022` | 高性能 |
| `gpt-3.5-turbo` | `claude-3-haiku-20240307` | 快速模型 |

### 自定义模型映射

如需自定义映射规则，修改 `src-tauri/src/converters/model_mapper.rs`:

```rust
impl Default for ModelMapper {
    fn default() -> Self {
        let mut claude_to_openai = HashMap::new();
        let mut openai_to_claude = HashMap::new();

        // 添加你的自定义映射
        claude_to_openai.insert(
            "claude-custom-model".to_string(),
            "gpt-4-custom".to_string()
        );
        openai_to_claude.insert(
            "gpt-4-custom".to_string(),
            "claude-custom-model".to_string()
        );

        // ...
    }
}
```

---

## 请求转换示例

### Claude Messages API 请求

**Claude Code 发送的原始请求** (`POST /v1/messages`):

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 1.0,
  "stream": true
}
```

### 自动转换为 OpenAI Chat Completions 请求

**代理转换后发送到 OpenAI** (`POST /v1/chat/completions`):

```json
{
  "model": "gpt-4",
  "max_completion_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 1.0,
  "stream": true
}
```

### 关键转换点

| Claude 字段 | OpenAI 字段 | 转换逻辑 |
|------------|------------|---------|
| `model` | `model` | 通过 `ModelMapper` 映射 |
| `max_tokens` | `max_completion_tokens` | 直接重命名 |
| `messages` | `messages` | 结构相同，直接复制 |
| `temperature` | `temperature` | 值相同，直接复制 |
| `stream` | `stream` | 值相同，直接复制 |
| `system` (顶层) | `messages[0]` (role=system) | Claude 系统提示词转为 OpenAI 格式 |

---

## 流式响应转换

### OpenAI SSE 事件格式

**OpenAI 流式响应示例**:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}

data: [DONE]
```

### 自动转换为 Claude SSE 格式

**代理转换后返回给 Claude Code**:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg-chatcmpl-123","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022","usage":{"input_tokens":0,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}

event: message_stop
data: {"type":"message_stop"}
```

### 流式转换关键代码

**位置**: `src-tauri/src/proxy/router.rs:1016-1111`

```rust
if is_streaming {
    log::info!("Converting OpenAI streaming response to Claude SSE format");

    let claude_model = "claude-sonnet-4-5-20250929".to_string();
    let body = response.into_body();

    // 创建一个将 OpenAI SSE 转换为 Claude SSE 事件的流
    let converted_stream = Self::convert_openai_stream(body, claude_model);

    // 构建流式响应
    let stream_body = StreamBody::new(converted_stream);
    let mut response = Response::new(boxed(stream_body));

    // 设置 Claude SSE 响应头
    response.headers_mut().insert(
        hyper::header::CONTENT_TYPE,
        HeaderValue::from_static("text/event-stream"),
    );
    // ...
}
```

---

## 测试验证

### 1. 配置验证

**检查配置是否正确**:

```bash
# 查询数据库
sqlite3 ~/.claude-code-proxy/claude-code-proxy.db

SELECT id, name, provider_type, model, server_url
FROM api_configs
WHERE provider_type = 'OpenAI';
```

**预期输出**:
```
1|OpenAI GPT-4|OpenAI|gpt-4|https://api.openai.com
```

### 2. 代理日志验证

**启动应用并查看日志**:

```bash
cargo tauri dev

# 或查看日志文件
tail -f ~/.claude-code-proxy/logs/proxy.log
```

**切换到 OpenAI 配置后，发送请求，查看日志**:

```
[INFO] Using session config: session=abc123, config_id=5
[INFO] Provider type: OpenAI
[INFO] Converting Claude request to OpenAI format
[INFO] Updated request URI to OpenAI endpoint: /v1/chat/completions
[INFO] Forwarding request to: https://api.openai.com/v1/chat/completions
[INFO] Converting OpenAI streaming response to Claude SSE format
```

### 3. 请求抓包验证

**使用 Charles/Fiddler 抓包查看实际请求**:

1. 配置系统代理到抓包工具
2. 在 Claude Code 中发送请求
3. 查看代理转发的请求格式：
   - **Request URL**: `https://api.openai.com/v1/chat/completions` ✅
   - **Request Body**: OpenAI Chat Completions 格式 ✅
   - **Response**: OpenAI 格式 ✅

### 4. Claude Code 功能测试

**在 Claude Code 中测试各种功能**:

- [x] 普通对话
- [x] 代码生成
- [x] 流式响应
- [x] 长对话 (多轮)
- [x] 系统提示词
- [x] 温度参数调整
- [x] Token 限制

**预期**: 所有功能正常，Claude Code 完全感知不到使用的是 OpenAI 模型

---

## 故障排查

### 问题 1: 请求失败，返回 400 Bad Request

**可能原因**:
- OpenAI API Key 无效
- 模型名称错误
- 请求格式转换失败

**排查步骤**:
1. 检查 API Key 是否正确配置
2. 查看代理日志中的错误信息
3. 验证 `provider_type` 字段是否设置为 `OpenAI`

**解决方法**:
```bash
# 检查配置
sqlite3 ~/.claude-code-proxy/claude-code-proxy.db
SELECT name, provider_type, api_key FROM api_configs WHERE id = 5;

# 测试 API Key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

### 问题 2: 流式响应中断

**可能原因**:
- SSE 事件格式转换错误
- 网络连接中断
- OpenAI API 限流

**排查步骤**:
1. 查看代理日志中的流处理信息
2. 检查网络连接稳定性
3. 查看 OpenAI 账户使用量

**解决方法**:
```rust
// 检查流转换代码 (src-tauri/src/proxy/router.rs)
let converted_stream = Self::convert_openai_stream(body, claude_model);
```

### 问题 3: 模型名称映射错误

**可能原因**:
- 使用了不支持的 Claude 模型名称
- 模型映射表缺失对应关系

**排查步骤**:
1. 查看 `src-tauri/src/converters/model_mapper.rs`
2. 检查请求的模型名称是否在映射表中

**解决方法**:
```rust
// 添加自定义模型映射
claude_to_openai.insert(
    "claude-new-model".to_string(),
    "gpt-4".to_string()
);
```

### 问题 4: 响应格式不兼容

**可能原因**:
- OpenAI 响应结构变更
- 转换逻辑缺失字段处理

**排查步骤**:
1. 抓包查看 OpenAI 原始响应
2. 检查转换函数 `convert_openai_response_to_claude()`
3. 查看 Claude Code 报错信息

**解决方法**:
```rust
// 更新转换逻辑以适配新字段
// 文件: src-tauri/src/converters/openai_claude.rs
pub fn convert_openai_response_to_claude(
    openai_resp: &OpenAIResponse,
    claude_model: &str
) -> ClaudeResponse {
    // 添加对新字段的处理
}
```

### 问题 5: 切换服务商后路由未生效

**可能原因**:
- SESSION_CONFIG_MAP 未更新
- session_id 不匹配

**排查步骤**:
1. 查看切换操作的日志
2. 检查 `SESSION_CONFIG_MAP.switch()` 是否成功
3. 验证下一个请求是否使用新的 config_id

**解决方法**:
```bash
# 查看日志
tail -f ~/.claude-code-proxy/logs/proxy.log | grep "Session config switched"

# 预期输出
[INFO] Session config switched: abc123 from 3 to 5
[INFO] Using session config: session=abc123, config_id=5
```

---

## 性能优化建议

### 1. 批量请求优化

- 使用连接池复用 HTTP 连接
- 启用 HTTP/2 多路复用

### 2. 缓存策略

- 缓存模型映射结果
- 缓存协议检测结果

### 3. 流式响应优化

- 使用 Tokio 异步流处理
- 避免不必要的缓冲

---

## 相关文件

| 文件 | 职责 | 行号参考 |
|------|------|---------|
| `src-tauri/src/converters/openai_claude.rs` | 请求/响应转换 | 全文 |
| `src-tauri/src/converters/model_mapper.rs` | 模型名称映射 | 全文 |
| `src-tauri/src/proxy/router.rs` | 路由集成 | 659-687, 1016-1111 |
| `src-tauri/src/converters/protocol_detector.rs` | 协议检测 | 全文 |

---

## 总结

### ✅ 已实现的能力

1. **完全透明的格式转换**: Claude Code 无需任何修改即可调用 OpenAI 模型
2. **双向协议支持**: Claude ↔ OpenAI 双向转换
3. **流式响应处理**: 实时 SSE 事件格式转换
4. **智能模型映射**: 自动在 Claude 和 OpenAI 模型名称间切换
5. **零配置使用**: 只需设置 `provider_type: OpenAI` 即可

### 🎯 使用要点

1. **关键配置**: `provider_type` 字段必须设置为 `OpenAI`
2. **自动转换**: 代理会自动处理所有格式转换，无需客户端修改
3. **静默切换**: 在 Terminal 标签页切换服务商时完全静默，无终端干扰
4. **模型对标**: Claude 和 OpenAI 模型会自动映射到对应性能的模型

### 📚 扩展阅读

- [终端服务商真正静默切换](./truly-silent-provider-switch.md)
- [代理服务器路由机制](../src-tauri/CLAUDE.md#proxy)
- [格式转换器架构](../src-tauri/CLAUDE.md#converters)

---

**最后更新**: 2025-12-13
**版本**: 1.0.0
**状态**: ✅ 生产就绪
