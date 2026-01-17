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
