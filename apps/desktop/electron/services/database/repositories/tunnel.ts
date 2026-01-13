/**
 * Tunnel repository - Database operations for tunnel configurations
 */

import { BaseRepository } from './base'
import type { BaseRow } from '../types'

export interface TunnelConfigRow extends BaseRow {
  device_id: string
  tunnel_id: string
  subdomain: string
  domain: string
  credentials: string
  status: 'active' | 'inactive' | 'error'
  created_at: number
  updated_at: number
  last_started_at?: number
  last_stopped_at?: number
}

export interface TunnelStatsRow {
  id: string
  date: string
  requests: number
  traffic_up: number
  traffic_down: number
  errors: number
  avg_latency_ms: number
  unique_ips: number
  created_at: number
}

export interface TunnelAccessLogRow {
  id: string
  timestamp: number
  client_ip?: string
  user_agent?: string
  method: string
  path: string
  status_code?: number
  latency_ms?: number
  api_key_used?: string
  auth_success: number
  error?: string
  created_at: number
}

export interface TunnelSystemLogRow {
  id: string
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  details?: string
  created_at: number
}

export class TunnelRepository extends BaseRepository<TunnelConfigRow> {
  protected tableName = 'tunnel_config'

  /**
   * Get tunnel config by device ID
   */
  findByDeviceId(deviceId: string): TunnelConfigRow | null {
    const stmt = this.db.prepare('SELECT * FROM tunnel_config WHERE device_id = ?')
    const result = stmt.get(deviceId) as TunnelConfigRow | undefined
    return result ?? null
  }

  /**
   * Get tunnel config by tunnel ID
   */
  findByTunnelId(tunnelId: string): TunnelConfigRow | null {
    const stmt = this.db.prepare('SELECT * FROM tunnel_config WHERE tunnel_id = ?')
    const result = stmt.get(tunnelId) as TunnelConfigRow | undefined
    return result ?? null
  }

  /**
   * Create or update tunnel config
   */
  upsert(data: Omit<TunnelConfigRow, 'id' | 'created_at' | 'updated_at'>): TunnelConfigRow {
    const existing = this.findByDeviceId(data.device_id)
    
    if (existing) {
      // Update existing
      const stmt = this.db.prepare(`
        UPDATE tunnel_config 
        SET tunnel_id = ?, subdomain = ?, domain = ?, credentials = ?, 
            status = ?, updated_at = ?
        WHERE device_id = ?
      `)
      stmt.run(
        data.tunnel_id,
        data.subdomain,
        data.domain,
        data.credentials,
        data.status,
        this.now(),
        data.device_id
      )
      return this.findByDeviceId(data.device_id)!
    } else {
      // Create new
      const id = this.generateId()
      const now = this.now()
      
      const stmt = this.db.prepare(`
        INSERT INTO tunnel_config 
        (id, device_id, tunnel_id, subdomain, domain, credentials, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(
        id,
        data.device_id,
        data.tunnel_id,
        data.subdomain,
        data.domain,
        data.credentials,
        data.status,
        now,
        now
      )
      
      return this.findById(id)!
    }
  }

  /**
   * Update tunnel status
   */
  updateStatus(deviceId: string, status: TunnelConfigRow['status']): void {
    const stmt = this.db.prepare(`
      UPDATE tunnel_config 
      SET status = ?, updated_at = ?
      WHERE device_id = ?
    `)
    stmt.run(status, this.now(), deviceId)
  }

  /**
   * Record tunnel start
   */
  recordStart(deviceId: string): void {
    const now = this.now()
    const stmt = this.db.prepare(`
      UPDATE tunnel_config 
      SET status = 'active', last_started_at = ?, updated_at = ?
      WHERE device_id = ?
    `)
    stmt.run(now, now, deviceId)
  }

  /**
   * Record tunnel stop
   */
  recordStop(deviceId: string): void {
    const now = this.now()
    const stmt = this.db.prepare(`
      UPDATE tunnel_config 
      SET status = 'inactive', last_stopped_at = ?, updated_at = ?
      WHERE device_id = ?
    `)
    stmt.run(now, now, deviceId)
  }

  // ========== Tunnel Stats Methods ==========

  /**
   * Get stats for a specific date
   */
  getStatsByDate(date: string): TunnelStatsRow | null {
    const stmt = this.db.prepare('SELECT * FROM tunnel_stats WHERE date = ?')
    const result = stmt.get(date) as TunnelStatsRow | undefined
    return result ?? null
  }

  /**
   * Get stats for date range
   */
  getStatsInRange(startDate: string, endDate: string): TunnelStatsRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tunnel_stats 
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC
    `)
    return stmt.all(startDate, endDate) as TunnelStatsRow[]
  }

  /**
   * Upsert stats for today
   * Note: avg_latency_ms uses weighted average based on request count
   */
  upsertStats(data: Partial<TunnelStatsRow> & { date: string }): void {
    const existing = this.getStatsByDate(data.date)

    if (existing) {
      // Update with proper aggregation
      // For avg_latency_ms, use weighted average: (old_avg * old_count + new_avg * new_count) / total_count
      const newRequests = data.requests || 0
      const newLatency = data.avg_latency_ms || 0
      const oldRequests = existing.requests || 0
      const oldLatency = existing.avg_latency_ms || 0
      const totalRequests = oldRequests + newRequests

      // Calculate weighted average latency
      const weightedAvgLatency = totalRequests > 0
        ? Math.round((oldLatency * oldRequests + newLatency * newRequests) / totalRequests)
        : 0

      const stmt = this.db.prepare(`
        UPDATE tunnel_stats SET
          requests = requests + ?,
          traffic_up = traffic_up + ?,
          traffic_down = traffic_down + ?,
          errors = errors + ?,
          avg_latency_ms = ?,
          unique_ips = unique_ips + ?
        WHERE date = ?
      `)
      stmt.run(
        newRequests,
        data.traffic_up || 0,
        data.traffic_down || 0,
        data.errors || 0,
        weightedAvgLatency,
        data.unique_ips || 0,
        data.date
      )
    } else {
      // Insert
      const id = this.generateId()
      const stmt = this.db.prepare(`
        INSERT INTO tunnel_stats
        (id, date, requests, traffic_up, traffic_down, errors, avg_latency_ms, unique_ips, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        id,
        data.date,
        data.requests || 0,
        data.traffic_up || 0,
        data.traffic_down || 0,
        data.errors || 0,
        data.avg_latency_ms || 0,
        data.unique_ips || 0,
        this.now()
      )
    }
  }

  /**
   * Clean old stats
   */
  cleanOldStats(retentionDays: number): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]
    
    const stmt = this.db.prepare('DELETE FROM tunnel_stats WHERE date < ?')
    const result = stmt.run(cutoffStr)
    return result.changes
  }

  // ========== Access Logs Methods ==========

  /**
   * Add access log
   */
  addAccessLog(data: Omit<TunnelAccessLogRow, 'id' | 'created_at'>): void {
    const id = this.generateId()
    const stmt = this.db.prepare(`
      INSERT INTO tunnel_access_logs 
      (id, timestamp, client_ip, user_agent, method, path, status_code, 
       latency_ms, api_key_used, auth_success, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      data.timestamp,
      data.client_ip,
      data.user_agent,
      data.method,
      data.path,
      data.status_code,
      data.latency_ms,
      data.api_key_used,
      data.auth_success,
      data.error,
      this.now()
    )
  }

  /**
   * Get recent access logs
   */
  getRecentAccessLogs(limit = 100): TunnelAccessLogRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tunnel_access_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `)
    return stmt.all(limit) as TunnelAccessLogRow[]
  }

  /**
   * Get access logs in time range
   */
  getAccessLogsInRange(startTime: number, endTime: number): TunnelAccessLogRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tunnel_access_logs 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `)
    return stmt.all(startTime, endTime) as TunnelAccessLogRow[]
  }

  /**
   * Clean old access logs
   */
  cleanOldAccessLogs(retentionDays: number): number {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
    const stmt = this.db.prepare('DELETE FROM tunnel_access_logs WHERE timestamp < ?')
    const result = stmt.run(cutoffTime)
    return result.changes
  }

  // ========== System Logs Methods ==========

  /**
   * Add system log
   */
  addSystemLog(level: TunnelSystemLogRow['level'], message: string, details?: string): void {
    const id = this.generateId()
    const timestamp = this.now()
    const stmt = this.db.prepare(`
      INSERT INTO tunnel_logs (id, timestamp, level, message, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, timestamp, level, message, details, timestamp)
  }

  /**
   * Get recent system logs
   */
  getRecentSystemLogs(limit = 100, level?: TunnelSystemLogRow['level']): TunnelSystemLogRow[] {
    let query = 'SELECT * FROM tunnel_logs'
    const params: any[] = []
    
    if (level) {
      query += ' WHERE level = ?'
      params.push(level)
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)
    
    const stmt = this.db.prepare(query)
    return stmt.all(...params) as TunnelSystemLogRow[]
  }

  /**
   * Clean old system logs
   */
  cleanOldSystemLogs(retentionDays: number): number {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
    const stmt = this.db.prepare('DELETE FROM tunnel_logs WHERE timestamp < ?')
    const result = stmt.run(cutoffTime)
    return result.changes
  }
}

// Export singleton instance
export const tunnelRepository = new TunnelRepository()
