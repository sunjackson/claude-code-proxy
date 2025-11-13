#!/bin/bash

# Claude Code Proxy - Logo 替换脚本
# 一键替换项目中所有的 logo 图标

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."

    if ! command_exists sips; then
        print_error "未找到 sips 工具（macOS 内置），请在 macOS 系统上运行此脚本"
        exit 1
    fi

    if ! command_exists iconutil; then
        print_warning "未找到 iconutil 工具，将跳过 .icns 文件生成"
    fi

    print_success "依赖检查完成"
}

# 验证输入的图片文件
validate_image() {
    local image_path="$1"

    if [ ! -f "$image_path" ]; then
        print_error "图片文件不存在: $image_path"
        exit 1
    fi

    # 检查文件格式
    local file_type=$(file -b --mime-type "$image_path")
    if [[ ! "$file_type" =~ ^image/ ]]; then
        print_error "文件不是有效的图片格式: $file_type"
        exit 1
    fi

    print_success "图片文件验证通过: $image_path"
}

# 使用 sips 调整图片大小
resize_image() {
    local input="$1"
    local output="$2"
    local width="$3"
    local height="${4:-$width}"  # 如果没有指定高度，使用宽度（正方形）

    # 创建输出目录
    mkdir -p "$(dirname "$output")"

    # 使用 sips 调整大小
    sips -z "$height" "$width" "$input" --out "$output" >/dev/null 2>&1

    if [ $? -eq 0 ]; then
        print_success "生成: $output (${width}x${height})"
    else
        print_error "生成失败: $output"
        return 1
    fi
}

# 备份现有图标
backup_icons() {
    local backup_dir="src-tauri/icons/backup_$(date +%Y%m%d_%H%M%S)"

    print_info "备份现有图标到: $backup_dir"
    mkdir -p "$backup_dir"

    # 备份根目录的图标
    cp -r src-tauri/icons/*.png "$backup_dir/" 2>/dev/null || true
    cp -r src-tauri/icons/*.icns "$backup_dir/" 2>/dev/null || true
    cp -r src-tauri/icons/*.ico "$backup_dir/" 2>/dev/null || true

    # 备份子目录
    cp -r src-tauri/icons/ios "$backup_dir/" 2>/dev/null || true
    cp -r src-tauri/icons/android "$backup_dir/" 2>/dev/null || true

    print_success "备份完成"
}

# 生成所有 PNG 图标
generate_png_icons() {
    local source_image="$1"
    local icons_dir="src-tauri/icons"

    print_info "开始生成 PNG 图标..."

    # macOS/Windows 图标尺寸
    resize_image "$source_image" "$icons_dir/32x32.png" 32
    resize_image "$source_image" "$icons_dir/64x64.png" 64
    resize_image "$source_image" "$icons_dir/128x128.png" 128
    resize_image "$source_image" "$icons_dir/128x128@2x.png" 256
    resize_image "$source_image" "$icons_dir/icon.png" 512

    # Windows Store 图标
    resize_image "$source_image" "$icons_dir/Square30x30Logo.png" 30
    resize_image "$source_image" "$icons_dir/Square44x44Logo.png" 44
    resize_image "$source_image" "$icons_dir/Square71x71Logo.png" 71
    resize_image "$source_image" "$icons_dir/Square89x89Logo.png" 89
    resize_image "$source_image" "$icons_dir/Square107x107Logo.png" 107
    resize_image "$source_image" "$icons_dir/Square142x142Logo.png" 142
    resize_image "$source_image" "$icons_dir/Square150x150Logo.png" 150
    resize_image "$source_image" "$icons_dir/Square284x284Logo.png" 284
    resize_image "$source_image" "$icons_dir/Square310x310Logo.png" 310
    resize_image "$source_image" "$icons_dir/StoreLogo.png" 50

    print_success "PNG 图标生成完成"
}

# 生成 iOS 图标
generate_ios_icons() {
    local source_image="$1"
    local ios_dir="src-tauri/icons/ios"

    print_info "开始生成 iOS 图标..."

    # iOS 需要的所有尺寸
    resize_image "$source_image" "$ios_dir/AppIcon-20x20@1x.png" 20
    resize_image "$source_image" "$ios_dir/AppIcon-20x20@2x.png" 40
    resize_image "$source_image" "$ios_dir/AppIcon-20x20@2x-1.png" 40
    resize_image "$source_image" "$ios_dir/AppIcon-20x20@3x.png" 60

    resize_image "$source_image" "$ios_dir/AppIcon-29x29@1x.png" 29
    resize_image "$source_image" "$ios_dir/AppIcon-29x29@2x.png" 58
    resize_image "$source_image" "$ios_dir/AppIcon-29x29@2x-1.png" 58
    resize_image "$source_image" "$ios_dir/AppIcon-29x29@3x.png" 87

    resize_image "$source_image" "$ios_dir/AppIcon-40x40@1x.png" 40
    resize_image "$source_image" "$ios_dir/AppIcon-40x40@2x.png" 80
    resize_image "$source_image" "$ios_dir/AppIcon-40x40@2x-1.png" 80
    resize_image "$source_image" "$ios_dir/AppIcon-40x40@3x.png" 120

    resize_image "$source_image" "$ios_dir/AppIcon-60x60@2x.png" 120
    resize_image "$source_image" "$ios_dir/AppIcon-60x60@3x.png" 180

    resize_image "$source_image" "$ios_dir/AppIcon-76x76@1x.png" 76
    resize_image "$source_image" "$ios_dir/AppIcon-76x76@2x.png" 152

    resize_image "$source_image" "$ios_dir/AppIcon-83.5x83.5@2x.png" 167

    resize_image "$source_image" "$ios_dir/AppIcon-1024x1024@1x.png" 1024

    print_success "iOS 图标生成完成"
}

# 生成 Android 图标
generate_android_icons() {
    local source_image="$1"
    local android_dir="src-tauri/icons/android"

    print_info "开始生成 Android 图标..."

    # mdpi (baseline)
    resize_image "$source_image" "$android_dir/mipmap-mdpi/ic_launcher.png" 48
    resize_image "$source_image" "$android_dir/mipmap-mdpi/ic_launcher_round.png" 48

    # hdpi
    resize_image "$source_image" "$android_dir/mipmap-hdpi/ic_launcher.png" 72
    resize_image "$source_image" "$android_dir/mipmap-hdpi/ic_launcher_round.png" 72

    # xhdpi
    resize_image "$source_image" "$android_dir/mipmap-xhdpi/ic_launcher.png" 96
    resize_image "$source_image" "$android_dir/mipmap-xhdpi/ic_launcher_round.png" 96

    # xxhdpi
    resize_image "$source_image" "$android_dir/mipmap-xxhdpi/ic_launcher.png" 144
    resize_image "$source_image" "$android_dir/mipmap-xxhdpi/ic_launcher_round.png" 144

    # xxxhdpi
    resize_image "$source_image" "$android_dir/mipmap-xxxhdpi/ic_launcher.png" 192
    resize_image "$source_image" "$android_dir/mipmap-xxxhdpi/ic_launcher_round.png" 192

    print_success "Android 图标生成完成"
}

# 生成 macOS .icns 文件
generate_icns() {
    local source_image="$1"
    local icons_dir="src-tauri/icons"

    if ! command_exists iconutil; then
        print_warning "跳过 .icns 文件生成（需要 iconutil 工具）"
        return
    fi

    print_info "开始生成 macOS .icns 文件..."

    # 创建临时目录
    local iconset_dir="$icons_dir/icon.iconset"
    mkdir -p "$iconset_dir"

    # 生成 iconset 需要的所有尺寸
    resize_image "$source_image" "$iconset_dir/icon_16x16.png" 16
    resize_image "$source_image" "$iconset_dir/icon_16x16@2x.png" 32
    resize_image "$source_image" "$iconset_dir/icon_32x32.png" 32
    resize_image "$source_image" "$iconset_dir/icon_32x32@2x.png" 64
    resize_image "$source_image" "$iconset_dir/icon_128x128.png" 128
    resize_image "$source_image" "$iconset_dir/icon_128x128@2x.png" 256
    resize_image "$source_image" "$iconset_dir/icon_256x256.png" 256
    resize_image "$source_image" "$iconset_dir/icon_256x256@2x.png" 512
    resize_image "$source_image" "$iconset_dir/icon_512x512.png" 512
    resize_image "$source_image" "$iconset_dir/icon_512x512@2x.png" 1024

    # 使用 iconutil 生成 .icns
    iconutil -c icns "$iconset_dir" -o "$icons_dir/icon.icns"

    # 清理临时目录
    rm -rf "$iconset_dir"

    print_success "macOS .icns 文件生成完成"
}

# 生成 Windows .ico 文件
generate_ico() {
    local source_image="$1"
    local icons_dir="src-tauri/icons"

    print_info "开始生成 Windows .ico 文件..."

    # 检查是否安装了 ImageMagick
    if command_exists magick; then
        # 使用 ImageMagick 生成 .ico
        magick "$source_image" -define icon:auto-resize=256,128,64,48,32,16 "$icons_dir/icon.ico"
        print_success "Windows .ico 文件生成完成（使用 ImageMagick）"
    elif command_exists convert; then
        # 使用旧版 ImageMagick
        convert "$source_image" -define icon:auto-resize=256,128,64,48,32,16 "$icons_dir/icon.ico"
        print_success "Windows .ico 文件生成完成（使用 ImageMagick）"
    else
        # 使用 sips 生成多个尺寸的 PNG，然后手动组合
        local temp_dir="$icons_dir/temp_ico"
        mkdir -p "$temp_dir"

        resize_image "$source_image" "$temp_dir/16.png" 16
        resize_image "$source_image" "$temp_dir/32.png" 32
        resize_image "$source_image" "$temp_dir/48.png" 48
        resize_image "$source_image" "$temp_dir/64.png" 64
        resize_image "$source_image" "$temp_dir/128.png" 128
        resize_image "$source_image" "$temp_dir/256.png" 256

        # 简单方案：只使用32x32作为.ico
        cp "$temp_dir/32.png" "$icons_dir/icon.ico"

        rm -rf "$temp_dir"

        print_warning "Windows .ico 文件生成完成（简化版，建议安装 ImageMagick 以获得完整支持）"
        print_info "安装 ImageMagick: brew install imagemagick"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
Claude Code Proxy - Logo 替换脚本

用法: ./replace-logo.sh <logo图片路径>

参数:
    logo图片路径    要替换的新 logo 图片文件路径（支持 PNG、JPG 等格式）

示例:
    ./replace-logo.sh /path/to/new-logo.png
    ./replace-logo.sh ~/Downloads/my-logo.jpg

说明:
    - 脚本会自动备份现有图标到 src-tauri/icons/backup_* 目录
    - 自动生成所有平台需要的图标尺寸：
      * macOS (.icns)
      * Windows (.ico, 需要 ImageMagick)
      * iOS (各种 @1x, @2x, @3x)
      * Android (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
    - 建议使用高分辨率的正方形图片（至少 1024x1024）

依赖:
    - sips (macOS 内置)
    - iconutil (macOS 内置，用于生成 .icns)
    - ImageMagick (可选，用于生成 .ico): brew install imagemagick

EOF
}

# 主函数
main() {
    echo ""
    print_info "======================================"
    print_info "  Claude Code Proxy Logo 替换脚本"
    print_info "======================================"
    echo ""

    # 检查参数
    if [ $# -eq 0 ]; then
        print_error "请提供 logo 图片路径"
        echo ""
        show_help
        exit 1
    fi

    if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
        show_help
        exit 0
    fi

    local source_image="$1"

    # 转换为绝对路径
    if [[ "$source_image" != /* ]]; then
        source_image="$(pwd)/$source_image"
    fi

    # 检查依赖
    check_dependencies

    # 验证输入图片
    validate_image "$source_image"

    # 询问用户确认
    echo ""
    print_warning "此操作将替换项目中的所有图标文件"
    read -p "是否继续？(y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "操作已取消"
        exit 0
    fi

    # 备份现有图标
    backup_icons

    # 生成各平台图标
    generate_png_icons "$source_image"
    generate_ios_icons "$source_image"
    generate_android_icons "$source_image"
    generate_icns "$source_image"
    generate_ico "$source_image"

    echo ""
    print_success "======================================"
    print_success "  所有图标已成功替换！"
    print_success "======================================"
    echo ""
    print_info "下一步："
    print_info "1. 检查生成的图标是否符合预期"
    print_info "2. 运行 ./build.sh 重新构建应用"
    print_info "3. 如有问题，可从备份目录恢复: src-tauri/icons/backup_*"
    echo ""
}

# 运行主函数
main "$@"
