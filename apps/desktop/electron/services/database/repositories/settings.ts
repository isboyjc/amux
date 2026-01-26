/**
 * Settings repository - Type-safe key-value settings store
 */

import { getDatabase } from '../index'
import type { SettingsRow } from '../types'

// Settings schema (mirrored from src/types/index.ts)
export interface SettingsSchema {
  'proxy.port': number
  'proxy.host': string
  'proxy.autoStart': boolean
  'proxy.timeout': number
  'proxy.retry.enabled': boolean
  'proxy.retry.maxRetries': number
  'proxy.retry.retryDelay': number
  'proxy.retry.retryOn': number[]
  'proxy.circuitBreaker.enabled': boolean
  'proxy.circuitBreaker.threshold': number
  'proxy.circuitBreaker.resetTimeout': number
  'proxy.cors.enabled': boolean
  'proxy.cors.origins': string[]
  'proxy.sse.heartbeatInterval': number
  'proxy.sse.connectionTimeout': number
  'appearance.theme': 'light' | 'dark' | 'system'
  'appearance.language': 'zh-CN' | 'en-US'
  'chat.defaultModel': string
  'chat.streamResponse': boolean
  'chat.showReasoning': boolean
  'logs.enabled': boolean
  'logs.retentionDays': number
  'logs.maxEntries': number
  'logs.saveRequestBody': boolean
  'logs.saveResponseBody': boolean
  'logs.maxBodySize': number
  'presets.remoteUrl': string
  'presets.lastUpdated': number
  'presets.autoUpdate': boolean
  
  // Analytics settings
  'analytics.enabled': boolean
  'analytics.userId': string
  'app.launchAtStartup': boolean
  'app.startMinimized': boolean
  'app.minimizeToTray': boolean
  'app.showTrayIcon': boolean
  'security.masterPassword.enabled': boolean
  'security.masterPassword.hash': string
  'security.unifiedApiKey.enabled': boolean
}

export class SettingsRepository {
  private get db() {
    return getDatabase()
  }

  /**
   * Get a setting value by key
   */
  get<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
    const result = stmt.get(key) as { value: string } | undefined
    
    if (!result) {
      return undefined
    }
    
    try {
      return JSON.parse(result.value) as SettingsSchema[K]
    } catch {
      return undefined
    }
  }

  /**
   * Get a setting value with default fallback
   */
  getWithDefault<K extends keyof SettingsSchema>(
    key: K,
    defaultValue: SettingsSchema[K]
  ): SettingsSchema[K] {
    const value = this.get(key)
    return value !== undefined ? value : defaultValue
  }

  /**
   * Set a setting value
   */
  set<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
    const now = Date.now()
    const jsonValue = JSON.stringify(value)
    
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `)
    
    stmt.run(key, jsonValue, now, jsonValue, now)
  }

  /**
   * Get all settings
   */
  getAll(): Partial<SettingsSchema> {
    const stmt = this.db.prepare('SELECT key, value FROM settings')
    const rows = stmt.all() as SettingsRow[]
    
    const settings: Partial<SettingsSchema> = {}
    
    for (const row of rows) {
      try {
        (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value)
      } catch {
        // Skip invalid JSON
      }
    }
    
    return settings
  }

  /**
   * Get multiple settings at once
   */
  getMany<K extends keyof SettingsSchema>(keys: K[]): Pick<SettingsSchema, K> {
    const placeholders = keys.map(() => '?').join(', ')
    const stmt = this.db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    const rows = stmt.all(...keys) as SettingsRow[]
    
    const settings: Partial<SettingsSchema> = {}
    
    for (const row of rows) {
      try {
        (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value)
      } catch {
        // Skip invalid JSON
      }
    }
    
    return settings as Pick<SettingsSchema, K>
  }

  /**
   * Set multiple settings at once
   */
  setMany(settings: Partial<SettingsSchema>): void {
    const now = Date.now()
    
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `)
    
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        const jsonValue = JSON.stringify(value)
        stmt.run(key, jsonValue, now, jsonValue, now)
      }
    })()
  }

  /**
   * Delete a setting
   */
  delete(key: keyof SettingsSchema): boolean {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?')
    const result = stmt.run(key)
    return result.changes > 0
  }

  /**
   * Check if a setting exists
   */
  has(key: keyof SettingsSchema): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM settings WHERE key = ? LIMIT 1')
    return stmt.get(key) !== undefined
  }

  /**
   * Get settings by prefix
   */
  getByPrefix(prefix: string): Record<string, unknown> {
    const stmt = this.db.prepare('SELECT key, value FROM settings WHERE key LIKE ?')
    const rows = stmt.all(`${prefix}%`) as SettingsRow[]
    
    const settings: Record<string, unknown> = {}
    
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value)
      } catch {
        // Skip invalid JSON
      }
    }
    
    return settings
  }
}

// Singleton instance
let instance: SettingsRepository | null = null

export function getSettingsRepository(): SettingsRepository {
  if (!instance) {
    instance = new SettingsRepository()
  }
  return instance
}
