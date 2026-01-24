# @amux.ai/llm-bridge

> Core IR (Intermediate Representation) and adapter interfaces for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/llm-bridge.svg)](https://www.npmjs.com/package/@amux.ai/llm-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@amux.ai/llm-bridge` is the core package of Amux that provides:

- **Intermediate Representation (IR)**: Unified data structures for LLM requests/responses
- **Adapter Interface**: Standard interface for building provider adapters
- **Bridge Pattern**: Orchestration layer for bidirectional conversion
- **HTTP Client**: Built-in HTTP client with SSE streaming support
- **Zero Dependencies**: No runtime dependencies

## Installation

```bash
pnpm add @amux.ai/llm-bridge
# or
npm install @amux.ai/llm-bridge
# or
yarn add @amux.ai/llm-bridge
```

## Quick Start

### Create a Bridge

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com'
  }
})

// Send request in OpenAI format, get response in OpenAI format
// But actually calls Anthropic API under the hood
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### Streaming

```typescript
for await (const chunk of bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
})) {
  console.log(chunk)
}
```

## Core Concepts

### Intermediate Representation (IR)

The IR is the central data structure that all adapters convert to/from:

- **LLMRequestIR**: Unified request format
- **LLMResponseIR**: Unified response format
- **LLMStreamEvent**: Unified streaming events
- **LLMErrorIR**: Unified error format

### Adapter Interface

Every adapter implements the `LLMAdapter` interface:

```typescript
interface LLMAdapter {
  inbound: {
    parseRequest(request: unknown): Promise<LLMRequestIR>
    parseResponse(response: unknown): Promise<LLMResponseIR>
    parseStream(chunk: string): Promise<LLMStreamEvent | null>
    parseError(error: unknown): LLMErrorIR
  }
  outbound: {
    buildRequest(ir: LLMRequestIR): unknown
    buildResponse(ir: LLMResponseIR): unknown
  }
  capabilities: AdapterCapabilities
  getInfo(): AdapterInfo
}
```

### Bridge Pattern

The Bridge orchestrates the conversion flow:

1. Inbound adapter parses incoming request → IR
2. Validate IR (optional)
3. Outbound adapter builds provider request from IR
4. Send HTTP request to target provider
5. Outbound adapter parses response → IR
6. Inbound adapter builds final response from IR

## API Reference

### `createBridge(options)`

Create a new bridge instance.

**Options:**
- `inbound` - Inbound adapter instance
- `outbound` - Outbound adapter instance
- `config` - Configuration object
  - `apiKey` - API key for the outbound provider
  - `baseURL` - Base URL for the outbound provider (optional)
  - `timeout` - Request timeout in milliseconds (optional)
  - `headers` - Additional HTTP headers (optional)

**Returns:** `Bridge` instance

### `bridge.chat(request)`

Send a chat completion request.

**Parameters:**
- `request` - Request object in inbound adapter format

**Returns:** `Promise<Response>` - Response in inbound adapter format

### `bridge.chatStream(request)`

Send a streaming chat completion request.

**Parameters:**
- `request` - Request object in inbound adapter format with `stream: true`

**Returns:** `AsyncIterable<string>` - Server-Sent Events stream

## Available Adapters

- [@amux.ai/adapter-openai](https://www.npmjs.com/package/@amux.ai/adapter-openai) - OpenAI
- [@amux.ai/adapter-anthropic](https://www.npmjs.com/package/@amux.ai/adapter-anthropic) - Anthropic (Claude)
- [@amux.ai/adapter-deepseek](https://www.npmjs.com/package/@amux.ai/adapter-deepseek) - DeepSeek
- [@amux.ai/adapter-moonshot](https://www.npmjs.com/package/@amux.ai/adapter-moonshot) - Moonshot (Kimi)
- [@amux.ai/adapter-zhipu](https://www.npmjs.com/package/@amux.ai/adapter-zhipu) - Zhipu AI (GLM)
- [@amux.ai/adapter-qwen](https://www.npmjs.com/package/@amux.ai/adapter-qwen) - Qwen
- [@amux.ai/adapter-google](https://www.npmjs.com/package/@amux.ai/adapter-google) - Google Gemini

## TypeScript Support

This package is written in TypeScript and provides full type definitions.

```typescript
import type { 
  LLMRequestIR, 
  LLMResponseIR, 
  LLMAdapter,
  Bridge 
} from '@amux.ai/llm-bridge'
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](https://github.com/isboyjc/amux/blob/main/CONTRIBUTING.md).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
- [Changelog](./CHANGELOG.md)
