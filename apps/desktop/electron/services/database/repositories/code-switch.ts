/**
 * Code Switch repository - CRUD operations for Code Switch configurations
 */

import { BaseRepository } from './base'
import type { CodeSwitchConfigRow } from '../types'

export interface CreateCodeSwitchDTO {
  cliType: 'claudecode' | 'codex'
  providerId: string
  configPath: string
  backupConfig: string
  proxyPath: string
}

export interface UpdateCodeSwitchDTO {
  providerId?: string
  configPath?: string
  backupConfig?: string
  enabled?: boolean
}

export class CodeSwitchRepository extends BaseRepository<CodeSwitchConfigRow> {
  protected tableName = 'code_switch_configs'

  /**
   * Find all records (override to remove sort_order)
   */
  override findAll(): CodeSwitchConfigRow[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`)
    return stmt.all() as CodeSwitchConfigRow[]
  }

  /**
   * Find Code Switch config by CLI type
   */
  findByCLIType(cliType: 'claudecode' | 'codex'): CodeSwitchConfigRow | null {
    const stmt = this.db.prepare('SELECT * FROM code_switch_configs WHERE cli_type = ?')
    const result = stmt.get(cliType) as CodeSwitchConfigRow | undefined
    return result ?? null
  }

  /**
   * Find all enabled Code Switch configs
   */
  findAllEnabled(): CodeSwitchConfigRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM code_switch_configs WHERE enabled = 1 ORDER BY created_at DESC'
    )
    return stmt.all() as CodeSwitchConfigRow[]
  }

  /**
   * Find Code Switch configs by provider ID
   */
  findByProvider(providerId: string): CodeSwitchConfigRow[] {
    const stmt = this.db.prepare('SELECT * FROM code_switch_configs WHERE provider_id = ?')
    return stmt.all(providerId) as CodeSwitchConfigRow[]
  }

  /**
   * Create a new Code Switch config
   */
  create(data: CreateCodeSwitchDTO): CodeSwitchConfigRow {
    const id = this.generateId()
    const now = this.now()

    const stmt = this.db.prepare(`
      INSERT INTO code_switch_configs (
        id, cli_type, enabled, provider_id, config_path, backup_config, proxy_path, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.cliType,
      0, // Default disabled
      data.providerId,
      data.configPath,
      data.backupConfig,
      data.proxyPath,
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * Update Code Switch config
   */
  update(id: string, data: UpdateCodeSwitchDTO): CodeSwitchConfigRow | null {
    const existing = this.findById(id)
    if (!existing) return null

    const updates: string[] = []
    const values: unknown[] = []

    if (data.providerId !== undefined) {
      updates.push('provider_id = ?')
      values.push(data.providerId)
    }

    if (data.configPath !== undefined) {
      updates.push('config_path = ?')
      values.push(data.configPath)
    }

    if (data.backupConfig !== undefined) {
      updates.push('backup_config = ?')
      values.push(data.backupConfig)
    }

    if (data.enabled !== undefined) {
      updates.push('enabled = ?')
      values.push(data.enabled ? 1 : 0)
    }

    if (updates.length === 0) return existing

    updates.push('updated_at = ?')
    values.push(this.now())
    values.push(id)

    const stmt = this.db.prepare(`
      UPDATE code_switch_configs
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...values)

    return this.findById(id)
  }

  /**
   * Update provider for a CLI type
   */
  updateProvider(cliType: 'claudecode' | 'codex', providerId: string): void {
    const stmt = this.db.prepare(`
      UPDATE code_switch_configs
      SET provider_id = ?, updated_at = ?
      WHERE cli_type = ?
    `)
    stmt.run(providerId, this.now(), cliType)
  }

  /**
   * Set enabled status for a CLI type
   */
  setEnabled(cliType: 'claudecode' | 'codex', enabled: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE code_switch_configs
      SET enabled = ?, updated_at = ?
      WHERE cli_type = ?
    `)
    stmt.run(enabled ? 1 : 0, this.now(), cliType)
  }

  /**
   * Delete Code Switch config by CLI type
   */
  deleteByCLIType(cliType: 'claudecode' | 'codex'): boolean {
    const stmt = this.db.prepare('DELETE FROM code_switch_configs WHERE cli_type = ?')
    const result = stmt.run(cliType)
    return result.changes > 0
  }

  /**
   * Disable Code Switch configs by provider ID
   */
  disableByProvider(providerId: string): void {
    const stmt = this.db.prepare(`
      UPDATE code_switch_configs
      SET enabled = 0, updated_at = ?
      WHERE provider_id = ?
    `)
    stmt.run(this.now(), providerId)
  }
}

// Singleton instance
let instance: CodeSwitchRepository | null = null

/**
 * Get singleton instance of CodeSwitchRepository
 */
export function getCodeSwitchRepository(): CodeSwitchRepository {
  if (!instance) {
    instance = new CodeSwitchRepository()
  }
  return instance
}
