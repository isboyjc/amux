# Amux

> 双向 LLM API 桥接与本地 AI 网关工具集。

[English](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

## Amux 是什么

Amux 是一个 monorepo，包含：

- 基于统一 IR 的核心桥接库（`@amux.ai/llm-bridge`）
- 官方 Provider 适配器集合
- 完整的 Electron 桌面产品（`apps/desktop`）
- 配套应用（`apps/proxy`、`apps/tunnel-api`、`apps/website`）
- SDK 示例（`examples/basic`、`examples/streaming`）

核心架构模式：

`Provider Format -> Inbound Adapter -> IR -> Outbound Adapter -> Provider API`

## Monorepo 结构

仓库使用 pnpm workspace + Nx 任务编排。

### packages/

- `@amux.ai/llm-bridge`（`packages/llm-bridge`）
  - 核心桥接编排、IR 类型、Adapter 契约、HTTP 客户端、能力校验
  - 对外暴露 `createBridge`、`Bridge`、IR/Adapter 类型
- Provider 适配器（均依赖 `@amux.ai/llm-bridge`）
  - `@amux.ai/adapter-openai`
  - `@amux.ai/adapter-anthropic`
  - `@amux.ai/adapter-deepseek`
  - `@amux.ai/adapter-google`
  - `@amux.ai/adapter-minimax`
  - `@amux.ai/adapter-moonshot`
  - `@amux.ai/adapter-qwen`
  - `@amux.ai/adapter-zhipu`
- `@amux.ai/utils`（`packages/utils`）
  - 轻量工具函数（`parseSSE`、`createSSE`、`normalizeError`、`LLMBridgeError`）

说明：

- `@amux.ai/adapter-openai` 同时导出 `openaiAdapter`（`/v1/chat/completions`）与 `openaiResponsesAdapter`（`/v1/responses`）。
- `packages/adapter-*` 当前共有 8 个 provider adapter 包。

### apps/

- `apps/desktop`（`@amux.ai/desktop`, private）
  - 主产品：Electron + React 桌面应用，包含本地代理、数据库、OAuth、Tunnel、日志指标、Code Switch、更新检查
- `apps/proxy`（`@amux.ai/proxy`, private）
  - Express 示例网关，内置转换路由与模型映射
- `apps/tunnel-api`（`@amux.ai/tunnel-api`, private）
  - Cloudflare Workers 后端，供 Desktop Tunnel 管理调用
- `apps/website`（`@amux.ai/website`, private）
  - Next.js/Fumadocs 文档站，支持 `en`/`zh`

### examples/

- `examples/basic`：桥接与适配器基础示例
- `examples/streaming`：流式事件处理示例

## 核心 Bridge 行为

实现参考：`packages/llm-bridge/src/bridge/bridge.ts`。

- `chat()` 主流程：入站解析 -> 模型映射 -> 校验/Hook -> 出站构建 -> HTTP 调用 -> 出站解析 -> 入站重建响应
- 模型映射优先级：`targetModel > modelMapper > modelMapping > original`
- 流式处理行为：
  - `chatStreamRaw()` 会过滤重复 `end` 事件
  - Bridge 在解析 SSE 时会跳过 `data: [DONE]`
  - `chatStream()` 会过滤 `data === '[DONE]'` 的 final 事件
- endpoint 解析：
  - chat path：`config.chatPath` > adapter 默认值
  - models path：`config.modelsPath` > adapter 默认值
  - 支持 `{model}` 占位符替换

## Amux Desktop（apps/desktop）

Amux Desktop 是一个本地优先的 AI 网关与控制面板产品，基于 Electron 构建。

### 产品定位

- 在本地启动 Fastify 代理服务并暴露统一代理入口
- 在 SQLite 中存储 providers/proxies/mappings/logs/settings
- 提供 Provider 管理、代理链配置、日志、仪表盘、Tunnel、OAuth、Code Switch 等 UI
- 与 `@amux.ai/llm-bridge` + 全部官方 adapter 集成

### 主进程启动顺序

参考：`apps/desktop/electron/main.ts`。

初始化顺序为：

1. Crypto 服务初始化
2. 数据库初始化
3. 执行数据库迁移
4. Presets 初始化
5. 若 provider 表为空则注入默认 provider
6. Analytics 初始化
7. OAuth Manager 初始化
8. Logger 初始化
9. 注册 IPC handlers
10. 创建窗口

### 本地代理架构

参考：

- `apps/desktop/electron/services/proxy-server/index.ts`
- `apps/desktop/electron/services/proxy-server/routes.ts`
- `apps/desktop/electron/services/proxy-server/bridge-manager.ts`
- `apps/desktop/electron/ipc/proxy-service.ts`

基于实现的事实：

- Fastify 默认监听 `127.0.0.1:9527`（受 settings 配置控制）
- OAuth translation 路由先于常规代理路由注册
- 动态路由类别：
  - Provider passthrough：`/providers/{proxy_path}...`
  - Conversion proxy：`/proxies/{proxy_path}{endpoint}`
  - 列表与模型相关：`/v1/proxies`、各 proxy 的 models 路由
- 当前已注册 Code Switch 路由：
  - `POST /code/claudecode/v1/messages`
- Codex Code Switch HTTP 路由在源码中有实现，但在 `routes.ts` 中目前注释禁用（实现存在但默认未启用）

### 数据层与迁移

参考：

- `apps/desktop/electron/services/database/index.ts`
- `apps/desktop/electron/services/database/migrator.ts`
- `apps/desktop/electron/services/database/migrations/*`

事实：

- 使用 SQLite（`amux.db`），位于 Electron `userData` 目录
- 通过 `user_version` + `schema_migrations` 管理迁移
- 当前迁移版本包含 `001` 到 `012`

### Tunnel 子系统

参考：

- `apps/desktop/electron/services/tunnel/tunnel-service.ts`
- `apps/desktop/electron/services/tunnel/cloudflared-manager.ts`
- `apps/tunnel-api/src/index.ts`

事实：

- Desktop 负责本地 `cloudflared` 进程管理
- 当本地不存在 `cloudflared` 时，支持下载
- Desktop 端默认 tunnel API 地址为 `https://tunnel-api.amux.ai`
- Tunnel API 支持 create/delete/status/list

### OAuth 子系统

参考：

- `apps/desktop/electron/services/oauth/*`
- `apps/desktop/electron/services/proxy-server/oauth/index.ts`
- `apps/desktop/electron/services/proxy-server/oauth/key-manager.ts`

事实：

- OAuth provider 类型包括 `codex` 与 `antigravity`
- 对外转换入口在 `/oauth/codex/*` 与 `/oauth/antigravity/*`
- 请求通过数据库中的 OAuth service key（`oauth_service_keys`）校验
- service key 生成格式：`sk-amux.oauth.{providerType}-{randomId}`

### Desktop 更新检查

参考：`apps/desktop/electron/services/updater/index.ts`。

- 通过 GitHub latest release API 检查版本：
  - `https://api.github.com/repos/isboyjc/amux/releases/latest`

### Desktop 常用命令

在仓库根目录执行：

```bash
pnpm dev:desktop
pnpm build:desktop
pnpm package:desktop
pnpm package:desktop:all
pnpm package:desktop:mac
pnpm package:desktop:win
pnpm package:desktop:linux
```

在 `apps/desktop` 目录执行：

```bash
pnpm dev
pnpm build
pnpm package
```

## 快速开始（SDK 使用）

只安装需要的包：

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai @amux.ai/adapter-anthropic
```

基本调用示例：

```ts
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
})

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello from Amux' }],
})

console.log(response)
```

## 开发命令

```bash
pnpm install

# Monorepo 任务
pnpm build
pnpm build:all
pnpm test
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check

# apps/examples 快捷命令
pnpm dev:website
pnpm dev:proxy
pnpm dev:example
pnpm dev:example:streaming
```

## 相关文档

- Agent 指南：`CLAUDE.md`、`AGENTS.md`
- Desktop 专属说明：`apps/desktop/README.md`
- 文档站内容：`apps/website/app/content/docs/en/*`、`apps/website/app/content/docs/zh/*`
- 贡献指南：`CONTRIBUTING.md`

## License

MIT © [isboyjc](https://github.com/isboyjc)

