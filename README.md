# Amux

> Bidirectional LLM API Adapter - A unified infrastructure for converting between different LLM provider APIs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

## 🌟 Features

- **🔄 Bidirectional Conversion**: Convert between any LLM provider API formats
- **🎯 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **🔌 Extensible**: Easy to add custom adapters for new providers
- **⚡ Zero Dependencies**: Core package has zero runtime dependencies
- **🧪 Well-Tested**: High test coverage with comprehensive test suites
- **📦 Tree-Shakable**: Optimized for modern bundlers
- **🚀 7 Official Adapters**: OpenAI, Anthropic, DeepSeek, Moonshot, Zhipu, Qwen, Gemini

## 🚀 Quick Start

### Installation

```bash
# Install core package and adapters you need
pnpm add @amux/llm-bridge @amux/adapter-openai @amux/adapter-anthropic
```

### Basic Usage

```typescript
import { createBridge } from '@amux/llm-bridge'
import { openaiAdapter } from '@amux/adapter-openai'
import { anthropicAdapter } from '@amux/adapter-anthropic'

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

## 📦 Packages

| Package | Description | Version | Status |
|---------|-------------|---------|--------|
| [@amux/llm-bridge](./packages/llm-bridge) | Core IR and adapter interfaces | - | ✅ Stable |
| [@amux/adapter-openai](./packages/adapter-openai) | OpenAI adapter | - | ✅ Stable |
| [@amux/adapter-anthropic](./packages/adapter-anthropic) | Anthropic (Claude) adapter | - | ✅ Stable |
| [@amux/adapter-deepseek](./packages/adapter-deepseek) | DeepSeek adapter | - | ✅ Stable |
| [@amux/adapter-moonshot](./packages/adapter-moonshot) | Moonshot (Kimi) adapter | - | ✅ Stable |
| [@amux/adapter-zhipu](./packages/adapter-zhipu) | Zhipu AI (GLM) adapter | - | ✅ Stable |
| [@amux/adapter-qwen](./packages/adapter-qwen) | Qwen adapter | - | ✅ Stable |
| [@amux/adapter-google](./packages/adapter-google) | Google Gemini adapter | - | ✅ Stable |
| [@amux/utils](./packages/utils) | Shared utilities | - | ✅ Stable |

## 🏗️ Architecture

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

## 🎯 Use Cases

- **Multi-Provider Support**: Build applications that work with multiple LLM providers
- **Provider Migration**: Easily migrate from one provider to another
- **Cost Optimization**: Route requests to different providers based on cost/performance
- **Fallback Strategy**: Implement automatic fallback to alternative providers
- **Testing**: Test your application with different providers without code changes

## 📚 Examples

### All Adapters

```typescript
import { createBridge } from '@amux/llm-bridge'
import { openaiAdapter } from '@amux/adapter-openai'
import { anthropicAdapter } from '@amux/adapter-anthropic'
import { deepseekAdapter } from '@amux/adapter-deepseek'
import { moonshotAdapter } from '@amux/adapter-moonshot'
import { qwenAdapter } from '@amux/adapter-qwen'
import { geminiAdapter } from '@amux/adapter-google'

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

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/llm-bridge && pnpm test

# Run tests with coverage
pnpm test:coverage
```

## 🛠️ Development

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

## 📊 Project Status

✅ **MVP Complete!**

- ✅ Core infrastructure
- ✅ 7 official adapters (OpenAI, Anthropic, DeepSeek, Moonshot, Zhipu, Qwen, Gemini)
- ✅ Bidirectional conversion
- ✅ Type-safe TypeScript
- ✅ Unit tests
- ✅ Working examples

## 🗺️ Roadmap

- [ ] Complete streaming support for all adapters
- [ ] Add more unit tests (target: 80%+ coverage)
- [ ] Create documentation site (fumadocs)
- [ ] Add integration tests
- [ ] Publish to npm
- [ ] Add more adapters (community contributions welcome!)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT © [isboyjc](https://github.com/isboyjc)

## 🙏 Acknowledgments

This project is inspired by the excellent work of:
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [LiteLLM](https://github.com/BerriAI/litellm)

---

**Made with ❤️ by the Amux team**
