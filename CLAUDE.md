# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amux is a bidirectional LLM API adapter that enables seamless conversion between different LLM provider APIs. It uses an Intermediate Representation (IR) pattern to convert between any provider format (OpenAI, Anthropic, DeepSeek, Moonshot, Qwen, Google Gemini, Zhipu, MiniMax).

**Key Architecture**: Provider Format → Inbound Adapter → IR → Outbound Adapter → Target Provider Format

## Development Commands

```bash
# Build all packages (excludes apps)
pnpm build

# Build specific package
cd packages/llm-bridge && pnpm build

# Run all tests (via Nx)
pnpm test

# Run tests for a specific package
pnpm --filter @amux.ai/llm-bridge test
cd packages/llm-bridge && pnpm test

# Watch mode
cd packages/llm-bridge && pnpm test:watch

# Coverage (target: 80%+)
pnpm test:coverage

# Type check / lint / format
pnpm typecheck
pnpm lint
pnpm format

# Documentation site
pnpm dev:website
pnpm build:website

# Desktop app
pnpm dev:desktop
pnpm build:desktop
pnpm package:desktop          # current platform
pnpm package:desktop:mac:arm64 # specific platform

# Examples
pnpm dev:example
pnpm dev:example:streaming

# Changesets (version management)
pnpm changeset
pnpm changeset:version
pnpm changeset:publish
```

## Monorepo Structure

pnpm workspace monorepo orchestrated by Nx:

- **packages/llm-bridge**: Core IR definitions, adapter interfaces, bridge orchestration, HTTP client (`@amux.ai/llm-bridge`)
- **packages/utils**: Shared utilities — SSE stream parsing, error handling (`@amux.ai/utils`)
- **packages/adapter-{provider}**: Official adapters: `openai`, `anthropic`, `deepseek`, `moonshot`, `qwen`, `google`, `zhipu`, `minimax`
- **apps/desktop**: Electron + React desktop app (see section below)
- **apps/website**: Documentation site (fumadocs, bilingual EN/ZH)
- **apps/proxy**: Proxy server for testing
- **apps/tunnel-api**: Tunnel API service
- **examples/**: Usage examples (basic, streaming)

Build tooling: Nx for task orchestration/caching, tsup for bundling packages (ESM + CJS + .d.ts), TypeScript strict mode.

## Core Architecture

### Layer Separation

```
User Application Layer  — HTTP response handling, SSE [DONE] markers, connection mgmt
Bridge Layer            — Orchestration, model mapping, cross-adapter compat checks, common logic
Adapter Layer           — Provider ↔ IR conversion ONLY, no cross-adapter awareness
IR Layer                — Unified provider-agnostic data structures
```

**Key Rules:**

1. **Adapter Isolation**: Each adapter ONLY knows about its own provider format. Never add logic in one adapter that handles another adapter's specifics.
2. **IR as Contract**: IR types (`packages/llm-bridge/src/ir/`) are the contract between adapters. Features like `reasoning` are standard IR types, not provider-specific.
3. **Protocol vs IR**: Protocol-level concerns (like `[DONE]` SSE marker) are expressed by adapters but filtered by Bridge. Users handle protocol markers in the HTTP layer.
4. **Bridge for Common Logic**: Any logic that applies across multiple adapters belongs in Bridge (`packages/llm-bridge/src/bridge/bridge.ts`), not duplicated in each adapter.

### Bridge Flow

1. Inbound adapter parses incoming request → IR
2. Validate IR (optional)
3. Outbound adapter builds provider request from IR
4. HTTP client sends request to target provider
5. Outbound adapter parses response → IR
6. Inbound adapter builds final response from IR

### Adapter Interface

Every adapter implements `LLMAdapter` (defined in `packages/llm-bridge/src/adapter/base.ts`):
- **inbound**: parseRequest, parseResponse, parseStream, parseError
- **outbound**: buildRequest, buildResponse
- **capabilities**: Feature flags checked by Bridge for compatibility
- **getInfo()**: Metadata including endpoint baseURL and chatPath

OpenAI-compatible providers (DeepSeek, Moonshot, Qwen, Zhipu, MiniMax) extend the OpenAI adapter with minimal customization.

### IR Extension Points

- `extensions` field: Provider-specific features that don't map to unified IR (`extensions?: { [provider: string]: unknown }`)
- `raw` field: Preserves original request/response for debugging

## Desktop App (`apps/desktop`)

Electron 33 + React 18 + TypeScript desktop application.

**Tech stack**: electron-vite, Fastify (local proxy server), better-sqlite3, Zustand, React Router v7, shadcn/ui + TailwindCSS, i18n localization.

**Structure**:
- `electron/main.ts` — Main process entry
- `electron/services/` — Backend services (database, proxy-server, crypto, tunnel, updater, etc.)
- `electron/ipc/` — IPC handlers between main/renderer
- `src/pages/` — React pages (Dashboard, Providers, Proxies, Settings, Tokens, Logs, Tunnel, Chat)
- `src/stores/` — Zustand state stores
- `src/locales/` — i18n translations

**Native modules**: Run `cd apps/desktop && pnpm rebuild` after install if better-sqlite3 has issues.

## Adding a New Adapter

1. Create `packages/adapter-{provider}/` with `src/` (adapter.ts, types.ts, inbound/, outbound/) and `tests/`
2. Implement `LLMAdapter` interface with inbound parsers, outbound builders, and capabilities
3. For OpenAI-compatible providers, extend the OpenAI adapter instead of implementing from scratch
4. Add tests (`packages/adapter-{provider}/tests/adapter.test.ts`)

## Common Pitfalls

- **Streaming**: Set `ir.stream = true` in chatStream method
- **Adapter Endpoint**: Each adapter defines its own baseURL and chatPath in `getInfo().endpoint`
- **SSE Format**: Streaming responses use SSE format with `data: {...}` lines
- **Zero Dependencies**: Core package has zero runtime dependencies — keep it that way

## Testing

- Framework: Vitest (config at `vitest.config.ts`)
- Test files: `packages/*/tests/*.test.ts`
- Coverage target: 80%+
- Mock external API calls in unit tests

## Documentation Update Rules

**IMPORTANT**: When making changes to packages, always update the corresponding documentation:

1. **Package Changes** → Update `apps/website/app/content/docs/` (both `en/` and `zh/` directories)
2. **Adapter Rename/Add/Remove** → Update:
   - `docs/en/index.mdx` and `docs/zh/index.mdx` (provider list)
   - `docs/en/installation.mdx` and `docs/zh/installation.mdx` (install commands)
   - `docs/*/adapters/index.mdx` (adapter overview)
   - Create/rename/delete adapter-specific doc files
3. **API Changes** → Update `docs/*/api/` files
4. **New Features** → Add to relevant concept docs and examples

Documentation is bilingual (English and Chinese). Always update both language versions.
