# AGENTS.md

This file provides guidance for AI agents (Claude  Code, GitHub Copilot, Cursor, Windsurf, etc.) working with the Amux codebase.

## What Is This Project?

Amux is a bidirectional LLM API adapter ecosystem consisting of:

1. **LLM Bridge SDK** (`packages/`) — TypeScript libraries for converting between LLM provider API formats via an Intermediate Representation (IR).
2. **Amux Desktop** (`apps/desktop/`) — Electron desktop app with a local proxy server for managing LLM providers and converting API formats.
3. **Documentation Site** (`apps/website/`) — Bilingual (en/zh) documentation built with Next.js + Fumadocs.

## Critical Rules

### Do Not Violate

1. **Adapter Isolation**: Each adapter (`packages/adapter-*`) ONLY knows about its own provider format. Never import or reference one adapter from another adapter.
2. **IR as Contract**: The Intermediate Representation (`packages/llm-bridge/src/ir/`) is the sole interface between adapters. All provider features must map to/from IR types.
3. **Zero Runtime Dependencies**: The core package (`@amux.ai/llm-bridge`) must have zero runtime dependencies. Only dev dependencies are allowed.
4. **Bilingual Documentation**: When updating any documentation in `apps/website/app/content/docs/`, always update both `en/` and `zh/` versions.
5. **No Business Code Changes for Docs**: When the task is documentation-only, do not modify any TypeScript source code in `packages/` or `apps/`.

### Architecture Constraints

- **Bridge handles common logic**: Cross-adapter concerns (filtering `[DONE]` markers, deduplicating end events, model mapping) belong in the Bridge class, not in individual adapters.
- **Adapters express their protocol correctly**: An adapter's `finalize()` should return `[DONE]` if its protocol requires it. The Bridge filters this before yielding to the user. The user's HTTP layer adds it back.
- **All adapters are standalone**: No adapter extends another adapter's class. Each implements the `LLMAdapter` interface independently, even if the API is OpenAI-compatible.

## Repository Map

```
amux/
├── packages/
│   ├── llm-bridge/           # Core package: IR, Adapter interface, Bridge, HTTPClient
│   │   └── src/
│   │       ├── ir/            # LLMRequestIR, LLMResponseIR, LLMStreamEvent, LLMErrorIR
│   │       ├── adapter/       # LLMAdapter interface, AdapterCapabilities, AdapterRegistry
│   │       ├── bridge/        # Bridge class, createBridge(), HTTPClient, BridgeConfig
│   │       ├── types/         # Message, Tool, ToolChoice, GenerationConfig
│   │       ├── utils/         # SSELineParser, content/error/usage helpers
│   │       └── errors/        # APIError, NetworkError, TimeoutError, etc.
│   ├── utils/                 # SSE string parsing, error normalization
│   ├── adapter-openai/        # OpenAI Chat Completions + Responses API
│   ├── adapter-anthropic/     # Anthropic Messages API (native format)
│   ├── adapter-deepseek/      # DeepSeek (OpenAI-compat + reasoning_content)
│   ├── adapter-moonshot/      # Moonshot/Kimi (OpenAI-compat + reasoning_content)
│   ├── adapter-qwen/          # Qwen (OpenAI-compat + thinking, search)
│   ├── adapter-google/        # Google Gemini (native format, auto-detects OpenAI)
│   ├── adapter-minimax/       # MiniMax (OpenAI-compat + reasoning_details)
│   └── adapter-zhipu/         # Zhipu/GLM (OpenAI-compat + web search)
├── apps/
│   ├── desktop/               # Electron app
│   │   ├── electron/          # Main process: IPC handlers, services
│   │   │   ├── main.ts        # App entry, initialization sequence
│   │   │   ├── ipc/           # 14 IPC handler groups
│   │   │   └── services/      # proxy-server, database, crypto, code-switch, tunnel, oauth
│   │   └── src/               # Renderer: React 18 + shadcn/ui + Zustand
│   │       ├── pages/         # Chat, Dashboard, Providers, Proxies, CodeSwitch, etc.
│   │       ├── stores/        # Zustand stores
│   │       └── components/    # UI components
│   ├── website/               # Next.js + Fumadocs docs site
│   │   └── app/content/docs/  # en/ and zh/ bilingual docs
│   ├── proxy/                 # Express proxy server
│   └── tunnel-api/            # Cloudflare Workers tunnel API
├── examples/                  # basic/ and streaming/ usage examples
├── CLAUDE.md                  # Detailed architecture reference (read this first)
├── nx.json                    # Nx build config
├── tsconfig.base.json         # Shared TS config (strict, ES2022)
└── vitest.config.ts           # Test config (80% coverage threshold)
```

## Quick Reference: Key Interfaces

### LLMAdapter (every adapter implements this)

```typescript
// packages/llm-bridge/src/adapter/base.ts
interface LLMAdapter {
  readonly name: string
  readonly version: string
  readonly capabilities: AdapterCapabilities

  inbound: {
    parseRequest(request: unknown): LLMRequestIR
    parseResponse?(response: unknown): LLMResponseIR
    parseStream?(chunk: unknown): LLMStreamEvent | LLMStreamEvent[] | null
    parseError?(error: unknown): LLMErrorIR
  }

  outbound: {
    buildRequest(ir: LLMRequestIR): unknown
    buildResponse?(ir: LLMResponseIR): unknown
    createStreamBuilder?(): StreamEventBuilder
  }

  getInfo(): AdapterInfo
}
```

### LLMRequestIR (the core data contract)

```typescript
// packages/llm-bridge/src/ir/request.ts
interface LLMRequestIR {
  messages: Message[]
  model?: string
  tools?: Tool[]
  toolChoice?: ToolChoice
  stream?: boolean
  generation?: GenerationConfig
  system?: string
  extensions?: Record<string, unknown>
  raw?: unknown
}
```

### StreamEventType

```typescript
type StreamEventType = 'start' | 'content' | 'reasoning' | 'tool_call' | 'end' | 'error'
```

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (not apps)
pnpm test             # Run all tests
pnpm typecheck        # Type check everything
pnpm lint             # Lint everything
pnpm format           # Format code
pnpm dev:desktop      # Desktop app dev mode
pnpm dev:website      # Docs site dev mode
```

## Testing

- **Framework:** Vitest
- **Test files:** `packages/*/tests/*.test.ts`
- **Coverage target:** 80%+ on lines, functions, branches, statements
- **Pattern:** Arrange-Act-Assert
- **Run specific:** `pnpm --filter @amux.ai/adapter-openai test`

## Adapter-Specific Notes for Code Changes

| Adapter | Key Differences from OpenAI |
|---------|---------------------------|
| **anthropic** | Native format. `tool_use`/`tool_result` in content blocks, not `tool_calls`. Role is `user`/`assistant` only. System prompt is a top-level field. Finish reasons: `end_turn`, `max_tokens`, `tool_use`. |
| **deepseek** | `reasoning_content` field on messages/stream. Reasoner models: skip system messages, don't include `reasoning_content` in input. Cache tokens in usage. |
| **moonshot** | `reasoning_content` for `kimi-k2-thinking` model. Kimi-prefixed type names. |
| **qwen** | `enable_thinking` boolean, `enable_search` boolean. Extended multimodal: `input_audio`, `video`, `video_url`. |
| **google** | Completely different native format. Auto-detects OpenAI format via `isOpenAIFormat()`. Role `model` maps to `assistant`. `{model}` placeholder in chatPath. `functionDeclarations` instead of tool definitions. |
| **minimax** | `reasoning_details` (array of objects) instead of `reasoning_content` (string). `reasoning_split` flag. Temperature range (0, 1]. |
| **zhipu** | Additional fields: `do_sample`, `request_id`. `sensitive` finish reason maps to `content_filter`. |

## Common Tasks

### Adding a new adapter

See the "Adding a New Adapter" section in `CLAUDE.md` for the complete checklist (10 steps).

### Modifying an existing adapter

1. Update the relevant parser/builder files under `packages/adapter-{provider}/src/`
2. Update or add tests in `packages/adapter-{provider}/tests/`
3. Run `pnpm --filter @amux.ai/adapter-{provider} test`
4. Update docs in `apps/website/app/content/docs/en/adapters/{provider}.mdx` and `zh/` equivalent

### Modifying Bridge logic

1. Edit files in `packages/llm-bridge/src/bridge/`
2. Run `pnpm --filter @amux.ai/llm-bridge test`
3. Verify no adapter tests break: `pnpm test`

### Modifying Desktop app

1. Main process code: `apps/desktop/electron/`
2. Renderer code: `apps/desktop/src/`
3. Dev mode: `pnpm dev:desktop`
4. IPC channels are registered in `apps/desktop/electron/ipc/index.ts`
5. Proxy server routes are registered in `apps/desktop/electron/services/proxy-server/routes.ts`

### Updating documentation

1. Docs are in `apps/website/app/content/docs/{en,zh}/`
2. Always update both `en/` and `zh/` versions
3. Dev mode: `pnpm dev:website`
4. Site uses Fumadocs MDX format

## Files You Should Read First

For understanding the project architecture, read in this order:

1. `CLAUDE.md` — Full architecture reference, layer principles, common pitfalls
2. `packages/llm-bridge/src/ir/request.ts` — Core IR request type
3. `packages/llm-bridge/src/adapter/base.ts` — LLMAdapter interface
4. `packages/llm-bridge/src/bridge/bridge.ts` — Bridge orchestration logic
5. `packages/adapter-openai/src/adapter.ts` — Reference adapter implementation
6. `packages/adapter-anthropic/src/adapter.ts` — Non-OpenAI adapter example
