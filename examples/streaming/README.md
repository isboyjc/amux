# Streaming Example

This example demonstrates streaming responses with LLM Bridge.

## Setup

```bash
pnpm install
```

## Environment Variables

```bash
cp .env.example .env
# Edit .env and add your API keys
```

## Run

```bash
pnpm start
```

## What it does

Shows how to use streaming with different adapters:
- OpenAI → Anthropic (streaming)
- Anthropic → OpenAI (streaming)
- Real-time token-by-token output
