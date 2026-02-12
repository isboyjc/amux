# Amux

> Bidirectional LLM API bridge and local AI gateway toolkit.

[中文文档](./README_ZH.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

## What Amux Is

Amux is a monorepo that includes:

- A reusable core bridge (`@amux.ai/llm-bridge`) built around a provider-agnostic IR
- Official provider adapters
- A full Electron desktop product (`apps/desktop`) with local proxying and management UI
- Supporting applications (`apps/proxy`, `apps/tunnel-api`, `apps/website`)
- SDK usage examples (`examples/basic`, `examples/streaming`)

Core architecture pattern:

`Provider Format -> Inbound Adapter -> IR -> Outbound Adapter -> Provider API`

## Monorepo Layout

This repository uses pnpm workspaces and Nx task orchestration.

### packages/

- `@amux.ai/llm-bridge` (`packages/llm-bridge`)
  - Core bridge orchestration, IR types, adapter contracts, HTTP client, capability checks
  - Exposes `createBridge`, `Bridge`, IR/adapter types
- Provider adapters (all depend on `@amux.ai/llm-bridge`)
  - `@amux.ai/adapter-openai`
  - `@amux.ai/adapter-anthropic`
  - `@amux.ai/adapter-deepseek`
  - `@amux.ai/adapter-google`
  - `@amux.ai/adapter-minimax`
  - `@amux.ai/adapter-moonshot`
  - `@amux.ai/adapter-qwen`
  - `@amux.ai/adapter-zhipu`
- `@amux.ai/utils` (`packages/utils`)
  - Lightweight helpers (`parseSSE`, `createSSE`, `normalizeError`, `LLMBridgeError`)

Notes:

- `@amux.ai/adapter-openai` exports both `openaiAdapter` (`/v1/chat/completions`) and `openaiResponsesAdapter` (`/v1/responses`).
- There are 8 provider adapter packages in `packages/adapter-*`.

### apps/

- `apps/desktop` (`@amux.ai/desktop`, private)
  - Main product: Electron + React desktop app with local proxy, database, OAuth, tunnel, logs/metrics, code-switch, updater
- `apps/proxy` (`@amux.ai/proxy`, private)
  - Express sample gateway with predefined conversion routes and model mappings
- `apps/tunnel-api` (`@amux.ai/tunnel-api`, private)
  - Cloudflare Workers backend used by Desktop tunnel management
- `apps/website` (`@amux.ai/website`, private)
  - Next.js/Fumadocs documentation site (`en` + `zh`)

### examples/

- `examples/basic`: bridge/adapters basic usage
- `examples/streaming`: streaming and event handling examples

## Core Bridge Behavior

Implementation reference: `packages/llm-bridge/src/bridge/bridge.ts`.

- `chat()` flow: inbound parse -> model mapping -> validate/hooks -> outbound build -> HTTP -> outbound parse -> inbound build response
- Model mapping priority: `targetModel > modelMapper > modelMapping > original`
- Streaming pipeline:
  - `chatStreamRaw()` filters duplicate `end` events
  - Bridge ignores incoming SSE marker `data: [DONE]` before JSON parse
  - `chatStream()` filters final SSE payloads where `data === '[DONE]'`
- Endpoint resolution:
  - chat path: `config.chatPath` > adapter default path
  - models path: `config.modelsPath` > adapter default path
  - supports `{model}` replacement in endpoint templates

## Amux Desktop (apps/desktop)

Amux Desktop is a local-first AI gateway and control plane built with Electron.

### Product role

- Runs a local proxy service (Fastify) and exposes proxy endpoints
- Stores providers/proxies/mappings/logs/settings in SQLite
- Provides UI for provider management, proxy chain management, logs, dashboard, tunnel, OAuth, code-switch
- Integrates with `@amux.ai/llm-bridge` + all official adapters

### Startup sequence (main process)

Reference: `apps/desktop/electron/main.ts`.

Initialization order:

1. Crypto service initialization
2. Database initialization
3. Database migrations
4. Presets initialization
5. Default provider bootstrap (if providers table is empty)
6. Analytics initialization
7. OAuth manager initialization
8. Logger initialization
9. IPC handler registration
10. Browser window creation

### Local proxy architecture

References:

- `apps/desktop/electron/services/proxy-server/index.ts`
- `apps/desktop/electron/services/proxy-server/routes.ts`
- `apps/desktop/electron/services/proxy-server/bridge-manager.ts`
- `apps/desktop/electron/ipc/proxy-service.ts`

Facts from implementation:

- Fastify server defaults to `127.0.0.1:9527` (settings-backed)
- OAuth translation routes are registered before main proxy routes
- Dynamic route categories:
  - Provider passthrough routes: `/providers/{proxy_path}...`
  - Conversion proxy routes: `/proxies/{proxy_path}{endpoint}`
  - List routes: `/v1/proxies`, and per-proxy models routes
- Code Switch route currently registered:
  - `POST /code/claudecode/v1/messages`
- Codex Code Switch HTTP routes exist in source but are currently commented out in `routes.ts` (implemented but not enabled in current route registration)

### Data and migrations

References:

- `apps/desktop/electron/services/database/index.ts`
- `apps/desktop/electron/services/database/migrator.ts`
- `apps/desktop/electron/services/database/migrations/*`

Facts:

- Uses SQLite (`amux.db`) under Electron `userData`
- Migration tracking uses `user_version` + `schema_migrations`
- Current migrations include versions `001` through `012`

### Tunnel subsystem

References:

- `apps/desktop/electron/services/tunnel/tunnel-service.ts`
- `apps/desktop/electron/services/tunnel/cloudflared-manager.ts`
- `apps/tunnel-api/src/index.ts`

Facts:

- Desktop manages local `cloudflared` process
- If missing, Desktop can download `cloudflared`
- Tunnel backend default URL in desktop service: `https://tunnel-api.amux.ai`
- Tunnel API supports create/delete/status/list endpoints

### OAuth subsystem

References:

- `apps/desktop/electron/services/oauth/*`
- `apps/desktop/electron/services/proxy-server/oauth/index.ts`
- `apps/desktop/electron/services/proxy-server/oauth/key-manager.ts`

Facts:

- OAuth provider types include `codex` and `antigravity`
- Translation routes are exposed under `/oauth/codex/*` and `/oauth/antigravity/*`
- Requests are validated using OAuth service keys stored in DB (`oauth_service_keys`)
- OAuth service key format: `sk-amux.oauth.{providerType}-{randomId}`

### Desktop updater behavior

Reference: `apps/desktop/electron/services/updater/index.ts`.

- Update checks call GitHub latest release API:
  - `https://api.github.com/repos/isboyjc/amux/releases/latest`

### Desktop commands

From repo root:

```bash
pnpm dev:desktop
pnpm build:desktop
pnpm package:desktop
pnpm package:desktop:all
pnpm package:desktop:mac
pnpm package:desktop:win
pnpm package:desktop:linux
```

Inside `apps/desktop`:

```bash
pnpm dev
pnpm build
pnpm package
```

## Quick Start (SDK Usage)

Install only what you need:

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai @amux.ai/adapter-anthropic
```

Basic bridge usage:

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

## Development Commands

```bash
pnpm install

# Monorepo tasks
pnpm build
pnpm build:all
pnpm test
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check

# Apps/examples shortcuts
pnpm dev:website
pnpm dev:proxy
pnpm dev:example
pnpm dev:example:streaming
```

## Related Docs

- Agent guides: `CLAUDE.md`, `AGENTS.md`
- Desktop-specific guide: `apps/desktop/README.md`
- Docs site content: `apps/website/app/content/docs/en/*`, `apps/website/app/content/docs/zh/*`
- Contribution guide: `CONTRIBUTING.md`

## License

MIT © [isboyjc](https://github.com/isboyjc)

