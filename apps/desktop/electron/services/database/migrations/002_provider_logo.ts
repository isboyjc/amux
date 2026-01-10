/**
 * Add logo and color fields to providers table
 */

import type { Migration, DatabaseInstance } from '../types'

export const migration002ProviderLogo: Migration = {
  version: 2,
  name: 'provider_logo',
  
  up(db: DatabaseInstance): void {
    // Add logo column - stores relative path to logo file
    db.exec(`ALTER TABLE providers ADD COLUMN logo TEXT`)
    
    // Add color column - stores brand color hex code
    db.exec(`ALTER TABLE providers ADD COLUMN color TEXT`)
  },

  down(db: DatabaseInstance): void {
    // SQLite doesn't support DROP COLUMN directly before 3.35.0
    // We need to recreate the table without these columns
    db.exec(`
      CREATE TABLE providers_backup (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        api_key TEXT,
        base_url TEXT,
        models TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        updated_at INTEGER DEFAULT (unixepoch() * 1000)
      )
    `)
    
    db.exec(`
      INSERT INTO providers_backup (id, name, adapter_type, api_key, base_url, models, enabled, sort_order, created_at, updated_at)
      SELECT id, name, adapter_type, api_key, base_url, models, enabled, sort_order, created_at, updated_at
      FROM providers
    `)
    
    db.exec(`DROP TABLE providers`)
    db.exec(`ALTER TABLE providers_backup RENAME TO providers`)
    
    // Recreate index
    db.exec(`CREATE INDEX idx_providers_enabled ON providers(enabled)`)
  }
}
