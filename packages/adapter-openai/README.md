# @amux.ai/adapter-openai

> OpenAI adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-openai.svg)](https://www.npmjs.com/package/@amux.ai/adapter-openai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official OpenAI adapter for Amux, providing bidirectional conversion between OpenAI API format and Amux IR (Intermediate Representation).

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-openai
```

## Usage

### As Inbound Adapter (Parse OpenAI format)

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

### As Outbound Adapter (Call OpenAI API)

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

## Supported Features

- ✅ Chat completions
- ✅ Streaming
- ✅ Function/Tool calling
- ✅ Vision (image inputs)
- ✅ System prompts
- ✅ JSON mode
- ✅ Logprobs
- ✅ Seed

## API Compatibility

This adapter supports the OpenAI Chat Completions API format. For detailed API documentation, see [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
