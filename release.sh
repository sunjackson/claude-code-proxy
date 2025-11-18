#!/bin/bash

#
# 自动发布脚本
# 用法: ./release.sh v1.1.0
#

set -e

VERSION=$1

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

# 检查参数
if [ -z "$VERSION" ]; then
    print_error "请提供版本号"
    echo "用法: ./release.sh v1.1.0"
    exit 1
fi

# 验证版本号格式
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "版本号格式不正确，应为: vX.Y.Z (例如: v1.1.0)"
    exit 1
fi

# 提取版本号（去掉 v 前缀）
VERSION_NUM=${VERSION#v}

print_info "========================================"
print_info "  Claude Code Proxy 发布脚本"
print_info "========================================"
print_info "版本: $VERSION"
print_info ""

# 1. 检查是否在 master 分支
print_info "检查当前分支..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    print_error "当前不在 master 或 main 分支"
    print_info "当前分支: $CURRENT_BRANCH"
    exit 1
fi
print_success "当前在 $CURRENT_BRANCH 分支"

# 2. 检查是否有未提交的更改
print_info "检查未提交的更改..."
if ! git diff-index --quiet HEAD --; then
    print_error "存在未提交的更改，请先提交或暂存"
    git status --short
    exit 1
fi
print_success "工作区干净"

# 3. 拉取最新代码
print_info "拉取最新代码..."
git pull origin $CURRENT_BRANCH
print_success "代码已更新"

# 4. 检查 tag 是否已存在
print_info "检查 tag 是否已存在..."
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    print_error "Tag $VERSION 已存在"
    print_info "请使用新的版本号或删除已有 tag:"
    print_info "  git tag -d $VERSION"
    print_info "  git push origin :refs/tags/$VERSION"
    exit 1
fi
print_success "Tag 可用"

# 5. 验证版本号是否已更新
print_info "验证版本号..."

# 检查 tauri.conf.json
TAURI_VERSION=$(grep -o '"version": "[^"]*"' src-tauri/tauri.conf.json | head -1 | cut -d'"' -f4)
if [ "$TAURI_VERSION" != "$VERSION_NUM" ]; then
    print_warning "src-tauri/tauri.conf.json 中的版本号不匹配"
    print_info "  当前: $TAURI_VERSION"
    print_info "  期望: $VERSION_NUM"
fi

# 检查 Cargo.toml
CARGO_VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | cut -d'"' -f2)
if [ "$CARGO_VERSION" != "$VERSION_NUM" ]; then
    print_warning "src-tauri/Cargo.toml 中的版本号不匹配"
    print_info "  当前: $CARGO_VERSION"
    print_info "  期望: $VERSION_NUM"
fi

# 检查 package.json
PKG_VERSION=$(grep '"version":' src-ui/package.json | head -1 | cut -d'"' -f4)
if [ "$PKG_VERSION" != "$VERSION_NUM" ]; then
    print_warning "src-ui/package.json 中的版本号不匹配"
    print_info "  当前: $PKG_VERSION"
    print_info "  期望: $VERSION_NUM"
fi

# 6. 确认发布
print_info ""
print_warning "即将发布版本 $VERSION"
print_info "这将触发 GitHub Actions 自动构建"
read -p "$(echo -e ${YELLOW}是否继续? [y/N]:${NC} )" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "发布已取消"
    exit 0
fi

# 7. 创建并推送 tag
print_info "创建 tag..."
git tag -a "$VERSION" -m "Release $VERSION"
print_success "Tag 已创建"

print_info "推送 tag 到远程..."
git push origin "$VERSION"
print_success "Tag 已推送"

# 8. 完成
print_info ""
print_success "========================================"
print_success "  版本 $VERSION 已发布!"
print_success "========================================"
print_info ""
print_info "GitHub Actions 将自动执行以下操作:"
print_info "  1. 构建 macOS (Apple Silicon + Intel) 版本"
print_info "  2. 构建 Windows (x64) 版本"
print_info "  3. 构建 Linux (x64) 版本"
print_info "  4. 创建 GitHub Release (Draft)"
print_info "  5. 上传所有安装包"
print_info ""
print_info "预计完成时间: 45-60 分钟"
print_info ""
print_info "查看构建进度:"
print_info "  🔗 https://github.com/sunjackson/claude-code-proxy/actions"
print_info ""
print_info "构建完成后，请访问以下链接编辑并发布 Release:"
print_info "  🔗 https://github.com/sunjackson/claude-code-proxy/releases"
print_info ""
