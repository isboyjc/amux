import { describe, it, expect } from 'vitest'
import { parseSSE, createSSE } from '../src/stream'

describe('Stream Utils', () => {
  describe('parseSSE', () => {
    it('should parse SSE format', () => {
      const chunk = 'data: {"type":"test"}\n\ndata: {"type":"test2"}\n\n'
      const events = parseSSE(chunk)

      expect(events).toHaveLength(2)
      expect(events[0]?.data).toBe('{"type":"test"}')
      expect(events[1]?.data).toBe('{"type":"test2"}')
    })

    it('should ignore [DONE] marker', () => {
      const chunk = 'data: {"type":"test"}\n\ndata: [DONE]\n\n'
      const events = parseSSE(chunk)

      expect(events).toHaveLength(1)
      expect(events[0]?.data).toBe('{"type":"test"}')
    })

    it('should handle empty chunks', () => {
      const chunk = ''
      const events = parseSSE(chunk)

      expect(events).toHaveLength(0)
    })

    it('should handle malformed SSE', () => {
      const chunk = 'invalid data\ndata: {"type":"test"}\n\n'
      const events = parseSSE(chunk)

      expect(events).toHaveLength(1)
      expect(events[0]?.data).toBe('{"type":"test"}')
    })
  })

  describe('createSSE', () => {
    it('should create SSE format', () => {
      const data = { type: 'test', content: 'hello' }
      const sse = createSSE(data)

      expect(sse).toBe('data: {"type":"test","content":"hello"}\n\n')
    })

    it('should handle complex objects', () => {
      const data = {
        type: 'content',
        delta: { text: 'hello' },
        nested: { deep: { value: 123 } },
      }
      const sse = createSSE(data)

      expect(sse).toContain('data: ')
      expect(sse).toContain('"type":"content"')
      expect(sse).toContain('\n\n')
    })
  })
})
