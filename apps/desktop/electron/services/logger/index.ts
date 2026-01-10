/**
 * Request logger service with buffered writes
 */

import { getRequestLogRepository, getSettingsRepository } from '../database/repositories'
import type { CreateLogDTO } from '../database/repositories/request-log'

// Buffer configuration
const FLUSH_INTERVAL = 5000   // 5 seconds
const MAX_BUFFER_SIZE = 100   // Flush when buffer reaches this size

// Log buffer
const logBuffer: CreateLogDTO[] = []
let flushTimer: NodeJS.Timeout | null = null

/**
 * Initialize the logger service
 */
export function initLogger(): void {
  // Start periodic flush
  startFlushTimer()
  console.log('[Logger] Initialized')
}

/**
 * Shutdown the logger service
 */
export function shutdownLogger(): void {
  // Flush remaining logs
  flush()
  
  // Stop timer
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  
  console.log('[Logger] Shutdown')
}

/**
 * Start the flush timer
 */
function startFlushTimer(): void {
  if (flushTimer) {
    return
  }
  
  flushTimer = setInterval(() => {
    flush()
  }, FLUSH_INTERVAL)
}

/**
 * Flush buffered logs to database
 */
function flush(): void {
  if (logBuffer.length === 0) {
    return
  }
  
  const settings = getSettingsRepository()
  const logsEnabled = settings.get('logs.enabled') ?? true
  
  if (!logsEnabled) {
    logBuffer.length = 0
    return
  }
  
  const repo = getRequestLogRepository()
  const logsToWrite = logBuffer.splice(0, logBuffer.length)
  
  try {
    for (const log of logsToWrite) {
      repo.insert(log)
    }
    
    console.log(`[Logger] Flushed ${logsToWrite.length} logs`)
  } catch (error) {
    console.error('[Logger] Flush failed:', error)
    // Re-add failed logs to buffer (at the beginning)
    logBuffer.unshift(...logsToWrite)
  }
}

/**
 * Log a request
 */
export function logRequest(data: CreateLogDTO): void {
  const settings = getSettingsRepository()
  const logsEnabled = settings.get('logs.enabled') ?? true
  
  if (!logsEnabled) {
    return
  }
  
  // Check body size limits
  const maxBodySize = settings.get('logs.maxBodySize') ?? 10240
  const saveRequestBody = settings.get('logs.saveRequestBody') ?? false
  const saveResponseBody = settings.get('logs.saveResponseBody') ?? false
  
  const logData: CreateLogDTO = {
    ...data,
    requestBody: saveRequestBody && data.requestBody
      ? truncateBody(data.requestBody, maxBodySize)
      : undefined,
    responseBody: saveResponseBody && data.responseBody
      ? truncateBody(data.responseBody, maxBodySize)
      : undefined
  }
  
  // Add to buffer
  logBuffer.push(logData)
  
  // Flush if buffer is full
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flush()
  }
}

/**
 * Truncate body if it exceeds max size
 */
function truncateBody(body: string, maxSize: number): string {
  if (body.length <= maxSize) {
    return body
  }
  
  return body.substring(0, maxSize) + '...[truncated]'
}

/**
 * Clean up old logs based on retention policy
 */
export function cleanupOldLogs(): { deletedByDate: number; deletedByCount: number } {
  const settings = getSettingsRepository()
  const repo = getRequestLogRepository()
  
  const retentionDays = settings.get('logs.retentionDays') ?? 30
  const maxEntries = settings.get('logs.maxEntries') ?? 10000
  
  // Delete logs older than retention period
  const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
  const deletedByDate = repo.clearBefore(cutoffDate)
  
  // Delete excess logs
  const deletedByCount = repo.trimToMaxEntries(maxEntries)
  
  console.log(`[Logger] Cleanup: ${deletedByDate} by date, ${deletedByCount} by count`)
  
  return { deletedByDate, deletedByCount }
}

/**
 * Get buffer status
 */
export function getBufferStatus(): {
  size: number
  maxSize: number
  flushInterval: number
} {
  return {
    size: logBuffer.length,
    maxSize: MAX_BUFFER_SIZE,
    flushInterval: FLUSH_INTERVAL
  }
}

/**
 * Force flush the buffer
 */
export function forceFlush(): number {
  const count = logBuffer.length
  flush()
  return count
}
