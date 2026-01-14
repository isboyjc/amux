/**
 * Add request source field to distinguish between local and tunnel requests
 */

import type { Migration, DatabaseInstance } from '../types'

export const migration006RequestSource: Migration = {
  version: 6,
  name: 'request_source',
  
  up(db: DatabaseInstance): void {
    // Add source column to request_logs table
    // Values: 'local' | 'tunnel'
    db.exec(`
      ALTER TABLE request_logs 
      ADD COLUMN source TEXT DEFAULT 'local'
    `)
    
    console.log('[Migration 006] Added source column to request_logs table')
  },
  
  down(db: DatabaseInstance): void {
    // SQLite doesn't support DROP COLUMN directly
    // We need to recreate the table without the column
    
    // 1. Create new table without source column
    db.exec(`
      CREATE TABLE request_logs_backup (
        id TEXT PRIMARY KEY,
        proxy_id TEXT,
        proxy_path TEXT,
        source_model TEXT,
        target_model TEXT,
        status_code INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        latency_ms INTEGER,
        request_body TEXT,
        response_body TEXT,
        error TEXT,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        FOREIGN KEY (proxy_id) REFERENCES bridge_proxies(id) ON DELETE SET NULL
      )
    `)
    
    // 2. Copy data (without source column)
    db.exec(`
      INSERT INTO request_logs_backup 
      SELECT 
        id, proxy_id, proxy_path, source_model, target_model,
        status_code, input_tokens, output_tokens, latency_ms,
        request_body, response_body, error, created_at
      FROM request_logs
    `)
    
    // 3. Drop old table
    db.exec(`DROP TABLE request_logs`)
    
    // 4. Rename backup table
    db.exec(`ALTER TABLE request_logs_backup RENAME TO request_logs`)
    
    // 5. Recreate indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_proxy_path ON request_logs(proxy_path)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_proxy_id ON request_logs(proxy_id)`)
    
    console.log('[Migration 006] Removed source column from request_logs table')
  }
}
