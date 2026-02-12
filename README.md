# Amux

> Bidirectional LLM API Adapter - A unified infrastructure for converting between different LLM provider APIs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

[English](./README.md) | [中文](./README_ZH.md)

## Features

- **Bidirectional Conversion**: Convert between any LLM provider API formats
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Extensible**: Easy to add custom adapters for new providers
- **Zero Dependencies**: Core package has zero runtime dependencies
- **Well-Tested**: High test coverage with comprehensive test suites
- **Tree-Shakable**: Optimized for modern bundlers
- **8 Official Adapters**: OpenAI, Anthropic, DeepSeek, Moonshot, Zhipu, Qwen, Gemini, MiniMax

## Quick Start

### Installation

```bash
# Install core package and adapters you need
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai @amux.ai/adapter-anthropic
```

### Basic Usage

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

// Create a bridge: OpenAI format in → Anthropic API out
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com'
  }
})

// Send OpenAI-format request, get OpenAI-format response
// But actually calls Claude API under the hood
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})

console.log(response.choices[0].message.content)
```

## Packages

| Package | Description | Version | Status |
|---------|-------------|---------|--------|
| [@amux.ai/llm-bridge](./packages/llm-bridge) | Core IR and adapter interfaces | - | Stable |
| [@amux.ai/adapter-openai](./packages/adapter-openai) | OpenAI adapter | - | Stable |
| [@amux.ai/adapter-anthropic](./packages/adapter-anthropic) | Anthropic (Claude) adapter | - | Stable |
| [@amux.ai/adapter-deepseek](./packages/adapter-deepseek) | DeepSeek adapter | - | Stable |
| [@amux.ai/adapter-moonshot](./packages/adapter-moonshot) | Moonshot (Kimi) adapter | - | Stable |
| [@amux.ai/adapter-zhipu](./packages/adapter-zhipu) | Zhipu AI (GLM) adapter | - | Stable |
| [@amux.ai/adapter-qwen](./packages/adapter-qwen) | Qwen adapter | - | Stable |
| [@amux.ai/adapter-google](./packages/adapter-google) | Google Gemini adapter | - | Stable |
| [@amux.ai/adapter-minimax](./packages/adapter-minimax) | MiniMax adapter | - | Stable |
| [@amux.ai/utils](./packages/utils) | Shared utilities | - | Stable |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
└────────────────────┬────────────────────────────────────┘
                     │ OpenAI Format Request
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Inbound Adapter                        │
│              (Parse OpenAI → IR)                         │
└────────────────────┬────────────────────────────────────┘
                     │ Intermediate Representation (IR)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      Bridge                              │
│         (Validation & Compatibility Check)               │
└────────────────────┬────────────────────────────────────┘
                     │ IR
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Outbound Adapter                        │
│              (IR → Build Anthropic)                      │
└────────────────────┬────────────────────────────────────┘
                     │ Anthropic Format Request
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Anthropic API                           │
└─────────────────────────────────────────────────────────┘
```

## Use Cases

- **Multi-Provider Support**: Build applications that work with multiple LLM providers
- **Provider Migration**: Easily migrate from one provider to another
- **Cost Optimization**: Route requests to different providers based on cost/performance
- **Fallback Strategy**: Implement automatic fallback to alternative providers
- **Testing**: Test your application with different providers without code changes

## Examples

### All Adapters

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { qwenAdapter } from '@amux.ai/adapter-qwen'
import { geminiAdapter } from '@amux.ai/adapter-google'

// OpenAI → Anthropic
const bridge1 = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: process.env.ANTHROPIC_API_KEY }
})

// Anthropic → DeepSeek
const bridge2 = createBridge({
  inbound: anthropicAdapter,
  outbound: deepseekAdapter,
  config: { apiKey: process.env.DEEPSEEK_API_KEY }
})

// Any combination works!
```

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

## Amux Desktop

Amux also provides a **desktop application** that brings all the bridge capabilities to a visual interface.

### Features

- **Provider Management**: Configure and manage multiple LLM providers with API keys
- **Proxy Management**: Create and manage API proxies with model mapping
- **Chat Interface**: Test LLM conversations directly in the app
- **OAuth Account Pooling**: Manage OAuth accounts for providers (e.g., Azure OpenAI)
- **Tunnel**: Create Cloudflare tunnels for remote access
- **Dashboard**: View usage statistics and analytics with charts
- **Code Switch**: Dynamic CLI configuration management for switching between different model configurations
- **Local Proxy Server**: Built-in Fastify server for local API proxying

### Download

Download the latest version from the [Releases](https://github.com/isboyjc/amux/releases) page.

### Build from Source

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

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/llm-bridge && pnpm test

# Run tests with coverage
pnpm test:coverage
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run example
cd examples/basic && pnpm start

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### Release Process

#### NPM Packages

For publishing npm packages, use the manual publish workflow:

```bash
# 1. Add changeset (describe your changes)
pnpm changeset

# 2. Update versions and generate CHANGELOG
pnpm changeset:version

# 3. Commit and push version updates
git add .
git commit -m "chore: bump package versions"
git push

# 4. Build packages
pnpm --filter "./packages/**" build

# 5. Publish to npm (requires npm login)
pnpm changeset:publish

# 6. Push generated tags
git push --tags
```

#### Desktop App

For releasing the Desktop application:

```bash
# Use the release script (recommended)
pnpm release

# Or manually create tag
git tag -a desktop-v0.2.1 -m "Release Desktop v0.2.1"
git push origin desktop-v0.2.1
```

The Desktop release will automatically trigger GitHub Actions to build installers for macOS, Windows, and Linux.

## Project Status

**MVP Complete!**

- Core infrastructure
- 8 official adapters (OpenAI, Anthropic, DeepSeek, Moonshot, Zhipu, Qwen, Gemini, MiniMax)
- Bidirectional conversion
- Type-safe TypeScript
- Unit tests
- Working examples
- Desktop application

## Roadmap

- Complete streaming support for all adapters
- Add more unit tests (target: 80%+ coverage)
- Create documentation site (fumadocs)
- Add integration tests
- Publish to npm
- Add more adapters (community contributions welcome!)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Acknowledgments

This project is inspired by the excellent work of:
- [Vercel AI SDK](https://sdk.vercel.ai/)

---

**Made with love by the Amux team**
