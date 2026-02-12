# Amux

[English](./README.md) | [中文](./README_ZH.md)

> Bidirectional LLM API Adapter — Unified infrastructure for converting between LLM provider APIs, plus a desktop app for zero-code proxy management.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

## Overview

Amux is a bidirectional LLM API adapter ecosystem with two core components:

- **LLM Bridge SDK** — A zero-dependency TypeScript library that converts between different LLM provider API formats using an Intermediate Representation (IR) pattern. Send an OpenAI-format request and have it seamlessly call Claude, DeepSeek, Gemini, or any other supported provider under the hood.
- **Amux Desktop** — A cross-platform Electron desktop application that wraps the SDK into a full-featured local proxy server with GUI management, Code Switch for CLI tools, Cloudflare tunnel integration, and more.

## Features

**SDK**
- Bidirectional conversion between any combination of 8 LLM provider API formats
- Full TypeScript support with comprehensive type definitions
- Zero runtime dependencies in the core package
- Streaming support (SSE) with unified event types
- Tool calling, vision/multimodal, reasoning content support
- Extensible adapter architecture — add custom providers easily

**Desktop App**
- Local LLM API proxy server with GUI (Fastify on `127.0.0.1:9527`)
- Provider management — configure API keys, endpoints, and models for 8+ providers
- Bridge proxies — format conversion routes with model mapping
- Provider passthrough — direct proxy without format conversion
- Code Switch — redirect Claude  Code and Codex CLI to any LLM provider with model mapping
- OAuth account pools — round-robin/quota-aware selection for Codex and Antigravity providers
- Cloudflare Tunnel — expose the local proxy to the internet via bundled cloudflared
- Built-in chat interface for testing providers through the proxy
- Dashboard with real-time metrics, request logging, and token usage analytics
- API key encryption (AES-256-GCM) and authentication for the proxy
- Bilingual UI (English / Chinese)
- Cross-platform: macOS, Windows, Linux

## Quick Start

### SDK Usage

```bash
# Install core package and the adapters you need
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai @amux.ai/adapter-anthropic
```

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

// Create a bridge: OpenAI format in -> Anthropic API out
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com'
  }
})

// Send OpenAI-format request, get OpenAI-format response
// Actually calls Claude API under the hood
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})

console.log(response.choices[0].message.content)
```

### Desktop App

Download the latest release from [GitHub Releases](https://github.com/isboyjc/amux/releases), or build from source:

```bash
git clone https://github.com/isboyjc/amux.git
cd amux
pnpm install
pnpm dev:desktop
```

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [@amux.ai/llm-bridge](./packages/llm-bridge) | Core IR, adapter interface, Bridge, HTTPClient | Stable |
| [@amux.ai/adapter-openai](./packages/adapter-openai) | OpenAI Chat Completions + Responses API | Stable |
| [@amux.ai/adapter-anthropic](./packages/adapter-anthropic) | Anthropic (Claude) Messages API | Stable |
| [@amux.ai/adapter-deepseek](./packages/adapter-deepseek) | DeepSeek (with reasoning support) | Stable |
| [@amux.ai/adapter-moonshot](./packages/adapter-moonshot) | Moonshot / Kimi (with reasoning support) | Stable |
| [@amux.ai/adapter-qwen](./packages/adapter-qwen) | Qwen (with thinking, web search) | Stable |
| [@amux.ai/adapter-google](./packages/adapter-google) | Google Gemini (native format) | Stable |
| [@amux.ai/adapter-zhipu](./packages/adapter-zhipu) | Zhipu AI / GLM (with web search) | Stable |
| [@amux.ai/adapter-minimax](./packages/adapter-minimax) | MiniMax (with reasoning support) | Stable |
| [@amux.ai/utils](./packages/utils) | Shared utilities (SSE parsing, error handling) | Stable |

## Architecture

The SDK uses an Intermediate Representation (IR) pattern to decouple provider formats:

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
└────────────────────┬────────────────────────────────────┘
                     │ Provider A format request
                     v
┌─────────────────────────────────────────────────────────┐
│                   Inbound Adapter                        │
│              (Parse Provider A -> IR)                    │
└────────────────────┬────────────────────────────────────┘
                     │ Intermediate Representation (IR)
                     v
┌─────────────────────────────────────────────────────────┐
│                      Bridge                              │
│    (Model mapping, validation, hooks, orchestration)     │
└────────────────────┬────────────────────────────────────┘
                     │ IR
                     v
┌─────────────────────────────────────────────────────────┐
│                  Outbound Adapter                        │
│              (IR -> Build Provider B)                    │
└────────────────────┬────────────────────────────────────┘
                     │ Provider B format request
                     v
┌─────────────────────────────────────────────────────────┐
│                  Provider B API                           │
└─────────────────────────────────────────────────────────┘
```

Any inbound adapter can pair with any outbound adapter, enabling N x N provider combinations.

## Amux Desktop

Amux Desktop is a cross-platform Electron application that provides a complete GUI for managing LLM API proxy services.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Electron 33 |
| Build Tool | electron-vite + Vite 6 |
| Packaging | electron-builder |
| UI | React 18 + shadcn/ui + Tailwind CSS 3 |
| State Management | Zustand 5 |
| HTTP Server | Fastify 5 |
| Database | SQLite (better-sqlite3, WAL mode) |
| Encryption | AES-256-GCM (Node.js crypto + Electron safeStorage) |
| Charts | Recharts |

### Features in Detail

#### Provider Management

Configure and manage multiple LLM providers with encrypted API key storage, connection testing, and model list fetching. Supported providers: OpenAI, Anthropic, DeepSeek, Moonshot, Qwen, Google Gemini, Zhipu, MiniMax, and any custom OpenAI-compatible endpoint.

#### Bridge Proxies

Create format-conversion proxy routes. For example, accept requests in OpenAI format and forward them to Anthropic's API with automatic format conversion. Configure model mapping rules (e.g., `gpt-4` -> `claude-sonnet-4-20250514`) per proxy route. Proxy chaining is supported with circular dependency detection.

#### Provider Passthrough

Direct proxy to any configured provider without format conversion — useful for centralizing API key management or adding logging.

#### Code Switch

Redirect CLI tools like **Claude  Code** and **Codex** to use any LLM provider through Amux:

- Automatically detects CLI config files (`~/.claude/` for Claude  Code, Codex TOML configs)
- Backs up original configurations to the database before modification
- Configures the CLI to route API requests through the local Amux proxy
- Model mapping editor — map CLI model names to target provider models
- Switch providers dynamically without re-editing CLI configs
- Restore original configs on disable

#### OAuth Account Pools

Manage OAuth accounts for Codex and Antigravity providers with pool-based routing:

- OAuth authorization flow with local callback server
- Multiple selection strategies: round-robin, least-used, quota-aware
- Token refresh and quota tracking
- Auto-creates pool provider for authorized accounts

#### Cloudflare Tunnel

Expose the local proxy server to the internet via Cloudflare Tunnel:

- Bundled cloudflared binary (multi-platform)
- One-click tunnel start/stop with status monitoring
- External URL display for remote access
- Access and system logs

#### Dashboard & Monitoring

- Real-time proxy metrics: total requests, success rate, average latency, RPM
- Time series charts for request volume and token usage
- Full request/response logging with filtering, export (JSON/CSV), and retention management

#### API Token Management

- Create named API keys (prefixed `sk-amux.`) for proxy authentication
- Enable/disable/rename/delete tokens
- Internal requests (built-in chat) bypass authentication

#### Additional Features

- Config import/export (encrypted with PBKDF2)
- Auto-launch at system startup
- Version update checker via GitHub releases
- Google Analytics 4 (optional, anonymous)
- Bilingual UI (English / Chinese) with dynamic switching

### Proxy Server Routes

The Desktop app runs a Fastify HTTP server with these route categories:

| Route Pattern | Purpose |
|---------------|---------|
| `POST /code/claudecode/v1/messages` | Code Switch for Claude  Code |
| `POST /providers/{proxy_path}/*` | Provider passthrough |
| `GET /providers/{proxy_path}/v1/models` | Provider model listing |
| `POST /proxies/{proxy_path}/*` | Bridge conversion proxy |
| `GET /proxies/{proxy_path}/v1/models` | Proxy model listing |
| `GET /health` | Health check |
| `GET /` | Status page (HTML) |

### Building from Source

```bash
# Prerequisites: Node.js >= 18, pnpm >= 8

git clone https://github.com/isboyjc/amux.git
cd amux
pnpm install

# Development mode (with HMR)
pnpm dev:desktop

# Package for current platform
pnpm package:desktop:mac       # macOS (DMG)
pnpm package:desktop:win       # Windows (NSIS + ZIP)
pnpm package:desktop:linux     # Linux (AppImage + DEB)

# Platform-specific variants
pnpm package:desktop:mac:arm64     # macOS Apple Silicon
pnpm package:desktop:mac:x64       # macOS Intel
pnpm package:desktop:win:arm64     # Windows ARM
```

## SDK Examples

### Streaming

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

### Tool Calling

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

### Model Mapping

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

### All Adapters

```typescript
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { qwenAdapter } from '@amux.ai/adapter-qwen'
import { googleAdapter } from '@amux.ai/adapter-google'
import { zhipuAdapter } from '@amux.ai/adapter-zhipu'
import { minimaxAdapter } from '@amux.ai/adapter-minimax'

// Any combination works: inbound x outbound
```

## Use Cases

- **Multi-Provider Support** — Build applications that work with multiple LLM providers through a single interface
- **Provider Migration** — Switch from one provider to another without changing application code
- **Cost Optimization** — Route requests to different providers based on cost/performance
- **Fallback Strategy** — Implement automatic fallback to alternative providers
- **CLI Tool Routing** — Use Code Switch to route Claude  Code or Codex through any LLM provider
- **API Gateway** — Run a local or public proxy that handles auth, logging, and format conversion

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Test with coverage
pnpm test:coverage

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Run examples
cd examples/basic && pnpm start
cd examples/streaming && pnpm start

# Documentation site
pnpm dev:website
pnpm build:website
```

## Monorepo Structure

```
amux/
├── packages/
│   ├── llm-bridge/           # Core: IR, Adapter interface, Bridge, HTTPClient
│   ├── utils/                # Shared utilities
│   ├── adapter-openai/       # OpenAI adapter (Chat Completions + Responses API)
│   ├── adapter-anthropic/    # Anthropic adapter
│   ├── adapter-deepseek/     # DeepSeek adapter
│   ├── adapter-moonshot/     # Moonshot/Kimi adapter
│   ├── adapter-qwen/         # Qwen adapter
│   ├── adapter-google/       # Google Gemini adapter
│   ├── adapter-zhipu/        # Zhipu/GLM adapter
│   └── adapter-minimax/      # MiniMax adapter
├── apps/
│   ├── desktop/              # Electron desktop app
│   ├── website/              # Documentation site (Fumadocs)
│   ├── proxy/                # Standalone Express proxy server
│   └── tunnel-api/           # Cloudflare Workers tunnel API
└── examples/
    ├── basic/                # Basic usage example
    └── streaming/            # Streaming example
```

## Release Process

### NPM Packages

```bash
pnpm changeset              # Describe your changes
pnpm changeset:version      # Update versions and CHANGELOG
git add . && git commit -m "chore: bump package versions"
git push
pnpm --filter "./packages/**" build
pnpm changeset:publish      # Publish to npm
git push --tags
```

### Desktop App

```bash
# Use the interactive release script
pnpm release

# Triggers GitHub Actions to build installers for macOS, Windows, Linux
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style guidelines, and the pull request process.

## License

MIT (c) [isboyjc](https://github.com/isboyjc)

## Acknowledgments

Inspired by:
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [LiteLLM](https://github.com/BerriAI/litellm)
