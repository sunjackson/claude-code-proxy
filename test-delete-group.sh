#!/bin/bash

# 测试分组删除功能

DB_PATH="$HOME/Library/Application Support/com.claude-code-router/database.db"

echo "================================"
echo "测试配置分组删除功能"
echo "================================"
echo ""

echo "步骤 1: 查看删除前的状态"
echo "--- 配置分组列表 ---"
sqlite3 "$DB_PATH" "SELECT id, name FROM ConfigGroup ORDER BY id;"
echo ""
echo "--- 分组 6 的配置 ---"
sqlite3 "$DB_PATH" "SELECT id, name, group_id FROM ApiConfig WHERE group_id = 6;"
echo ""

echo "步骤 2: 测试删除分组 6（应该将配置移到未分组）"
echo "请在应用界面中删除'测试删除分组'（选择将配置移到未分组）"
echo "按回车键继续查看结果..."
read

echo ""
echo "步骤 3: 查看删除后的状态"
echo "--- 配置分组列表 ---"
sqlite3 "$DB_PATH" "SELECT id, name FROM ConfigGroup ORDER BY id;"
echo ""
echo "--- 原分组 6 的配置（应该移到分组 5）---"
sqlite3 "$DB_PATH" "SELECT id, name, group_id FROM ApiConfig WHERE id IN (4, 5);"
echo ""

echo "步骤 4: 测试删除'未分组'（应该失败）"
echo "请在应用界面中尝试删除'未分组'，应该看到错误提示"
echo ""

echo "================================"
echo "测试完成！"
echo "================================"
