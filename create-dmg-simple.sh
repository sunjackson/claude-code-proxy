#!/bin/bash

# ===========================================
# ClaudeCodeProxy DMG 打包脚本(优化版)
# ===========================================
# 用途:创建带有"应用程序"文件夹链接的 DMG 安装镜像
# 使用方法:./create-dmg-simple.sh [选项]
#
# 选项:
#   -v, --version VERSION    指定版本号(默认从 tauri.conf.json 读取)
#   -o, --output DIR        指定输出目录(默认: dist)
#   -f, --force             强制覆盖已存在的 DMG
#   -s, --skip-build        跳过构建,直接打包
#   -b, --build             构建后再打包
#   -h, --help              显示帮助信息

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 默认配置变量
APP_NAME="ClaudeCodeProxy"
VERSION=""
OUTPUT_DIR="dist"
FORCE_BUILD=false
SKIP_BUILD=false
RUN_BUILD=false
APP_PATH="src-tauri/target/release/bundle/macos/${APP_NAME}.app"

# 函数:显示帮助信息
show_help() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}   ClaudeCodeProxy DMG 打包工具${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -v, --version VERSION    指定版本号(默认从 tauri.conf.json 读取)"
    echo "  -o, --output DIR        指定输出目录(默认: dist)"
    echo "  -f, --force             强制覆盖已存在的 DMG"
    echo "  -s, --skip-build        跳过构建,直接打包"
    echo "  -b, --build             先构建应用再打包"
    echo "  -h, --help              显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                       # 使用默认设置"
    echo "  $0 -v 1.2.0             # 指定版本号"
    echo "  $0 -s                   # 跳过构建"
    echo "  $0 -b                   # 先构建再打包"
    echo "  $0 -f -v 2.0.0          # 强制覆盖并指定版本"
    echo ""
    exit 0
}

# 函数:从 tauri.conf.json 读取版本号
get_version_from_config() {
    local config_file="src-tauri/tauri.conf.json"
    if [ -f "$config_file" ]; then
        # 尝试使用 jq
        if command -v jq &> /dev/null; then
            VERSION=$(jq -r '.version // .package.version // empty' "$config_file" 2>/dev/null)
        else
            # 使用 grep 和 sed 作为备选方案
            VERSION=$(grep -m1 '"version"' "$config_file" | sed 's/.*"version"[^"]*"\([^"]*\)".*/\1/')
        fi
    fi

    # 如果仍未获取到版本号,使用默认值
    if [ -z "$VERSION" ]; then
        VERSION="1.0.0"
        echo -e "${YELLOW}⚠ 警告: 无法从配置文件读取版本号,使用默认版本: $VERSION${NC}"
    fi
}

# 函数:检查依赖
check_dependencies() {
    echo -e "${CYAN}→${NC} 检查系统依赖..."
    local missing_deps=()

    # 检查 hdiutil
    if ! command -v hdiutil &> /dev/null; then
        missing_deps+=("hdiutil (macOS 系统工具)")
    fi

    # 检查 md5
    if ! command -v md5 &> /dev/null; then
        missing_deps+=("md5 (macOS 系统工具)")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}✗ 错误: 缺少必要的依赖工具${NC}"
        for dep in "${missing_deps[@]}"; do
            echo -e "${RED}  - $dep${NC}"
        done
        exit 1
    fi
    echo -e "${GREEN}✓${NC} 系统依赖检查通过"
}

# 函数:清理函数(用于错误处理)
cleanup_on_error() {
    echo ""
    echo -e "${RED}✗ 发生错误,正在清理临时文件...${NC}"
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        echo -e "${GREEN}✓${NC} 临时文件已清理"
    fi
    exit 1
}

# 设置错误处理
trap cleanup_on_error ERR

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_BUILD=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -b|--build)
            RUN_BUILD=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}错误: 未知选项 $1${NC}"
            echo "使用 -h 或 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 如果未指定版本号,从配置文件读取
if [ -z "$VERSION" ]; then
    get_version_from_config
fi

# 更新依赖版本号的变量
DMG_NAME="${APP_NAME}_${VERSION}_macOS_Installer"
TEMP_DIR="${OUTPUT_DIR}/dmg_temp"
FINAL_DMG="${OUTPUT_DIR}/${DMG_NAME}.dmg"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   ClaudeCodeProxy DMG 打包工具${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  应用名称: ${CYAN}$APP_NAME${NC}"
echo -e "  版本号:   ${CYAN}$VERSION${NC}"
echo -e "  输出目录: ${CYAN}$OUTPUT_DIR${NC}"
echo ""

# 检查依赖
check_dependencies

# 如果指定了构建选项,先执行构建
if [ "$RUN_BUILD" = true ]; then
    echo -e "${CYAN}→${NC} 开始构建应用..."
    echo ""

    # 检查是否有 npm
    if command -v npm &> /dev/null; then
        npm run tauri build
        echo ""
        echo -e "${GREEN}✓${NC} 应用构建完成"
    else
        echo -e "${RED}✗ 错误: 找不到 npm 命令${NC}"
        exit 1
    fi
fi

# 检查 .app 文件是否存在
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}✗ 错误: 找不到应用程序文件${NC}"
    echo -e "${RED}  路径: $APP_PATH${NC}"

    if [ "$SKIP_BUILD" = true ]; then
        echo -e "${YELLOW}  提示: 您使用了 -s 选项跳过构建,但应用程序不存在${NC}"
    else
        echo -e "${YELLOW}  请使用以下命令之一:${NC}"
        echo -e "${YELLOW}  1. 先构建: npm run tauri build${NC}"
        echo -e "${YELLOW}  2. 或使用: $0 -b (自动构建并打包)${NC}"
    fi
    exit 1
fi

echo -e "${GREEN}✓${NC} 找到应用程序: ${APP_NAME}.app"

# 检查 DMG 是否已存在
if [ -f "$FINAL_DMG" ] && [ "$FORCE_BUILD" = false ]; then
    echo -e "${YELLOW}⚠ 警告: DMG 文件已存在${NC}"
    echo -e "${YELLOW}  路径: $FINAL_DMG${NC}"
    echo -e "${YELLOW}  使用 -f 选项强制覆盖,或删除现有文件${NC}"
    exit 1
fi

# 清理旧文件
echo -e "${CYAN}→${NC} 清理旧文件..."
rm -rf "$TEMP_DIR"
if [ "$FORCE_BUILD" = true ] && [ -f "$FINAL_DMG" ]; then
    rm -f "$FINAL_DMG"
    echo -e "${YELLOW}  已删除现有 DMG 文件${NC}"
fi

# 创建临时目录
echo -e "${CYAN}→${NC} 创建临时目录..."
mkdir -p "$TEMP_DIR"
mkdir -p "$OUTPUT_DIR"

# 复制应用程序到临时目录
echo -e "${CYAN}→${NC} 复制应用程序..."
cp -R "$APP_PATH" "$TEMP_DIR/"
echo -e "${GREEN}✓${NC} 应用程序已复制到临时目录"

# 创建应用程序文件夹的符号链接
echo -e "${CYAN}→${NC} 创建应用程序文件夹链接..."
ln -s /Applications "$TEMP_DIR/Applications"
echo -e "${GREEN}✓${NC} Applications 链接已创建"

# 创建 DMG
echo -e "${CYAN}→${NC} 创建 DMG 镜像..."
echo -e "  卷标名称: ${CYAN}$APP_NAME${NC}"
echo -e "  输出文件: ${CYAN}$FINAL_DMG${NC}"
echo ""

hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$TEMP_DIR" \
    -ov \
    -format UDZO \
    -imagekey zlib-level=9 \
    "$FINAL_DMG"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} DMG 镜像创建成功"
else
    echo -e "${RED}✗${NC} DMG 镜像创建失败"
    cleanup_on_error
fi

# 清理临时文件
echo -e "${CYAN}→${NC} 清理临时文件..."
rm -rf "$TEMP_DIR"
echo -e "${GREEN}✓${NC} 临时文件已清理"

# 显示结果
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ DMG 创建成功!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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
echo -e "  ${YELLOW}用户安装步骤:${NC}"
echo "  1. 双击 DMG 文件打开安装镜像"
echo "  2. 将 ${APP_NAME} 图标拖拽到 Applications 文件夹图标"
echo "  3. 首次运行时右键点击应用选择「打开」"
echo "     (或在系统设置 > 隐私与安全性中允许)"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   分发说明${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${YELLOW}注意事项:${NC}"
echo "  • 这是未签名的应用,首次运行需要用户确认"
echo "  • 建议在 README 中添加详细的安装说明"
echo "  • 如需提供更好的用户体验,可申请 Apple Developer 账户进行签名"
echo ""

# 测试 DMG
echo -e "${CYAN}→${NC} 验证 DMG 文件..."
if hdiutil attach "$FINAL_DMG" -noverify -nobrowse > /dev/null 2>&1; then
    # 等待一下确保挂载完成
    sleep 1

    # 查找挂载点
    MOUNT_POINT=$(hdiutil info | grep "$APP_NAME" | grep "Volumes" | tail -1 | awk -F'/Volumes/' '{print "/Volumes/"$2}')

    if [ ! -z "$MOUNT_POINT" ]; then
        # 检查内容
        if [ -d "$MOUNT_POINT/${APP_NAME}.app" ] && [ -L "$MOUNT_POINT/Applications" ]; then
            echo -e "${GREEN}✓${NC} DMG 验证通过"
            echo -e "  ${GREEN}•${NC} 应用程序文件: ✓"
            echo -e "  ${GREEN}•${NC} Applications 链接: ✓"
        else
            echo -e "${YELLOW}⚠${NC} DMG 内容可能不完整"
            if [ ! -d "$MOUNT_POINT/${APP_NAME}.app" ]; then
                echo -e "  ${YELLOW}•${NC} 应用程序文件: ✗"
            fi
            if [ ! -L "$MOUNT_POINT/Applications" ]; then
                echo -e "  ${YELLOW}•${NC} Applications 链接: ✗"
            fi
        fi

        # 卸载
        hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠${NC} 无法找到挂载点"
    fi
else
    echo -e "${YELLOW}⚠${NC} 无法自动验证,请手动测试"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ 所有步骤完成!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 显示快速命令提示
echo -e "${CYAN}快速命令提示:${NC}"
echo -e "  打开 Finder 查看: ${YELLOW}open $OUTPUT_DIR${NC}"
echo -e "  测试安装 DMG:    ${YELLOW}open $FINAL_DMG${NC}"
echo ""
