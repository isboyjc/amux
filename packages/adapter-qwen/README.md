# @amux.ai/adapter-qwen

> Qwen (Tongyi Qianwen) adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-qwen.svg)](https://www.npmjs.com/package/@amux.ai/adapter-qwen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official Qwen (Tongyi Qianwen) adapter for Amux. Qwen API is OpenAI-compatible, so this adapter extends the OpenAI adapter with Qwen-specific configurations.

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-qwen
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-qwen
```

## Usage

### As Inbound Adapter

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { qwenAdapter } from '@amux.ai/adapter-qwen'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inbound: qwenAdapter,
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
import { qwenAdapter } from '@amux.ai/adapter-qwen'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: qwenAdapter,
  config: {
    apiKey: process.env.QWEN_API_KEY
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

- `qwen-turbo`
- `qwen-plus`
- `qwen-max`
- `qwen-vl-plus`
- `qwen-vl-max`

## API Compatibility

Qwen API is OpenAI-compatible. For detailed API documentation, see [Qwen API Documentation](https://help.aliyun.com/zh/dashscope/).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
