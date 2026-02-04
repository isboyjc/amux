import type { Database } from 'better-sqlite3'

export const migration003ProviderPaths = {
  version: 3,
  name: 'provider_paths',
  
  up(db: Database): void {
    // Add chatPath and modelsPath columns to providers table
    const tableInfo = db.prepare('PRAGMA table_info(providers)').all() as Array<{ name: string }>
    const columns = tableInfo.map(col => col.name)
    
    if (!columns.includes('chat_path')) {
      db.exec('ALTER TABLE providers ADD COLUMN chat_path TEXT')
    }
    
    if (!columns.includes('models_path')) {
      db.exec('ALTER TABLE providers ADD COLUMN models_path TEXT')
    }
  },
  
  down(_db: Database): void {
    // SQLite doesn't support DROP COLUMN easily, so we'll just leave the columns
    console.log('Migration 003 down - columns will remain')
  }
}
