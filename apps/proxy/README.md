# Amux Proxy

A proxy server that converts Anthropic API requests to DeepSeek API requests using the Amux package.

## Purpose

This proxy allows you to use DeepSeek as a backend while using Anthropic-compatible clients (like Claude Code). It validates the Amux package's bidirectional conversion capabilities.

## Quick Start

```bash
# Start the proxy server
pnpm start

# Or with custom port
PORT=8080 pnpm start

# Or with custom target model
TARGET_MODEL=deepseek-reasoner pnpm start
```

## Usage with Claude Code

1. Start the proxy server:
   ```bash
   cd apps/proxy
   pnpm start
   ```

2. Configure Claude Code environment:
   ```bash
   export ANTHROPIC_BASE_URL=http://localhost:3000
   export ANTHROPIC_API_KEY=<your-deepseek-api-key>
   ```

3. Run Claude Code as usual - requests will be proxied to DeepSeek.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `TARGET_MODEL` | `deepseek-chat` | DeepSeek model to use |

## Model Mapping

The proxy automatically maps Anthropic model names to DeepSeek models:

| Anthropic Model | DeepSeek Model |
|-----------------|----------------|
| `claude-3-opus-*` | `deepseek-chat` |
| `claude-3-sonnet-*` | `deepseek-chat` |
| `claude-3-haiku-*` | `deepseek-chat` |
| `claude-3-5-sonnet-*` | `deepseek-chat` |
| `claude-3-5-haiku-*` | `deepseek-chat` |
| `claude-sonnet-4-*` | `deepseek-chat` |
| `claude-opus-4-5-*` | `deepseek-reasoner` |

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and bridge configuration.

### Messages (Anthropic-compatible)
```
POST /v1/messages
```

Accepts Anthropic API format requests and proxies them to DeepSeek.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  Proxy Server   │────▶│  DeepSeek API   │
│  (Anthropic)    │◀────│     (Amux)      │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
   Anthropic            IR (Intermediate           DeepSeek
   Format               Representation)            Format
```

## Development

```bash
# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build
```
