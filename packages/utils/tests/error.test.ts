import { describe, it, expect } from 'vitest'
import { LLMBridgeError, normalizeError } from '../src/error'

describe('Error Utils', () => {
  describe('LLMBridgeError', () => {
    it('should create error with message', () => {
      const error = new LLMBridgeError('Test error')

      expect(error.message).toBe('Test error')
      expect(error.name).toBe('LLMBridgeError')
    })

    it('should create error with code and status', () => {
      const error = new LLMBridgeError('Test error', 'TEST_CODE', 400)

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.status).toBe(400)
    })

    it('should create error with details', () => {
      const error = new LLMBridgeError(
        'Test error',
        'TEST_CODE',
        400,
        { field: 'value' }
      )

      expect(error.details).toEqual({ field: 'value' })
    })
  })

  describe('normalizeError', () => {
    it('should normalize LLMBridgeError', () => {
      const error = new LLMBridgeError('Test error', 'TEST_CODE', 400)
      const normalized = normalizeError(error)

      expect(normalized.message).toBe('Test error')
      expect(normalized.code).toBe('TEST_CODE')
      expect(normalized.status).toBe(400)
    })

    it('should normalize standard Error', () => {
      const error = new Error('Standard error')
      const normalized = normalizeError(error)

      expect(normalized.message).toBe('Standard error')
      expect(normalized.code).toBeUndefined()
      expect(normalized.status).toBeUndefined()
    })

    it('should normalize string error', () => {
      const error = 'String error'
      const normalized = normalizeError(error)

      expect(normalized.message).toBe('String error')
    })

    it('should normalize unknown error', () => {
      const error = { custom: 'error' }
      const normalized = normalizeError(error)

      expect(normalized.message).toBe('[object Object]')
    })
  })
})
