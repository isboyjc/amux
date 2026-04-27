/**
 * CLI Live 配置备份 Repository
 * 管理 CLI 配置文件的备份和恢复
 */

import type { DatabaseInstance } from '../types'
import type { CliLiveConfigBackupRow } from '../types'
import { getDatabase } from '../index'

export interface CreateBackupDTO {
  cliType: string
  originalContent: string
  configFilePath: string
}

export class CliLiveConfigBackupRepository {
  private db: DatabaseInstance

  constructor() {
    this.db = getDatabase()
  }

  /**
   * 创建或更新备份
   */
  createOrUpdate(data: CreateBackupDTO): void {
    const stmt = this.db.prepare(`
      INSERT INTO cli_live_config_backups (cli_type, original_content, backed_up_at, config_file_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cli_type) DO UPDATE SET
        original_content = excluded.original_content,
        backed_up_at = excluded.backed_up_at,
        config_file_path = excluded.config_file_path
    `)

    stmt.run(data.cliType, data.originalContent, Date.now(), data.configFilePath)
  }

  /**
   * 按 CLI 类型查找备份
   */
  findByCliType(cliType: string): CliLiveConfigBackupRow | null {
    const stmt = this.db.prepare(`
      SELECT * FROM cli_live_config_backups WHERE cli_type = ?
    `)
    return (stmt.get(cliType) as CliLiveConfigBackupRow) || null
  }

  /**
   * 删除备份
   */
  deleteByCliType(cliType: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM cli_live_config_backups WHERE cli_type = ?
    `)
    const result = stmt.run(cliType)
    return result.changes > 0
  }

  /**
   * 检查是否有备份
   */
  hasBackup(cliType: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cli_live_config_backups WHERE cli_type = ?
    `)
    const result = stmt.get(cliType) as { count: number }
    return result.count > 0
  }

  /**
   * 获取所有备份
   */
  findAll(): CliLiveConfigBackupRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cli_live_config_backups ORDER BY backed_up_at DESC
    `)
    return stmt.all() as CliLiveConfigBackupRow[]
  }

  /**
   * 清空所有备份
   */
  deleteAll(): void {
    this.db.exec('DELETE FROM cli_live_config_backups')
  }
}

// Singleton instance
let instance: CliLiveConfigBackupRepository | null = null

export function getCliLiveConfigBackupRepository(): CliLiveConfigBackupRepository {
  if (!instance) {
    instance = new CliLiveConfigBackupRepository()
  }
  return instance
}
