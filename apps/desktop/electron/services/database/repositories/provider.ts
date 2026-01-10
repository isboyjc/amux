/**
 * Provider repository - CRUD operations for providers
 */

import { BaseRepository } from './base'
import type { ProviderRow } from '../types'

export interface CreateProviderDTO {
  name: string
  adapterType: string
  apiKey?: string
  baseUrl?: string
  chatPath?: string
  modelsPath?: string
  models?: string[]
  enabled?: boolean
  logo?: string
  color?: string
}

export interface UpdateProviderDTO {
  name?: string
  adapterType?: string
  apiKey?: string
  baseUrl?: string
  chatPath?: string
  modelsPath?: string
  models?: string[]
  enabled?: boolean
  sortOrder?: number
  logo?: string
  color?: string
}

export class ProviderRepository extends BaseRepository<ProviderRow> {
  protected tableName = 'providers'

  /**
   * Find all enabled providers
   */
  findAllEnabled(): ProviderRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM providers WHERE enabled = 1 ORDER BY sort_order ASC, created_at DESC'
    )
    return stmt.all() as ProviderRow[]
  }

  /**
   * Create a new provider
   */
  create(data: CreateProviderDTO): ProviderRow {
    const id = this.generateId()
    const now = this.now()
    
    const stmt = this.db.prepare(`
      INSERT INTO providers (id, name, adapter_type, api_key, base_url, chat_path, models_path, models, enabled, logo, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      data.name,
      data.adapterType,
      data.apiKey ?? null,
      data.baseUrl ?? null,
      data.chatPath ?? null,
      data.modelsPath ?? null,
      JSON.stringify(data.models ?? []),
      data.enabled !== false ? 1 : 0,
      data.logo ?? null,
      data.color ?? null,
      now,
      now
    )
    
    return this.findById(id)!
  }

  /**
   * Update an existing provider
   */
  update(id: string, data: UpdateProviderDTO): ProviderRow | null {
    const existing = this.findById(id)
    if (!existing) {
      return null
    }
    
    const updates: string[] = []
    const values: unknown[] = []
    
    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }
    if (data.adapterType !== undefined) {
      updates.push('adapter_type = ?')
      values.push(data.adapterType)
    }
    if (data.apiKey !== undefined) {
      updates.push('api_key = ?')
      values.push(data.apiKey)
    }
    if (data.baseUrl !== undefined) {
      updates.push('base_url = ?')
      values.push(data.baseUrl)
    }
    if (data.chatPath !== undefined) {
      updates.push('chat_path = ?')
      values.push(data.chatPath)
    }
    if (data.modelsPath !== undefined) {
      updates.push('models_path = ?')
      values.push(data.modelsPath)
    }
    if (data.models !== undefined) {
      updates.push('models = ?')
      values.push(JSON.stringify(data.models))
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?')
      values.push(data.enabled ? 1 : 0)
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?')
      values.push(data.sortOrder)
    }
    if (data.logo !== undefined) {
      updates.push('logo = ?')
      values.push(data.logo)
    }
    if (data.color !== undefined) {
      updates.push('color = ?')
      values.push(data.color)
    }
    
    if (updates.length === 0) {
      return existing
    }
    
    updates.push('updated_at = ?')
    values.push(this.now())
    values.push(id)
    
    const stmt = this.db.prepare(`
      UPDATE providers SET ${updates.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)
    
    return this.findById(id)
  }

  /**
   * Toggle provider enabled status
   */
  toggleEnabled(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE providers SET enabled = ?, updated_at = ? WHERE id = ?
    `)
    const result = stmt.run(enabled ? 1 : 0, this.now(), id)
    return result.changes > 0
  }

  /**
   * Update sort order for multiple providers
   */
  updateSortOrder(orders: Array<{ id: string; sortOrder: number }>): void {
    const stmt = this.db.prepare(`
      UPDATE providers SET sort_order = ?, updated_at = ? WHERE id = ?
    `)
    
    const now = this.now()
    this.db.transaction(() => {
      for (const { id, sortOrder } of orders) {
        stmt.run(sortOrder, now, id)
      }
    })()
  }

  /**
   * Find provider by adapter type
   */
  findByAdapterType(adapterType: string): ProviderRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM providers WHERE adapter_type = ? ORDER BY sort_order ASC'
    )
    return stmt.all(adapterType) as ProviderRow[]
  }
}

// Singleton instance
let instance: ProviderRepository | null = null

export function getProviderRepository(): ProviderRepository {
  if (!instance) {
    instance = new ProviderRepository()
  }
  return instance
}
