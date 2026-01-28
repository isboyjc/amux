# @amux.ai/adapter-minimax

MiniMax adapter for Amux - bidirectional LLM API adapter.

## Features

- ✅ OpenAI-compatible API format
- ✅ Interleaved Thinking support (reasoning_details)
- ✅ Streaming support
- ✅ Function calling / Tool use
- ✅ System prompts
- ✅ JSON mode
- ✅ Temperature range validation (0.0, 1.0]

## Installation

```bash
pnpm add @amux.ai/adapter-minimax
```

## Usage

### Basic Example

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { minimaxAdapter } from '@amux.ai/adapter-minimax'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inboundAdapter: openaiAdapter,
  outboundAdapter: minimaxAdapter,
  apiKey: process.env.MINIMAX_API_KEY!,
})

const response = await bridge.chat({
  messages: [
    { role: 'user', content: 'Hello!' },
  ],
})

console.log(response.choices[0]?.message.content)
```

### Streaming with Interleaved Thinking

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { minimaxAdapter } from '@amux.ai/adapter-minimax'
import { openaiAdapter } from '@amux.ai/adapter-openai'

const bridge = createBridge({
  inboundAdapter: openaiAdapter,
  outboundAdapter: minimaxAdapter,
  apiKey: process.env.MINIMAX_API_KEY!,
})

// Enable reasoning split to get reasoning_details
const ir = openaiAdapter.inbound.parseRequest({
  model: 'MiniMax-M2.1',
  messages: [
    { role: 'user', content: 'Solve this complex problem...' },
  ],
  stream: true,
})

// Add reasoning_split extension
ir.extensions = {
  minimax: {
    reasoning_split: true,
  },
}

const stream = await bridge.chatStream(ir)

for await (const event of stream) {
  if (event.type === 'reasoning') {
    console.log('Thinking:', event.reasoning?.delta)
  } else if (event.type === 'content') {
    console.log('Content:', event.content?.delta)
  }
}
```

## Supported Models

- `MiniMax-M2.1` - Strong multilingual programming capabilities (output speed ~60 tps)
- `MiniMax-M2.1-lightning` - Lightning version: faster and more agile (output speed ~100 tps)
- `MiniMax-M2` - Designed for efficient coding and Agent workflows

## Capabilities

| Feature | Supported |
|---------|-----------|
| Streaming | ✅ |
| Tools | ✅ |
| Vision | ❌ |
| Multimodal | ❌ |
| System Prompt | ✅ |
| Tool Choice | ✅ |
| Reasoning | ✅ |
| Web Search | ❌ |
| JSON Mode | ✅ |
| Logprobs | ❌ |
| Seed | ❌ |

## API Endpoint

- **Base URL**: `https://api.minimaxi.com`
- **Chat Path**: `/v1/chat/completions`
- **Models Path**: `/v1/models`

## Special Features

### Interleaved Thinking

MiniMax M2.1 supports Interleaved Thinking through the `reasoning_details` field. To enable it:

1. Set `reasoning_split: true` in the request (via extensions)
2. The reasoning content will be separated into `reasoning_details` array
3. Each detail has `type: 'thinking'` and `text` fields

### Temperature Range

MiniMax has a strict temperature range of (0.0, 1.0]:

- Minimum: 0.01 (values ≤ 0.0 are clamped to 0.01)
- Maximum: 1.0 (values > 1.0 are clamped to 1.0)
- Recommended: 1.0

## Unsupported OpenAI Parameters

The following OpenAI parameters are not supported by MiniMax:

- `presence_penalty`
- `frequency_penalty`
- `logit_bias`
- `logprobs`
- `seed`
- `n` (only supports value 1)

## Documentation

For more information about MiniMax models:

- [MiniMax Text Generation Guide](https://platform.minimax.com/docs/guides/text-generation)
- [OpenAI API Compatibility](https://platform.minimax.com/docs/api-reference/text-openai-api)
- [MiniMax M2.1 Release](https://minimax.com/news/minimax-m21)

## License

MIT
