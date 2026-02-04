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
  authPath?: string | null  // For Codex: auth.json path
  tomlPath?: string | null  // For Codex: config.toml path
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
   * Requires both auth.json and config.toml
   */
  static detectCodex(customPath?: string): CLIConfigDetection {
    const authPath = customPath
      ? PathResolver.normalizePath(customPath)
      : PathResolver.getCodexAuthPath()
    
    const tomlPath = customPath
      ? PathResolver.normalizePath(customPath.replace('auth.json', 'config.toml'))
      : PathResolver.getCodexConfigPath()

    // Check auth.json
    if (!fs.existsSync(authPath)) {
      return {
        cliType: 'codex',
        detected: false,
        configPath: null,
        authPath: null,
        tomlPath: null,
        valid: false,
        error: 'auth.json not found'
      }
    }

    // Check config.toml
    if (!fs.existsSync(tomlPath)) {
      return {
        cliType: 'codex',
        detected: false,
        configPath: null,
        authPath,
        tomlPath: null,
        valid: false,
        error: 'config.toml not found'
      }
    }

    try {
      // Validate auth.json
      const authContent = fs.readFileSync(authPath, 'utf-8')
      const authConfig = JSON.parse(authContent)

      if (typeof authConfig !== 'object' || authConfig === null) {
        return {
          cliType: 'codex',
          detected: true,
          configPath: authPath,
          authPath,
          tomlPath,
          valid: false,
          error: 'Invalid auth.json structure'
        }
      }

      // Validate config.toml (just check it exists and is readable)
      const tomlContent = fs.readFileSync(tomlPath, 'utf-8')
      if (!tomlContent) {
        return {
          cliType: 'codex',
          detected: true,
          configPath: authPath,
          authPath,
          tomlPath,
          valid: false,
          error: 'config.toml is empty'
        }
      }

      // Both files exist and are valid
      return {
        cliType: 'codex',
        detected: true,
        configPath: authPath,  // Primary config (for backwards compatibility)
        authPath,
        tomlPath,
        valid: true
      }
    } catch (error) {
      return {
        cliType: 'codex',
        detected: true,
        configPath: authPath,
        authPath,
        tomlPath,
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid file format'
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
