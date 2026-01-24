# @amux.ai/adapter-anthropic

> Anthropic (Claude) adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-anthropic.svg)](https://www.npmjs.com/package/@amux.ai/adapter-anthropic)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official Anthropic adapter for Amux, providing bidirectional conversion between Anthropic API format and Amux IR (Intermediate Representation).

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-anthropic
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-anthropic
```

## Usage

### As Inbound Adapter (Parse Anthropic format)

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: {
    apiKey: process.env.OPENAI_API_KEY
  }
})

// Send Anthropic format, receive Anthropic format
const response = await bridge.chat({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### As Outbound Adapter (Call Anthropic API)

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY
  }
})

// Send OpenAI format, receive OpenAI format
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

## Supported Features

- ✅ Messages API
- ✅ Streaming
- ✅ Tool calling
- ✅ Vision (image inputs)
- ✅ System prompts
- ✅ Thinking/Reasoning (extended thinking)

## Supported Models

- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

## API Compatibility

This adapter supports the Anthropic Messages API format. For detailed API documentation, see [Anthropic API Reference](https://docs.anthropic.com/en/api/messages).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
