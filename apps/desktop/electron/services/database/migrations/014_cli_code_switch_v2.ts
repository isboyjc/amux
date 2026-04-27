/**
 * Migration 014: CLI Code Switch V2
 *
 * 重构 Code Switch 架构，支持多 CLI 独立管理：
 * 1. 每个 CLI（Claude Code, Codex）独立配置和开关
 * 2. 引用现有 providers 表（不复制数据）
 * 3. 支持历史映射记忆（切回供应商时恢复映射）
 * 4. 支持代理接管模式（热切换）
 * 5. 自动备份和恢复配置文件
 */

import type { Migration } from '../types'

const up: Migration['up'] = (db) => {
  console.log('[Migration 014] Creating CLI Code Switch V2 tables...')

  // ============================================================
  // 1. CLI Code Switch 配置表
  // ============================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS cli_code_switch_configs (
      id TEXT PRIMARY KEY,
      cli_type TEXT NOT NULL UNIQUE CHECK(cli_type IN ('claude', 'codex')),
      current_provider_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      takeover_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      
      FOREIGN KEY (current_provider_id) REFERENCES providers(id) ON DELETE SET NULL
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cli_cs_enabled 
    ON cli_code_switch_configs(enabled)
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cli_cs_type 
    ON cli_code_switch_configs(cli_type)
  `)

  // ============================================================
  // 2. CLI + Provider 模型映射表（支持历史记忆）
  // ============================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS cli_provider_model_mappings (
      id TEXT PRIMARY KEY,
      cli_type TEXT NOT NULL CHECK(cli_type IN ('claude', 'codex')),
      provider_id TEXT NOT NULL,
      mapping_type TEXT NOT NULL CHECK(mapping_type IN ('exact', 'family', 'reasoning', 'default')),
      source_model TEXT,
      target_model TEXT NOT NULL,
      keywords TEXT,
      priority INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cli_provider_mappings_active 
    ON cli_provider_model_mappings(cli_type, provider_id, is_active)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cli_provider_mappings_type 
    ON cli_provider_model_mappings(cli_type, provider_id, mapping_type)
  `)

  // ============================================================
  // 3. CLI 配置备份表
  // ============================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS cli_live_config_backups (
      cli_type TEXT PRIMARY KEY CHECK(cli_type IN ('claude', 'codex')),
      original_content TEXT NOT NULL,
      backed_up_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      config_file_path TEXT NOT NULL
    )
  `)

  // ============================================================
  // 4. 数据迁移：从旧架构迁移到新架构
  // ============================================================
  
  // 检查是否存在旧表
  const oldTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='code_switch_configs'")
    .all()

  if (oldTableExists.length > 0) {
    console.log('[Migration 014] Migrating data from old Code Switch tables...')

    try {
      // 迁移 code_switch_configs → cli_code_switch_configs
      // 注意：旧的 cli_type='claudecode' 映射到新的 'claude'
      db.exec(`
        INSERT INTO cli_code_switch_configs (id, cli_type, current_provider_id, enabled, created_at, updated_at)
        SELECT 
          id,
          CASE 
            WHEN cli_type = 'claudecode' THEN 'claude'
            ELSE 'codex'
          END as cli_type,
          provider_id,
          enabled,
          created_at,
          updated_at
        FROM code_switch_configs
      `)

      // 迁移 code_model_mappings → cli_provider_model_mappings
      // 需要 JOIN code_switch_configs 获取 cli_type
      db.exec(`
        INSERT INTO cli_provider_model_mappings (
          id, cli_type, provider_id, mapping_type, source_model, target_model,
          keywords, priority, is_active, created_at, updated_at
        )
        SELECT 
          m.id,
          CASE 
            WHEN c.cli_type = 'claudecode' THEN 'claude'
            ELSE 'codex'
          END as cli_type,
          m.provider_id,
          m.mapping_type,
          m.source_model,
          m.target_model,
          NULL as keywords,
          0 as priority,
          m.is_active,
          m.created_at,
          m.updated_at
        FROM code_model_mappings m
        JOIN code_switch_configs c ON m.code_switch_id = c.id
      `)

      // 保留旧表（V1 handlers 可能仍在使用）
      // 注意：旧表数据已迁移，但不删除旧表，让 V1 和 V2 共存
      console.log('[Migration 014] Data migration completed successfully')
      console.log('[Migration 014] Note: Old tables (code_switch_configs, code_model_mappings) are preserved for backward compatibility')
    } catch (error) {
      console.error('[Migration 014] Data migration failed:', error)
      throw error
    }
  }

  console.log('[Migration 014] CLI Code Switch V2 tables created successfully')
}

const down: Migration['down'] = (db) => {
  console.log('[Migration 014] Rolling back CLI Code Switch V2...')

  // 删除新表
  db.exec('DROP TABLE IF EXISTS cli_live_config_backups')
  db.exec('DROP TABLE IF EXISTS cli_provider_model_mappings')
  db.exec('DROP TABLE IF EXISTS cli_code_switch_configs')

  // V1 表仍然存在（未被重命名），无需恢复
  console.log('[Migration 014] V1 tables remain unchanged')

  console.log('[Migration 014] Rollback completed')
}

export const migration014CliCodeSwitchV2: Migration = {
  version: 14,
  name: 'CLI Code Switch V2',
  up,
  down,
}
