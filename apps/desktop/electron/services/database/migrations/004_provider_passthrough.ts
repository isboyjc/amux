/**
 * Add Provider Passthrough Proxy support
 * 
 * Adds fields to enable providers to be used as passthrough proxies
 * without format conversion (direct forwarding to provider API).
 */

import type { Database } from 'better-sqlite3'

export const migration004ProviderPassthrough = {
  version: 4,
  name: 'provider_passthrough',
  
  up(db: Database): void {
    // Check existing columns
    const tableInfo = db.prepare('PRAGMA table_info(providers)').all() as Array<{ name: string }>
    const columns = tableInfo.map(col => col.name)
    
    // Add enable_as_proxy column - whether this provider is enabled as a passthrough proxy
    if (!columns.includes('enable_as_proxy')) {
      db.exec('ALTER TABLE providers ADD COLUMN enable_as_proxy INTEGER DEFAULT 0')
    }
    
    // Add proxy_path column - URL path identifier for passthrough proxy
    // This must be unique across all providers that have passthrough enabled
    if (!columns.includes('proxy_path')) {
      db.exec('ALTER TABLE providers ADD COLUMN proxy_path TEXT')
    }
    
    // Create unique index on proxy_path (only for non-null values)
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_proxy_path 
      ON providers(proxy_path) 
      WHERE proxy_path IS NOT NULL
    `)
    
    console.log('[Migration 004] Provider passthrough support added')
  },
  
  down(db: Database): void {
    // Drop the index first
    db.exec('DROP INDEX IF EXISTS idx_providers_proxy_path')
    
    // SQLite doesn't support DROP COLUMN easily before 3.35.0
    // In production, these columns would remain but be unused
    console.log('[Migration 004 down] Columns will remain but be unused')
  }
}
