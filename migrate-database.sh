#!/bin/bash
# 数据库迁移脚本
# 用于更新现有数据库到最新 schema

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Claude Code Router 数据库迁移      ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

# 数据库路径
DB_PATH=~/Library/Application\ Support/com.claude-code-router/database.db

# 检查数据库是否存在
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}✗${NC} 数据库文件不存在: $DB_PATH"
    echo -e "${BLUE}ℹ${NC} 请先启动应用以创建数据库"
    exit 1
fi

echo -e "${GREEN}✓${NC} 找到数据库: $DB_PATH"
echo ""

# 备份数据库
BACKUP_PATH="${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${BLUE}ℹ${NC} 正在备份数据库..."
cp "$DB_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✓${NC} 备份完成: $BACKUP_PATH"
echo ""

# 执行迁移
echo -e "${BLUE}ℹ${NC} 正在执行迁移..."
echo ""

# 迁移 001: 添加模型配置字段
echo "执行迁移 001: 添加模型配置字段..."
if sqlite3 "$DB_PATH" < migrations/001_add_model_config_fields.sql; then
    echo -e "${GREEN}✓${NC} 迁移 001 成功"
else
    echo -e "${RED}✗${NC} 迁移 001 失败"
    echo -e "${YELLOW}⚠${NC} 正在从备份恢复..."
    cp "$BACKUP_PATH" "$DB_PATH"
    echo -e "${GREEN}✓${NC} 已恢复备份"
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} 所有迁移已完成"
echo ""

# 验证表结构
echo -e "${BLUE}ℹ${NC} 验证表结构..."
echo ""
echo "ApiConfig 表字段列表:"
sqlite3 "$DB_PATH" "PRAGMA table_info(ApiConfig);" | while IFS='|' read -r cid name type notnull dflt_value pk; do
    echo "  - $name ($type)"
done

echo ""
echo -e "${GREEN}✓${NC} 数据库迁移完成！"
echo ""
echo -e "${YELLOW}提示:${NC} 备份文件保存在: $BACKUP_PATH"
echo -e "${YELLOW}提示:${NC} 请重启应用以使更改生效"
echo ""
