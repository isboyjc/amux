/**
 * Config writer for Code Switch
 * Writes Code Switch proxy configuration to CLI config files
 */

import * as fs from 'fs'
import * as path from 'path'
import { PathResolver } from './path-resolver'

export interface WriteClaudeCodeConfigOptions {
  configPath: string
  proxyUrl: string
  apiKey: string
}

export interface WriteCodexConfigOptions {
  authPath: string
  proxyUrl: string
  apiKey: string
}

export class ConfigWriter {
  /**
   * Write Claude Code configuration
   * Updates settings.json with proxy URL and API key
   */
  static async writeClaudeCode(options: WriteClaudeCodeConfigOptions): Promise<void> {
    const { configPath, proxyUrl, apiKey } = options
    const normalizedPath = PathResolver.normalizePath(configPath)

    // Read existing config
    const content = fs.readFileSync(normalizedPath, 'utf-8')
    const config = JSON.parse(content)

    // Ensure env object exists
    if (!config.env) {
      config.env = {}
    }

    // Write proxy configuration
    config.env.ANTHROPIC_BASE_URL = proxyUrl
    config.env.ANTHROPIC_API_KEY = apiKey

    // Atomic write
    await this.atomicWrite(normalizedPath, JSON.stringify(config, null, 2))
  }

  /**
   * Write Codex configuration
   * Updates auth.json and config.toml with proxy URL and API key
   */
  static async writeCodex(options: WriteCodexConfigOptions): Promise<void> {
    const { authPath, proxyUrl, apiKey } = options
    const normalizedAuthPath = PathResolver.normalizePath(authPath)
    const tomlPath = path.join(path.dirname(normalizedAuthPath), 'config.toml')

    // Update auth.json
    const authContent = fs.readFileSync(normalizedAuthPath, 'utf-8')
    const authConfig = JSON.parse(authContent)

    // Set API key in auth.json
    authConfig.api_key = apiKey

    await this.atomicWrite(normalizedAuthPath, JSON.stringify(authConfig, null, 2))

    // Update config.toml
    let tomlContent = ''
    if (fs.existsSync(tomlPath)) {
      tomlContent = fs.readFileSync(tomlPath, 'utf-8')
    }

    // Update or add base_url in TOML
    const baseUrlRegex = /^base_url\s*=\s*"[^"]*"/m
    const newBaseUrl = `base_url = "${proxyUrl}"`

    if (baseUrlRegex.test(tomlContent)) {
      // Replace existing base_url
      tomlContent = tomlContent.replace(baseUrlRegex, newBaseUrl)
    } else {
      // Add base_url at the beginning
      tomlContent = `${newBaseUrl}\n${tomlContent}`
    }

    await this.atomicWrite(tomlPath, tomlContent)
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

  /**
   * Verify Codex configuration
   */
  static verifyCodexConfig(authPath: string, expectedProxyUrl: string): boolean {
    try {
      const normalizedAuthPath = PathResolver.normalizePath(authPath)
      const tomlPath = path.join(path.dirname(normalizedAuthPath), 'config.toml')

      // Check auth.json
      const authContent = fs.readFileSync(normalizedAuthPath, 'utf-8')
      const authConfig = JSON.parse(authContent)

      if (typeof authConfig.api_key !== 'string') {
        return false
      }

      // Check config.toml
      if (fs.existsSync(tomlPath)) {
        const tomlContent = fs.readFileSync(tomlPath, 'utf-8')
        const baseUrlRegex = /^base_url\s*=\s*"([^"]*)"/m
        const match = tomlContent.match(baseUrlRegex)

        if (!match || match[1] !== expectedProxyUrl) {
          return false
        }
      }

      return true
    } catch {
      return false
    }
  }
}
