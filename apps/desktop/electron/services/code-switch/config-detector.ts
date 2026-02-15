/**
 * Config detector for Code Switch
 * Detects and validates Claude Code configuration files
 */

import * as fs from 'fs'
import { PathResolver } from './path-resolver'

export interface CLIConfigDetection {
  cliType: 'claudecode'
  detected: boolean
  configPath: string | null
  valid: boolean
  error?: string
}

export class ConfigDetector {
  /**
   * Detect Claude Code configuration
   * Searches for settings.json in standard locations
   */
  static detectClaudeCode(customPath?: string): CLIConfigDetection {
    const possiblePaths = customPath
      ? [PathResolver.normalizePath(customPath)]
      : [
          PathResolver.getClaudeSettingsPath(),
        ].filter((p): p is string => p !== null)

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf-8')
          const config = JSON.parse(content)

          if (typeof config === 'object' && config !== null) {
            return {
              cliType: 'claudecode',
              detected: true,
              configPath,
              valid: true
            }
          }
        } catch (error) {
          return {
            cliType: 'claudecode',
            detected: true,
            configPath,
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid JSON format'
          }
        }
      }
    }

    return {
      cliType: 'claudecode',
      detected: false,
      configPath: null,
      valid: false,
      error: 'Config file not found'
    }
  }

  /**
   * Detect all CLI configurations
   */
  static detectAll(): CLIConfigDetection[] {
    return [this.detectClaudeCode()]
  }

  /**
   * Validate custom config path
   */
  static validateCustomPath(customPath: string): CLIConfigDetection {
    return this.detectClaudeCode(customPath)
  }
}
