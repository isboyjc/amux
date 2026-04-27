/**
 * Path resolver for Code Switch
 * Handles cross-platform path detection and validation for multiple CLIs
 */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { CliType, getCliDefinition } from '../../types/cli'

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

  /**
   * 获取指定 CLI 的配置文件路径（根据当前操作系统）
   * V2: 支持多 CLI
   */
  static getConfigPath(cliType: CliType): string | null {
    const cliDef = getCliDefinition(cliType)
    const platform = process.platform as 'darwin' | 'win32' | 'linux'
    return cliDef.configPaths[platform] || cliDef.configPaths.linux
  }

  /**
   * 获取 Codex 配置目录
   */
  static getCodexConfigDir(): string {
    return path.join(this.getHomeDir(), '.codex')
  }

  /**
   * 获取 Codex config.toml 路径
   */
  static getCodexConfigPath(): string {
    return path.join(this.getCodexConfigDir(), 'config.toml')
  }

  /**
   * 获取 Codex auth.json 路径
   */
  static getCodexAuthPath(): string {
    return path.join(this.getCodexConfigDir(), 'auth.json')
  }
}
