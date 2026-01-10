/**
 * API Key repository - CRUD operations for unified API keys
 */

import { randomUUID, randomBytes } from 'crypto'
import { getDatabase } from '../index'
import type { ApiKeyRow } from '../types'

// API Key prefix
const API_KEY_PREFIX = 'sk-'
const API_KEY_LENGTH = 32

export interface CreateApiKeyDTO {
  name?: string
}

export class ApiKeyRepository {
  private get db() {
    return getDatabase()
  }

  /**
   * Generate a new API key string
   */
  private generateApiKey(): string {
    // Generate random bytes and convert to URL-safe base64
    const bytes = randomBytes(API_KEY_LENGTH)
    const key = bytes.toString('base64url').slice(0, API_KEY_LENGTH)
    return API_KEY_PREFIX + key
  }

  /**
   * Find all API keys
   */
  findAll(): ApiKeyRow[] {
    const stmt = this.db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC')
    return stmt.all() as ApiKeyRow[]
  }

  /**
   * Find all enabled API keys
   */
  findAllEnabled(): ApiKeyRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM api_keys WHERE enabled = 1 ORDER BY created_at DESC'
    )
    return stmt.all() as ApiKeyRow[]
  }

  /**
   * Find API key by ID
   */
  findById(id: string): ApiKeyRow | null {
    const stmt = this.db.prepare('SELECT * FROM api_keys WHERE id = ?')
    const result = stmt.get(id) as ApiKeyRow | undefined
    return result ?? null
  }

  /**
   * Find API key by key string
   */
  findByKey(key: string): ApiKeyRow | null {
    const stmt = this.db.prepare('SELECT * FROM api_keys WHERE key = ?')
    const result = stmt.get(key) as ApiKeyRow | undefined
    return result ?? null
  }

  /**
   * Validate an API key
   * Returns the API key record if valid, null otherwise
   */
  validateKey(key: string): ApiKeyRow | null {
    const apiKey = this.findByKey(key)
    if (!apiKey || !apiKey.enabled) {
      return null
    }
    return apiKey
  }

  /**
   * Create a new API key
   */
  create(data: CreateApiKeyDTO = {}): ApiKeyRow {
    const id = randomUUID()
    const key = this.generateApiKey()
    const now = Date.now()
    
    const stmt = this.db.prepare(`
      INSERT INTO api_keys (id, key, name, enabled, created_at)
      VALUES (?, ?, ?, 1, ?)
    `)
    
    stmt.run(id, key, data.name ?? null, now)
    
    return this.findById(id)!
  }

  /**
   * Update API key name
   */
  updateName(id: string, name: string): ApiKeyRow | null {
    const stmt = this.db.prepare('UPDATE api_keys SET name = ? WHERE id = ?')
    const result = stmt.run(name, id)
    
    if (result.changes === 0) {
      return null
    }
    
    return this.findById(id)
  }

  /**
   * Toggle API key enabled status
   */
  toggleEnabled(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare('UPDATE api_keys SET enabled = ? WHERE id = ?')
    const result = stmt.run(enabled ? 1 : 0, id)
    return result.changes > 0
  }

  /**
   * Update last used timestamp
   */
  updateLastUsed(id: string): void {
    const stmt = this.db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    stmt.run(Date.now(), id)
  }

  /**
   * Delete an API key
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM api_keys WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Count all API keys
   */
  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM api_keys')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * Count enabled API keys
   */
  countEnabled(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE enabled = 1')
    const result = stmt.get() as { count: number }
    return result.count
  }
}

// Singleton instance
let instance: ApiKeyRepository | null = null

export function getApiKeyRepository(): ApiKeyRepository {
  if (!instance) {
    instance = new ApiKeyRepository()
  }
  return instance
}
