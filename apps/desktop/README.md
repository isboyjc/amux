# Amux Desktop

Amux Desktop 是一个基于 Electron 的跨平台桌面客户端，提供 LLM API 代理桥接服务。它可以在本地运行一个代理服务器，实现不同 LLM 服务商 API 之间的格式转换和路由。

## 功能特性

- **多 Provider 支持**: 支持 OpenAI、Anthropic、DeepSeek、Moonshot、通义千问、智谱、Google 等主流 LLM 服务商
- **灵活的代理配置**: 自定义代理路径、入站/出站适配器、模型映射
- **代理链支持**: 支持多级代理链路，实现复杂的路由逻辑
- **统一 API Key**: 可选的统一密钥管理，简化客户端配置
- **实时监控**: 仪表盘展示请求指标、成功率、延迟等实时数据
- **请求日志**: 详细的请求日志记录，支持导出和分析
- **系统托盘**: 最小化到系统托盘，后台运行
- **自动启动**: 支持开机自启动
- **配置导入导出**: 方便的配置备份和迁移

## 安装

### macOS

从 Release 页面下载 `.dmg` 文件后，将应用拖入 Applications 文件夹。

首次打开应用时，macOS 可能会提示"无法打开，因为无法验证开发者"。这是因为应用未经过 Apple 公证。请运行以下命令解除隔离属性：

```bash
sudo xattr -dr com.apple.quarantine /Applications/Amux.app
```

然后重新打开应用即可正常使用。

### Windows

从 Release 页面下载 `.exe` 安装程序，双击运行即可安装。

### Linux

从 Release 页面下载 `.AppImage` 或 `.deb` 文件：

- **AppImage**: 添加执行权限后直接运行 `chmod +x Amux-*.AppImage && ./Amux-*.AppImage`
- **deb**: 使用 `sudo dpkg -i Amux-*.deb` 安装

## 快速开始

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建应用
pnpm build

# 打包应用
pnpm package
```

### 目录结构

```
apps/desktop/
├── electron/                 # Electron 主进程
│   ├── main.ts              # 主进程入口
│   ├── preload.ts           # 预加载脚本
│   ├── ipc/                 # IPC 处理器
│   └── services/            # 主进程服务
│       ├── database/        # SQLite 数据库
│       ├── proxy-server/    # Fastify 代理服务器
│       ├── crypto/          # API Key 加密
│       ├── presets/         # Provider 预设
│       ├── logger/          # 日志服务
│       ├── metrics/         # 指标服务
│       ├── tray/            # 系统托盘
│       ├── auto-launch/     # 自动启动
│       └── config/          # 配置导入导出
├── src/                     # React 渲染进程
│   ├── components/          # UI 组件
│   ├── pages/               # 页面组件
│   ├── stores/              # Zustand 状态管理
│   ├── locales/             # 多语言
│   └── types/               # 类型定义
└── resources/               # 应用资源
```

## 技术栈

- **框架**: Electron + React + TypeScript
- **构建**: electron-vite + Vite
- **UI**: shadcn/ui + TailwindCSS
- **状态管理**: Zustand
- **路由**: React Router
- **数据库**: better-sqlite3
- **HTTP 服务器**: Fastify
- **核心库**: @amux.ai/llm-bridge + 各适配器包

## 配置说明

### 代理服务

默认监听地址: `127.0.0.1:9527`

访问代理端点: `http://127.0.0.1:9527/{proxy_path}/v1/chat/completions`

### 数据存储

应用数据存储在用户目录下:
- macOS: `~/Library/Application Support/amux-desktop/`
- Windows: `%APPDATA%/amux-desktop/`
- Linux: `~/.config/amux-desktop/`

## 打包发布

```bash
# 打包 macOS 版本
pnpm package:mac

# 打包 Windows 版本
pnpm package:win

# 打包 Linux 版本
pnpm package:linux
```

## License

MIT
