# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI agents when working with code in this repository.

## Project Overview

Amux is a **bidirectional LLM API adapter** that enables seamless conversion between different LLM provider APIs. It uses an Intermediate Representation (IR) pattern to convert between any provider format (OpenAI, Anthropic, DeepSeek, Moonshot, Qwen, Gemini, MiniMax, Zhipu).

The project also includes **Amux Desktop**, a desktop application that provides a GUI for managing LLM API proxies, OAuth account pooling, tunnels, and more.

**Key Architecture**: `Provider Format → Inbound Adapter → IR → Outbound Adapter → Target Provider Format`

## Project Structure

This is a **pnpm workspace monorepo** managed by Nx:

```
amux/
├── packages/                    # Core packages (published to npm)
│   ├── llm-bridge/             # Core IR, adapter interfaces, Bridge orchestration
│   ├── utils/                   # Shared utilities (SSE parsing, error handling)
│   ├── adapter-openai/         # OpenAI adapter (base for most adapters)
│   ├── adapter-anthropic/      # Anthropic (Claude) adapter
│   ├── adapter-deepseek/       # DeepSeek adapter
│   ├── adapter-moonshot/       # Moonshot (Kimi) adapter
│   ├── adapter-qwen/           # Qwen adapter
│   ├── adapter-google/          # Google Gemini adapter
│   ├── adapter-minimax/        # MiniMax adapter
│   └── adapter-zhipu/           # Zhipu (ChatGLM) adapter
├── apps/                        # Applications
│   ├── website/                # Documentation site (Next.js + fumadocs)
│   ├── desktop/                # Amux Desktop (Electron app)
│   ├── proxy/                  # Proxy server for testing
│   └── tunnel-api/             # Cloudflare Workers for tunnel management
├── examples/                    # Usage examples
│   ├── basic/                  # Basic non-streaming example
│   └── streaming/              # Streaming example
└── scripts/                    # Build/release scripts
```

## Package Responsibilities

### Core Packages

| Package | Responsibility |
|---------|----------------|
| `packages/llm-bridge` | Core IR definitions, LLMAdapter interface, Bridge orchestration, HTTP client. **Zero runtime dependencies**. |
| `packages/utils` | Shared utilities: SSE stream parsing, error handling utilities |
| `packages/adapter-*` | Each adapter implements `LLMAdapter` interface to convert between provider format ↔ IR |

### Apps

| App | Responsibility |
|-----|----------------|
| `apps/website` | Documentation site built with Next.js and fumadocs (bilingual: English & Chinese) |
| `apps/desktop` | Amux Desktop - Electron-based desktop application for LLM API proxy management |
| `apps/proxy` | Simple proxy server for testing bidirectional LLM API conversion |
| `apps/tunnel-api` | Cloudflare Workers API for Amux Tunnel management |

## Development Commands

### Build
```bash
# Build all packages
pnpm build

# Build specific package
cd packages/llm-bridge && pnpm build

# Watch mode for development
cd packages/llm-bridge && pnpm dev
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/llm-bridge && pnpm test

# Watch mode
cd packages/llm-bridge && pnpm test:watch

# Coverage (target: 80%+)
pnpm test:coverage
```

**Test Status:**
- ✅ Core package (llm-bridge): All tests passing
- ✅ OpenAI adapter: All tests passing
- ✅ Anthropic adapter: All tests passing
- ✅ DeepSeek adapter: All tests passing
- ✅ Moonshot adapter: All tests passing
- ✅ Zhipu adapter: All tests passing
- ✅ MiniMax adapter: All tests passing
- ⚠️ Gemini adapter: Tests failing (request parsing, stream parsing issues)
- ⚠️ Qwen adapter: Tests failing (system message handling, vision content, stream parsing)

### Type Checking & Linting
```bash
# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Format code
pnpm format
pnpm format:check
```

### Examples
```bash
# Run basic example
pnpm dev:example
cd examples/basic && pnpm start

# Run streaming example
pnpm dev:example:streaming
```

### Documentation Site
```bash
# Development
pnpm dev:website

# Build
pnpm build:website

# Start production server
pnpm start:website
```

### Desktop Application
```bash
# Development
pnpm dev:desktop

# Build
pnpm build:desktop

# Package for distribution
pnpm package:desktop

# Package for specific platforms
pnpm package:desktop:mac      # macOS
pnpm package:desktop:win      # Windows
pnpm package:desktop:linux    # Linux
```

## Core Architecture Concepts

### Architecture Layer Principles

The project follows strict separation of concern across layers:

```
┌─────────────────────────────────────────────────────────────┐
│  User Application Layer (HTTP/Protocol)                     │
│  - HTTP response handling                                   │
│  - Protocol-specific markers (e.g., [DONE] for SSE)        │
│  - Connection management                                    │
├─────────────────────────────────────────────────────────────┤
│  Bridge Layer (Orchestration)                              │
│  - Request/response flow orchestration                    │
│  - Model mapping                                           │
│  - Cross-adapter compatibility checks                       │
│  - Generic/common logic shared across all adapters          │
│  - Filter out protocol-level details from adapters         │
├─────────────────────────────────────────────────────────────┤
│  Adapter Layer (Provider ↔ IR Conversion)                  │
│  - ONLY handles its own provider format ↔ IR conversion   │
│  - NO cross-adapter logic or dependencies                  │
│  - Correctly express its own protocol format               │
│  - Provider-specific quirks handled here                   │
├─────────────────────────────────────────────────────────────┤
│  IR Layer (Intermediate Representation)                     │
│  - Unified data structures                                 │
│  - Provider-agnostic                                       │
│  - Standard event types (start, content, reasoning, end)   │
└─────────────────────────────────────────────────────────────┘
```

**Key Rules:**

1. **Adapter Isolation**: Each adapter ONLY knows about its own provider format. Never add logic in one adapter that handles another adapter's specifics.

2. **IR as Contract**: IR types are the contract between adapters. Features like `reasoning` are standard IR types, not provider-specific.

3. **Protocol vs IR**: Protocol-level concerns (like `[DONE]` SSE marker) are expressed by adapters but filtered by Bridge. Adapters correctly represent their protocol, Bridge filters protocol details, users handle protocol markers in HTTP layer.

4. **Bridge for Common Logic**: Any logic that applies across multiple adapters belongs in Bridge, not duplicated in each adapter. This includes filtering protocol-level markers like `[DONE]`.

**Example - SSE [DONE] marker handling:**
- Adapter layer: `finalize()` returns `[DONE]` (correct protocol representation)
- Bridge layer: Filters out `[DONE]` before yielding to user (common logic)
- User HTTP layer: Adds `[DONE]` marker to HTTP response (protocol handling)

### Intermediate Representation (IR)

The IR is the central data structure that all adapters convert to/from. Key types:

- **LLMRequestIR**: Unified request format with messages, tools, generation config, system prompt, metadata, extensions
- **LLMResponseIR**: Unified response format with content, tool calls, usage stats
- **LLMStreamEvent**: Unified streaming event format
- **LLMErrorIR**: Unified error format

Location: `packages/llm-bridge/src/ir/`

### Adapter Interface

Every adapter implements the `LLMAdapter` interface with:

- **inbound**: Parse provider format → IR (parseRequest, parseResponse, parseStream, parseError)
- **outbound**: Build IR → provider format (buildRequest, buildResponse)
- **capabilities**: Feature flags (streaming, tools, vision, etc.)
- **getInfo()**: Adapter metadata

Location: `packages/llm-bridge/src/adapter/base.ts`

### Bridge Pattern

The Bridge class orchestrates the conversion flow:

1. Inbound adapter parses incoming request → IR
2. Validate IR (optional)
3. Outbound adapter builds provider request from IR
4. Send HTTP request to target provider API
5. Outbound adapter parses response → IR
6. Inbound adapter builds final response from IR

Location: `packages/llm-bridge/src/bridge/bridge.ts`

## Adapter Structure

Each adapter follows this structure:

```
packages/adapter-{provider}/
├── src/
│   ├── adapter.ts           # Main adapter implementation
│   ├── types.ts             # Provider-specific types
│   ├── inbound/
│   │   ├── request-parser.ts
│   │   ├── response-parser.ts
│   │   ├── stream-parser.ts
│   │   └── error-parser.ts
│   ├── outbound/
│   │   ├── request-builder.ts
│   │   ├── response-builder.ts
│   │   └── stream-builder.ts
│   └── index.ts
├── tests/
│   └── adapter.test.ts
└── package.json
```

**OpenAI-compatible adapters** (DeepSeek, Moonshot, Qwen, Gemini, MiniMax, Zhipu) extend the OpenAI adapter with minimal customization.

## Amux Desktop Application

The Desktop application (`apps/desktop`) is an Electron-based app that provides:

### Features
- **Provider Management**: Configure and manage multiple LLM providers
- **Proxy Management**: Create and manage API proxies with model mapping
- **Chat Interface**: Test LLM conversations directly in the app
- **OAuth Account Pooling**: Manage OAuth accounts for providers (e.g., Azure OpenAI)
- **Tunnel**: Create Cloudflare tunnels for remote access
- **Dashboard**: View usage statistics and analytics
- **Code Switch**: Dynamic CLI configuration management for switching between different model configurations

### Tech Stack
- **Frontend**: React, Tailwind CSS, Zustand (state management)
- **Backend**: Electron (main process), Fastify (local proxy server)
- **Database**: better-sqlite3 (local storage)
- **UI Components**: Radix UI, shadcn/ui

### Key Directories
- `apps/desktop/src/` - React frontend
- `apps/desktop/electron/` - Electron main process, IPC handlers, services

### Build Commands
```bash
pnpm dev:desktop          # Development mode
pnpm build:desktop        # Build
pnpm package:desktop      # Package for distribution
```

## Key Implementation Details

### HTTP Client

Location: `packages/llm-bridge/src/bridge/http-client.ts`

- Handles both regular and streaming requests
- Supports custom headers, timeout, base URL
- SSE (Server-Sent Events) parsing for streaming

### Adapter Registry

Location: `packages/llm-bridge/src/adapter/registry.ts`

- Optional registry for managing multiple adapters
- Not required for basic bridge usage

### Capabilities System

Location: `packages/llm-bridge/src/adapter/capabilities.ts`

Adapters declare capabilities:
- streaming, tools, vision, multimodal
- systemPrompt, toolChoice, reasoning
- webSearch, jsonMode, logprobs, seed

The Bridge checks compatibility between inbound/outbound adapters.

## Testing Guidelines

- Use Vitest for all tests
- Test files: `packages/*/tests/*.test.ts`
- Coverage target: 80%+ (lines, functions, branches, statements)
- Test structure: Arrange-Act-Assert pattern
- Mock external API calls in unit tests

## Build System

- **Nx**: Task orchestration and caching
- **tsup**: Fast TypeScript bundler for packages
- **TypeScript**: Strict mode enabled
- **Outputs**: ESM (.js), CJS (.cjs), and type definitions (.d.ts)

Build configuration: `nx.json`, `tsconfig.base.json`, individual `tsconfig.json` files

## Version Management

Uses Changesets for version management:

```bash
# Add a changeset
pnpm changeset

# Version packages
pnpm changeset:version

# Publish packages
pnpm changeset:publish
```

## Important Patterns

### Zero Dependencies

The core package (`llm-bridge`) has zero runtime dependencies. Only dev dependencies for building and testing.

### Extensions Field

The IR includes an `extensions` field for provider-specific features that don't map to the unified IR:

```typescript
extensions?: {
  [provider: string]: unknown
}
```

### Raw Field

The IR includes a `raw` field to preserve the original request/response for debugging:

```typescript
raw?: unknown
```

### Error Handling

All adapters should implement error parsing to convert provider-specific errors to `LLMErrorIR` format.

## Adding a New Adapter

1. Create package: `packages/adapter-{provider}/`
2. Implement `LLMAdapter` interface
3. Define provider-specific types
4. Implement inbound parsers (request, response, stream, error)
5. Implement outbound builders (request, response)
6. Declare capabilities
7. Add tests
8. Export from index.ts

For OpenAI-compatible providers, extend the OpenAI adapter instead of implementing from scratch.

## Common Pitfalls

- **Streaming**: Remember to set `ir.stream = true` in chatStream method
- **Type Safety**: Always validate unknown types from provider APIs
- **Capabilities**: Check adapter capabilities before using features
- **Adapter Endpoint**: Each adapter defines its own baseURL and chatPath in `getInfo().endpoint`
- **SSE Format**: Streaming responses use SSE format with `data: {...}` lines

## Known Issues

### Gemini Adapter
- **Request Parsing**: Tests expect OpenAI format but Gemini uses `contents` instead of `messages`
- **Stream Parsing**: Stream parser returns null for all events (not implemented correctly)
- **Tool Format**: Gemini uses different tool format than OpenAI
- **Capabilities**: Test expects `toolChoice: false` but adapter declares `toolChoice: true`

### Qwen Adapter
- **System Messages**: System messages not extracted properly
- **Vision Content**: Uses `image` type instead of `image_url` type
- **Content Format**: Doesn't serialize multipart content to JSON string like OpenAI adapter
- **Stream Parsing**: Stream parser returns null

**Root Cause**: These adapters claim to be OpenAI-compatible but have subtle differences in:
1. How they handle system messages (separate field vs in messages array)
2. Content format for vision/multipart messages
3. Stream event format
4. Tool/function calling format

**Fix Strategy**: Either update the adapters to handle these differences, or update the tests to match actual provider behavior.

## Documentation

- Main README: Project overview and quick start
- CONTRIBUTING.md: Development setup and contribution guidelines
- prompt.md: Project vision and architecture (Chinese)
- Documentation site: fumadocs-based site in `apps/website/`

### Documentation Update Rules

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
