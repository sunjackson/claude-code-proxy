# 快速开始指南: Claude Code 代理服务管理应用

**特性分支**: `001-claude-code-proxy` | **日期**: 2025-11-08
**目标读者**: 开发人员
**预计阅读时间**: 15 分钟

---

## 概述

本指南帮助开发人员快速搭建开发环境并运行 Claude Code 代理服务管理应用。应用基于 **Tauri** 框架构建,后端使用 **Rust**,前端使用 **React 18 + TypeScript + Tailwind CSS**。

**前置条件**:
- Node.js 18+ 和 npm/pnpm
- Rust 1.70+ 和 Cargo
- Git
- 操作系统: Windows 10+, macOS 11+, 或 Linux

---

## 1. 环境准备

### 1.1 安装 Rust

**macOS / Linux**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Windows**:
下载并运行 [rustup-init.exe](https://rustup.rs/)

验证安装:
```bash
rustc --version
cargo --version
```

---

### 1.2 安装 Node.js

**推荐使用 nvm**(Node Version Manager):
```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
nvm install 18
nvm use 18

# Windows (使用 nvm-windows)
# 下载安装包: https://github.com/coreybutler/nvm-windows/releases
nvm install 18
nvm use 18
```

验证安装:
```bash
node --version  # v18.x.x
npm --version   # 9.x.x
```

**可选**: 安装 pnpm(更快的包管理器)
```bash
npm install -g pnpm
```

---

### 1.3 安装 Tauri CLI

```bash
cargo install tauri-cli
```

验证安装:
```bash
cargo tauri --version
```

---

### 1.4 安装系统依赖

**macOS**:
```bash
# 无需额外依赖
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libsqlite3-dev
```

**Windows**:
```powershell
# 安装 Microsoft C++ Build Tools
# 下载: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# 选择 "Desktop development with C++" 工作负载
```

---

## 2. 克隆仓库并安装依赖

```bash
# 克隆仓库
git clone https://github.com/your-org/claude-code-router.git
cd claude-code-router

# 切换到特性分支
git checkout 001-claude-code-proxy

# 安装前端依赖
cd src-ui  # 假设前端代码在 src-ui 目录
npm install  # 或 pnpm install

# 安装 Rust 依赖(会在首次构建时自动安装)
cd ..
```

---

## 3. 项目结构概览

```
claude-code-router/
├── src-tauri/              # Rust 后端(Tauri)
│   ├── src/
│   │   ├── main.rs         # 应用入口
│   │   ├── commands/       # Tauri Commands(IPC 接口)
│   │   ├── services/       # 业务服务
│   │   ├── models/         # 数据模型
│   │   ├── db/             # SQLite 数据库
│   │   └── proxy/          # HTTP 代理服务器
│   ├── Cargo.toml          # Rust 依赖配置
│   └── tauri.conf.json     # Tauri 应用配置
│
├── src-ui/                 # React 前端
│   ├── src/
│   │   ├── App.tsx         # 应用根组件
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用组件
│   │   ├── hooks/          # React Hooks
│   │   ├── store/          # Zustand 状态管理
│   │   ├── locales/        # 国际化文件
│   │   └── styles/         # Tailwind CSS
│   ├── package.json        # Node.js 依赖配置
│   └── vite.config.ts      # Vite 构建配置
│
├── specs/                  # 规格文档(本文档所在目录)
└── README.md               # 项目说明
```

---

## 4. 开发模式运行

### 4.1 启动开发服务器

**终端 1 - 启动前端开发服务器**:
```bash
cd src-ui
npm run dev
# Vite 服务器将在 http://localhost:5173 启动
```

**终端 2 - 启动 Tauri 应用**:
```bash
cd src-tauri
cargo tauri dev
```

**首次运行**:
- Rust 依赖编译可能需要 5-10 分钟
- 应用窗口将自动打开并加载前端 UI
- 后续运行将显著加快(增量编译)

---

### 4.2 热重载

**前端热重载**:
- 修改 `src-ui/src/` 中的 React 代码会自动刷新浏览器
- 无需重启 Tauri 应用

**后端热重载**:
- 修改 `src-tauri/src/` 中的 Rust 代码需要重启 Tauri 应用
- 终端 2 中按 `Ctrl+C` 停止,然后重新运行 `cargo tauri dev`

**推荐工作流**:
1. 先完成前端 UI 开发(快速迭代)
2. 再调整后端逻辑(需重启)

---

## 5. 数据库初始化

应用首次启动时会自动初始化 SQLite 数据库:

**数据库路径**:
- **macOS**: `~/Library/Application Support/com.claude-code-router/app.db`
- **Linux**: `~/.local/share/claude-code-router/app.db`
- **Windows**: `C:\Users\<用户名>\AppData\Roaming\claude-code-router\app.db`

**初始化脚本** (`src-tauri/src/db/init.rs`):
```rust
pub fn initialize_database() -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;

    // 创建所有表(参考 data-model.md)
    conn.execute_batch(include_str!("../sql/schema.sql"))?;

    // 插入默认数据
    conn.execute(
        "INSERT OR IGNORE INTO AppSettings (id, language, default_proxy_port) VALUES (1, 'zh-CN', 25341)",
        [],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO ConfigGroup (id, name) VALUES (0, '未分组')",
        [],
    )?;

    Ok(conn)
}
```

**重置数据库**:
```bash
# 删除数据库文件,应用将在下次启动时重新创建
rm ~/Library/Application\ Support/com.claude-code-router/app.db  # macOS
rm ~/.local/share/claude-code-router/app.db                      # Linux
del %APPDATA%\claude-code-router\app.db                          # Windows
```

---

## 6. 核心功能测试

### 6.1 测试代理服务启动

**前置条件**: 确保端口 25341 未被占用

**测试步骤**:
1. 打开应用主界面(Dashboard)
2. 点击"启动代理服务"按钮
3. 验证状态指示灯变为绿色
4. 使用 `curl` 测试代理:
   ```bash
   # 假设已配置一个 API 中转站
   curl -x http://127.0.0.1:25341 https://api.anthropic.com/v1/messages \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
   ```

**预期结果**: 请求通过本地代理转发到配置的中转站,返回 Claude 响应

---

### 6.2 测试配置管理

**测试步骤**:
1. 导航到"配置管理"页面(`/configs`)
2. 点击"新建分组"按钮,创建名为"测试分组"的分组
3. 在"测试分组"下点击"新建配置"按钮
4. 填写配置信息:
   - 配置名称: "测试配置 1"
   - API 密钥: `sk_test_xxxxx`(使用测试密钥)
   - 服务器地址: `https://api.example.com`
   - 端口: `443`
5. 保存配置
6. 点击配置项的"测试"按钮

**预期结果**:
- 配置成功保存到数据库
- API 密钥存储到系统密钥链(不在数据库中明文存储)
- 测试结果显示连接状态和延迟

---

### 6.3 测试 Claude Code 集成

**前置条件**: 已安装 Claude Code(或手动创建 `~/.claude/settings.json`)

**测试步骤**:
1. 导航到"Claude Code 集成"页面(`/claude-code`)
2. 验证应用自动检测到 Claude Code 配置路径
3. 点击"启用本地代理"按钮
4. 打开 `~/.claude/settings.json` 验证配置被修改:
   ```json
   {
     "env": {
       "ANTHROPIC_BASE_URL": "http://127.0.0.1:25341",
       "HTTP_PROXY": "http://127.0.0.1:25341",
       "HTTPS_PROXY": "http://127.0.0.1:25341"
     }
   }
   ```
5. 点击"恢复原始配置"按钮
6. 验证配置恢复到备份版本

**预期结果**:
- 配置文件被正确修改和恢复
- 备份文件保存在 `~/.claude-code-proxy/backups/` 目录
- UI 显示成功通知

---

## 7. 调试技巧

### 7.1 查看 Rust 后端日志

**方法 1 - 终端输出**:
```bash
# 在运行 cargo tauri dev 的终端中查看日志
# 日志会实时显示,包括 println!、eprintln! 等
```

**方法 2 - 使用日志库**:
```rust
use log::{info, warn, error};

#[tauri::command]
fn my_command() {
    info!("This is an info log");
    warn!("This is a warning");
    error!("This is an error");
}
```

启用日志输出:
```bash
RUST_LOG=debug cargo tauri dev
```

---

### 7.2 查看前端日志

**浏览器开发者工具**:
- **macOS**: `Cmd + Option + I`
- **Windows/Linux**: `F12` 或 `Ctrl + Shift + I`

**Console 标签**: 查看 JavaScript 日志和错误

**Network 标签**: 查看 HTTP 请求(代理转发的请求)

**推荐**: 使用 `console.log` 调试 React 组件:
```typescript
useEffect(() => {
  console.log('Current config:', currentConfig);
}, [currentConfig]);
```

---

### 7.3 调试 IPC 通信

**前端调用 Tauri Command**:
```typescript
import { invoke } from '@tauri-apps/api/tauri';

try {
  const result = await invoke('get_proxy_status');
  console.log('Proxy status:', result);
} catch (error) {
  console.error('IPC Error:', error);
}
```

**后端 Command 调试**:
```rust
#[tauri::command]
fn get_proxy_status() -> Result<ProxyStatus, String> {
    println!("[DEBUG] get_proxy_status called");
    // ... 实现
}
```

---

### 7.4 SQLite 数据库调试

**推荐工具**: [DB Browser for SQLite](https://sqlitebrowser.org/)

```bash
# macOS
brew install --cask db-browser-for-sqlite

# 打开数据库
open -a "DB Browser for SQLite" ~/Library/Application\ Support/com.claude-code-router/app.db
```

**常用 SQL 查询**:
```sql
-- 查看所有配置分组
SELECT * FROM ConfigGroup;

-- 查看某个分组的所有配置
SELECT * FROM ApiConfig WHERE group_id = 1 ORDER BY sort_order;

-- 查看最近的切换日志
SELECT * FROM SwitchLog ORDER BY switch_at DESC LIMIT 10;

-- 查看应用设置
SELECT * FROM AppSettings WHERE id = 1;
```

---

## 8. 构建生产版本

### 8.1 构建应用

```bash
cd src-ui
npm run build  # 构建前端静态文件

cd ../src-tauri
cargo tauri build  # 构建 Tauri 应用
```

**构建输出**:
- **macOS**: `src-tauri/target/release/bundle/dmg/Claude Code Router_1.0.0_x64.dmg`
- **Windows**: `src-tauri/target/release/bundle/msi/Claude Code Router_1.0.0_x64_en-US.msi`
- **Linux**: `src-tauri/target/release/bundle/deb/claude-code-router_1.0.0_amd64.deb`

---

### 8.2 应用签名(可选)

**macOS**:
```bash
# 需要 Apple Developer 账户
codesign --deep --force --verify --verbose --sign "Developer ID Application: YOUR_NAME" "Claude Code Router.app"
```

**Windows**:
```powershell
# 需要代码签名证书
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 "Claude Code Router.exe"
```

---

## 9. 运行测试

### 9.1 Rust 单元测试

```bash
cd src-tauri
cargo test

# 运行特定测试
cargo test test_config_manager

# 显示详细输出
cargo test -- --nocapture
```

**测试示例** (`src-tauri/src/services/config_manager.rs`):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_config_group() {
        let manager = ConfigManager::new_in_memory();
        let group = manager.create_group("Test Group", None).unwrap();
        assert_eq!(group.name, "Test Group");
    }
}
```

---

### 9.2 前端单元测试

**使用 Vitest**:
```bash
cd src-ui
npm run test

# 覆盖率报告
npm run test:coverage
```

**测试示例** (`src-ui/src/components/ConfigList.test.tsx`):
```typescript
import { render, screen } from '@testing-library/react';
import { ConfigList } from './ConfigList';

describe('ConfigList', () => {
  it('renders config items', () => {
    const configs = [
      { id: 1, name: 'Config 1', server_url: 'https://api.example.com' },
    ];
    render(<ConfigList configs={configs} />);
    expect(screen.getByText('Config 1')).toBeInTheDocument();
  });
});
```

---

### 9.3 端到端测试(可选)

**使用 Playwright** 测试 Tauri 应用:
```bash
cd src-ui
npm install -D @playwright/test
npx playwright test
```

---

## 10. 常见问题排查

### 10.1 端口被占用

**错误**: `PortInUse: Port 25341 is already in use`

**解决方案**:
```bash
# 查找占用进程
lsof -i :25341  # macOS/Linux
netstat -ano | findstr :25341  # Windows

# 杀死进程
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

---

### 10.2 系统密钥链访问失败

**错误**: `KeychainError: Failed to access system keychain`

**解决方案**:
- **macOS**: 首次运行时允许应用访问 Keychain
- **Linux**: 确保安装了 `libsecret-1-dev`:
  ```bash
  sudo apt install libsecret-1-dev
  ```
- **Windows**: 确保应用有访问 Windows Credential Manager 的权限

---

### 10.3 Claude Code 配置文件未找到

**错误**: `PathNotFound: Claude Code settings.json not found`

**解决方案**:
1. 确认 Claude Code 已安装
2. 手动创建配置文件:
   ```bash
   # macOS/Linux
   mkdir -p ~/.claude
   echo '{}' > ~/.claude/settings.json

   # Windows
   mkdir %USERPROFILE%\.claude
   echo {} > %USERPROFILE%\.claude\settings.json
   ```

---

### 10.4 Rust 编译错误

**错误**: `error: linker 'cc' not found`

**解决方案**:
```bash
# macOS
xcode-select --install

# Linux
sudo apt install build-essential

# Windows
# 安装 Microsoft C++ Build Tools
```

---

## 11. 下一步

完成快速开始后,建议:

1. **阅读技术文档**:
   - [data-model.md](./data-model.md) - 数据模型详解
   - [contracts/tauri-commands.md](./contracts/tauri-commands.md) - API 接口合约
   - [contracts/ui-components.md](./contracts/ui-components.md) - UI 组件规范

2. **实现核心功能**:
   - 按照 [tasks.md](./tasks.md) 中的任务列表开发(执行 `/speckit.tasks` 生成)
   - 遵循 [research.md](./research.md) 中的技术决策

3. **参与代码审查**:
   - 提交 Pull Request 前运行所有测试
   - 确保代码符合 ESLint 和 Clippy 规范

4. **贡献文档**:
   - 更新 README.md
   - 记录新功能的使用方法

---

## 12. 参考资源

### 官方文档
- [Tauri 官方文档](https://tauri.app/v1/guides/)
- [React 18 文档](https://react.dev/)
- [Rust 官方书籍](https://doc.rust-lang.org/book/)
- [SQLite 文档](https://www.sqlite.org/docs.html)

### 社区资源
- [Tauri Discord](https://discord.gg/tauri)
- [Rust 中文社区](https://rustcc.cn/)
- [React 中文社区](https://react.nodejs.cn/)

### 项目特定资源
- [Claude Code 文档](https://docs.anthropic.com/claude/docs/claude-code)
- [keytar 库文档](https://github.com/atom/node-keytar)
- [Hyper HTTP 库文档](https://hyper.rs/)

---

**文档版本**: v1.0.0
**最后更新**: 2025-11-08
**维护者**: 开发团队

如有问题,请在项目 Issues 中提问。
