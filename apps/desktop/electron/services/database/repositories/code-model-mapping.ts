/**
 * Code Model Mapping repository - Manages model mappings with historical support
 * 
 * Historical mapping support allows users to switch between providers without losing
 * their previous mapping configurations.
 */

import { BaseRepository } from './base'
import type { CodeModelMappingRow } from '../types'

export interface CreateModelMappingDTO {
  codeSwitchId: string
  providerId: string
  claudeModel: string
  targetModel: string
  isActive?: boolean
}

export interface UpdateModelMappingsDTO {
  codeSwitchId: string
  providerId: string
  mappings: Array<{
    claudeModel: string
    targetModel: string
  }>
}

export class CodeModelMappingRepository extends BaseRepository<CodeModelMappingRow> {
  protected tableName = 'code_model_mappings'

  /**
   * Find all records (override to remove sort_order)
   */
  findAll(): CodeModelMappingRow[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`)
    return stmt.all() as CodeModelMappingRow[]
  }

  /**
   * Find active model mappings for a Code Switch config
   */
  findActiveByCodeSwitchId(codeSwitchId: string): CodeModelMappingRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM code_model_mappings
      WHERE code_switch_id = ? AND is_active = 1
      ORDER BY created_at ASC
    `)
    return stmt.all(codeSwitchId) as CodeModelMappingRow[]
  }

  /**
   * Find all mappings for a Code Switch config (including inactive)
   */
  findAllByCodeSwitchId(codeSwitchId: string): CodeModelMappingRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM code_model_mappings
      WHERE code_switch_id = ?
      ORDER BY is_active DESC, created_at ASC
    `)
    return stmt.all(codeSwitchId) as CodeModelMappingRow[]
  }

  /**
   * Find historical mappings for a specific provider
   * Used when switching back to a previously used provider
   */
  findByProvider(codeSwitchId: string, providerId: string): CodeModelMappingRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM code_model_mappings
      WHERE code_switch_id = ? AND provider_id = ?
      ORDER BY created_at ASC
    `)
    return stmt.all(codeSwitchId, providerId) as CodeModelMappingRow[]
  }

  /**
   * Create a single model mapping
   */
  create(data: CreateModelMappingDTO): CodeModelMappingRow {
    const id = this.generateId()
    const now = this.now()

    const stmt = this.db.prepare(`
      INSERT INTO code_model_mappings (
        id, code_switch_id, provider_id, claude_model, target_model, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.codeSwitchId,
      data.providerId,
      data.claudeModel,
      data.targetModel,
      data.isActive !== false ? 1 : 0,
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * Batch update/create mappings for a provider
   * This is the main method used when switching providers or updating mappings
   * 
   * Algorithm:
   * 1. Deactivate all mappings for this Code Switch
   * 2. Upsert new mappings (create or update existing ones for this provider)
   * 3. Set new mappings as active
   */
  updateMappingsForProvider(data: UpdateModelMappingsDTO): void {
    const { codeSwitchId, providerId, mappings } = data
    const now = this.now()

    // Use transaction for atomicity
    const transaction = this.db.transaction(() => {
      // Step 1: Deactivate all mappings for this Code Switch
      const deactivateStmt = this.db.prepare(`
        UPDATE code_model_mappings
        SET is_active = 0, updated_at = ?
        WHERE code_switch_id = ?
      `)
      deactivateStmt.run(now, codeSwitchId)

      // Step 2 & 3: Upsert new mappings and set as active
      const upsertStmt = this.db.prepare(`
        INSERT INTO code_model_mappings (
          id, code_switch_id, provider_id, claude_model, target_model, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT (code_switch_id, provider_id, claude_model)
        DO UPDATE SET
          target_model = excluded.target_model,
          is_active = 1,
          updated_at = excluded.updated_at
      `)

      for (const mapping of mappings) {
        upsertStmt.run(
          this.generateId(),
          codeSwitchId,
          providerId,
          mapping.claudeModel,
          mapping.targetModel,
          now,
          now
        )
      }
    })

    transaction()
  }

  /**
   * Delete all mappings for a Code Switch config
   */
  deleteByCodeSwitchId(codeSwitchId: string): void {
    const stmt = this.db.prepare('DELETE FROM code_model_mappings WHERE code_switch_id = ?')
    stmt.run(codeSwitchId)
  }

  /**
   * Delete all mappings for a provider (used when provider is deleted)
   */
  deleteByProvider(providerId: string): void {
    const stmt = this.db.prepare('DELETE FROM code_model_mappings WHERE provider_id = ?')
    stmt.run(providerId)
  }

  /**
   * Check if historical mappings exist for a provider
   * Used to determine if we can auto-restore mappings when switching back
   */
  hasHistoricalMappings(codeSwitchId: string, providerId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM code_model_mappings
      WHERE code_switch_id = ? AND provider_id = ?
      LIMIT 1
    `)
    return stmt.get(codeSwitchId, providerId) !== undefined
  }

  /**
   * Get mapping count by provider
   * Useful for statistics
   */
  countByProvider(providerId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM code_model_mappings
      WHERE provider_id = ?
    `)
    const result = stmt.get(providerId) as { count: number }
    return result.count
  }
}
