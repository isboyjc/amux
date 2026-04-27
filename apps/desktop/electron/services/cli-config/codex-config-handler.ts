/**
 * Codex 配置处理器
 * 处理 ~/.codex/config.toml 的读取、写入、备份和恢复
 * 
 * 注意：Node.js TOML 库不像 Rust 的 toml_edit 那样能完美保留注释和格式，
 * 可能会丢失原始文件的注释和格式。建议在 UI 中提示用户。
 */

import * as fs from 'fs'
import * as path from 'path'
import TOML from '@iarna/toml'
import { PathResolver } from '../code-switch/path-resolver'

export interface CodexConfig {
  model_provider?: {
    base_url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export class CodexConfigHandler {
  /**
   * 读取 Codex 配置
   */
  static read(configPath: string): CodexConfig {
    const normalizedPath = PathResolver.normalizePath(configPath)

    if (!fs.existsSync(normalizedPath)) {
      return {}
    }

    const content = fs.readFileSync(normalizedPath, 'utf-8')
    try {
      return TOML.parse(content) as CodexConfig
    } catch (error) {
      throw new Error(`解析 Codex 配置失败: ${error}`)
    }
  }

  /**
   * 写入代理接管配置
   * 参考 cc-switch 的实现：
   * 1. 更新 model_provider.base_url 为代理 URL
   * 
   * 注意：Codex 的 API key 通常存储在 ~/.codex/auth.json 中，
   * 这里只处理 base_url 的修改
   */
  static async writeProxyTakeover(configPath: string, proxyUrl: string): Promise<void> {
    const config = this.read(configPath)

    // 更新 model_provider.base_url
    if (!config.model_provider) {
      config.model_provider = {}
    }
    config.model_provider.base_url = proxyUrl

    // 序列化并写入
    const content = TOML.stringify(config as any)
    await this.atomicWrite(configPath, content)
  }

  /**
   * 恢复原始配置
   */
  static async restore(configPath: string, originalContent: string): Promise<void> {
    await this.atomicWrite(configPath, originalContent)
  }

  /**
   * 检查配置文件是否存在
   */
  static exists(configPath: string): boolean {
    const normalizedPath = PathResolver.normalizePath(configPath)
    return fs.existsSync(normalizedPath)
  }

  /**
   * 原子写入
   */
  private static async atomicWrite(filePath: string, content: string): Promise<void> {
    const normalizedPath = PathResolver.normalizePath(filePath)
    const tempPath = `${normalizedPath}.tmp`

    try {
      const dir = path.dirname(normalizedPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(tempPath, content, 'utf-8')
      fs.renameSync(tempPath, normalizedPath)
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath)
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error
    }
  }

  /**
   * 验证配置是否为代理模式
   */
  static isProxyMode(configPath: string, expectedProxyUrl: string): boolean {
    try {
      const config = this.read(configPath)
      return config.model_provider?.base_url === expectedProxyUrl
    } catch {
      return false
    }
  }

  /**
   * 读取 auth.json（如果存在）
   * Codex 的 API key 存储在 auth.json 中
   */
  static readAuthFile(configDir: string): Record<string, unknown> | null {
    const authPath = path.join(configDir, 'auth.json')
    const normalizedPath = PathResolver.normalizePath(authPath)

    if (!fs.existsSync(normalizedPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(normalizedPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error('读取 Codex auth.json 失败:', error)
      return null
    }
  }

  /**
   * 提取 API key（从 auth.json）
   * 注意：Codex auth.json 的结构可能是 { "api_key": "xxx" } 或其他格式
   */
  static extractApiKey(configPath: string): string | null {
    const configDir = path.dirname(PathResolver.normalizePath(configPath))
    const auth = this.readAuthFile(configDir)

    if (!auth) {
      return null
    }

    // 尝试常见的 key 字段
    return (auth.api_key || auth.apiKey || auth.key || null) as string | null
  }
}
