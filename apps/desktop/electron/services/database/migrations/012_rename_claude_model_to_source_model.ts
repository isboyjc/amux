/**
 * Migration 012: Rename claude_model to source_model
 * 
 * Rename the 'claude_model' field in code_model_mappings table to 'source_model'
 * for better semantic clarity when supporting both Claude Code and Codex.
 * 
 * The field now represents:
 * - For Claude Code: Claude official model names (e.g., 'claude-opus-4-5-20251101')
 * - For Codex: Source model names (e.g., 'gpt-5.2-codex', 'deepseek/deepseek-chat')
 */

import type { Migration } from '../types'

const up: Migration['up'] = (db) => {
  console.log('[Migration 012] Renaming claude_model to source_model...')

  // SQLite doesn't support direct column rename, so we need to:
  // 1. Create a new table with the new column name
  // 2. Copy data from old table
  // 3. Drop old table
  // 4. Rename new table to old name
  // 5. Recreate indexes

  // Step 1: Create new table
  db.exec(`
    CREATE TABLE code_model_mappings_new (
      id TEXT PRIMARY KEY,
      code_switch_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      source_model TEXT NOT NULL,
      target_model TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      
      FOREIGN KEY (code_switch_id) REFERENCES code_switch_configs (id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE,
      UNIQUE (code_switch_id, provider_id, source_model)
    )
  `)

  // Step 2: Copy data
  db.exec(`
    INSERT INTO code_model_mappings_new (
      id, code_switch_id, provider_id, source_model, target_model, 
      is_active, created_at, updated_at
    )
    SELECT 
      id, code_switch_id, provider_id, claude_model, target_model,
      is_active, created_at, updated_at
    FROM code_model_mappings
  `)

  // Step 3: Drop old table
  db.exec('DROP TABLE code_model_mappings')

  // Step 4: Rename new table
  db.exec('ALTER TABLE code_model_mappings_new RENAME TO code_model_mappings')

  // Step 5: Recreate indexes
  db.exec(`
    CREATE INDEX idx_code_mapping_switch 
    ON code_model_mappings (code_switch_id)
  `)

  db.exec(`
    CREATE INDEX idx_code_mapping_provider 
    ON code_model_mappings (provider_id)
  `)

  db.exec(`
    CREATE INDEX idx_code_mapping_active 
    ON code_model_mappings (is_active)
  `)

  console.log('[Migration 012] Successfully renamed claude_model to source_model')
}

const down: Migration['down'] = (db) => {
  console.log('[Migration 012] Rolling back: renaming source_model back to claude_model...')

  // Reverse the process
  db.exec(`
    CREATE TABLE code_model_mappings_old (
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

  db.exec(`
    INSERT INTO code_model_mappings_old (
      id, code_switch_id, provider_id, claude_model, target_model,
      is_active, created_at, updated_at
    )
    SELECT 
      id, code_switch_id, provider_id, source_model, target_model,
      is_active, created_at, updated_at
    FROM code_model_mappings
  `)

  db.exec('DROP TABLE code_model_mappings')
  db.exec('ALTER TABLE code_model_mappings_old RENAME TO code_model_mappings')

  db.exec(`
    CREATE INDEX idx_code_mapping_switch 
    ON code_model_mappings (code_switch_id)
  `)

  db.exec(`
    CREATE INDEX idx_code_mapping_provider 
    ON code_model_mappings (provider_id)
  `)

  db.exec(`
    CREATE INDEX idx_code_mapping_active 
    ON code_model_mappings (is_active)
  `)

  console.log('[Migration 012] Rollback complete')
}

export const migration012RenameClaudeModelToSourceModel: Migration = {
  version: 12,
  name: 'Rename claude_model to source_model',
  up,
  down
}
