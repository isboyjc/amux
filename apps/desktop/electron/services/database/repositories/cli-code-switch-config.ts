/**
 * CLI Code Switch 配置 Repository
 * 管理每个 CLI 的 Code Switch 配置（供应商选择、开关状态等）
 */

import { BaseRepository } from './base'
import type { CliCodeSwitchConfigRow } from '../types'

export interface CreateCliCodeSwitchConfigDTO {
  cliType: string
  currentProviderId?: string
  enabled?: boolean
}

export interface UpdateCliCodeSwitchConfigDTO {
  currentProviderId?: string
  enabled?: boolean
  takeoverActive?: boolean
}

export class CliCodeSwitchConfigRepository extends BaseRepository<CliCodeSwitchConfigRow> {
  protected tableName = 'cli_code_switch_configs'

  /**
   * 获取指定 CLI 的配置（不存在则创建）
   */
  getOrCreate(cliType: string): CliCodeSwitchConfigRow {
    let config = this.findByCliType(cliType)

    if (!config) {
      config = this.create({ cliType })
    }

    return config
  }

  /**
   * 按 CLI 类型查找
   */
  findByCliType(cliType: string): CliCodeSwitchConfigRow | null {
    const stmt = this.db.prepare('SELECT * FROM cli_code_switch_configs WHERE cli_type = ?')
    return (stmt.get(cliType) as CliCodeSwitchConfigRow) || null
  }

  /**
   * 创建配置
   */
  create(data: CreateCliCodeSwitchConfigDTO): CliCodeSwitchConfigRow {
    const id = this.generateId()
    const now = this.now()

    const stmt = this.db.prepare(`
      INSERT INTO cli_code_switch_configs (
        id, cli_type, current_provider_id, enabled, takeover_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.cliType,
      data.currentProviderId || null,
      data.enabled ? 1 : 0,
      0, // takeover_active 初始为 false
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * 按 CLI 类型更新
   */
  updateByCliType(
    cliType: string,
    data: UpdateCliCodeSwitchConfigDTO
  ): CliCodeSwitchConfigRow | null {
    const existing = this.findByCliType(cliType)
    if (!existing) {
      return null
    }

    const updates: string[] = []
    const values: unknown[] = []

    if (data.currentProviderId !== undefined) {
      updates.push('current_provider_id = ?')
      values.push(data.currentProviderId)
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?')
      values.push(data.enabled ? 1 : 0)
    }
    if (data.takeoverActive !== undefined) {
      updates.push('takeover_active = ?')
      values.push(data.takeoverActive ? 1 : 0)
    }

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(this.now())
    values.push(cliType)

    const stmt = this.db.prepare(`
      UPDATE cli_code_switch_configs SET ${updates.join(', ')} WHERE cli_type = ?
    `)
    stmt.run(...values)

    return this.findByCliType(cliType)
  }

  /**
   * 获取所有已启用的 CLI
   */
  findAllEnabled(): CliCodeSwitchConfigRow[] {
    const stmt = this.db.prepare('SELECT * FROM cli_code_switch_configs WHERE enabled = 1')
    return stmt.all() as CliCodeSwitchConfigRow[]
  }

  /**
   * 检查 CLI 是否启用
   */
  isEnabled(cliType: string): boolean {
    const config = this.findByCliType(cliType)
    return config?.enabled === 1
  }

  /**
   * 检查是否处于代理接管模式
   */
  isTakeoverActive(cliType: string): boolean {
    const config = this.findByCliType(cliType)
    return config?.takeover_active === 1
  }

  /**
   * 获取当前供应商 ID
   */
  getCurrentProviderId(cliType: string): string | null {
    const config = this.findByCliType(cliType)
    return config?.current_provider_id || null
  }
}

// Singleton instance
let instance: CliCodeSwitchConfigRepository | null = null

export function getCliCodeSwitchConfigRepository(): CliCodeSwitchConfigRepository {
  if (!instance) {
    instance = new CliCodeSwitchConfigRepository()
  }
  return instance
}
