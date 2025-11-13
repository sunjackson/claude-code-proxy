#!/bin/bash

# Claude Code Proxy - 快速启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
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

# 查找cargo命令
find_cargo() {
    if command -v cargo >/dev/null 2>&1; then
        echo "cargo"
    elif [ -f "$HOME/.cargo/bin/cargo" ]; then
        echo "$HOME/.cargo/bin/cargo"
    else
        return 1
    fi
}

# 检查是否已编译
check_build() {
    if [ ! -f "src-tauri/target/release/claude-code-proxy" ] && \
       [ ! -f "src-tauri/target/release/claude-code-proxy.exe" ] && \
       [ ! -d "src-tauri/target/release/bundle" ]; then
        print_warning "未找到编译产物，正在执行首次编译..."
        ./build.sh
    fi
}

# 查找可执行文件
find_executable() {
    # macOS App Bundle
    if [ -d "src-tauri/target/release/bundle/macos/claude-code-proxy.app" ]; then
        echo "src-tauri/target/release/bundle/macos/claude-code-proxy.app/Contents/MacOS/claude-code-proxy"
        return 0
    fi

    # Linux/macOS 可执行文件
    if [ -f "src-tauri/target/release/claude-code-proxy" ]; then
        echo "src-tauri/target/release/claude-code-proxy"
        return 0
    fi

    # Windows 可执行文件
    if [ -f "src-tauri/target/release/claude-code-proxy.exe" ]; then
        echo "src-tauri/target/release/claude-code-proxy.exe"
        return 0
    fi

    return 1
}

# 启动应用（生产模式）
start_production() {
    print_info "正在启动 Claude Code Proxy（生产模式）..."

    check_build

    local executable
    executable=$(find_executable)

    if [ $? -eq 0 ]; then
        print_success "找到可执行文件: $executable"
        print_info "正在启动应用..."

        # 启动应用
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS：使用 open 命令启动 App
            if [[ $executable == *.app/* ]]; then
                open -n "${executable%.app/*}.app"
            else
                "$executable"
            fi
        else
            # Linux/Windows：直接运行
            "$executable" &
        fi

        print_success "应用已启动！"
    else
        print_error "未找到可执行文件，请先运行 ./build.sh 编译项目"
        exit 1
    fi
}

# 启动应用（开发模式）
start_development() {
    print_info "正在启动 Claude Code Proxy（开发模式）..."

    # 检查依赖
    if ! command -v npm >/dev/null 2>&1; then
        print_error "未找到 npm，请先安装 Node.js"
        exit 1
    fi

    # 检查是否安装了依赖
    if [ ! -d "src-ui/node_modules" ]; then
        print_warning "未安装前端依赖，正在安装..."
        cd src-ui
        npm install
        cd ..
    fi

    # 启动开发服务器
    print_info "启动开发服务器..."
    npm run tauri dev
}

# 查看应用状态
check_status() {
    print_info "检查 Claude Code Proxy 运行状态..."

    # 检查进程
    if pgrep -f "claude-code-proxy" > /dev/null; then
        print_success "应用正在运行"

        # 显示进程信息
        print_info "进程信息："
        ps aux | grep "claude-code-proxy" | grep -v grep

        # 检查代理端口
        print_info "检查代理端口 25341..."
        if lsof -i :25341 > /dev/null 2>&1; then
            print_success "代理服务正在运行（端口 25341）"
        else
            print_warning "代理服务未运行"
        fi
    else
        print_warning "应用未运行"
    fi
}

# 停止应用
stop_app() {
    print_info "正在停止 Claude Code Proxy..."

    if pgrep -f "claude-code-proxy" > /dev/null; then
        pkill -f "claude-code-proxy"
        sleep 1

        if pgrep -f "claude-code-proxy" > /dev/null; then
            print_warning "应用未完全停止，强制终止..."
            pkill -9 -f "claude-code-proxy"
        fi

        print_success "应用已停止"
    else
        print_info "应用未运行"
    fi
}

# 重启应用
restart_app() {
    print_info "正在重启 Claude Code Proxy..."
    stop_app
    sleep 2
    start_production
}

# 查看日志
view_logs() {
    print_info "查看应用日志..."

    # macOS 日志位置
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local log_dir="$HOME/Library/Logs/com.claude-code-proxy.app"
        if [ -d "$log_dir" ]; then
            print_info "日志目录: $log_dir"
            tail -f "$log_dir"/*.log 2>/dev/null || print_warning "未找到日志文件"
        else
            print_warning "未找到日志目录"
        fi
    # Linux 日志位置
    elif [[ "$OSTYPE" == "linux"* ]]; then
        local log_dir="$HOME/.local/share/claude-code-proxy/logs"
        if [ -d "$log_dir" ]; then
            print_info "日志目录: $log_dir"
            tail -f "$log_dir"/*.log 2>/dev/null || print_warning "未找到日志文件"
        else
            print_warning "未找到日志目录"
        fi
    else
        print_warning "不支持的操作系统"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
${MAGENTA}
╔══════════════════════════════════════════════════════════╗
║        Claude Code Proxy - 快速启动脚本                 ║
╚══════════════════════════════════════════════════════════╝
${NC}

用法: ./start.sh [命令]

命令:
    ${GREEN}start${NC}, ${GREEN}prod${NC}        启动应用（生产模式，默认）
    ${GREEN}dev${NC}                 启动应用（开发模式）
    ${GREEN}stop${NC}                停止应用
    ${GREEN}restart${NC}             重启应用
    ${GREEN}status${NC}              查看运行状态
    ${GREEN}logs${NC}                查看日志
    ${GREEN}build${NC}               编译项目
    ${GREEN}help${NC}, ${GREEN}-h${NC}           显示此帮助信息

示例:
    ${BLUE}./start.sh${NC}              # 启动应用（生产模式）
    ${BLUE}./start.sh dev${NC}          # 启动应用（开发模式）
    ${BLUE}./start.sh status${NC}       # 查看运行状态
    ${BLUE}./start.sh restart${NC}      # 重启应用

快捷方式:
    ${YELLOW}npm start${NC}              # 等同于 ./start.sh
    ${YELLOW}npm run dev${NC}            # 等同于 ./start.sh dev
    ${YELLOW}npm run build${NC}          # 等同于 ./build.sh

EOF
}

# 主函数
main() {
    echo ""
    print_info "======================================"
    print_info "  Claude Code Proxy 启动脚本"
    print_info "======================================"
    echo ""

    # 解析参数
    case ${1:-start} in
        start|prod|production)
            start_production
            ;;
        dev|development)
            start_development
            ;;
        stop)
            stop_app
            ;;
        restart)
            restart_app
            ;;
        status)
            check_status
            ;;
        logs|log)
            view_logs
            ;;
        build)
            ./build.sh
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
