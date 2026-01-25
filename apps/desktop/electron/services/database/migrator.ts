/**
 * Database migration system
 */

import type { DatabaseInstance, Migration, SchemaMigrationRow } from './types'

// All migrations (imported in order)
import { migration001Initial } from './migrations/001_initial'
import { migration002ProviderLogo } from './migrations/002_provider_logo'
import { migration003ProviderPaths } from './migrations/003_provider_paths'
import { migration004ProviderPassthrough } from './migrations/004_provider_passthrough'
import { migration005Tunnel } from './migrations/005_tunnel'
import { migration006RequestSource } from './migrations/006_request_source'
import { migration007FixGeminiAdapter } from './migrations/007_fix_gemini_adapter'
import { migration008FixGeminiStreamEndpoint } from './migrations/008_fix_gemini_stream_endpoint'
import { migration009 } from './migrations/009_oauth_accounts'
import { migration010FixHealthStatus } from './migrations/010_fix_health_status'

// Register all migrations here
const migrations: Migration[] = [
  migration001Initial,
  migration002ProviderLogo,
  migration003ProviderPaths,
  migration004ProviderPassthrough,
  migration005Tunnel,
  migration006RequestSource,
  migration007FixGeminiAdapter,
  migration008FixGeminiStreamEndpoint,
  migration009,
  migration010FixHealthStatus
]

/**
 * Get current database version from user_version pragma
 */
export function getCurrentVersion(db: DatabaseInstance): number {
  const result = db.pragma('user_version', { simple: true })
  return typeof result === 'number' ? result : 0
}

/**
 * Set database version using user_version pragma
 */
export function setVersion(db: DatabaseInstance, version: number): void {
  db.pragma(`user_version = ${version}`)
}

/**
 * Ensure schema_migrations table exists
 */
function ensureMigrationsTable(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER DEFAULT (unixepoch() * 1000)
    )
  `)
}

/**
 * Record a migration as applied
 */
function recordMigration(db: DatabaseInstance, version: number): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO schema_migrations (version) VALUES (?)')
  stmt.run(version)
}

/**
 * Get list of applied migrations
 */
export function getAppliedMigrations(db: DatabaseInstance): SchemaMigrationRow[] {
  ensureMigrationsTable(db)
  const stmt = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
  return stmt.all() as SchemaMigrationRow[]
}

/**
 * Get pending migrations that haven't been applied yet
 */
export function getPendingMigrations(db: DatabaseInstance): Migration[] {
  const currentVersion = getCurrentVersion(db)
  return migrations.filter(m => m.version > currentVersion)
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: DatabaseInstance): number {
  ensureMigrationsTable(db)
  
  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = migrations.filter(m => m.version > currentVersion)
  
  if (pendingMigrations.length === 0) {
    console.log('[Migrator] Database is up to date')
    return currentVersion
  }
  
  console.log(`[Migrator] Running ${pendingMigrations.length} pending migration(s)`)
  
  let lastVersion = currentVersion
  
  for (const migration of pendingMigrations) {
    console.log(`[Migrator] Running migration ${migration.version}: ${migration.name}`)
    
    try {
      // Run migration in transaction
      db.transaction(() => {
        migration.up(db)
        setVersion(db, migration.version)
        recordMigration(db, migration.version)
      })()
      
      lastVersion = migration.version
      console.log(`[Migrator] Migration ${migration.version} completed`)
    } catch (error) {
      console.error(`[Migrator] Migration ${migration.version} failed:`, error)
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${error}`)
    }
  }
  
  console.log(`[Migrator] All migrations completed. Current version: ${lastVersion}`)
  return lastVersion
}

/**
 * Rollback the last migration
 */
export function rollbackLastMigration(db: DatabaseInstance): number {
  const currentVersion = getCurrentVersion(db)
  
  if (currentVersion === 0) {
    console.log('[Migrator] No migrations to rollback')
    return 0
  }
  
  const migration = migrations.find(m => m.version === currentVersion)
  
  if (!migration) {
    throw new Error(`Migration ${currentVersion} not found`)
  }
  
  console.log(`[Migrator] Rolling back migration ${migration.version}: ${migration.name}`)
  
  try {
    db.transaction(() => {
      migration.down(db)
      const previousVersion = currentVersion - 1
      setVersion(db, previousVersion)
      
      const stmt = db.prepare('DELETE FROM schema_migrations WHERE version = ?')
      stmt.run(currentVersion)
    })()
    
    const newVersion = currentVersion - 1
    console.log(`[Migrator] Rollback completed. Current version: ${newVersion}`)
    return newVersion
  } catch (error) {
    console.error(`[Migrator] Rollback failed:`, error)
    throw error
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(db: DatabaseInstance): {
  currentVersion: number
  latestVersion: number
  pendingCount: number
  migrations: Array<{
    version: number
    name: string
    applied: boolean
    appliedAt?: number
  }>
} {
  const currentVersion = getCurrentVersion(db)
  const applied = getAppliedMigrations(db)
  const appliedMap = new Map(applied.map(a => [a.version, a.applied_at]))
  
  return {
    currentVersion,
    latestVersion: migrations.length > 0 ? migrations[migrations.length - 1].version : 0,
    pendingCount: migrations.filter(m => m.version > currentVersion).length,
    migrations: migrations.map(m => ({
      version: m.version,
      name: m.name,
      applied: appliedMap.has(m.version),
      appliedAt: appliedMap.get(m.version)
    }))
  }
}
