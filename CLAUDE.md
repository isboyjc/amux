# CLAUDE.md

This file provides guidance to Claude Code and other AI agents when working with this repository.

## Project Overview

Amux is a bidirectional LLM API adapter ecosystem. The project consists of two parts:

1. **LLM Bridge SDK** — A TypeScript library that converts between different LLM provider API formats using an Intermediate Representation (IR) pattern.
2. **Amux Desktop** — An Electron desktop application that runs a local LLM API proxy server with a GUI for managing providers, proxies, and features like Code Switch.

**Core conversion flow:** Provider A Format → Inbound Adapter → IR → Outbound Adapter → Provider B Format

## Monorepo Structure

This is a pnpm workspace monorepo orchestrated by Nx.

```
amux/
├── packages/
│   ├── llm-bridge/          # Core: IR types, LLMAdapter interface, Bridge, HTTPClient
│   ├── utils/               # Shared utilities: SSE parsing, error normalization
│   ├── adapter-openai/      # OpenAI Chat Completions + Responses API adapter
│   ├── adapter-anthropic/   # Anthropic Messages API adapter (standalone, native format)
│   ├── adapter-deepseek/    # DeepSeek adapter (OpenAI-compatible + reasoning_content)
│   ├── adapter-moonshot/    # Moonshot/Kimi adapter (OpenAI-compatible + reasoning_content)
│   ├── adapter-qwen/        # Qwen adapter (OpenAI-compatible + thinking, search, vision extensions)
│   ├── adapter-google/      # Google Gemini adapter (native Gemini format, auto-detects OpenAI format)
│   ├── adapter-minimax/     # MiniMax adapter (OpenAI-compatible + reasoning_details)
│   └── adapter-zhipu/       # Zhipu/GLM adapter (OpenAI-compatible + web search)
├── apps/
│   ├── desktop/             # Electron desktop app (React + Fastify proxy server)
│   ├── website/             # Documentation site (Next.js + Fumadocs, bilingual en/zh)
│   ├── proxy/               # Standalone Express proxy server
│   └── tunnel-api/          # Cloudflare Workers tunnel management API
├── examples/
│   ├── basic/               # Basic bridge usage example
│   └── streaming/           # Streaming example
├── scripts/
│   └── release.ts           # Interactive desktop release script
├── nx.json                  # Nx build orchestration config
├── tsconfig.base.json       # Shared TypeScript config (strict mode, ES2022, ESNext modules)
├── vitest.config.ts         # Root Vitest config (80% coverage thresholds)
└── pnpm-workspace.yaml      # Workspace: packages/*, apps/*, examples/*
```

## Package Details

### @amux.ai/llm-bridge (Core)

**Path:** `packages/llm-bridge/`
**Zero runtime dependencies.** Exports: ESM + CJS + .d.ts

Key source directories:
- `src/ir/` — IR types: `LLMRequestIR`, `LLMResponseIR`, `LLMStreamEvent`, `LLMErrorIR`
- `src/adapter/` — `LLMAdapter` interface, `AdapterCapabilities`, `AdapterRegistry`
- `src/bridge/` — `Bridge` class (orchestration), `HTTPClient` (fetch with retry), `createBridge()` factory
- `src/types/` — Shared types: `Message`, `Tool`, `ToolChoice`, `GenerationConfig`
- `src/utils/` — `SSELineParser`, content helpers, usage/error parsers
- `src/errors/` — Error hierarchy: `APIError`, `NetworkError`, `TimeoutError`, `ValidationError`, `AdapterError`

### Adapter Packages

All adapters follow the same structure:
```
packages/adapter-{provider}/src/
├── adapter.ts              # LLMAdapter implementation
├── types.ts                # Provider-specific types
├── inbound/
│   ├── request-parser.ts   # Provider format → IR
│   ├── response-parser.ts  # Provider response → IR
│   ├── stream-parser.ts    # Provider stream chunk → IR stream events
│   └── error-parser.ts     # Provider error → IR error
├── outbound/
│   ├── request-builder.ts  # IR → Provider format
│   ├── response-builder.ts # IR → Provider response format
│   └── stream-builder.ts   # IR stream events → Provider SSE format
└── index.ts
```

**All adapters are standalone implementations.** None extend the OpenAI adapter class. Each handles its own provider-specific quirks independently.

| Adapter | Native Format | Reasoning Field | Special Features |
|---------|--------------|-----------------|------------------|
| openai | OpenAI Chat Completions | N/A | Also exports `openaiResponsesAdapter` for Responses API |
| anthropic | Native Anthropic Messages | `thinking` content blocks | Tool use in content blocks, `end_turn`/`tool_use` stop reasons |
| deepseek | OpenAI-compatible | `reasoning_content` | Cache tokens, reasoner model restrictions (no system messages) |
| moonshot | OpenAI-compatible | `reasoning_content` | Kimi types |
| qwen | OpenAI-compatible | `reasoning_content` via `enable_thinking` | Web search (`enable_search`), video content |
| google | Native Gemini | N/A | Auto-detects OpenAI vs Gemini format, `{model}` in chatPath |
| minimax | OpenAI-compatible | `reasoning_details` (array) | `reasoning_split` flag, temperature clamped to (0,1] |
| zhipu | OpenAI-compatible | N/A | Web search, `do_sample`, `request_id` |

### @amux.ai/utils

**Path:** `packages/utils/`
- `parseSSE(chunk)` / `createSSE(data)` — SSE string utilities
- `normalizeError()` — Error normalization

### Amux Desktop

**Path:** `apps/desktop/`
**Stack:** Electron 33 + React 18 + Fastify 5 + SQLite (better-sqlite3) + Zustand + shadcn/ui + Tailwind CSS 3

Electron main process (`electron/`):
- `main.ts` — App initialization: crypto → database → migrations → presets → providers → analytics → OAuth → logger → IPC handlers → window
- `ipc/` — 14 IPC handler groups (providers, proxies, proxy-service, settings, api-keys, logs, chat, tunnel, oauth, code-switch, etc.)
- `services/proxy-server/` — Fastify HTTP proxy server (default `127.0.0.1:9527`)
  - `routes.ts` — Code Switch routes, provider passthrough routes, conversion proxy (Bridge) routes
  - `bridge-manager.ts` — Bridge instance LRU cache (max 50), adapter singleton map
- `services/database/` — SQLite with WAL mode, 12 migrations, 12 repositories
- `services/crypto/` — AES-256-GCM encryption for API keys
- `services/code-switch/` — CLI config detection, backup, and rewriting for Claude Code / Codex
- `services/tunnel/` — Cloudflare tunnel management via bundled cloudflared binary
- `services/oauth/` — OAuth2 flows for Codex/Antigravity providers, pool management

Renderer (`src/`):
- Pages: Chat, Dashboard, Providers, Proxies, CodeSwitch, OAuth, Tunnel, Tokens, Logs, Settings
- Stores: proxy, provider, bridge-proxy, chat, settings, i18n, updater (all Zustand)
- i18n: en-US and zh-CN with dynamic switching

## Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages (only packages/*, not apps)
pnpm build

# Run all tests via Nx
pnpm test

# Run tests for a specific package
pnpm --filter @amux.ai/llm-bridge test

# Test coverage (target: 80%+)
pnpm test:coverage

# Type check all packages
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Run basic example
cd examples/basic && pnpm start

# Documentation site dev
pnpm dev:website

# Desktop app dev (Electron + Vite HMR)
pnpm dev:desktop

# Desktop packaging
pnpm package:desktop:mac     # macOS
pnpm package:desktop:win     # Windows
pnpm package:desktop:linux   # Linux
```

## Architecture Layer Principles

```
┌─────────────────────────────────────────────────────────────┐
│  User Application Layer (HTTP/Protocol)                     │
│  - HTTP response handling                                   │
│  - Protocol markers (e.g., [DONE] for SSE)                  │
│  - Connection management                                    │
├─────────────────────────────────────────────────────────────┤
│  Bridge Layer (Orchestration)                               │
│  - Request/response flow orchestration                      │
│  - Model mapping (targetModel > modelMapper > modelMapping) │
│  - Capability validation between adapters                   │
│  - Hook system (onRequest, onResponse, onStreamEvent)       │
│  - Filters protocol markers like [DONE] from stream         │
│  - Deduplicates end events                                  │
├─────────────────────────────────────────────────────────────┤
│  Adapter Layer (Provider ↔ IR Conversion)                   │
│  - ONLY handles its own provider format ↔ IR                │
│  - NO cross-adapter logic or dependencies                   │
│  - Correctly expresses its own protocol format              │
│  - Provider-specific quirks handled here                    │
├─────────────────────────────────────────────────────────────┤
│  IR Layer (Intermediate Representation)                     │
│  - Unified data structures (provider-agnostic)              │
│  - Standard event types: start, content, reasoning,         │
│    tool_call, end, error                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Rules:**

1. **Adapter Isolation**: Each adapter ONLY knows about its own provider format. Never add logic in one adapter that handles another adapter's specifics.
2. **IR as Contract**: IR types are the contract between adapters. Features like `reasoning` are standard IR types, not provider-specific.
3. **Protocol vs IR**: Adapters correctly express their protocol (e.g., `finalize()` returns `[DONE]`), Bridge filters protocol details, user HTTP layer adds them back.
4. **Bridge for Common Logic**: Cross-adapter logic (like filtering `[DONE]`, deduplicating end events) belongs in Bridge, not duplicated across adapters.

## Bridge Flow (Non-Streaming)

1. Inbound adapter `parseRequest()` → `LLMRequestIR`
2. Model mapping applied
3. `onRequest` hook fires
4. Request validated, capabilities checked
5. Outbound adapter `buildRequest()` → provider request format
6. `HTTPClient.request()` → POST to provider API
7. Outbound adapter `parseResponse()` → `LLMResponseIR`
8. `onResponse` hook fires
9. Inbound adapter `buildResponse()` → original provider format response

## Bridge Flow (Streaming)

1. Same as steps 1-4 above, with `ir.stream = true`
2. Outbound adapter `buildRequest()` → provider request format
3. `HTTPClient.requestStream()` → SSE stream from provider API
4. `SSELineParser` extracts complete lines from chunked response
5. Outbound adapter `parseStream()` → `LLMStreamEvent[]`
6. Inbound adapter `createStreamBuilder().process()` → `SSEEvent[]` in inbound format
7. Bridge filters `[DONE]` from `finalize()` output (protocol concern)

## Key IR Types

```typescript
// packages/llm-bridge/src/ir/request.ts
interface LLMRequestIR {
  messages: Message[]
  model?: string
  tools?: Tool[]
  toolChoice?: ToolChoice
  stream?: boolean
  generation?: GenerationConfig  // temperature, maxTokens, thinking, etc.
  system?: string                // Extracted system prompt
  metadata?: Record<string, unknown>
  extensions?: Record<string, unknown>  // Provider-specific extensions
  raw?: unknown                  // Original request for debugging
}

// packages/llm-bridge/src/ir/stream.ts
type StreamEventType = 'start' | 'content' | 'reasoning' | 'tool_call' | 'end' | 'error'

// packages/llm-bridge/src/adapter/base.ts
interface LLMAdapter {
  readonly name: string
  readonly version: string
  readonly capabilities: AdapterCapabilities
  inbound: { parseRequest, parseResponse?, parseStream?, parseError? }
  outbound: { buildRequest, buildResponse?, buildStreamEvent?, createStreamBuilder? }
  getInfo(): AdapterInfo  // includes endpoint: { baseUrl, chatPath, modelsPath }
}
```

## Testing Guidelines

- **Framework:** Vitest
- **Location:** `packages/*/tests/*.test.ts`
- **Pattern:** Arrange-Act-Assert
- **Coverage target:** 80%+ (lines, functions, branches, statements)
- **Mocking:** Mock external API calls; test adapter conversion logic in isolation

## Build System

- **Nx**: Task orchestration with caching. Config in `nx.json`.
- **tsup**: TypeScript bundling for packages. Outputs ESM (.js), CJS (.cjs), .d.ts.
- **electron-vite**: Desktop app build (Vite for renderer, esbuild for main/preload).
- **electron-builder**: Desktop packaging (DMG/NSIS/AppImage).
- **TypeScript**: Strict mode. Shared config in `tsconfig.base.json`.

## Version Management

**NPM Packages:** Changesets (`pnpm changeset` → `pnpm changeset:version` → `pnpm changeset:publish`)

**Desktop App:** Git tag `desktop-v{version}` triggers GitHub Actions CI/CD (`release-desktop.yml`). Use `pnpm release` for the interactive release flow.

## Adding a New Adapter

1. Create `packages/adapter-{provider}/` with `package.json` depending on `@amux.ai/llm-bridge: workspace:*`
2. Define provider-specific types in `types.ts`
3. Implement `LLMAdapter` interface in `adapter.ts`
4. Implement inbound parsers: request, response, stream, error
5. Implement outbound builders: request, response, stream (StreamEventBuilder)
6. Declare `AdapterCapabilities`
7. Write tests in `tests/adapter.test.ts`
8. Export adapter singleton from `index.ts`
9. Register in Desktop's `bridge-manager.ts` ADAPTER_MAP if applicable
10. Update documentation (both `en/` and `zh/` in `apps/website/app/content/docs/`)

## Documentation Update Rules

When making changes to packages, always update corresponding documentation:

1. **Package changes** → Update `apps/website/app/content/docs/` (both `en/` and `zh/`)
2. **Adapter add/remove** → Update `index.mdx`, `installation.mdx`, `adapters/index.mdx`, create/delete adapter docs
3. **API changes** → Update `docs/*/api/` files
4. **New features** → Add to relevant concept docs and examples

Documentation is bilingual (English and Chinese). Always update both.

## Common Pitfalls

- **Streaming:** Always set `ir.stream = true` when building streaming requests
- **Type Safety:** Validate `unknown` types from provider APIs before casting
- **Capabilities:** Bridge checks adapter capabilities — ensure they're declared correctly
- **Adapter Endpoint:** Each adapter defines its own `baseURL` and `chatPath` in `getInfo().endpoint`
- **SSE Format:** Streaming uses SSE with `data: {...}` lines; use `SSELineParser` for chunked parsing
- **Gemini chatPath:** Contains `{model}` placeholder that Bridge replaces
- **DeepSeek reasoner:** Skips system messages and `reasoning_content` in input for reasoner models
- **Anthropic format:** Uses `tool_use`/`tool_result` content blocks, not `tool_calls`; role is `user`/`assistant` only
- **Zero dependencies:** Core package must not add runtime dependencies

## Desktop-Specific Notes

- Desktop bundles all `@amux.ai/*` workspace packages (not externalized) via electron-vite config
- SQLite database at `{userData}/amux.db` with WAL mode
- API keys encrypted with AES-256-GCM; master key stored via `safeStorage`
- Proxy server routes: `/code/claudecode/v1/messages` (Code Switch), `/providers/{path}/*` (passthrough), `/proxies/{path}/*` (Bridge conversion)
- Bridge instances are LRU-cached (max 50) in `bridge-manager.ts`
- Code Switch modifies CLI config files (Claude Code: `~/.claude/`, Codex: config TOML) and backs up originals to database
