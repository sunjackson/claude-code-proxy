#!/bin/bash

# ===========================================
# ClaudeCodeProxy DMG 打包脚本（简化版）
# ===========================================
# 用途：创建带有"应用程序"文件夹链接的 DMG 安装镜像
# 使用方法：./create-dmg-simple.sh

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="ClaudeCodeProxy"
VERSION="1.0.0"
APP_PATH="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
OUTPUT_DIR="dist"
DMG_NAME="${APP_NAME}_${VERSION}_macOS_Installer"
TEMP_DIR="${OUTPUT_DIR}/dmg_temp"
FINAL_DMG="${OUTPUT_DIR}/${DMG_NAME}.dmg"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   ClaudeCodeProxy DMG 打包工具${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查 .app 文件是否存在
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}✗ 错误: 找不到应用程序文件${NC}"
    echo -e "${RED}  路径: $APP_PATH${NC}"
    echo -e "${YELLOW}  请先运行构建命令: npm run tauri build${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} 找到应用程序: ${APP_NAME}.app"

# 清理旧文件
echo -e "${YELLOW}→${NC} 清理旧文件..."
rm -rf "$TEMP_DIR"
rm -f "$FINAL_DMG"

# 创建临时目录
echo -e "${YELLOW}→${NC} 创建临时目录..."
mkdir -p "$TEMP_DIR"
mkdir -p "$OUTPUT_DIR"

# 复制应用程序到临时目录
echo -e "${YELLOW}→${NC} 复制应用程序..."
cp -R "$APP_PATH" "$TEMP_DIR/"

# 创建应用程序文件夹的符号链接
echo -e "${YELLOW}→${NC} 创建应用程序文件夹链接..."
ln -s /Applications "$TEMP_DIR/Applications"

# 创建 DMG
echo -e "${YELLOW}→${NC} 创建 DMG 镜像..."
echo "  卷标名称: $APP_NAME"
echo "  输出文件: $FINAL_DMG"
echo ""

hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$TEMP_DIR" \
    -ov \
    -format UDZO \
    -imagekey zlib-level=9 \
    "$FINAL_DMG"

# 清理临时文件
echo -e "${YELLOW}→${NC} 清理临时文件..."
rm -rf "$TEMP_DIR"

# 显示结果
echo ""
echo -e "${GREEN}✓ DMG 创建成功！${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   打包信息${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 获取文件信息
FILE_SIZE=$(du -h "$FINAL_DMG" | cut -f1)
FILE_MD5=$(md5 -q "$FINAL_DMG")

echo ""
echo -e "  文件名:   ${GREEN}$DMG_NAME.dmg${NC}"
echo -e "  大小:     ${GREEN}$FILE_SIZE${NC}"
echo -e "  MD5:      ${GREEN}$FILE_MD5${NC}"
echo -e "  路径:     ${GREEN}$FINAL_DMG${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   安装说明${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  ${YELLOW}用户安装步骤：${NC}"
echo "  1. 双击 DMG 文件打开安装镜像"
echo "  2. 将 ${APP_NAME} 图标拖拽到 Applications 文件夹图标"
echo "  3. 首次运行时右键点击应用选择「打开」"
echo "     (或在系统设置 > 隐私与安全性中允许)"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   分发说明${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  ${YELLOW}注意事项：${NC}"
echo "  • 这是未签名的应用，首次运行需要用户确认"
echo "  • 建议在 README 中添加详细的安装说明"
echo "  • 如需提供更好的用户体验，可申请 Apple Developer 账户进行签名"
echo ""

# 测试 DMG
echo -e "${YELLOW}→${NC} 验证 DMG 文件..."
if hdiutil attach "$FINAL_DMG" -noverify -nobrowse > /dev/null 2>&1; then
    # 查找挂载点
    MOUNT_POINT=$(hdiutil info | grep "$APP_NAME" | grep "Volumes" | tail -1 | awk -F'/Volumes/' '{print "/Volumes/"$2}')

    if [ ! -z "$MOUNT_POINT" ]; then
        # 检查内容
        if [ -d "$MOUNT_POINT/${APP_NAME}.app" ] && [ -L "$MOUNT_POINT/Applications" ]; then
            echo -e "${GREEN}✓${NC} DMG 验证通过"
            echo "  - 应用程序文件: ✓"
            echo "  - Applications 链接: ✓"
        else
            echo -e "${YELLOW}⚠${NC} DMG 内容可能不完整"
        fi

        # 卸载
        hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}⚠${NC} 无法自动验证，请手动测试"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ 所有步骤完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
