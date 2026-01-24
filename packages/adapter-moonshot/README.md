# @amux.ai/adapter-moonshot

> Moonshot AI (Kimi) adapter for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/adapter-moonshot.svg)](https://www.npmjs.com/package/@amux.ai/adapter-moonshot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Official Moonshot AI (Kimi) adapter for Amux. Moonshot API is OpenAI-compatible, so this adapter extends the OpenAI adapter with Moonshot-specific configurations.

## Installation

```bash
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-moonshot
# or
npm install @amux.ai/llm-bridge @amux.ai/adapter-moonshot
```

## Usage

### As Inbound Adapter

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inbound: moonshotAdapter,
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
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'

const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: moonshotAdapter,
  config: {
    apiKey: process.env.MOONSHOT_API_KEY
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

## Supported Models

- `moonshot-v1-8k`
- `moonshot-v1-32k`
- `moonshot-v1-128k`

## API Compatibility

Moonshot API is OpenAI-compatible. For detailed API documentation, see [Moonshot AI Documentation](https://platform.moonshot.cn/docs).

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
