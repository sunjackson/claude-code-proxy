# URL 格式说明

**更新时间：** 2025-11-11

---

## 📋 URL 格式要求

### ✅ 支持的格式

**完整的URL（推荐）：**
```
https://api.anthropic.com
https://api.example.com
http://localhost
http://192.168.1.100
```

**带端口的URL（可选）：**
```
https://api.anthropic.com:443
https://api.example.com:8443
http://localhost:8080
http://192.168.1.100:3000
```

### 🔧 端口处理规则

1. **API配置创建时：**
   - **不会自动推断端口**
   - 用户输入什么URL就保存什么URL
   - 端口信息完全从URL中获取

2. **请求转发时（内部处理）：**
   - 从URL中提取host和port
   - 如果URL包含端口（如`:8443`），使用指定端口
   - 如果URL不包含端口：
     - HTTPS URL 使用 **443** 端口
     - HTTP URL 使用 **80** 端口

3. **示例：**
   - `https://api.example.com` → 请求时连接到 `api.example.com:443`
   - `https://api.example.com:8443` → 请求时连接到 `api.example.com:8443`
   - `https://api.example.com/v1/messages` → 请求时连接到 `api.example.com:443`（路径会保留）

---

## 📖 示例

### API 配置示例

**Anthropic 官方 API：**
```
server_url: https://api.anthropic.com
→ 实际连接: api.anthropic.com:443
```

**自定义端口：**
```
server_url: https://custom-api.com:8443
→ 实际连接: custom-api.com:8443
```

**本地开发：**
```
server_url: http://localhost:8080
→ 实际连接: localhost:8080
```

**内网服务：**
```
server_url: http://192.168.1.100
→ 实际连接: 192.168.1.100:80
```

---

## ⚠️ 注意事项

1. **协议必须指定：**
   - 必须以 `http://` 或 `https://` 开头
   - ❌ 错误：`api.example.com`
   - ✅ 正确：`https://api.example.com`

2. **端口号是可选的：**
   - 标准端口（https=443, http=80）可以省略
   - 非标准端口必须明确指定

3. **路径会被忽略：**
   - URL中的路径部分（如 `/v1/messages`）在解析连接地址时会被忽略
   - 请求时会使用完整的URL路径

---

## 🔍 URL 解析示例

| 输入URL | 协议 | Host | 端口 | 连接地址 |
|--------|------|------|------|---------|
| `https://api.example.com` | HTTPS | api.example.com | 443（默认） | `api.example.com:443` |
| `https://api.example.com:8443` | HTTPS | api.example.com | 8443 | `api.example.com:8443` |
| `http://localhost` | HTTP | localhost | 80（默认） | `localhost:80` |
| `http://localhost:8080` | HTTP | localhost | 8080 | `localhost:8080` |
| `https://api.example.com/v1` | HTTPS | api.example.com | 443（默认） | `api.example.com:443` |

---

**文档版本：** 1.0
**最后更新：** 2025-11-11
