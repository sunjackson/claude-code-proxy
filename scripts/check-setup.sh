#!/bin/bash
# 检查项目设置的脚本

# 不要在错误时退出，继续检查所有项
set +e

echo "🔍 检查 Claude Code Router 项目设置..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 已安装 ($(command -v "$1"))"
        return 0
    else
        echo -e "${RED}✗${NC} $1 未安装"
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 存在"
        return 0
    else
        echo -e "${RED}✗${NC} $1 不存在"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 目录存在"
        return 0
    else
        echo -e "${RED}✗${NC} $1 目录不存在"
        return 1
    fi
}

# 1. 检查必需的命令
echo "📦 检查依赖..."
check_command "node"
check_command "npm"
check_command "cargo"
check_command "rustc"
echo ""

# 2. 检查项目结构
echo "📁 检查项目结构..."
check_dir "src-tauri"
check_dir "src-ui"
check_dir "specs"
echo ""

# 3. 检查关键配置文件
echo "⚙️  检查配置文件..."
check_file "src-tauri/Cargo.toml"
check_file "src-tauri/tauri.conf.json"
check_file "src-ui/package.json"
check_file "src-ui/vite.config.ts"
check_file "src-ui/tsconfig.json"
check_file ".gitignore"
check_file "README.md"
echo ""

# 4. 检查入口文件
echo "🚀 检查入口文件..."
check_file "src-ui/index.html"
check_file "src-ui/src/main.tsx"
check_file "src-ui/src/App.tsx"
echo ""

# 5. 检查布局组件
echo "🎨 检查布局组件..."
check_file "src-ui/src/components/AppLayout.tsx"
check_file "src-ui/src/components/Sidebar.tsx"
check_file "src-ui/src/components/Header.tsx"
check_file "src-ui/src/components/ErrorBoundary.tsx"
echo ""

# 6. 检查页面组件
echo "📄 检查页面组件..."
check_file "src-ui/src/pages/Dashboard.tsx"
check_file "src-ui/src/pages/ConfigManagement.tsx"
check_file "src-ui/src/pages/ClaudeCodeIntegration.tsx"
check_file "src-ui/src/pages/Recommendations.tsx"
check_file "src-ui/src/pages/Settings.tsx"
echo ""

# 7. 检查翻译文件
echo "🌍 检查国际化文件..."
check_file "src-ui/src/locales/zh-CN.json"
check_file "src-ui/src/locales/en-US.json"
check_file "src-ui/src/services/i18n.ts"
echo ""

# 8. 检查依赖是否安装
echo "📚 检查依赖安装..."
if [ -d "src-ui/node_modules" ]; then
    echo -e "${GREEN}✓${NC} 前端依赖已安装"
else
    echo -e "${YELLOW}⚠${NC}  前端依赖未安装，运行: cd src-ui && npm install"
fi
echo ""

# 9. 统计项目文件
echo "📊 项目统计..."
echo "  Rust 文件: $(find src-tauri/src -name "*.rs" 2>/dev/null | wc -l | tr -d ' ')"
echo "  TypeScript 文件: $(find src-ui/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "  组件文件: $(find src-ui/src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')"
echo "  页面文件: $(find src-ui/src/pages -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')"
echo ""

echo "✅ 检查完成！"
echo ""
echo "📝 下一步:"
echo "  1. 安装依赖: cd src-ui && npm install"
echo "  2. 启动开发服务器: npm run dev"
echo "  3. 在另一个终端启动应用: cd src-tauri && cargo tauri dev"
