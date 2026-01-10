/**
 * Logs IPC handlers
 */

import { ipcMain } from 'electron'
import { getRequestLogRepository } from '../services/database/repositories'
import { cleanupOldLogs } from '../services/logger'
import type { LogFilter, PaginationOptions } from '../../src/types/ipc'
import type { RequestLogRow } from '../services/database/types'

// Convert DB row to RequestLog object
function toLog(row: RequestLogRow) {
  return {
    id: row.id,
    proxyId: row.proxy_id ?? undefined,
    proxyPath: row.proxy_path,
    sourceModel: row.source_model,
    targetModel: row.target_model,
    statusCode: row.status_code,
    inputTokens: row.input_tokens ?? undefined,
    outputTokens: row.output_tokens ?? undefined,
    latencyMs: row.latency_ms,
    requestBody: row.request_body ?? undefined,
    responseBody: row.response_body ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at
  }
}

export function registerLogHandlers(): void {
  const repo = getRequestLogRepository()

  // Query logs with pagination
  ipcMain.handle('logs:query', async (_event, filter: LogFilter, pagination: PaginationOptions) => {
    const result = repo.query(filter, pagination)
    return {
      ...result,
      data: result.data.map(toLog)
    }
  })

  // Get log statistics
  ipcMain.handle('logs:get-stats', async (_event, filter?: LogFilter) => {
    return repo.getStats(filter || {})
  })

  // Export logs
  ipcMain.handle('logs:export', async (_event, filter: LogFilter, format: 'json' | 'csv') => {
    if (format === 'csv') {
      return repo.exportToCsv(filter)
    }
    return repo.exportToJson(filter)
  })

  // Clear logs
  ipcMain.handle('logs:clear', async (_event, before?: number) => {
    if (before) {
      return repo.clearBefore(before)
    }
    return repo.clearAll()
  })

  // Cleanup old logs
  ipcMain.handle('logs:cleanup', async () => {
    return cleanupOldLogs()
  })
}
