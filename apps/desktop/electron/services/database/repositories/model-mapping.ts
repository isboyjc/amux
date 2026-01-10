/**
 * Model mapping repository - CRUD operations for model mappings
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '../index'
import type { ModelMappingRow } from '../types'

export interface CreateMappingDTO {
  proxyId: string
  sourceModel: string
  targetModel: string
  isDefault?: boolean
}

export interface UpdateMappingDTO {
  sourceModel?: string
  targetModel?: string
  isDefault?: boolean
}

export class ModelMappingRepository {
  private get db() {
    return getDatabase()
  }

  /**
   * Find all mappings for a proxy
   */
  findByProxyId(proxyId: string): ModelMappingRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM model_mappings WHERE proxy_id = ? ORDER BY is_default DESC, source_model ASC'
    )
    return stmt.all(proxyId) as ModelMappingRow[]
  }

  /**
   * Find mapping by ID
   */
  findById(id: string): ModelMappingRow | null {
    const stmt = this.db.prepare('SELECT * FROM model_mappings WHERE id = ?')
    const result = stmt.get(id) as ModelMappingRow | undefined
    return result ?? null
  }

  /**
   * Find mapping by proxy and source model
   */
  findBySourceModel(proxyId: string, sourceModel: string): ModelMappingRow | null {
    const stmt = this.db.prepare(
      'SELECT * FROM model_mappings WHERE proxy_id = ? AND source_model = ?'
    )
    const result = stmt.get(proxyId, sourceModel) as ModelMappingRow | undefined
    return result ?? null
  }

  /**
   * Get default mapping for a proxy
   */
  getDefaultMapping(proxyId: string): ModelMappingRow | null {
    const stmt = this.db.prepare(
      'SELECT * FROM model_mappings WHERE proxy_id = ? AND is_default = 1 LIMIT 1'
    )
    const result = stmt.get(proxyId) as ModelMappingRow | undefined
    return result ?? null
  }

  /**
   * Resolve target model for a given source model
   */
  resolveTargetModel(proxyId: string, sourceModel: string): string | null {
    // First try exact match
    const exactMatch = this.findBySourceModel(proxyId, sourceModel)
    if (exactMatch) {
      return exactMatch.target_model
    }
    
    // Fall back to default mapping
    const defaultMapping = this.getDefaultMapping(proxyId)
    return defaultMapping?.target_model ?? null
  }

  /**
   * Create a new mapping
   */
  create(data: CreateMappingDTO): ModelMappingRow {
    const id = randomUUID()
    
    // If this is the default mapping, clear other defaults first
    if (data.isDefault) {
      this.clearDefault(data.proxyId)
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO model_mappings (id, proxy_id, source_model, target_model, is_default)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      data.proxyId,
      data.sourceModel,
      data.targetModel,
      data.isDefault ? 1 : 0
    )
    
    return this.findById(id)!
  }

  /**
   * Update an existing mapping
   */
  update(id: string, data: UpdateMappingDTO): ModelMappingRow | null {
    const existing = this.findById(id)
    if (!existing) {
      return null
    }
    
    // If setting as default, clear other defaults first
    if (data.isDefault) {
      this.clearDefault(existing.proxy_id, id)
    }
    
    const updates: string[] = []
    const values: unknown[] = []
    
    if (data.sourceModel !== undefined) {
      updates.push('source_model = ?')
      values.push(data.sourceModel)
    }
    if (data.targetModel !== undefined) {
      updates.push('target_model = ?')
      values.push(data.targetModel)
    }
    if (data.isDefault !== undefined) {
      updates.push('is_default = ?')
      values.push(data.isDefault ? 1 : 0)
    }
    
    if (updates.length === 0) {
      return existing
    }
    
    values.push(id)
    
    const stmt = this.db.prepare(`
      UPDATE model_mappings SET ${updates.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)
    
    return this.findById(id)
  }

  /**
   * Delete a mapping
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM model_mappings WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Delete all mappings for a proxy
   */
  deleteByProxyId(proxyId: string): number {
    const stmt = this.db.prepare('DELETE FROM model_mappings WHERE proxy_id = ?')
    const result = stmt.run(proxyId)
    return result.changes
  }

  /**
   * Set a mapping as default (and clear others)
   */
  setDefault(id: string): boolean {
    const mapping = this.findById(id)
    if (!mapping) {
      return false
    }
    
    this.db.transaction(() => {
      // Clear other defaults
      const clearStmt = this.db.prepare(
        'UPDATE model_mappings SET is_default = 0 WHERE proxy_id = ? AND id != ?'
      )
      clearStmt.run(mapping.proxy_id, id)
      
      // Set this one as default
      const setStmt = this.db.prepare(
        'UPDATE model_mappings SET is_default = 1 WHERE id = ?'
      )
      setStmt.run(id)
    })()
    
    return true
  }

  /**
   * Clear default flag for a proxy (optionally excluding one mapping)
   */
  private clearDefault(proxyId: string, excludeId?: string): void {
    const stmt = excludeId
      ? this.db.prepare('UPDATE model_mappings SET is_default = 0 WHERE proxy_id = ? AND id != ?')
      : this.db.prepare('UPDATE model_mappings SET is_default = 0 WHERE proxy_id = ?')
    
    if (excludeId) {
      stmt.run(proxyId, excludeId)
    } else {
      stmt.run(proxyId)
    }
  }

  /**
   * Bulk create mappings for a proxy
   */
  bulkCreate(proxyId: string, mappings: Array<Omit<CreateMappingDTO, 'proxyId'>>): ModelMappingRow[] {
    const created: ModelMappingRow[] = []
    
    this.db.transaction(() => {
      // Delete existing mappings
      this.deleteByProxyId(proxyId)
      
      // Create new mappings
      for (const mapping of mappings) {
        const result = this.create({
          proxyId,
          ...mapping
        })
        created.push(result)
      }
    })()
    
    return created
  }
}

// Singleton instance
let instance: ModelMappingRepository | null = null

export function getModelMappingRepository(): ModelMappingRepository {
  if (!instance) {
    instance = new ModelMappingRepository()
  }
  return instance
}
