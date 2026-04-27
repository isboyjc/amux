/**
 * CLI + Provider 模型映射 Repository
 * 管理每个 CLI 针对不同供应商的模型映射配置，支持历史记忆
 */

import { BaseRepository } from './base'
import type { CliProviderModelMappingRow, CodeModelMappingType } from '../types'

export interface CliModelMappingItem {
  mappingType: CodeModelMappingType
  sourceModel?: string // exact 映射的源模型
  targetModel: string
  keywords?: string[] // family 映射的关键词
  priority?: number // family 映射的优先级
}

export interface UpdateMappingsDTO {
  cliType: string
  providerId: string
  mappings: CliModelMappingItem[]
}

export class CliProviderModelMappingRepository extends BaseRepository<CliProviderModelMappingRow> {
  protected tableName = 'cli_provider_model_mappings'

  /**
   * 获取指定 CLI + Provider 的活动映射
   */
  findActive(cliType: string, providerId: string): CliProviderModelMappingRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ? AND is_active = 1
      ORDER BY priority DESC, created_at ASC
    `)
    return stmt.all(cliType, providerId) as CliProviderModelMappingRow[]
  }

  /**
   * 获取指定 CLI + Provider 的所有映射（包括历史）
   */
  findAllByCliAndProvider(cliType: string, providerId: string): CliProviderModelMappingRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ?
      ORDER BY is_active DESC, priority DESC, created_at ASC
    `)
    return stmt.all(cliType, providerId) as CliProviderModelMappingRow[]
  }

  /**
   * 检查是否有历史映射
   */
  hasHistoricalMappings(cliType: string, providerId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ?
    `)
    const result = stmt.get(cliType, providerId) as { count: number }
    return result.count > 0
  }

  /**
   * 激活指定 CLI + Provider 的映射（停用该 CLI 的其他映射）
   */
  activateMappings(cliType: string, providerId: string): void {
    const transaction = this.db.transaction(() => {
      const now = this.now()

      // 1. 停用该 CLI 的所有映射
      const deactivateAllStmt = this.db.prepare(`
        UPDATE cli_provider_model_mappings
        SET is_active = 0, updated_at = ?
        WHERE cli_type = ?
      `)
      deactivateAllStmt.run(now, cliType)

      // 2. 激活指定 provider 的映射
      const activateStmt = this.db.prepare(`
        UPDATE cli_provider_model_mappings
        SET is_active = 1, updated_at = ?
        WHERE cli_type = ? AND provider_id = ?
      `)
      activateStmt.run(now, cliType, providerId)
    })

    transaction()
  }

  /**
   * 停用指定 CLI 的所有映射
   */
  deactivateAll(cliType: string): void {
    const stmt = this.db.prepare(`
      UPDATE cli_provider_model_mappings
      SET is_active = 0, updated_at = ?
      WHERE cli_type = ?
    `)
    stmt.run(this.now(), cliType)
  }

  /**
   * 更新映射（替换指定 CLI + Provider 的所有映射）
   */
  updateMappings(data: UpdateMappingsDTO): void {
    const { cliType, providerId, mappings } = data

    const transaction = this.db.transaction(() => {
      const now = this.now()

      // 1. 停用该 CLI 的所有映射
      const deactivateAllStmt = this.db.prepare(`
        UPDATE cli_provider_model_mappings
        SET is_active = 0, updated_at = ?
        WHERE cli_type = ?
      `)
      deactivateAllStmt.run(now, cliType)

      // 2. 停用指定 provider 的旧映射（保留历史）
      const deactivateProviderStmt = this.db.prepare(`
        UPDATE cli_provider_model_mappings
        SET is_active = 0, updated_at = ?
        WHERE cli_type = ? AND provider_id = ?
      `)
      deactivateProviderStmt.run(now, cliType, providerId)

      // 3. 插入新映射（激活状态）
      const insertStmt = this.db.prepare(`
        INSERT INTO cli_provider_model_mappings (
          id, cli_type, provider_id, mapping_type, source_model, target_model,
          keywords, priority, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)

      for (const mapping of mappings) {
        const id = this.generateId()
        insertStmt.run(
          id,
          cliType,
          providerId,
          mapping.mappingType,
          mapping.sourceModel || null,
          mapping.targetModel,
          mapping.keywords ? JSON.stringify(mapping.keywords) : null,
          mapping.priority || 0,
          now,
          now
        )
      }
    })

    transaction()
  }

  /**
   * 删除指定 CLI + Provider 的所有映射（包括历史）
   */
  deleteByCliAndProvider(cliType: string, providerId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ?
    `)
    stmt.run(cliType, providerId)
  }

  /**
   * 删除指定 CLI 的所有映射
   */
  deleteByCli(cliType: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM cli_provider_model_mappings
      WHERE cli_type = ?
    `)
    stmt.run(cliType)
  }

  /**
   * 按映射类型查找
   */
  findByType(
    cliType: string,
    providerId: string,
    mappingType: CodeModelMappingType
  ): CliProviderModelMappingRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ? AND mapping_type = ? AND is_active = 1
      ORDER BY priority DESC
    `)
    return stmt.all(cliType, providerId, mappingType) as CliProviderModelMappingRow[]
  }

  /**
   * 获取统计信息
   */
  getStats(cliType: string, providerId: string): {
    total: number
    active: number
    byType: Record<string, number>
  } {
    const allStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ?
    `)
    const activeStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ? AND is_active = 1
    `)
    const byTypeStmt = this.db.prepare(`
      SELECT mapping_type, COUNT(*) as count FROM cli_provider_model_mappings
      WHERE cli_type = ? AND provider_id = ? AND is_active = 1
      GROUP BY mapping_type
    `)

    const total = (allStmt.get(cliType, providerId) as { count: number }).count
    const active = (activeStmt.get(cliType, providerId) as { count: number }).count
    const byTypeRows = byTypeStmt.all(cliType, providerId) as Array<{
      mapping_type: string
      count: number
    }>

    const byType: Record<string, number> = {}
    for (const row of byTypeRows) {
      byType[row.mapping_type] = row.count
    }

    return { total, active, byType }
  }
}

// Singleton instance
let instance: CliProviderModelMappingRepository | null = null

export function getCliProviderModelMappingRepository(): CliProviderModelMappingRepository {
  if (!instance) {
    instance = new CliProviderModelMappingRepository()
  }
  return instance
}
