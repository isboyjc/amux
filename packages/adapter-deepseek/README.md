# @amux.ai/adapter-deepseek

> DeepSeek adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-deepseek.svg)](https://www.npmjs.com/package/@amux.ai/adapter-deepseek)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official DeepSeek adapter for Amux. DeepSeek API is OpenAI-compatible, so this adapter extends the OpenAI adapter with DeepSeek-specific configurations.

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-deepseek
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-deepseek
```

## Usage

### As Inbound Adapter

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inbound: deepseekAdapter,
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
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: deepseekAdapter,
  config: {
    apiKey: process.env.DEEPSEEK_API_KEY
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
- ✅ System prompts
- ✅ JSON mode

## Supported Models

- `deepseek-chat`
- `deepseek-reasoner`

## API Compatibility

DeepSeek API is OpenAI-compatible. For detailed API documentation, see [DeepSeek API Documentation](https://platform.deepseek.com/docs).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
