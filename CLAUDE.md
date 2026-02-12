# CLAUDE.md

This document is an implementation-grounded guide for AI coding agents working in the Amux monorepo.

## 1) Project Summary

Amux is a pnpm/Nx monorepo centered on a provider-agnostic LLM bridge.

- Core pattern: `Provider Format -> Inbound Adapter -> IR -> Outbound Adapter -> Provider API`
- Workspace layout: `packages/*`, `apps/*`, `examples/*`
- Primary language: TypeScript

Top-level tooling is defined in `package.json`, `pnpm-workspace.yaml`, and `nx.json`.

## 2) Monorepo Structure and Responsibilities

### packages/

- `packages/llm-bridge` (`@amux.ai/llm-bridge`)
  - Core bridge orchestration, IR types, adapter contracts, HTTP client, capability checks.
  - Entry points: `createBridge`, `Bridge`, IR and adapter types.
- `packages/adapter-openai` (`@amux.ai/adapter-openai`)
  - Includes both `openaiAdapter` (`/v1/chat/completions`) and `openaiResponsesAdapter` (`/v1/responses`).
- `packages/adapter-anthropic` / `adapter-deepseek` / `adapter-google` / `adapter-minimax` / `adapter-moonshot` / `adapter-qwen` / `adapter-zhipu`
  - Provider adapters implementing `LLMAdapter`.
  - All depend on `@amux.ai/llm-bridge`.
- `packages/utils` (`@amux.ai/utils`)
  - Small shared helpers (`parseSSE`, `createSSE`, `normalizeError`, `LLMBridgeError`).
  - Keep descriptions conservative; this package is not the central orchestration layer.

### apps/

- `apps/desktop` (`@amux.ai/desktop`, private)
  - Electron desktop app with local Fastify proxy service, SQLite persistence, logs, metrics, OAuth, tunnel management, Code Switch, and update check.
- `apps/proxy` (`@amux.ai/proxy`, private)
  - Express sample proxy/gateway with predefined conversion routes and model mappings.
- `apps/tunnel-api` (`@amux.ai/tunnel-api`, private)
  - Cloudflare Workers API (KV + D1) for tunnel lifecycle (`create/delete/status/list`) and rate limiting.
- `apps/website` (`@amux.ai/website`, private)
  - Next.js + Fumadocs documentation site, bilingual (`en`/`zh`).

### examples/

- `examples/basic`
  - Basic bridge usage and adapter conversion examples.
- `examples/streaming`
  - Streaming and event-handling examples.

## 3) Core Bridge Semantics (Do Not Misstate)

Reference: `packages/llm-bridge/src/bridge/bridge.ts`

### Request/response flow

`chat()` and `chatRaw()` execute this order:

1. `inbound.parseRequest(request)` -> IR
2. Model mapping (if configured)
3. Optional hooks (`onRequest`)
4. Optional request validation + capability checks
5. `outbound.buildRequest(ir)`
6. HTTP call (`baseURL + endpoint`)
7. `outbound.inbound.parseResponse(response)` -> IR
8. Optional hooks (`onResponse`)
9. Convert back with inbound adapter response builder (for `chat()`)

### Model mapping precedence

`targetModel > modelMapper > modelMapping > original`

### Streaming specifics

- `chatStreamRaw()` filters duplicate `end` events.
- `processSSELines()` ignores protocol marker `data: [DONE]` before parsing JSON.
- `chatStream()` uses inbound `createStreamBuilder()` when available.
- `chatStream()` filters final SSE events whose `data === '[DONE]'` (protocol marker is expected to be added by HTTP layer when needed).

### Endpoint resolution

- Chat path priority: `config.chatPath` > adapter `getInfo().endpoint.chatPath`
- Models path priority: `config.modelsPath` > adapter `getInfo().endpoint.modelsPath`
- Supports `{model}` placeholder replacement in chat paths (important for Google adapter path templates).

## 4) Adapter Layer Rules

Reference: `packages/llm-bridge/src/adapter/base.ts`

- Adapters implement provider<->IR conversion only.
- Avoid cross-provider branching inside adapter internals.
- Keep provider-specific protocol details in adapter parsing/building.
- Shared cross-adapter behavior belongs in bridge layer, not duplicated across adapters.

Current provider adapter packages in this repo: OpenAI, Anthropic, DeepSeek, Google, MiniMax, Moonshot, Qwen, Zhipu.

## 5) Desktop App Operational Architecture

### Startup sequence

Reference: `apps/desktop/electron/main.ts`

Main process initializes in this order:

1. Crypto service
2. Database init + migrations
3. Presets init + default provider bootstrap when provider table is empty
4. Analytics init
5. OAuth manager init
6. Logger init
7. IPC handlers registration
8. Browser window creation

### Local proxy service

References:

- `apps/desktop/electron/services/proxy-server/index.ts`
- `apps/desktop/electron/services/proxy-server/routes.ts`
- `apps/desktop/electron/ipc/proxy-service.ts`

Facts:

- Fastify service defaults to `127.0.0.1:9527` (settings-backed).
- OAuth translation routes are registered before regular proxy routes.
- Dynamic route groups:
  - Provider passthrough: `/providers/{proxy_path}...`
  - Conversion proxy: `/proxies/{proxy_path}{endpoint}`
  - Code Switch (enabled): `POST /code/claudecode/v1/messages`
  - Codex code-switch routes exist in code but are currently commented out in route registration.

### Authentication behavior in proxy server

Reference: `apps/desktop/electron/services/proxy-server/utils.ts`

- If unified auth is disabled, requests can run without a platform key (provider key path).
- If unified auth is enabled:
  - `sk-amux.*` is validated as platform key.
  - Non-platform key is treated as passthrough key.

### Persistence and migration

References:

- `apps/desktop/electron/services/database/index.ts`
- `apps/desktop/electron/services/database/migrator.ts`
- `apps/desktop/electron/services/database/migrations/*`

Facts:

- SQLite (`amux.db`) under Electron `userData` path.
- Migrations are tracked via `user_version` and `schema_migrations`.
- Current migration set includes versions `001` through `012`.

### Tunnel subsystem

References:

- `apps/desktop/electron/services/tunnel/tunnel-service.ts`
- `apps/desktop/electron/services/tunnel/cloudflared-manager.ts`
- `apps/tunnel-api/src/index.ts`

Facts:

- Desktop manages local `cloudflared` binary/process.
- Tunnel API default base URL in desktop service is `https://tunnel-api.amux.ai`.
- Tunnel API routes include create/delete/status/list.

### OAuth subsystem

References:

- `apps/desktop/electron/services/oauth/*`
- `apps/desktop/electron/services/proxy-server/oauth/index.ts`
- `apps/desktop/electron/services/proxy-server/oauth/key-manager.ts`

Facts:

- Provider types include `codex` and `antigravity`.
- OAuth translation routes are exposed under `/oauth/codex/*` and `/oauth/antigravity/*`.
- Requests are validated against OAuth service keys stored in `oauth_service_keys` table.
- Generated key format is `sk-amux.oauth.{providerType}-{id}`.

### Update check

Reference: `apps/desktop/electron/services/updater/index.ts`

- Desktop checks latest release metadata from GitHub releases API endpoint:
  - `https://api.github.com/repos/isboyjc/amux/releases/latest`

## 6) Development Commands

### Root

```bash
pnpm install
pnpm build
pnpm build:all
pnpm test
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check
```

### Common app/package workflows

```bash
# Website
pnpm dev:website

# Proxy example app
pnpm dev:proxy

# Desktop app
pnpm dev:desktop
pnpm build:desktop
pnpm package:desktop
```

### Examples

```bash
pnpm dev:example
pnpm dev:example:streaming
```

## 7) Documentation and Sync Rules

When behavior/API is changed, keep docs synchronized:

- Root docs: `README.md` and `README_ZH.md`
- Agent docs: `CLAUDE.md` and `AGENTS.md`
- Website docs: `apps/website/app/content/docs/en/*` and `apps/website/app/content/docs/zh/*`

For architecture claims:

- Prefer citing concrete paths and implementation behavior.
- Avoid test-status claims unless verified in current run.
- Explicitly mark "implemented but not enabled" when routes/features are present in code but not registered.

## 8) Change Safety for Agents

- Keep changes scoped; do not modify unrelated business logic.
- Prefer root-cause changes over ad-hoc patches.
- Follow existing code/style patterns in each package/app.
- Do not assume provider compatibility details that are not expressed in adapter/bridge code.

