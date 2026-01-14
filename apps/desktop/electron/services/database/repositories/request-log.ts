/**
 * Request log repository - CRUD operations for request logs
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '../index'
import type { RequestLogRow } from '../types'

export interface CreateLogDTO {
  proxyId?: string
  proxyPath: string
  sourceModel: string
  targetModel: string
  statusCode: number
  inputTokens?: number
  outputTokens?: number
  latencyMs: number
  requestBody?: string
  responseBody?: string
  error?: string
  source?: 'local' | 'tunnel'
}

export interface LogFilter {
  proxyId?: string
  proxyPath?: string
  statusCode?: number
  statusRange?: 'success' | 'error' | 'all'
  startDate?: number
  endDate?: number
  search?: string
}

export interface PaginationOptions {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface LogStats {
  totalRequests: number
  successRequests: number
  failedRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  averageLatency: number
}

export class RequestLogRepository {
  private get db() {
    return getDatabase()
  }

  /**
   * Insert a new log entry
   */
  insert(data: CreateLogDTO): RequestLogRow {
    const id = randomUUID()
    const now = Date.now()
    
    const stmt = this.db.prepare(`
      INSERT INTO request_logs (
        id, proxy_id, proxy_path, source_model, target_model,
        status_code, input_tokens, output_tokens, latency_ms,
        request_body, response_body, error, source, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      data.proxyId ?? null,
      data.proxyPath,
      data.sourceModel,
      data.targetModel,
      data.statusCode,
      data.inputTokens ?? null,
      data.outputTokens ?? null,
      data.latencyMs,
      data.requestBody ?? null,
      data.responseBody ?? null,
      data.error ?? null,
      data.source ?? 'local',
      now
    )
    
    return this.findById(id)!
  }

  /**
   * Find log by ID
   */
  findById(id: string): RequestLogRow | null {
    const stmt = this.db.prepare('SELECT * FROM request_logs WHERE id = ?')
    const result = stmt.get(id) as RequestLogRow | undefined
    return result ?? null
  }

  /**
   * Query logs with filters and pagination
   */
  query(
    filter: LogFilter = {},
    pagination: PaginationOptions = { page: 1, pageSize: 50 }
  ): PaginatedResult<RequestLogRow> {
    const conditions: string[] = []
    const values: unknown[] = []
    
    if (filter.proxyId) {
      conditions.push('proxy_id = ?')
      values.push(filter.proxyId)
    }
    
    if (filter.proxyPath) {
      conditions.push('proxy_path = ?')
      values.push(filter.proxyPath)
    }
    
    if (filter.statusCode) {
      conditions.push('status_code = ?')
      values.push(filter.statusCode)
    }
    
    if (filter.statusRange === 'success') {
      conditions.push('status_code >= 200 AND status_code < 300')
    } else if (filter.statusRange === 'error') {
      conditions.push('(status_code < 200 OR status_code >= 300)')
    }
    
    if (filter.startDate) {
      conditions.push('created_at >= ?')
      values.push(filter.startDate)
    }
    
    if (filter.endDate) {
      conditions.push('created_at <= ?')
      values.push(filter.endDate)
    }
    
    if (filter.search) {
      conditions.push('(source_model LIKE ? OR target_model LIKE ? OR proxy_path LIKE ?)')
      const searchPattern = `%${filter.search}%`
      values.push(searchPattern, searchPattern, searchPattern)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM request_logs ${whereClause}`)
    const countResult = countStmt.get(...values) as { count: number }
    const total = countResult.count
    
    // Calculate pagination
    const { page, pageSize } = pagination
    const offset = (page - 1) * pageSize
    const totalPages = Math.ceil(total / pageSize)
    
    // Get paginated data
    const dataStmt = this.db.prepare(`
      SELECT * FROM request_logs ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    const data = dataStmt.all(...values, pageSize, offset) as RequestLogRow[]
    
    return {
      data,
      total,
      page,
      pageSize,
      totalPages
    }
  }

  /**
   * Get recent logs
   */
  getRecent(limit: number = 10): RequestLogRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?
    `)
    return stmt.all(limit) as RequestLogRow[]
  }

  /**
   * Get log statistics
   */
  getStats(filter: LogFilter = {}): LogStats {
    const conditions: string[] = []
    const values: unknown[] = []
    
    if (filter.proxyId) {
      conditions.push('proxy_id = ?')
      values.push(filter.proxyId)
    }
    
    if (filter.startDate) {
      conditions.push('created_at >= ?')
      values.push(filter.startDate)
    }
    
    if (filter.endDate) {
      conditions.push('created_at <= ?')
      values.push(filter.endDate)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_requests,
        SUM(CASE WHEN status_code < 200 OR status_code >= 300 THEN 1 ELSE 0 END) as failed_requests,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(AVG(latency_ms), 0) as average_latency
      FROM request_logs ${whereClause}
    `)
    
    const result = stmt.get(...values) as {
      total_requests: number
      success_requests: number
      failed_requests: number
      total_input_tokens: number
      total_output_tokens: number
      average_latency: number
    }
    
    return {
      totalRequests: result.total_requests,
      successRequests: result.success_requests,
      failedRequests: result.failed_requests,
      totalInputTokens: result.total_input_tokens,
      totalOutputTokens: result.total_output_tokens,
      averageLatency: Math.round(result.average_latency)
    }
  }

  /**
   * Clear logs older than specified timestamp
   */
  clearBefore(timestamp: number): number {
    const stmt = this.db.prepare('DELETE FROM request_logs WHERE created_at < ?')
    const result = stmt.run(timestamp)
    return result.changes
  }

  /**
   * Clear logs exceeding max entries (keep most recent)
   */
  trimToMaxEntries(maxEntries: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM request_logs
      WHERE id NOT IN (
        SELECT id FROM request_logs
        ORDER BY created_at DESC
        LIMIT ?
      )
    `)
    const result = stmt.run(maxEntries)
    return result.changes
  }

  /**
   * Clear all logs
   */
  clearAll(): number {
    const stmt = this.db.prepare('DELETE FROM request_logs')
    const result = stmt.run()
    return result.changes
  }

  /**
   * Delete a single log entry
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM request_logs WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Get total count
   */
  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM request_logs')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * Get detailed time series data for dashboard chart
   */
  getTimeSeriesStats(hours: number = 24): Array<{
    timestamp: number
    proxyPath: string
    sourceModel: string
    targetModel: string
    inputTokens: number
    outputTokens: number
    latency: number
    success: boolean
  }> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    
    const stmt = this.db.prepare(`
      SELECT
        created_at as timestamp,
        proxy_path,
        source_model,
        target_model,
        COALESCE(input_tokens, 0) as input_tokens,
        COALESCE(output_tokens, 0) as output_tokens,
        latency_ms,
        status_code
      FROM request_logs
      WHERE created_at >= ?
      ORDER BY created_at ASC
    `)
    
    const rows = stmt.all(cutoff) as Array<{
      timestamp: number
      proxy_path: string
      source_model: string
      target_model: string
      input_tokens: number
      output_tokens: number
      latency_ms: number
      status_code: number
    }>
    
    return rows.map(row => ({
      timestamp: row.timestamp,
      proxyPath: row.proxy_path,
      sourceModel: row.source_model,
      targetModel: row.target_model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      latency: row.latency_ms,
      success: row.status_code >= 200 && row.status_code < 300
    }))
  }

  /**
   * Export logs to JSON format
   */
  exportToJson(filter: LogFilter = {}): string {
    const result = this.query(filter, { page: 1, pageSize: 100000 })
    return JSON.stringify(result.data, null, 2)
  }

  /**
   * Export logs to CSV format
   */
  exportToCsv(filter: LogFilter = {}): string {
    const result = this.query(filter, { page: 1, pageSize: 100000 })
    
    const headers = [
      'id', 'proxy_id', 'proxy_path', 'source_model', 'target_model',
      'status_code', 'input_tokens', 'output_tokens', 'latency_ms',
      'error', 'created_at'
    ]
    
    const rows = result.data.map(log => [
      log.id,
      log.proxy_id ?? '',
      log.proxy_path,
      log.source_model,
      log.target_model,
      log.status_code,
      log.input_tokens ?? '',
      log.output_tokens ?? '',
      log.latency_ms,
      log.error ?? '',
      new Date(log.created_at).toISOString()
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    return csvContent
  }
}

// Singleton instance
let instance: RequestLogRepository | null = null

export function getRequestLogRepository(): RequestLogRepository {
  if (!instance) {
    instance = new RequestLogRepository()
  }
  return instance
}
