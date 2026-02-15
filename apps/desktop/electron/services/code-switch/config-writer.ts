/**
 * Config writer for Code Switch
 * Writes Claude Code proxy configuration to ~/.claude/settings.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { PathResolver } from './path-resolver'

export interface WriteClaudeCodeConfigOptions {
  configPath: string
  proxyUrl: string
  apiKey: string
}

export class ConfigWriter {
  /**
   * Model override env vars that must be removed during takeover.
   * If left in place, Claude Code will send these model names in requests,
   * bypassing our model mapping entirely.
   * Reference: CC-Switch proxy.rs CLAUDE_MODEL_OVERRIDE_ENV_KEYS
   */
  private static readonly MODEL_OVERRIDE_KEYS = [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_REASONING_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_SMALL_FAST_MODEL'
  ]

  /**
   * Write Claude Code configuration
   * Updates ~/.claude/settings.json with proxy URL and API key.
   * Creates file and directory if they do not exist.
   * Also removes model-override env vars so Claude Code uses its standard model names
   * (which our proxy will then map to the target provider model).
   */
  static async writeClaudeCode(options: WriteClaudeCodeConfigOptions): Promise<void> {
    const { configPath, proxyUrl, apiKey } = options
    const normalizedPath = PathResolver.normalizePath(configPath)

    let config: Record<string, unknown> & { env?: Record<string, string> }

    if (fs.existsSync(normalizedPath)) {
      const content = fs.readFileSync(normalizedPath, 'utf-8')
      config = JSON.parse(content) as typeof config
    } else {
      config = {}
    }

    if (!config.env) {
      config.env = {}
    }

    // Set proxy URL and API key
    config.env.ANTHROPIC_BASE_URL = proxyUrl
    config.env.ANTHROPIC_API_KEY = apiKey

    // Remove model override env vars so Claude Code sends standard model names
    for (const key of this.MODEL_OVERRIDE_KEYS) {
      delete config.env[key]
    }

    await this.atomicWrite(normalizedPath, JSON.stringify(config, null, 2))
  }

  /**
   * Atomic write operation
   * Writes to a temporary file first, then renames to prevent corruption
   */
  private static async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

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
   * Verify written configuration
   * Checks if the configuration was written correctly
   */
  static verifyClaudeCodeConfig(configPath: string, expectedProxyUrl: string): boolean {
    try {
      const normalizedPath = PathResolver.normalizePath(configPath)
      const content = fs.readFileSync(normalizedPath, 'utf-8')
      const config = JSON.parse(content)

      return (
        config.env &&
        config.env.ANTHROPIC_BASE_URL === expectedProxyUrl &&
        typeof config.env.ANTHROPIC_API_KEY === 'string'
      )
    } catch {
      return false
    }
  }
}
