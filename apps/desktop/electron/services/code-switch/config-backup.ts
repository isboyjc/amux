/**
 * Config backup for Code Switch
 * Handles backup and restore of Claude Code configuration files
 */

import * as fs from 'fs'
import * as path from 'path'
import { PathResolver } from './path-resolver'

export class ConfigBackup {
  /**
   * Backup Claude Code configuration
   * Returns JSON string of the entire settings.json
   */
  static backup(configPath: string): string {
    const normalizedPath = PathResolver.normalizePath(configPath)

    // File doesn't exist — nothing to back up, return empty object
    if (!fs.existsSync(normalizedPath)) {
      return JSON.stringify({}, null, 2)
    }

    try {
      const content = fs.readFileSync(normalizedPath, 'utf-8')
      const config = JSON.parse(content)
      return JSON.stringify(config, null, 2)
    } catch {
      // Invalid JSON — return empty object for safe restore
      return JSON.stringify({}, null, 2)
    }
  }

  /**
   * Restore configuration from backup
   * Restores settings.json from the backup JSON string
   */
  static async restore(configPath: string, backupContent: string): Promise<void> {
    const normalizedPath = PathResolver.normalizePath(configPath)
    const config = JSON.parse(backupContent)
    await this.atomicWrite(normalizedPath, JSON.stringify(config, null, 2))
  }

  /**
   * Atomic write operation
   * Writes to a temporary file first, then renames to prevent corruption
   */
  private static async atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tempPath = `${filePath}.tmp`

    try {
      fs.writeFileSync(tempPath, content, 'utf-8')
      fs.renameSync(tempPath, filePath)
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
      throw error
    }
  }

  /**
   * Verify backup integrity
   */
  static verifyBackup(backupContent: string): boolean {
    try {
      const parsed = JSON.parse(backupContent)
      return typeof parsed === 'object' && parsed !== null
    } catch {
      return false
    }
  }
}
