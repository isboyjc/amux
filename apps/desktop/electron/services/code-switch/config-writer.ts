/**
 * Config writer for Code Switch
 * Writes Code Switch proxy configuration to CLI config files
 */

import * as fs from 'fs'
import * as path from 'path'
import { PathResolver } from './path-resolver'
import { getDefaultConfig } from '../presets/code-switch-preset'

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
   * Write Codex configuration (Unified Endpoint)
   * Updates auth.json and config.toml with Amux proxy configuration
   * 
   * Unified Endpoint Approach:
   * - All providers' models are aggregated in /v1/models
   * - Model names use format: provider/model (e.g., deepseek/deepseek-chat)
   * - No model mapping needed - users select directly in Codex UI
   * - Single provider in config.toml (amux) points to our proxy
   */
  static async writeCodex(options: WriteCodexConfigOptions): Promise<void> {
    const { authPath, proxyUrl, apiKey } = options
    const normalizedAuthPath = PathResolver.normalizePath(authPath)
    const tomlPath = path.join(path.dirname(normalizedAuthPath), 'config.toml')

    // Update auth.json with API key
    const authContent = fs.readFileSync(normalizedAuthPath, 'utf-8')
    const authConfig = JSON.parse(authContent)
    authConfig.OPENAI_API_KEY = apiKey

    await this.atomicWrite(normalizedAuthPath, JSON.stringify(authConfig, null, 2))

    // Generate complete config.toml with unified endpoint setup
    const configToml = this.generateCodexUnifiedConfig(proxyUrl)
    
    await this.atomicWrite(tomlPath, configToml)
  }

  /**
   * Generate Codex unified endpoint config.toml
   * 
   * This config points Codex to Amux proxy with a single provider entry.
   * All provider models will be available via /v1/models endpoint.
   * 
   * Note: Configuration is loaded from code-switch preset file.
   */
  private static generateCodexUnifiedConfig(proxyUrl: string): string {
    // Load default config from preset
    const config = getDefaultConfig('codex')
    const modelProvider = config.modelProvider || 'amux'
    const model = config.model || 'gpt-5.2-codex'
    const modelReasoningEffort = config.modelReasoningEffort || 'high'
    const disableResponseStorage = config.disableResponseStorage !== false
    const wireApi = config.wireApi || 'responses'
    const requiresOpenaiAuth = config.requiresOpenaiAuth !== false

    return `# Amux Unified Endpoint Configuration
# Model names format: provider/model (e.g., deepseek/deepseek-chat)
# Default Codex models can be mapped in Amux Desktop
# All enabled providers' models are available via custom model selection

model_provider = "${modelProvider}"
model = "${model}"
model_reasoning_effort = "${modelReasoningEffort}"
disable_response_storage = ${disableResponseStorage}

[model_providers.${modelProvider}]
name = "${modelProvider}"
base_url = "${proxyUrl}"
wire_api = "${wireApi}"
requires_openai_auth = ${requiresOpenaiAuth}
`
  }

  /**
   * 更新 Codex config.toml 中的默认模型
   * 仅修改 model 字段，其他配置保持不变
   * 
   * @param configPath - config.toml 文件路径
   * @param modelName - 模型名（可以是默认模型或 provider/model）
   */
  static async updateCodexModel(
    configPath: string, 
    modelName: string
  ): Promise<void> {
    const normalizedPath = PathResolver.normalizePath(configPath)
    
    console.log(`[ConfigWriter] Updating Codex model: ${modelName}`)
    console.log(`[ConfigWriter] Config path: ${normalizedPath}`)
    
    // 检查文件是否存在
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Config file not found: ${normalizedPath}`)
    }
    
    // 读取现有配置
    const content = fs.readFileSync(normalizedPath, 'utf-8')
    
    // 使用正则替换 model 行
    const updatedContent = content.replace(
      /^model\s*=\s*"[^"]*"/m,
      `model = "${modelName}"`
    )
    
    // 原子写入
    await this.atomicWrite(normalizedPath, updatedContent)
    
    console.log(`[ConfigWriter] ✅ Model updated: ${modelName}`)
  }

  /**
   * 读取 Codex config.toml 中的当前模型
   * 
   * @param configPath - config.toml 文件路径
   * @returns 当前模型名，如果文件不存在或解析失败则返回默认值
   */
  static readCodexModel(configPath: string): string {
    const normalizedPath = PathResolver.normalizePath(configPath)
    
    // 文件不存在，返回默认值
    if (!fs.existsSync(normalizedPath)) {
      console.log(`[ConfigWriter] Config file not found, returning default model`)
      return 'gpt-5.2-codex'
    }
    
    try {
      const content = fs.readFileSync(normalizedPath, 'utf-8')
      
      // 解析 model 字段
      const match = content.match(/^model\s*=\s*"([^"]*)"/m)
      
      if (match && match[1]) {
        console.log(`[ConfigWriter] Current model: ${match[1]}`)
        return match[1]
      }
      
      console.log(`[ConfigWriter] Model field not found, returning default`)
      return 'gpt-5.2-codex'
    } catch (error) {
      console.error(`[ConfigWriter] Failed to read config:`, error)
      return 'gpt-5.2-codex'
    }
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
