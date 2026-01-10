/**
 * Database service - SQLite database initialization and management
 */

import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import type { DatabaseInstance, DatabaseOptions } from './types'

// Default database file name
const DEFAULT_DB_NAME = 'amux.db'

// Singleton database instance
let db: DatabaseInstance | null = null

/**
 * Get the default database path
 */
export function getDefaultDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, DEFAULT_DB_NAME)
}

/**
 * Initialize the database connection
 */
export function initDatabase(options: DatabaseOptions = {}): DatabaseInstance {
  if (db) {
    return db
  }

  const dbPath = options.path ?? getDefaultDatabasePath()
  const verbose = options.verbose ?? false
  const useWal = options.wal ?? true

  try {
    // Create database connection
    db = new Database(dbPath, {
      verbose: verbose ? console.log : undefined
    })

    // Enable WAL mode for better performance
    if (useWal) {
      db.pragma('journal_mode = WAL')
    }

    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // Set busy timeout to 5 seconds
    db.pragma('busy_timeout = 5000')

    console.log(`[Database] Initialized at ${dbPath}`)
    return db
  } catch (error) {
    console.error('[Database] Failed to initialize:', error)
    throw error
  }
}

/**
 * Get the database instance
 * @throws Error if database is not initialized
 */
export function getDatabase(): DatabaseInstance {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close()
      console.log('[Database] Connection closed')
    } catch (error) {
      console.error('[Database] Failed to close:', error)
    } finally {
      db = null
    }
  }
}

/**
 * Execute a database transaction
 */
export function transaction<T>(fn: (db: DatabaseInstance) => T): T {
  const database = getDatabase()
  return database.transaction(() => fn(database))()
}

/**
 * Check database integrity
 */
export function checkIntegrity(): boolean {
  const database = getDatabase()
  const result = database.pragma('integrity_check') as Array<{ integrity_check: string }>
  return result[0]?.integrity_check === 'ok'
}

/**
 * Get database file size in bytes
 */
export function getDatabaseSize(): number {
  const database = getDatabase()
  const result = database.pragma('page_count') as Array<{ page_count: number }>
  const pageSize = database.pragma('page_size') as Array<{ page_size: number }>
  return (result[0]?.page_count ?? 0) * (pageSize[0]?.page_size ?? 0)
}

/**
 * Vacuum the database to reclaim space
 */
export function vacuumDatabase(): void {
  const database = getDatabase()
  database.exec('VACUUM')
  console.log('[Database] Vacuum completed')
}

// Re-export types
export * from './types'
