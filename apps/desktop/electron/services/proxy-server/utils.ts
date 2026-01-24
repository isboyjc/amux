/**
 * Shared utilities for proxy server
 */

import type { FastifyRequest } from 'fastify'
import { getApiKeyRepository, getSettingsRepository } from '../database/repositories'
import { ProxyErrorCode } from './types'

// Platform key prefix
const PLATFORM_KEY_PREFIX = 'sk-amux.'

/**
 * Extract API key from request headers
 * Supports multiple formats:
 *   - Authorization: Bearer xxx (OpenAI style)
 *   - x-api-key: xxx (Anthropic style)
 *   - Authorization: xxx (raw)
 */
export function extractApiKey(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (auth) {
    if (auth.startsWith('Bearer ')) {
      return auth.slice(7)
    }
    return auth
  }
  
  const xApiKey = request.headers['x-api-key']
  if (xApiKey && typeof xApiKey === 'string') {
    return xApiKey
  }
  
  return null
}

/**
 * Check if a key is a platform key (starts with sk-amux.)
 */
export function isPlatformKey(apiKey: string): boolean {
  return apiKey.startsWith(PLATFORM_KEY_PREFIX)
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  const settingsRepo = getSettingsRepository()
  const enabled = settingsRepo.get('security.unifiedApiKey.enabled')
  return enabled === true
}

/**
 * Validate API key based on authentication mode
 * 
 * Auth disabled (default):
 *   - No key needed, use provider's configured key
 *   - Returns: { valid: true, usePlatformKey: false, usePassThrough: false }
 * 
 * Auth enabled:
 *   - Must provide a key
 *   - sk-amux.xxx → Platform key → validate and use provider's key
 *   - Other format → Pass-through key → use directly
 */
export function validateApiKey(apiKey: string | null): {
  valid: boolean
  usePlatformKey: boolean
  usePassThrough: boolean
  error?: string
} {
  const authEnabled = isAuthEnabled()
  
  // Auth disabled - no key needed
  if (!authEnabled) {
    return { valid: true, usePlatformKey: false, usePassThrough: false }
  }
  
  // Auth enabled - key is required
  if (!apiKey) {
    return {
      valid: false,
      usePlatformKey: false,
      usePassThrough: false,
      error: 'Authentication required. Provide an API key in Authorization header.'
    }
  }
  
  // Check if it's a platform key (sk-amux.xxx)
  if (isPlatformKey(apiKey)) {
    const apiKeyRepo = getApiKeyRepository()
    const key = apiKeyRepo.validateKey(apiKey)
    if (key) {
      apiKeyRepo.updateLastUsed(key.id)
      return { valid: true, usePlatformKey: true, usePassThrough: false }
    }
    return {
      valid: false,
      usePlatformKey: true,
      usePassThrough: false,
      error: 'Invalid or disabled platform API key.'
    }
  }
  
  // Other key format - pass-through mode
  return { valid: true, usePlatformKey: false, usePassThrough: true }
}

/**
 * Create error response in OpenAI or Anthropic format
 */
export function createErrorResponse(
  code: ProxyErrorCode,
  message: string,
  statusCode: number = 500,
  format: 'openai' | 'anthropic' = 'openai'
): { statusCode: number; body: unknown } {
  if (format === 'anthropic') {
    return {
      statusCode,
      body: {
        type: 'error',
        error: {
          type: code,
          message
        }
      }
    }
  }
  
  return {
    statusCode,
    body: {
      error: {
        message,
        type: 'api_error',
        code
      }
    }
  }
}

import * as fs from 'fs'
import * as path from 'path'

// Cache for presets to avoid repeated file reads
let presetsCache: any = null

/**
 * Get endpoint for adapter type from presets
 * Returns the endpoint template (may contain {model} placeholder for some adapters)
 * 
 * Note: This function loads from presets to avoid hardcoding adapter endpoints
 * Conversion proxies need this to determine inbound adapter endpoint
 */
export function getEndpointForAdapter(adapterType: string): string {
  try {
    // Load presets once and cache
    if (!presetsCache) {
      const presetsPath = path.join(__dirname, '../../../resources/presets/providers.json')
      presetsCache = JSON.parse(fs.readFileSync(presetsPath, 'utf-8'))
    }
    
    // Find preset by adapterType
    const preset = presetsCache.providers.find((p: any) => p.adapterType === adapterType)
    
    if (preset?.chatPath) {
      return preset.chatPath
    }
  } catch (error) {
    console.error('[Utils] Failed to load presets for endpoint:', error)
  }
  
  // Fallback to default OpenAI-compatible endpoint
  return '/v1/chat/completions'
}
