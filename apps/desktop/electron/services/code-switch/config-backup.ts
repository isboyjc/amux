/**
 * Config backup for Code Switch
 * Handles backup and restore of CLI configuration files
 */

import * as fs from 'fs'
import * as path from 'path'
import { PathResolver } from './path-resolver'

export class ConfigBackup {
  /**
   * Backup Claude Code configuration
   * Returns JSON string of the entire settings.json
   */
  static backup(cliType: 'claudecode' | 'codex', configPath: string): string {
    const normalizedPath = PathResolver.normalizePath(configPath)

    if (cliType === 'claudecode') {
      // Claude Code: Backup settings.json
      const content = fs.readFileSync(normalizedPath, 'utf-8')
      const config = JSON.parse(content)
      return JSON.stringify(config, null, 2)
    } else {
      // Codex: Backup both auth.json and config.toml
      const authPath = normalizedPath
      const tomlPath = path.join(path.dirname(authPath), 'config.toml')

      const backup: { auth?: unknown; config?: string } = {}

      if (fs.existsSync(authPath)) {
        const authContent = fs.readFileSync(authPath, 'utf-8')
        backup.auth = JSON.parse(authContent)
      }

      if (fs.existsSync(tomlPath)) {
        backup.config = fs.readFileSync(tomlPath, 'utf-8')
      }

      return JSON.stringify(backup, null, 2)
    }
  }

  /**
   * Restore configuration from backup
   * Restores the configuration files from the backup JSON string
   */
  static async restore(
    cliType: 'claudecode' | 'codex',
    configPath: string,
    backupContent: string
  ): Promise<void> {
    const normalizedPath = PathResolver.normalizePath(configPath)

    if (cliType === 'claudecode') {
      // Claude Code: Restore settings.json
      const config = JSON.parse(backupContent)
      await this.atomicWrite(normalizedPath, JSON.stringify(config, null, 2))
    } else {
      // Codex: Restore auth.json and config.toml
      const backup = JSON.parse(backupContent) as {
        auth?: unknown
        config?: string
      }

      const authPath = normalizedPath
      const tomlPath = path.join(path.dirname(authPath), 'config.toml')

      if (backup.auth) {
        await this.atomicWrite(authPath, JSON.stringify(backup.auth, null, 2))
      }

      if (backup.config) {
        await this.atomicWrite(tomlPath, backup.config)
      }
    }
  }

  /**
   * Atomic write operation
   * Writes to a temporary file first, then renames to prevent corruption
   */
  private static async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`

    try {
      // Write to temporary file
      fs.writeFileSync(tempPath, content, 'utf-8')

      // Atomic rename
      fs.renameSync(tempPath, filePath)
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
      throw error
    }
  }

  /**
   * Verify backup integrity
   * Checks if the backup can be parsed correctly
   */
  static verifyBackup(cliType: 'claudecode' | 'codex', backupContent: string): boolean {
    try {
      const parsed = JSON.parse(backupContent)

      if (cliType === 'claudecode') {
        // Claude Code backup should be a valid object
        return typeof parsed === 'object' && parsed !== null
      } else {
        // Codex backup should have auth or config
        return (
          typeof parsed === 'object' &&
          parsed !== null &&
          ('auth' in parsed || 'config' in parsed)
        )
      }
    } catch {
      return false
    }
  }
}
