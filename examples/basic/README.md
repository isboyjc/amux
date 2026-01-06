# Basic Example

This example demonstrates the basic usage of LLM Bridge with OpenAI and Anthropic adapters.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set environment variables:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

3. Run the example:
```bash
pnpm start
```

## What it does

This example shows:
- **OpenAI → Anthropic**: Send OpenAI-format request, call Claude API, get OpenAI-format response
- **Anthropic → OpenAI**: Send Anthropic-format request, call OpenAI API, get Anthropic-format response

This validates the bidirectional conversion architecture.
