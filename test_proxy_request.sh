#!/bin/bash

# 测试代理请求
echo "测试代理请求转发..."

# 假设代理运行在 127.0.0.1:25341
curl -v http://127.0.0.1:25341/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
