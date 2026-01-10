/**
 * Retry mechanism with exponential backoff
 */

import { getSettingsRepository } from '../database/repositories'

export interface RetryConfig {
  enabled: boolean
  maxRetries: number
  retryDelay: number
  retryOn: number[]
  backoffMultiplier: number
}

/**
 * Get retry config from settings
 */
export function getRetryConfig(): RetryConfig {
  const settings = getSettingsRepository()
  
  return {
    enabled: settings.get('proxy.retry.enabled') ?? true,
    maxRetries: settings.get('proxy.retry.maxRetries') ?? 3,
    retryDelay: settings.get('proxy.retry.retryDelay') ?? 1000,
    retryOn: settings.get('proxy.retry.retryOn') ?? [429, 500, 502, 503, 504],
    backoffMultiplier: 2
  }
}

/**
 * Check if status code should trigger retry
 */
export function shouldRetry(statusCode: number, config: RetryConfig): boolean {
  return config.enabled && config.retryOn.includes(statusCode)
}

/**
 * Calculate delay for a specific retry attempt
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: delay * multiplier^attempt
  return config.retryDelay * Math.pow(config.backoffMultiplier, attempt)
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  const retryConfig = { ...getRetryConfig(), ...config }
  
  if (!retryConfig.enabled) {
    return fn()
  }
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if we should retry
      const statusCode = (error as { statusCode?: number }).statusCode
      
      if (
        attempt < retryConfig.maxRetries &&
        statusCode !== undefined &&
        shouldRetry(statusCode, retryConfig)
      ) {
        const delay = calculateDelay(attempt, retryConfig)
        console.log(`[Retry] Attempt ${attempt + 1}/${retryConfig.maxRetries}, waiting ${delay}ms`)
        
        onRetry?.(attempt + 1, lastError)
        
        await sleep(delay)
      } else {
        break
      }
    }
  }
  
  throw lastError
}

/**
 * Create a retry wrapper for a specific function
 */
export function createRetryWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config?: Partial<RetryConfig>
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), config)
  }) as T
}
