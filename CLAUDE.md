# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Bridge is a bidirectional LLM API adapter that enables seamless conversion between different LLM provider APIs. It uses an Intermediate Representation (IR) pattern to convert between any provider format (OpenAI, Anthropic, DeepSeek, Kimi, Qwen, Gemini).

**Key Architecture**: Provider Format → Inbound Adapter → IR → Outbound Adapter → Target Provider Format

## Development Commands

### Build
```bash
# Build all packages
pnpm build

# Build specific package
cd packages/core && pnpm build

# Watch mode for development
cd packages/core && pnpm dev
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/core && pnpm test
pnpm --filter @llm-bridge/core test

# Watch mode
cd packages/core && pnpm test:watch

# Coverage (target: 80%+)
pnpm test:coverage
cd packages/core && pnpm test:coverage
```

**Test Status:**
- ✅ Core package: All tests passing (18 tests)
- ✅ OpenAI adapter: All tests passing
- ✅ Anthropic adapter: All tests passing
- ✅ DeepSeek adapter: All tests passing
- ⚠️ Gemini adapter: Tests failing (request parsing, stream parsing issues)
- ⚠️ Kimi adapter: Tests failing (system message handling, stream parsing)
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

## Monorepo Structure

This is a pnpm workspace monorepo managed by Nx:

- **packages/core**: Core IR definitions, adapter interfaces, bridge orchestration, HTTP client
- **packages/utils**: Shared utilities (SSE stream parsing, error handling)
- **packages/adapter-{provider}**: Official adapters (openai, anthropic, deepseek, kimi, qwen, gemini)
- **apps/website**: Documentation site (fumadocs)
- **examples/**: Usage examples

## Core Architecture Concepts

### Intermediate Representation (IR)

The IR is the central data structure that all adapters convert to/from. Key types:

- **LLMRequestIR**: Unified request format with messages, tools, generation config, system prompt, metadata, extensions
- **LLMResponseIR**: Unified response format with content, tool calls, usage stats
- **LLMStreamEvent**: Unified streaming event format
- **LLMErrorIR**: Unified error format

Location: `packages/core/src/ir/`

### Adapter Interface

Every adapter implements the `LLMAdapter` interface with:

- **inbound**: Parse provider format → IR (parseRequest, parseResponse, parseStream, parseError)
- **outbound**: Build IR → provider format (buildRequest, buildResponse)
- **capabilities**: Feature flags (streaming, tools, vision, etc.)
- **getInfo()**: Adapter metadata

Location: `packages/core/src/adapter/base.ts`

### Bridge Pattern

The Bridge class orchestrates the conversion flow:

1. Inbound adapter parses incoming request → IR
2. Validate IR (optional)
3. Outbound adapter builds provider request from IR
4. Send HTTP request to target provider API
5. Outbound adapter parses response → IR
6. Inbound adapter builds final response from IR

Location: `packages/core/src/bridge/bridge.ts`

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
│   │   └── response-builder.ts
│   └── index.ts
├── tests/
│   └── adapter.test.ts
└── package.json
```

**OpenAI-compatible adapters** (DeepSeek, Kimi, Qwen, Gemini) extend the OpenAI adapter with minimal customization.

## Key Implementation Details

### HTTP Client

Location: `packages/core/src/bridge/http-client.ts`

- Handles both regular and streaming requests
- Supports custom headers, timeout, base URL
- SSE (Server-Sent Events) parsing for streaming

### Adapter Registry

Location: `packages/core/src/adapter/registry.ts`

- Optional registry for managing multiple adapters
- Not required for basic bridge usage

### Capabilities System

Location: `packages/core/src/adapter/capabilities.ts`

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

The core package has zero runtime dependencies. Only dev dependencies for building and testing.

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
- **Base URLs**: Each provider has different base URLs and endpoints (see Bridge.getDefaultBaseURL)
- **SSE Format**: Streaming responses use SSE format with `data: {...}` lines

## Known Issues

### Gemini Adapter
- **Request Parsing**: Tests expect OpenAI format but Gemini uses `contents` instead of `messages`
- **Stream Parsing**: Stream parser returns null for all events (not implemented correctly)
- **Tool Format**: Gemini uses different tool format than OpenAI
- **Capabilities**: Test expects `toolChoice: false` but adapter declares `toolChoice: true`

### Kimi Adapter
- **System Messages**: OpenAI adapter doesn't extract system messages from messages array
- **Stream Parsing**: Stream parser returns null (likely using OpenAI format which doesn't match test expectations)

### Qwen Adapter
- **System Messages**: Same issue as Kimi - system messages not extracted properly
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
- PROJECT_SUMMARY.md: Detailed project status and architecture
- Documentation site: fumadocs-based site in `apps/website/`
