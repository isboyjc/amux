# Amux

[English](./README.md) | [中文](./README_ZH.md)

> 双向 LLM API 适配器 — 用于 LLM 提供商 API 格式互转的统一基础设施，附带桌面端零代码代理管理工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

## 概述

Amux 是一个双向 LLM API 适配器生态系统，包含两个核心组件：

- **LLM Bridge SDK** — 零依赖的 TypeScript 库，使用中间表示（IR）模式在不同 LLM 提供商 API 格式之间进行转换。发送 OpenAI 格式的请求，底层无缝调用 Claude、DeepSeek、Gemini 或其他支持的提供商。
- **Amux Desktop** — 跨平台 Electron 桌面应用，将 SDK 封装为功能完备的本地代理服务器，提供 GUI 管理界面、CLI 工具的 Code Switch 功能、Cloudflare 隧道集成等。

## 特性

**SDK**
- 8 种 LLM 提供商 API 格式之间的双向转换，任意组合
- 完整的 TypeScript 类型支持
- 核心包零运行时依赖
- 流式传输支持（SSE），统一的事件类型
- 支持工具调用、视觉/多模态、推理内容
- 可扩展的适配器架构 — 轻松添加自定义提供商

**桌面应用**
- 带 GUI 的本地 LLM API 代理服务器（Fastify，`127.0.0.1:9527`）
- 提供商管理 — 为 8+ 个提供商配置 API 密钥、端点和模型
- Bridge 代理 — 带模型映射的格式转换路由
- 提供商透传 — 无格式转换的直接代理
- Code Switch — 将 Claude  Code 和 Codex CLI 重定向到任意 LLM 提供商，支持模型映射
- OAuth 账号池 — 为 Codex 和 Antigravity 提供商提供轮询/配额感知的选择策略
- Cloudflare 隧道 — 通过内置的 cloudflared 将本地代理暴露到公网
- 内置聊天界面，通过代理测试各提供商
- 仪表盘，实时指标、请求日志和 Token 用量分析
- API 密钥加密（AES-256-GCM）和代理认证
- 双语界面（英文 / 中文）
- 跨平台：macOS、Windows、Linux

## 快速开始

### SDK 使用

```bash
# 安装核心包和所需的适配器
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai @amux.ai/adapter-anthropic
```

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

// 创建 Bridge：OpenAI 格式输入 -> Anthropic API 输出
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com'
  }
})

// 发送 OpenAI 格式请求，获得 OpenAI 格式响应
// 底层实际调用 Claude API
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})

console.log(response.choices[0].message.content)
```

### 桌面应用

从 [GitHub Releases](https://github.com/isboyjc/amux/releases) 下载最新版本，或从源码构建：

```bash
git clone https://github.com/isboyjc/amux.git
cd amux
pnpm install
pnpm dev:desktop
```

## 包列表

| 包名 | 描述 | 状态 |
|------|------|------|
| [@amux.ai/llm-bridge](./packages/llm-bridge) | 核心 IR、适配器接口、Bridge、HTTPClient | 稳定 |
| [@amux.ai/adapter-openai](./packages/adapter-openai) | OpenAI Chat Completions + Responses API | 稳定 |
| [@amux.ai/adapter-anthropic](./packages/adapter-anthropic) | Anthropic (Claude) Messages API | 稳定 |
| [@amux.ai/adapter-deepseek](./packages/adapter-deepseek) | DeepSeek（支持推理） | 稳定 |
| [@amux.ai/adapter-moonshot](./packages/adapter-moonshot) | Moonshot / Kimi（支持推理） | 稳定 |
| [@amux.ai/adapter-qwen](./packages/adapter-qwen) | 通义千问（支持思考、联网搜索） | 稳定 |
| [@amux.ai/adapter-google](./packages/adapter-google) | Google Gemini（原生格式） | 稳定 |
| [@amux.ai/adapter-zhipu](./packages/adapter-zhipu) | 智谱 AI / GLM（支持联网搜索） | 稳定 |
| [@amux.ai/adapter-minimax](./packages/adapter-minimax) | MiniMax（支持推理） | 稳定 |
| [@amux.ai/utils](./packages/utils) | 共享工具库（SSE 解析、错误处理） | 稳定 |

## 架构

SDK 使用中间表示（IR）模式解耦提供商格式：

```
┌─────────────────────────────────────────────────────────┐
│                      你的应用                             │
└────────────────────┬────────────────────────────────────┘
                     │ 提供商 A 格式请求
                     v
┌─────────────────────────────────────────────────────────┐
│                   入站适配器                               │
│              (解析提供商 A -> IR)                          │
└────────────────────┬────────────────────────────────────┘
                     │ 中间表示 (IR)
                     v
┌─────────────────────────────────────────────────────────┐
│                     Bridge                               │
│       (模型映射、验证、钩子、流程编排)                       │
└────────────────────┬────────────────────────────────────┘
                     │ IR
                     v
┌─────────────────────────────────────────────────────────┐
│                   出站适配器                               │
│              (IR -> 构建提供商 B)                          │
└────────────────────┬────────────────────────────────────┘
                     │ 提供商 B 格式请求
                     v
┌─────────────────────────────────────────────────────────┐
│                  提供商 B API                              │
└─────────────────────────────────────────────────────────┘
```

任意入站适配器可与任意出站适配器组合，实现 N x N 的提供商组合。

## Amux Desktop

Amux Desktop 是一个跨平台 Electron 应用，提供完整的 GUI 来管理 LLM API 代理服务。

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 构建工具 | electron-vite + Vite 6 |
| 打包 | electron-builder |
| UI | React 18 + shadcn/ui + Tailwind CSS 3 |
| 状态管理 | Zustand 5 |
| HTTP 服务器 | Fastify 5 |
| 数据库 | SQLite (better-sqlite3, WAL 模式) |
| 加密 | AES-256-GCM (Node.js crypto + Electron safeStorage) |
| 图表 | Recharts |

### 功能详情

#### 提供商管理

配置和管理多个 LLM 提供商，支持加密的 API 密钥存储、连接测试和模型列表获取。支持的提供商：OpenAI、Anthropic、DeepSeek、Moonshot、Qwen、Google Gemini、Zhipu、MiniMax 以及任何兼容 OpenAI 的自定义端点。

#### Bridge 代理

创建格式转换代理路由。例如，接收 OpenAI 格式的请求并自动转换格式后转发到 Anthropic API。可按代理路由配置模型映射规则（如 `gpt-4` -> `claude-sonnet-4-20250514`）。支持代理链，并带有循环依赖检测。

#### 提供商透传

直接代理到任何已配置的提供商，不进行格式转换 — 适用于集中管理 API 密钥或添加日志记录。

#### Code Switch

将 **Claude  Code** 和 **Codex** 等 CLI 工具重定向到通过 Amux 使用任意 LLM 提供商：

- 自动检测 CLI 配置文件（Claude  Code 的 `~/.claude/`，Codex 的 TOML 配置）
- 修改前将原始配置备份到数据库
- 配置 CLI 通过本地 Amux 代理发送 API 请求
- 模型映射编辑器 — 将 CLI 模型名称映射到目标提供商模型
- 动态切换提供商，无需重新编辑 CLI 配置
- 禁用时恢复原始配置

#### OAuth 账号池

管理 Codex 和 Antigravity 提供商的 OAuth 账号，支持基于池的路由：

- OAuth 授权流程，带本地回调服务器
- 多种选择策略：轮询、最少使用、配额感知
- Token 刷新和配额跟踪
- 授权账号自动创建池提供商

#### Cloudflare 隧道

通过 Cloudflare Tunnel 将本地代理服务器暴露到公网：

- 内置 cloudflared 二进制文件（多平台）
- 一键启停隧道，状态监控
- 显示外部 URL 用于远程访问
- 访问日志和系统日志

#### 仪表盘与监控

- 实时代理指标：总请求数、成功率、平均延迟、RPM
- 请求量和 Token 用量的时序图表
- 完整的请求/响应日志，支持过滤、导出（JSON/CSV）和留存管理

#### API Token 管理

- 创建命名的 API 密钥（前缀 `sk-amux.`）用于代理认证
- 启用/禁用/重命名/删除 Token
- 内部请求（内置聊天）绕过认证

#### 其他功能

- 配置导入/导出（使用 PBKDF2 加密）
- 系统启动时自动运行
- 通过 GitHub Releases 检查版本更新
- Google Analytics 4（可选，匿名）
- 双语界面（英文 / 中文）动态切换

### 代理服务器路由

桌面应用运行 Fastify HTTP 服务器，包含以下路由类别：

| 路由模式 | 用途 |
|---------|------|
| `POST /code/claudecode/v1/messages` | Claude  Code 的 Code Switch |
| `POST /providers/{proxy_path}/*` | 提供商透传 |
| `GET /providers/{proxy_path}/v1/models` | 提供商模型列表 |
| `POST /proxies/{proxy_path}/*` | Bridge 格式转换代理 |
| `GET /proxies/{proxy_path}/v1/models` | 代理模型列表 |
| `GET /health` | 健康检查 |
| `GET /` | 状态页面 (HTML) |

### 从源码构建

```bash
# 前置条件：Node.js >= 18, pnpm >= 8

git clone https://github.com/isboyjc/amux.git
cd amux
pnpm install

# 开发模式（带 HMR）
pnpm dev:desktop

# 为当前平台打包
pnpm package:desktop:mac       # macOS (DMG)
pnpm package:desktop:win       # Windows (NSIS + ZIP)
pnpm package:desktop:linux     # Linux (AppImage + DEB)

# 特定平台变体
pnpm package:desktop:mac:arm64     # macOS Apple Silicon
pnpm package:desktop:mac:x64       # macOS Intel
pnpm package:desktop:win:arm64     # Windows ARM
```

## SDK 示例

### 流式传输

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: process.env.ANTHROPIC_API_KEY }
})

for await (const chunk of bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
})) {
  console.log(chunk)
}
```

### 工具调用

```typescript
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is the weather in SF?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }]
})
```

### 模型映射

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: deepseekAdapter,
  config: { apiKey: process.env.DEEPSEEK_API_KEY },
  modelMapping: {
    'gpt-4': 'deepseek-chat',
    'gpt-4-turbo': 'deepseek-reasoner'
  }
})
```

### 所有适配器

```typescript
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { qwenAdapter } from '@amux.ai/adapter-qwen'
import { googleAdapter } from '@amux.ai/adapter-google'
import { zhipuAdapter } from '@amux.ai/adapter-zhipu'
import { minimaxAdapter } from '@amux.ai/adapter-minimax'

// 任意组合：入站 x 出站
```

## 使用场景

- **多提供商支持** — 通过单一接口构建支持多个 LLM 提供商的应用
- **提供商迁移** — 无需更改应用代码即可切换提供商
- **成本优化** — 根据成本/性能将请求路由到不同提供商
- **降级策略** — 实现自动降级到备选提供商
- **CLI 工具路由** — 使用 Code Switch 将 Claude  Code 或 Codex 路由到任意 LLM 提供商
- **API 网关** — 运行本地或公网代理，处理认证、日志和格式转换

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行所有测试
pnpm test

# 带覆盖率的测试
pnpm test:coverage

# 类型检查
pnpm typecheck

# Lint
pnpm lint

# 格式化
pnpm format

# 运行示例
cd examples/basic && pnpm start
cd examples/streaming && pnpm start

# 文档站点
pnpm dev:website
pnpm build:website
```

## Monorepo 结构

```
amux/
├── packages/
│   ├── llm-bridge/           # 核心：IR、适配器接口、Bridge、HTTPClient
│   ├── utils/                # 共享工具库
│   ├── adapter-openai/       # OpenAI 适配器（Chat Completions + Responses API）
│   ├── adapter-anthropic/    # Anthropic 适配器
│   ├── adapter-deepseek/     # DeepSeek 适配器
│   ├── adapter-moonshot/     # Moonshot/Kimi 适配器
│   ├── adapter-qwen/         # 通义千问适配器
│   ├── adapter-google/       # Google Gemini 适配器
│   ├── adapter-zhipu/        # 智谱/GLM 适配器
│   └── adapter-minimax/      # MiniMax 适配器
├── apps/
│   ├── desktop/              # Electron 桌面应用
│   ├── website/              # 文档站点 (Fumadocs)
│   ├── proxy/                # 独立 Express 代理服务器
│   └── tunnel-api/           # Cloudflare Workers 隧道 API
└── examples/
    ├── basic/                # 基础用法示例
    └── streaming/            # 流式传输示例
```

## 发布流程

### NPM 包

```bash
pnpm changeset              # 描述你的更改
pnpm changeset:version      # 更新版本号和 CHANGELOG
git add . && git commit -m "chore: bump package versions"
git push
pnpm --filter "./packages/**" build
pnpm changeset:publish      # 发布到 npm
git push --tags
```

### 桌面应用

```bash
# 使用交互式发布脚本
pnpm release

# 触发 GitHub Actions 为 macOS、Windows、Linux 构建安装包
```

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发环境搭建、代码风格规范和 PR 流程。

## 许可证

MIT (c) [isboyjc](https://github.com/isboyjc)

## 致谢

受以下项目启发：
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [LiteLLM](https://github.com/BerriAI/litellm)
