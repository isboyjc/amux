/**
 * Base repository class with common CRUD operations
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '../index'
import type { DatabaseInstance, BaseRow } from '../types'

export abstract class BaseRepository<T extends BaseRow> {
  protected abstract tableName: string

  /**
   * Get database instance
   */
  protected get db(): DatabaseInstance {
    return getDatabase()
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return randomUUID()
  }

  /**
   * Get current timestamp in milliseconds
   */
  protected now(): number {
    return Date.now()
  }

  /**
   * Find all records
   */
  findAll(): T[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ORDER BY sort_order ASC, created_at DESC`)
    return stmt.all() as T[]
  }

  /**
   * Find record by ID
   */
  findById(id: string): T | null {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
    const result = stmt.get(id) as T | undefined
    return result ?? null
  }

  /**
   * Delete record by ID
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Check if record exists
   */
  exists(id: string): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`)
    return stmt.get(id) !== undefined
  }

  /**
   * Count all records
   */
  count(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
    const result = stmt.get() as { count: number }
    return result.count
  }
}
