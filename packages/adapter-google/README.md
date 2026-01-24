# @amux.ai/adapter-google

> Google Gemini adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-google.svg)](https://www.npmjs.com/package/@amux.ai/adapter-google)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official Google Gemini adapter for Amux. Gemini API is OpenAI-compatible, so this adapter extends the OpenAI adapter with Gemini-specific configurations.

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-google
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-google
```

## Usage

### As Inbound Adapter

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { geminiAdapter } from '@amux.ai/adapter-google'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inbound: geminiAdapter,
  outbound: openaiAdapter,
  config: {
    apiKey: process.env.OPENAI_API_KEY
  }
})
```

### As Outbound Adapter

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { geminiAdapter } from '@amux.ai/adapter-google'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: geminiAdapter,
  config: {
    apiKey: process.env.GOOGLE_API_KEY
  }
})

const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

## Supported Features

- ✅ Chat completions
- ✅ Streaming
- ✅ Function/Tool calling
- ✅ Vision (image inputs)
- ✅ System prompts

## Supported Models

- `gemini-2.0-flash-exp`
- `gemini-exp-1206`
- `gemini-2.0-flash-thinking-exp-01-21`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

## API Compatibility

Gemini API is OpenAI-compatible. For detailed API documentation, see [Gemini API Documentation](https://ai.google.dev/docs).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
