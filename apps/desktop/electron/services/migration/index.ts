import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import Database from 'better-sqlite3'

/**
 * Data Migration Service
 * 
 * Migrates user data from old directory (@amux) to new directory (Amux)
 */

const OLD_APP_NAME = '@amux/desktop'  // Full package name creates nested directory
const NEW_APP_NAME = 'Amux'
const MIGRATION_MARKER = '.migrated-to-Amux'

interface MigrationResult {
  success: boolean
  migrated: boolean
  message: string
  oldPath?: string
  newPath?: string
}

/**
 * Get the old userData path (using @amux/desktop package name)
 * The old package name "@amux/desktop" creates nested directory structure:
 * - macOS: ~/Library/Application Support/@amux/desktop/
 * - Windows: %APPDATA%\@amux\desktop\
 * - Linux: ~/.config/@amux/desktop/
 */
function getOldUserDataPath(): string {
  const homedir = app.getPath('home')
  
  switch (process.platform) {
    case 'darwin':
      return join(homedir, 'Library', 'Application Support', '@amux', 'desktop')
    case 'win32':
      return join(app.getPath('appData'), '@amux', 'desktop')
    case 'linux':
      return join(homedir, '.config', '@amux', 'desktop')
    default:
      return join(homedir, '.config', '@amux', 'desktop')
  }
}

/**
 * Get the new userData path (using Amux name)
 */
function getNewUserDataPath(): string {
  return app.getPath('userData')
}

/**
 * Check if old directory has been migrated
 */
function isAlreadyMigrated(oldPath: string): boolean {
  const markerPath = join(oldPath, MIGRATION_MARKER)
  return existsSync(markerPath)
}

/**
 * Copy directory recursively
 */
function copyDirectoryRecursive(src: string, dest: string): void {
  // Create destination directory
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }
  
  // Read all items in source directory
  const items = readdirSync(src)
  
  for (const item of items) {
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    const stat = statSync(srcPath)
    
    if (stat.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectoryRecursive(srcPath, destPath)
    } else if (stat.isFile()) {
      // Copy file
      const destDir = dirname(destPath)
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }
      copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Verify that critical files were migrated correctly
 */
function verifyMigration(newPath: string): boolean {
  try {
    // Check if database file exists and is valid
    const dbPath = join(newPath, 'amux.db')
    if (existsSync(dbPath)) {
      // Try to open database to verify it's valid
      const db = new Database(dbPath, { readonly: true })
      db.close()
    }
    
    // Check if master key file exists (if it should exist)
    const keyPath = join(newPath, '.master-key')
    // Key file is optional, so just log if it exists
    if (existsSync(keyPath)) {
      // Try to read it to verify it's accessible
      readFileSync(keyPath)
    }
    
    return true
  } catch (error) {
    console.error('[Migration] Verification failed:', error)
    return false
  }
}

/**
 * Create migration marker file in old directory
 */
function createMigrationMarker(oldPath: string): void {
  const markerPath = join(oldPath, MIGRATION_MARKER)
  const timestamp = new Date().toISOString()
  const content = JSON.stringify({
    migratedAt: timestamp,
    migratedTo: NEW_APP_NAME,
    message: 'This directory has been migrated. You can safely delete it after confirming the new version works correctly.'
  }, null, 2)
  
  writeFileSync(markerPath, content, 'utf-8')
}

/**
 * Migrate user data from old directory to new directory
 * This function runs automatically on app startup and is silent to the user
 */
export async function migrateUserData(): Promise<MigrationResult> {
  try {
    const oldPath = getOldUserDataPath()
    const newPath = getNewUserDataPath()
    
    console.log('[Migration] Checking for data migration...')
    console.log('[Migration] Old path:', oldPath)
    console.log('[Migration] New path:', newPath)
    
    // Check if old directory exists
    if (!existsSync(oldPath)) {
      console.log('[Migration] Old directory does not exist, skipping migration')
      return {
        success: true,
        migrated: false,
        message: 'No old data to migrate'
      }
    }
    
    // Check if already migrated
    if (isAlreadyMigrated(oldPath)) {
      console.log('[Migration] Data already migrated (marker file found)')
      return {
        success: true,
        migrated: false,
        message: 'Data was already migrated previously',
        oldPath,
        newPath
      }
    }
    
    // Check if new directory already has data (fresh install or manual setup)
    const newDirExists = existsSync(newPath)
    if (newDirExists) {
      const newDirItems = readdirSync(newPath)
      if (newDirItems.length > 0) {
        console.log('[Migration] New directory already has data, skipping migration')
        // Create marker to avoid checking again
        createMigrationMarker(oldPath)
        return {
          success: true,
          migrated: false,
          message: 'New directory already has data',
          oldPath,
          newPath
        }
      }
    }
    
    console.log('[Migration] Starting data migration...')
    
    // Create new directory if needed
    if (!newDirExists) {
      mkdirSync(newPath, { recursive: true })
    }
    
    // Copy all files and directories
    copyDirectoryRecursive(oldPath, newPath)
    console.log('[Migration] Files copied successfully')
    
    // Verify migration
    if (!verifyMigration(newPath)) {
      console.error('[Migration] Verification failed, migration may be incomplete')
      return {
        success: false,
        migrated: false,
        message: 'Migration verification failed',
        oldPath,
        newPath
      }
    }
    
    console.log('[Migration] Verification passed')
    
    // Create migration marker
    createMigrationMarker(oldPath)
    console.log('[Migration] Migration completed successfully')
    console.log('[Migration] Old data is kept as backup and can be manually deleted from:', oldPath)
    
    return {
      success: true,
      migrated: true,
      message: 'Data migrated successfully',
      oldPath,
      newPath
    }
  } catch (error) {
    console.error('[Migration] Error during migration:', error)
    return {
      success: false,
      migrated: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
