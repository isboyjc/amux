/**
 * Migration 011: Code Switch support
 * 
 * Adds support for managing Claude Code and Codex configurations through Amux Desktop.
 * Users can dynamically switch providers without restarting their CLI.
 */

import type { Migration } from '../types'

const up: Migration['up'] = (db) => {
  console.log('[Migration 011] Creating Code Switch tables...')

  // code_switch_configs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_switch_configs (
      id TEXT PRIMARY KEY,
      cli_type TEXT NOT NULL CHECK(cli_type IN ('claudecode', 'codex')),
      enabled INTEGER NOT NULL DEFAULT 0,
      provider_id TEXT NOT NULL,
      config_path TEXT NOT NULL,
      backup_config TEXT,
      proxy_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      
      FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE,
      UNIQUE (cli_type)
    )
  `)

  // code_model_mappings table (with historical mapping support)
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_model_mappings (
      id TEXT PRIMARY KEY,
      code_switch_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      claude_model TEXT NOT NULL,
      target_model TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      
      FOREIGN KEY (code_switch_id) REFERENCES code_switch_configs (id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE,
      UNIQUE (code_switch_id, provider_id, claude_model)
    )
  `)

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_code_switch_enabled 
    ON code_switch_configs (enabled);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_code_switch_provider 
    ON code_switch_configs (provider_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_code_mapping_switch 
    ON code_model_mappings (code_switch_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_code_mapping_provider 
    ON code_model_mappings (provider_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_code_mapping_active 
    ON code_model_mappings (is_active);
  `)

  // Add custom config directory columns to settings table
  db.exec(`
    ALTER TABLE settings ADD COLUMN claude_config_dir TEXT DEFAULT NULL;
  `)

  db.exec(`
    ALTER TABLE settings ADD COLUMN codex_config_dir TEXT DEFAULT NULL;
  `)

  console.log('[Migration 011] Code Switch tables created successfully')
}

const down: Migration['down'] = (db) => {
  console.log('[Migration 011] Rolling back Code Switch tables...')

  // Drop indexes
  db.exec('DROP INDEX IF EXISTS idx_code_mapping_active')
  db.exec('DROP INDEX IF EXISTS idx_code_mapping_provider')
  db.exec('DROP INDEX IF EXISTS idx_code_mapping_switch')
  db.exec('DROP INDEX IF EXISTS idx_code_switch_provider')
  db.exec('DROP INDEX IF EXISTS idx_code_switch_enabled')

  // Drop tables (will cascade delete dependent rows)
  db.exec('DROP TABLE IF EXISTS code_model_mappings')
  db.exec('DROP TABLE IF EXISTS code_switch_configs')

  console.log('[Migration 011] Code Switch tables rolled back successfully')
}

export const migration011CodeSwitch: Migration = {
  version: 11,
  name: 'Code Switch support',
  up,
  down
}
