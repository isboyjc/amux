# @amux.ai/adapter-zhipu

> Zhipu AI (GLM) adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-zhipu.svg)](https://www.npmjs.com/package/@amux.ai/adapter-zhipu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official Zhipu AI (GLM) adapter for Amux. Zhipu API is OpenAI-compatible, so this adapter extends the OpenAI adapter with Zhipu-specific configurations.

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-zhipu
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-zhipu
```

## Usage

### As Inbound Adapter

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { zhipuAdapter } from '@amux.ai/adapter-zhipu'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inbound: zhipuAdapter,
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
import { zhipuAdapter } from '@amux.ai/adapter-zhipu'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: zhipuAdapter,
  config: {
    apiKey: process.env.ZHIPU_API_KEY
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
- ✅ Web search

## Supported Models

- `glm-4-plus`
- `glm-4-0520`
- `glm-4-air`
- `glm-4-airx`
- `glm-4-flash`
- `glm-4v-plus`
- `glm-4v`

## API Compatibility

Zhipu API is OpenAI-compatible. For detailed API documentation, see [Zhipu AI Documentation](https://open.bigmodel.cn/dev/api).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
