# @amux.ai/utils

> Shared utilities for Amux

[![npm version](https://img.shields.io/npm/v/@amux.ai/utils.svg)](https://www.npmjs.com/package/@amux.ai/utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@amux.ai/utils` provides shared utilities used across Amux packages, including SSE stream parsing, error handling, and more.

## Installation

```bash
pnpm add @amux.ai/utils
# or
npm install @amux.ai/utils
# or
yarn add @amux.ai/utils
```

## Features

- **SSE Parser**: Parse Server-Sent Events streams
- **Error Handler**: Unified error handling utilities
- **Type Guards**: TypeScript type guard utilities

## Usage

```typescript
import { parseSSE, createError } from '@amux.ai/utils'

// Parse SSE stream
const event = parseSSE('data: {"message": "hello"}\n\n')

// Create standardized error
const error = createError('API request failed', { statusCode: 500 })
```

## License

MIT © [isboyjc](https://github.com/isboyjc)

## Links

- [Documentation](https://github.com/isboyjc/amux#readme)
- [GitHub Repository](https://github.com/isboyjc/amux)
- [Issue Tracker](https://github.com/isboyjc/amux/issues)
