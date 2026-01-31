/**
 * Config detector for Code Switch
 * Detects and validates CLI configuration files
 */

import * as fs from 'fs'
import { PathResolver } from './path-resolver'

export interface CLIConfigDetection {
  cliType: 'claudecode' | 'codex'
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
          // Fallback paths if auto-detection fails
          // This ensures we check all common locations
        ].filter((p): p is string => p !== null)

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf-8')
          const config = JSON.parse(content)

          // Basic validation - check if it looks like a Claude Code config
          // Claude Code config should have certain fields like env
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
   * Detect Codex configuration
   * Requires auth.json, config.toml is optional
   */
  static detectCodex(customPath?: string): CLIConfigDetection {
    const authPath = customPath
      ? PathResolver.normalizePath(customPath)
      : PathResolver.getCodexAuthPath()

    if (!fs.existsSync(authPath)) {
      return {
        cliType: 'codex',
        detected: false,
        configPath: null,
        valid: false,
        error: 'auth.json not found'
      }
    }

    try {
      const content = fs.readFileSync(authPath, 'utf-8')
      const config = JSON.parse(content)

      // Basic validation - check if it looks like a Codex auth config
      if (typeof config === 'object' && config !== null) {
        return {
          cliType: 'codex',
          detected: true,
          configPath: authPath,
          valid: true
        }
      }

      return {
        cliType: 'codex',
        detected: true,
        configPath: authPath,
        valid: false,
        error: 'Invalid config structure'
      }
    } catch (error) {
      return {
        cliType: 'codex',
        detected: true,
        configPath: authPath,
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid JSON format'
      }
    }
  }

  /**
   * Detect all CLI configurations
   */
  static detectAll(): CLIConfigDetection[] {
    return [this.detectClaudeCode(), this.detectCodex()]
  }

  /**
   * Validate custom config path
   */
  static validateCustomPath(
    cliType: 'claudecode' | 'codex',
    customPath: string
  ): CLIConfigDetection {
    if (cliType === 'claudecode') {
      return this.detectClaudeCode(customPath)
    } else {
      return this.detectCodex(customPath)
    }
  }
}
