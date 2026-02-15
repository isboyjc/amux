/**
 * Migration 013: Enhance code_model_mappings with mapping_type
 *
 * Adds mapping_type for hybrid mapping strategy:
 * - exact: exact model ID match (current behavior)
 * - family: family match (opus/sonnet/haiku)
 * - reasoning: reasoning model mapping (thinking enabled)
 * - default: default fallback mapping
 *
 * Unique constraint becomes (code_switch_id, provider_id, source_model, mapping_type).
 */

import type { Migration } from '../types'

const up: Migration['up'] = (db) => {
  console.log('[Migration 013] Adding mapping_type to code_model_mappings...')

  db.exec(`
    CREATE TABLE code_model_mappings_new (
      id TEXT PRIMARY KEY,
      code_switch_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      source_model TEXT NOT NULL,
      target_model TEXT NOT NULL,
      mapping_type TEXT NOT NULL DEFAULT 'exact' CHECK(mapping_type IN ('exact', 'family', 'reasoning', 'default')),
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,

      FOREIGN KEY (code_switch_id) REFERENCES code_switch_configs (id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE,
      UNIQUE (code_switch_id, provider_id, source_model, mapping_type)
    )
  `)

  db.exec(`
    INSERT INTO code_model_mappings_new (
      id, code_switch_id, provider_id, source_model, target_model,
      mapping_type, is_active, created_at, updated_at
    )
    SELECT
      id, code_switch_id, provider_id, source_model, target_model,
      'exact', is_active, created_at, updated_at
    FROM code_model_mappings
  `)

  db.exec('DROP TABLE code_model_mappings')
  db.exec('ALTER TABLE code_model_mappings_new RENAME TO code_model_mappings')

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

  db.exec(`
    CREATE INDEX idx_code_mapping_type
    ON code_model_mappings (mapping_type)
  `)

  console.log('[Migration 013] mapping_type added successfully')
}

const down: Migration['down'] = (db) => {
  console.log('[Migration 013] Rolling back mapping_type...')

  db.exec(`
    CREATE TABLE code_model_mappings_old (
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

  db.exec(`
    INSERT INTO code_model_mappings_old (
      id, code_switch_id, provider_id, source_model, target_model,
      is_active, created_at, updated_at
    )
    SELECT
      id, code_switch_id, provider_id, source_model, target_model,
      is_active, created_at, updated_at
    FROM code_model_mappings
    WHERE mapping_type = 'exact'
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

  console.log('[Migration 013] Rollback complete')
}

export const migration013EnhanceModelMappingType: Migration = {
  version: 13,
  name: 'Enhance code_model_mappings with mapping_type',
  up,
  down
}
