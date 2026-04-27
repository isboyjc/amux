/**
 * Claude Code 配置处理器
 * 处理 ~/.claude/settings.json 的读取、写入、备份和恢复
 */

import * as fs from 'fs'
import * as path from 'path'
import { PathResolver } from '../code-switch/path-resolver'
import { CliType, getCliDefinition } from '../../types/cli'

const PROXY_TOKEN_PLACEHOLDER = 'PROXY_MANAGED'

export interface ClaudeConfig {
  env?: Record<string, string>
  [key: string]: unknown
}

export class ClaudeConfigHandler {
  /**
   * 读取 Claude Code 配置
   */
  static read(configPath: string): ClaudeConfig {
    const normalizedPath = PathResolver.normalizePath(configPath)

    if (!fs.existsSync(normalizedPath)) {
      return {}
    }

    const content = fs.readFileSync(normalizedPath, 'utf-8')
    try {
      return JSON.parse(content) as ClaudeConfig
    } catch (error) {
      throw new Error(`解析 Claude Code 配置失败: ${error}`)
    }
  }

  /**
   * 写入代理接管配置
   * 参考 cc-switch 的实现：
   * 1. 设置 ANTHROPIC_BASE_URL 为代理 URL
   * 2. 设置 ANTHROPIC_API_KEY 为占位符（避免 CLI 提示缺少 key）
   * 3. 移除模型覆盖环境变量（让代理处理模型映射）
   */
  static async writeProxyTakeover(configPath: string, proxyUrl: string): Promise<void> {
    const config = this.read(configPath)

    if (!config.env) {
      config.env = {}
    }

    // 1. 设置代理 URL
    config.env.ANTHROPIC_BASE_URL = proxyUrl

    // 2. 设置占位符 API key
    config.env.ANTHROPIC_API_KEY = PROXY_TOKEN_PLACEHOLDER

    // 3. 清除模型覆盖环境变量
    const cliDef = getCliDefinition(CliType.ClaudeCode)
    if (cliDef.modelOverrideEnvKeys) {
      for (const key of cliDef.modelOverrideEnvKeys) {
        delete config.env[key]
      }
    }

    await this.atomicWrite(configPath, JSON.stringify(config, null, 2))
  }

  /**
   * 提取原始 API key
   */
  static extractApiKey(config: ClaudeConfig): string | null {
    const apiKey = config.env?.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === PROXY_TOKEN_PLACEHOLDER) {
      return null
    }
    return apiKey
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
   * 原子写入（临时文件 + rename，避免配置损坏）
   */
  private static async atomicWrite(filePath: string, content: string): Promise<void> {
    const normalizedPath = PathResolver.normalizePath(filePath)
    const tempPath = `${normalizedPath}.tmp`

    try {
      // 确保目录存在
      const dir = path.dirname(normalizedPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // 写入临时文件
      fs.writeFileSync(tempPath, content, 'utf-8')

      // 原子 rename
      fs.renameSync(tempPath, normalizedPath)
    } catch (error) {
      // 清理临时文件
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
      return (
        config.env?.ANTHROPIC_BASE_URL === expectedProxyUrl &&
        config.env?.ANTHROPIC_API_KEY === PROXY_TOKEN_PLACEHOLDER
      )
    } catch {
      return false
    }
  }
}
