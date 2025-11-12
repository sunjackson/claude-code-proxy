#!/bin/bash
# 测试后端 Tauri 命令是否正常工作

echo "🔍 Claude Code Router 后端诊断测试"
echo "===================================="
echo ""

# 检查数据库
echo "1. 检查数据库文件..."
DB_PATH=~/Library/Application\ Support/com.claude-code-router/database.db
if [ -f "$DB_PATH" ]; then
    echo "✅ 数据库文件存在: $DB_PATH"
    echo "   文件大小: $(ls -lh "$DB_PATH" | awk '{print $5}')"

    echo ""
    echo "2. 检查数据库表..."
    sqlite3 "$DB_PATH" ".tables"

    echo ""
    echo "3. 检查关键数据..."
    echo "   AppSettings:"
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM AppSettings;"

    echo "   ConfigGroup:"
    sqlite3 "$DB_PATH" "SELECT id, name FROM ConfigGroup;"

    echo "   ProxyService:"
    sqlite3 "$DB_PATH" "SELECT id, status, listen_port FROM ProxyService;"

    echo "   ApiConfig:"
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ApiConfig;"
else
    echo "❌ 数据库文件不存在: $DB_PATH"
fi

echo ""
echo "4. 检查 Rust 编译..."
cd /Users/sunjackson/Project/claude-code-router/src-tauri
source ~/.cargo/env 2>/dev/null || true

if command -v cargo &> /dev/null; then
    echo "✅ Cargo 可用: $(cargo --version)"
else
    echo "❌ Cargo 不可用"
fi

echo ""
echo "===================================="
echo "✅ 诊断完成"
echo ""
echo "如果上述检查都正常，请查看应用启动时的终端日志。"
echo "查找包含 ERROR、failed、panic 的行。"
