#!/bin/bash

# Claude Code Proxy - 多平台编译脚本
# 支持：macOS、Windows、Linux

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

# 查找cargo命令
find_cargo() {
    if command_exists cargo; then
        echo "cargo"
    elif [ -f "$HOME/.cargo/bin/cargo" ]; then
        echo "$HOME/.cargo/bin/cargo"
    else
        return 1
    fi
}


# 检查依赖
check_dependencies() {
    print_info "检查依赖..."

    if ! command_exists node; then
        print_error "未找到 Node.js，请先安装 Node.js"
        exit 1
    fi

    if ! command_exists npm; then
        print_error "未找到 npm，请先安装 npm"
        exit 1
    fi

    CARGO_CMD=$(find_cargo)
    if [ $? -ne 0 ]; then
        print_error "未找到 Rust/Cargo，请先安装 Rust"
        print_info "访问 https://rustup.rs/ 安装 Rust"
        exit 1
    fi

    print_success "所有依赖已满足"
    print_info "使用 Cargo: $CARGO_CMD"
}

# 安装前端依赖
install_frontend_deps() {
    print_info "安装前端依赖..."
    cd src-ui
    npm install
    cd ..
    print_success "前端依赖安装完成"
}

# 构建前端
build_frontend() {
    print_info "构建前端..."
    cd src-ui
    npm run build
    cd ..
    print_success "前端构建完成"
}

# 构建后端（当前平台）
build_backend_current() {
    print_info "构建后端（当前平台）..."
    cd src-tauri
    $CARGO_CMD build --release
    cd ..
    print_success "后端构建完成"
}

# 构建指定平台
build_for_platform() {
    local platform=$1

    case $platform in
        macos|mac|darwin)
            print_info "构建 macOS 版本..."
            cd src-tauri
            $CARGO_CMD build --release --target x86_64-apple-darwin
            $CARGO_CMD build --release --target aarch64-apple-darwin
            cd ..
            print_success "macOS 版本构建完成"
            ;;
        windows|win)
            print_info "构建 Windows 版本..."
            if ! command_exists x86_64-pc-windows-gnu-gcc; then
                print_warning "未安装 Windows 交叉编译工具链，尝试使用 Tauri CLI..."
            fi
            cd src-tauri
            $CARGO_CMD build --release --target x86_64-pc-windows-gnu 2>/dev/null || \
            $CARGO_CMD build --release --target x86_64-pc-windows-msvc 2>/dev/null || \
            print_error "Windows 编译失败，请在 Windows 系统上构建"
            cd ..
            ;;
        linux)
            print_info "构建 Linux 版本..."
            cd src-tauri
            $CARGO_CMD build --release --target x86_64-unknown-linux-gnu 2>/dev/null || \
            print_error "Linux 编译失败，请在 Linux 系统上构建或安装交叉编译工具链"
            cd ..
            ;;
        all)
            print_info "构建所有平台版本..."
            build_for_platform macos
            build_for_platform windows
            build_for_platform linux
            ;;
        *)
            print_error "不支持的平台: $platform"
            print_info "支持的平台: macos, windows, linux, all"
            exit 1
            ;;
    esac
}

# 使用 Tauri CLI 构建（推荐）
build_with_tauri_cli() {
    print_info "使用 Tauri CLI 构建安装包..."

    # 使用 cargo tauri build 构建（会自动构建前端+后端+打包）
    cd src-tauri
    $CARGO_CMD tauri build
    cd ..

    print_success "Tauri 构建完成"
    print_info "安装包位于: src-tauri/target/release/bundle/"

    # 显示生成的安装包
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_info "macOS 安装包:"
        ls -lh src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null || true
        print_info "macOS 应用包:"
        ls -d src-tauri/target/release/bundle/macos/*.app 2>/dev/null || true
    elif [[ "$OSTYPE" == "linux"* ]]; then
        print_info "Linux 安装包:"
        ls -lh src-tauri/target/release/bundle/deb/*.deb 2>/dev/null || true
        ls -lh src-tauri/target/release/bundle/rpm/*.rpm 2>/dev/null || true
        ls -lh src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null || true
    fi
}

# 清理构建产物
clean_build() {
    print_info "清理构建产物..."
    rm -rf src-tauri/target
    rm -rf src-ui/dist
    print_success "清理完成"
}

# 显示帮助信息
show_help() {
    cat << EOF
Claude Code Proxy - 多平台编译脚本

用法: ./build.sh [选项]

选项:
    --help, -h              显示此帮助信息
    --clean                 清理构建产物
    --deps                  只安装依赖
    --platform <平台>       构建指定平台 (macos, windows, linux, all)
    --current               只编译可执行文件（不打包）

示例:
    ./build.sh                      # 使用 Tauri CLI 构建安装包（默认，推荐）
    ./build.sh --current            # 只编译可执行文件（不打包）
    ./build.sh --platform macos     # 交叉编译 macOS 版本
    ./build.sh --platform all       # 交叉编译所有平台
    ./build.sh --clean              # 清理构建产物

安装包位置:
    macOS:   src-tauri/target/release/bundle/dmg/*.dmg
    Windows: src-tauri/target/release/bundle/msi/*.msi
    Linux:   src-tauri/target/release/bundle/deb/*.deb

重要说明:
    - 打包时不包含数据库文件
    - 用户安装后首次启动时会自动创建新的数据库

EOF
}

# 主函数
main() {
    echo ""
    print_info "======================================"
    print_info "  Claude Code Proxy 编译脚本"
    print_info "======================================"
    echo ""

    # 解析参数
    if [ $# -eq 0 ]; then
        # 默认：使用Tauri CLI构建安装包（推荐）
        check_dependencies
        build_with_tauri_cli
    else
        case $1 in
            --help|-h)
                show_help
                ;;
            --clean)
                clean_build
                ;;
            --deps)
                check_dependencies
                install_frontend_deps
                ;;
            --platform)
                if [ -z "$2" ]; then
                    print_error "请指定平台"
                    exit 1
                fi
                check_dependencies
                install_frontend_deps
                build_frontend
                build_for_platform "$2"
                ;;
            --current)
                check_dependencies
                install_frontend_deps
                build_frontend
                build_backend_current
                print_success "构建完成！"
                print_info "可执行文件位于: src-tauri/target/release/"
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    fi
}

# 运行主函数
main "$@"
