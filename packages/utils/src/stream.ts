/**
 * Parse SSE (Server-Sent Events) stream
 */
export function parseSSE(chunk: string): Array<{ data: string }> {
  const lines = chunk.split('\n')
  const events: Array<{ data: string }> = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data: ')) {
      const data = trimmed.slice(6)
      if (data !== '[DONE]') {
        events.push({ data })
      }
    }
  }

  return events
}

/**
 * Create SSE format string
 */
export function createSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}
