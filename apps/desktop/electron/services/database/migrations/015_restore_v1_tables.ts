/**
 * Migration 015: 恢复 V1 Code Switch 表
 *
 * 修复 Migration 014 的副作用：
 * - Migration 014 的旧版本将 V1 表重命名为 _backup_v1_* 
 * - 但 V1 handlers 仍在使用，导致报错
 * - 本迁移将备份表恢复为原始表名，确保 V1/V2 共存
 */

import type { Migration } from '../types'

const up: Migration['up'] = (db) => {
  console.log('[Migration 015] Restoring V1 Code Switch tables for backward compatibility...')

  // 检查是否存在备份表
  const backupExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_backup_v1_code_switch_configs'")
    .all()

  if (backupExists.length > 0) {
    console.log('[Migration 015] Found backup tables, restoring...')

    try {
      // 检查原始表是否已存在（可能用户手动恢复了）
      const originalExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='code_switch_configs'")
        .all()

      if (originalExists.length === 0) {
        // 恢复 code_switch_configs 表
        db.exec('ALTER TABLE _backup_v1_code_switch_configs RENAME TO code_switch_configs')
        console.log('[Migration 015] Restored: code_switch_configs')
      } else {
        console.log('[Migration 015] code_switch_configs already exists, skipping')
      }

      // 检查 code_model_mappings 表
      const mappingOriginalExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='code_model_mappings'")
        .all()

      const mappingBackupExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_backup_v1_code_model_mappings'")
        .all()

      if (mappingOriginalExists.length === 0 && mappingBackupExists.length > 0) {
        // 恢复 code_model_mappings 表
        db.exec('ALTER TABLE _backup_v1_code_model_mappings RENAME TO code_model_mappings')
        console.log('[Migration 015] Restored: code_model_mappings')
      } else {
        console.log('[Migration 015] code_model_mappings already exists or no backup found, skipping')
      }

      console.log('[Migration 015] V1 tables restoration completed')
    } catch (error) {
      console.error('[Migration 015] Failed to restore V1 tables:', error)
      throw error
    }
  } else {
    console.log('[Migration 015] No backup tables found, V1 tables already exist or were never created')
  }

  console.log('[Migration 015] Migration completed successfully')
}

const down: Migration['down'] = (db) => {
  console.log('[Migration 015] Rolling back V1 table restoration...')
  
  // 回滚操作：将表重新命名为备份
  const originalExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='code_switch_configs'")
    .all()

  if (originalExists.length > 0) {
    db.exec('ALTER TABLE code_switch_configs RENAME TO _backup_v1_code_switch_configs')
    db.exec('ALTER TABLE code_model_mappings RENAME TO _backup_v1_code_model_mappings')
    console.log('[Migration 015] V1 tables renamed back to backup')
  }

  console.log('[Migration 015] Rollback completed')
}

export const migration015RestoreV1Tables: Migration = {
  version: 15,
  name: 'Restore V1 Code Switch tables',
  up,
  down,
}
