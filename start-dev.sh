#!/bin/bash
# Claude Code Proxy 开发环境一键启动脚本
# 支持自动检测和安装开发环境

set -e  # 遇到错误时退出

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# 询问用户是否继续
ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"

    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    read -p "$(echo -e "${YELLOW}?${NC} $prompt")" response
    response=${response:-$default}

    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# 检测操作系统
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            OS="macos"
            PACKAGE_MANAGER="brew"
            ;;
        Linux*)
            OS="linux"
            if command -v apt-get &> /dev/null; then
                PACKAGE_MANAGER="apt"
            elif command -v yum &> /dev/null; then
                PACKAGE_MANAGER="yum"
            elif command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
            elif command -v pacman &> /dev/null; then
                PACKAGE_MANAGER="pacman"
            else
                PACKAGE_MANAGER="unknown"
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            PACKAGE_MANAGER="choco"
            ;;
        *)
            OS="unknown"
            PACKAGE_MANAGER="unknown"
            ;;
    esac
}

# 安装 Homebrew (macOS)
install_homebrew() {
    print_info "正在安装 Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # 配置环境变量
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
}

# 安装 Node.js
install_nodejs() {
    print_info "正在安装 Node.js..."

    case $PACKAGE_MANAGER in
        brew)
            brew install node@18
            ;;
        apt)
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        yum|dnf)
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo $PACKAGE_MANAGER install -y nodejs
            ;;
        pacman)
            sudo pacman -S --noconfirm nodejs npm
            ;;
        choco)
            choco install nodejs-lts -y
            ;;
        *)
            print_error "无法自动安装 Node.js，请手动安装: https://nodejs.org/"
            return 1
            ;;
    esac

    print_success "Node.js 安装完成"
}

# 安装 Rust
install_rust() {
    print_info "正在安装 Rust..."

    if [ "$OS" = "windows" ]; then
        print_warning "Windows 系统请手动下载安装: https://rustup.rs/"
        return 1
    else
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        print_success "Rust 安装完成"
    fi
}

# 安装 Go
install_go() {
    print_info "正在安装 Go..."

    case $PACKAGE_MANAGER in
        brew)
            brew install go
            ;;
        apt)
            sudo add-apt-repository ppa:longsleep/golang-backports -y
            sudo apt-get update
            sudo apt-get install -y golang-go
            ;;
        yum|dnf)
            sudo $PACKAGE_MANAGER install -y golang
            ;;
        pacman)
            sudo pacman -S --noconfirm go
            ;;
        choco)
            choco install golang -y
            ;;
        *)
            print_warning "请手动安装 Go: https://golang.org/dl/"
            return 1
            ;;
    esac

    print_success "Go 安装完成"
}

# 安装 pnpm (可选)
install_pnpm() {
    print_info "正在安装 pnpm..."
    npm install -g pnpm
    print_success "pnpm 安装完成"
}

# 检查并安装 Node.js
check_nodejs() {
    if command -v node &> /dev/null; then
        local version=$(node --version)
        print_success "Node.js $version"
        return 0
    else
        print_error "未安装 Node.js"
        if ask_yes_no "是否自动安装 Node.js 18.x?" "y"; then
            install_nodejs
            return $?
        else
            print_info "请手动安装 Node.js: https://nodejs.org/"
            return 1
        fi
    fi
}

# 检查并安装 npm
check_npm() {
    if command -v npm &> /dev/null; then
        local version=$(npm --version)
        print_success "npm $version"
        return 0
    else
        print_error "未安装 npm (通常随 Node.js 一起安装)"
        return 1
    fi
}

# 加载 Cargo 环境变量（如果存在）
load_cargo_env() {
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi
}

# 检查并安装 Rust
check_rust() {
    # 先尝试加载 Cargo 环境变量
    load_cargo_env

    if command -v cargo &> /dev/null && command -v rustc &> /dev/null; then
        local cargo_version=$(cargo --version | cut -d' ' -f2)
        local rustc_version=$(rustc --version | cut -d' ' -f2)
        print_success "Cargo $cargo_version"
        print_success "Rustc $rustc_version"
        return 0
    else
        print_error "未安装 Rust/Cargo"
        if ask_yes_no "是否自动安装 Rust?" "y"; then
            install_rust
            # 安装后重新加载环境变量
            load_cargo_env
            return $?
        else
            print_info "请手动安装 Rust: https://rustup.rs/"
            return 1
        fi
    fi
}

# 检查并安装 Go
check_go() {
    if command -v go &> /dev/null; then
        local version=$(go version | cut -d' ' -f3)
        print_success "Go $version"
        return 0
    else
        print_warning "未安装 Go (可选)"
        if ask_yes_no "是否安装 Go?" "n"; then
            install_go
            return $?
        else
            print_info "跳过 Go 安装"
            return 0
        fi
    fi
}

# 安装 Tauri CLI
install_tauri_cli() {
    print_info "正在安装 Tauri CLI..."
    cargo install tauri-cli
    print_success "Tauri CLI 安装完成"
}

# 检查并安装 Tauri CLI
check_tauri_cli() {
    # 先尝试加载 Cargo 环境变量
    load_cargo_env

    if command -v cargo-tauri &> /dev/null || cargo tauri --version &> /dev/null 2>&1; then
        local version=$(cargo tauri --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
        if [ -z "$version" ]; then
            version="installed"
        fi
        print_success "Tauri CLI $version"
        return 0
    else
        print_error "未安装 Tauri CLI"
        if ask_yes_no "是否自动安装 Tauri CLI?" "y"; then
            install_tauri_cli
            return $?
        else
            print_info "请手动安装 Tauri CLI: cargo install tauri-cli"
            return 1
        fi
    fi
}

# 检查系统依赖 (Linux)
check_linux_deps() {
    if [ "$OS" != "linux" ]; then
        return 0
    fi

    print_info "检查 Linux 系统依赖..."

    local missing_deps=()
    local required_packages=(
        "libwebkit2gtk-4.0-dev"
        "build-essential"
        "libssl-dev"
        "libgtk-3-dev"
        "libsqlite3-dev"
    )

    for pkg in "${required_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $pkg"; then
            missing_deps+=("$pkg")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "缺少系统依赖: ${missing_deps[*]}"
        if ask_yes_no "是否安装缺少的系统依赖?" "y"; then
            case $PACKAGE_MANAGER in
                apt)
                    sudo apt-get update
                    sudo apt-get install -y "${missing_deps[@]}"
                    ;;
                yum|dnf)
                    sudo $PACKAGE_MANAGER install -y webkit2gtk3-devel openssl-devel gtk3-devel sqlite-devel
                    ;;
                pacman)
                    sudo pacman -S --noconfirm webkit2gtk base-devel openssl gtk3 sqlite
                    ;;
                *)
                    print_error "无法自动安装系统依赖，请手动安装"
                    return 1
                    ;;
            esac
            print_success "系统依赖安装完成"
        else
            print_warning "跳过系统依赖安装，可能导致构建失败"
        fi
    else
        print_success "系统依赖已满足"
    fi
}

# 打印标题
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Claude Code Proxy 开发环境启动    ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

# 检测操作系统
detect_os
print_info "操作系统: $OS"
print_info "包管理器: $PACKAGE_MANAGER"
echo ""

# 检查是否在项目根目录或 src-tauri 目录
if [ ! -d "src-tauri" ] && [ ! -d "src-ui" ]; then
    print_error "请在项目根目录运行此脚本"
    exit 1
fi

# 如果在 src-tauri 目录，切换到项目根目录
if [ -d "../src-ui" ] && [ ! -d "src-ui" ]; then
    cd ..
    print_info "已切换到项目根目录: $(pwd)"
fi

# 1. 环境检测
print_header "═══════════════════════════════════════"
print_header "第 1 步: 检查开发环境"
print_header "═══════════════════════════════════════"
echo ""

ENV_OK=true

# 检查 Homebrew (macOS)
if [ "$OS" = "macos" ]; then
    if ! command -v brew &> /dev/null; then
        print_warning "未安装 Homebrew"
        if ask_yes_no "是否安装 Homebrew?" "y"; then
            install_homebrew
        else
            print_info "跳过 Homebrew 安装"
        fi
    else
        print_success "Homebrew $(brew --version | head -n1)"
    fi
    echo ""
fi

# 检查 Node.js
check_nodejs || ENV_OK=false

# 检查 npm
check_npm || ENV_OK=false

# 检查 Rust
check_rust || ENV_OK=false

# 检查 Tauri CLI
check_tauri_cli || ENV_OK=false

# 检查 Go (可选)
check_go

# 检查 Linux 系统依赖
if [ "$OS" = "linux" ]; then
    echo ""
    check_linux_deps || ENV_OK=false
fi

echo ""

if [ "$ENV_OK" = false ]; then
    print_error "环境检查失败，请解决上述问题后重试"
    exit 1
fi

# 2. 安装前端依赖
print_header "═══════════════════════════════════════"
print_header "第 2 步: 检查项目依赖"
print_header "═══════════════════════════════════════"
echo ""

if [ ! -d "src-ui/node_modules" ]; then
    print_warning "未找到 node_modules，正在安装依赖..."
    cd src-ui

    # 询问使用哪个包管理器
    if command -v pnpm &> /dev/null; then
        print_info "检测到 pnpm，使用 pnpm 安装"
        pnpm install
    else
        if ask_yes_no "是否使用 pnpm (更快)?" "n"; then
            install_pnpm
            pnpm install
        else
            npm install
        fi
    fi

    cd ..

    if [ $? -ne 0 ]; then
        print_error "前端依赖安装失败"
        exit 1
    fi
    print_success "前端依赖安装完成"
else
    print_success "前端依赖已安装"
fi

echo ""

# 3. 清理端口占用
print_header "═══════════════════════════════════════"
print_header "第 3 步: 清理端口占用"
print_header "═══════════════════════════════════════"
echo ""

# 检查端口 5173
if lsof -ti:5173 &> /dev/null; then
    print_warning "端口 5173 被占用"
    if ask_yes_no "是否清理端口 5173?" "y"; then
        VITE_PIDS=$(lsof -ti:5173 2>/dev/null)
        if [ ! -z "$VITE_PIDS" ]; then
            kill -9 $VITE_PIDS 2>/dev/null
            sleep 1
            print_success "端口 5173 已清理"
        fi
    fi
else
    print_success "端口 5173 可用"
fi

echo ""

# 4. 启动开发环境
print_header "═══════════════════════════════════════"
print_header "第 4 步: 启动应用"
print_header "═══════════════════════════════════════"
echo ""

print_success "环境检查完成，即将启动应用..."
echo ""
print_info "前端地址: ${CYAN}http://localhost:5173${NC}"
print_info "应用窗口将自动打开..."
print_info "按 ${RED}Ctrl+C${NC} 停止开发服务器"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 等待 2 秒让用户看清信息
sleep 2

# 确保在 src-tauri 目录启动（Tauri 2.0 的 beforeDevCommand 从项目根目录执行）
cd src-tauri

# 使用 cargo tauri dev 启动（会自动启动前端 Vite 服务器）
cargo tauri dev

# 如果用户按 Ctrl+C，执行清理
EXIT_CODE=$?
echo ""
print_info "正在关闭开发服务器..."

# 清理可能残留的进程
VITE_PIDS=$(lsof -ti:5173 2>/dev/null)
if [ ! -z "$VITE_PIDS" ]; then
    kill -9 $VITE_PIDS 2>/dev/null
fi

print_success "开发服务器已停止"
echo ""

exit $EXIT_CODE
