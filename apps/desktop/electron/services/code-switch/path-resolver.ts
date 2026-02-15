/**
 * Path resolver for Code Switch
 * Handles cross-platform path detection and validation for Claude Code
 */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

export class PathResolver {
  /**
   * Get user home directory
   */
  static getHomeDir(): string {
    return os.homedir()
  }

  /**
   * Get Claude Code config directory
   * Typically: ~/.claude
   */
  static getClaudeConfigDir(): string {
    return path.join(this.getHomeDir(), '.claude')
  }

  /**
   * Get canonical Claude Code user settings path (official location).
   * Claude Code reads from ~/.claude/settings.json per official docs.
   * Use this when writing config so Claude Code picks it up.
   */
  static getClaudeCodeUserSettingsPath(): string {
    return path.join(this.getClaudeConfigDir(), 'settings.json')
  }

  /**
   * Get Claude Code settings path (for detection - only returns path if file exists).
   * Priority: ~/.claude/settings.json, then ~/.claude.json (legacy)
   */
  static getClaudeSettingsPath(): string | null {
    const possiblePaths = [
      this.getClaudeCodeUserSettingsPath(),
      path.join(this.getHomeDir(), '.claude.json')
    ]

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath
      }
    }

    return null
  }

  /**
   * Normalize path for cross-platform compatibility
   * Resolves ~ to home directory, handles relative paths
   */
  static normalizePath(inputPath: string): string {
    if (inputPath.startsWith('~')) {
      return path.join(this.getHomeDir(), inputPath.slice(1))
    }

    if (!path.isAbsolute(inputPath)) {
      return path.resolve(inputPath)
    }

    return inputPath
  }

  /**
   * Validate path exists and is accessible
   */
  static validatePath(filePath: string): {
    valid: boolean
    exists: boolean
    readable: boolean
    writable: boolean
    error?: string
  } {
    const normalizedPath = this.normalizePath(filePath)

    if (!fs.existsSync(normalizedPath)) {
      return {
        valid: false,
        exists: false,
        readable: false,
        writable: false,
        error: 'File does not exist'
      }
    }

    let readable = false
    let writable = false

    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK)
      readable = true
    } catch {
      // Not readable
    }

    try {
      fs.accessSync(normalizedPath, fs.constants.W_OK)
      writable = true
    } catch {
      // Not writable
    }

    const valid = readable && writable

    return {
      valid,
      exists: true,
      readable,
      writable,
      error: valid ? undefined : 'File is not readable or writable'
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  static ensureDir(dirPath: string): void {
    const normalizedPath = this.normalizePath(dirPath)
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true })
    }
  }
}
