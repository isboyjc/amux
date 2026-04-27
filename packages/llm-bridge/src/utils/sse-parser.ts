/**
 * A parsed SSE event with all standard fields.
 */
export interface ParsedSSEEvent {
  /** The event type (from `event:` field). Defaults to 'message' per SSE spec. */
  event: string
  /** The data payload (from `data:` field). Multiple data lines are joined with newlines. */
  data: string
  /** The event ID (from `id:` field), if present. */
  id?: string
  /** The retry interval in ms (from `retry:` field), if present. */
  retry?: number
}

/**
 * Efficient SSE (Server-Sent Events) line parser
 * Handles incomplete chunks and extracts complete lines efficiently
 */
export class SSELineParser {
  private buffer: string = ''

  /**
   * Process a chunk of SSE data and extract complete lines
   * @param chunk - The data chunk to process
   * @returns Array of complete lines
   */
  processChunk(chunk: string): string[] {
    this.buffer += chunk
    return this.extractLines()
  }

  /**
   * Process a chunk and return fully parsed SSE events.
   * An SSE event is delimited by a blank line. This method collects
   * field lines and emits complete events when a blank line is encountered.
   */
  processChunkEvents(chunk: string): ParsedSSEEvent[] {
    const lines = this.processChunk(chunk)
    return SSELineParser.parseEvents(lines)
  }

  /**
   * Parse an array of lines into SSE events.
   * Blank lines delimit events per the SSE spec.
   */
  static parseEvents(lines: string[]): ParsedSSEEvent[] {
    const events: ParsedSSEEvent[] = []
    let eventType = 'message'
    let dataParts: string[] = []
    let id: string | undefined
    let retry: number | undefined

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '')

      // Blank line = dispatch event
      if (line === '') {
        if (dataParts.length > 0) {
          events.push({
            event: eventType,
            data: dataParts.join('\n'),
            ...(id !== undefined && { id }),
            ...(retry !== undefined && { retry }),
          })
        }
        // Reset for next event
        eventType = 'message'
        dataParts = []
        id = undefined
        retry = undefined
        continue
      }

      // Comment line
      if (line.startsWith(':')) continue

      // Parse field
      const colonIndex = line.indexOf(':')
      let field: string
      let value: string

      if (colonIndex === -1) {
        field = line
        value = ''
      } else {
        field = line.slice(0, colonIndex)
        // Remove optional single leading space after colon
        value = line[colonIndex + 1] === ' '
          ? line.slice(colonIndex + 2)
          : line.slice(colonIndex + 1)
      }

      switch (field) {
        case 'event':
          eventType = value
          break
        case 'data':
          dataParts.push(value)
          break
        case 'id':
          id = value
          break
        case 'retry': {
          const n = parseInt(value, 10)
          if (!isNaN(n)) retry = n
          break
        }
        // Unknown fields are ignored per spec
      }
    }

    return events
  }

  /**
   * Extract all complete lines from the buffer
   * Incomplete lines remain in the buffer
   * @private
   */
  private extractLines(): string[] {
    const lines: string[] = []
    let position = 0

    while (position < this.buffer.length) {
      const newlineIndex = this.buffer.indexOf('\n', position)

      if (newlineIndex === -1) {
        // No complete line found, keep remainder in buffer
        this.buffer = this.buffer.slice(position)
        break
      }

      // Extract line (excluding newline)
      const line = this.buffer.slice(position, newlineIndex)
      lines.push(line)
      position = newlineIndex + 1
    }

    // If we processed all lines, clear buffer
    if (position >= this.buffer.length) {
      this.buffer = ''
    }

    return lines
  }

  /**
   * Get any remaining data in the buffer and clear it
   * Call this when the stream ends to get the last incomplete line
   */
  flush(): string[] {
    if (this.buffer.length === 0) {
      return []
    }

    const lines = this.buffer.split('\n').filter((line) => line.length > 0)
    this.buffer = ''
    return lines
  }

  /**
   * Check if buffer has any remaining data
   */
  hasRemaining(): boolean {
    return this.buffer.length > 0
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = ''
  }
}
