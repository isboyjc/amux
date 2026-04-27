/**
 * 代理接管管理器
 * 管理 CLI 配置文件的代理接管、备份和恢复
 * 
 * 代理接管模式的工作原理：
 * 1. 备份原始配置文件
 * 2. 修改配置文件，将 base_url 指向本地代理
 * 3. CLI 的所有请求会经过代理
 * 4. 切换供应商时，只需更新 DB 和缓存（热切换）
 * 5. 禁用时恢复原始配置
 */

import * as fs from 'fs'
import { CliType, getCliDefinition, getProxyUrl } from '../../types/cli'
import { ClaudeConfigHandler } from '../cli-config/claude-config-handler'
import { CodexConfigHandler } from '../cli-config/codex-config-handler'
import { PathResolver } from '../code-switch/path-resolver'
import { getCliCodeSwitchConfigRepository } from '../database/repositories/cli-code-switch-config'
import { getCliLiveConfigBackupRepository } from '../database/repositories/cli-live-config-backup'
import { getProviderRepository } from '../database/repositories/provider'

export class ProxyTakeoverManager {
  /**
   * 启用代理接管模式
   * 参考 cc-switch 的 start_with_takeover 实现
   * 
   * 步骤：
   * 1. 检测并读取配置文件
   * 2. 备份原始配置
   * 3. 提取原始 API key（同步到 provider）
   * 4. 写入代理配置
   * 5. 标记 takeover_active
   */
  static async enable(cliType: CliType, proxyPort: number = 3000): Promise<void> {
    const cliDef = getCliDefinition(cliType)
    const configRepo = getCliCodeSwitchConfigRepository()
    const backupRepo = getCliLiveConfigBackupRepository()

    // 1. 获取配置路径
    const configPath = PathResolver.getConfigPath(cliType)
    if (!configPath) {
      throw new Error(`无法解析 ${cliDef.displayName} 的配置路径`)
    }

    // 2. 检查配置文件是否存在
    const normalizedPath = PathResolver.normalizePath(configPath)
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(
        `配置文件不存在: ${configPath}\n` +
        `请先运行 ${cliDef.displayName} 生成配置文件`
      )
    }

    // 3. 读取原始配置
    const originalContent = fs.readFileSync(normalizedPath, 'utf-8')

    // 4. 备份原始配置
    backupRepo.createOrUpdate({
      cliType,
      originalContent,
      configFilePath: configPath,
    })

    // 5. 提取原始 API key 并同步到 provider（如果需要）
    await this.syncApiKeyToProvider(cliType, originalContent)

    // 6. 写入代理接管配置
    const proxyUrl = getProxyUrl(cliType, proxyPort)
    await this.writeProxyConfig(cliType, configPath, proxyUrl)

    // 7. 标记接管状态
    configRepo.updateByCliType(cliType, { takeoverActive: true })

    console.log(`[ProxyTakeover] ${cliDef.displayName} 代理接管已启用`)
  }

  /**
   * 禁用代理接管模式（恢复原始配置）
   */
  static async disable(cliType: CliType): Promise<void> {
    const cliDef = getCliDefinition(cliType)
    const configRepo = getCliCodeSwitchConfigRepository()
    const backupRepo = getCliLiveConfigBackupRepository()

    // 1. 读取备份
    const backup = backupRepo.findByCliType(cliType)
    if (!backup) {
      throw new Error(`未找到 ${cliDef.displayName} 的配置备份`)
    }

    // 2. 恢复原始配置
    await this.restoreConfig(cliType, backup.config_file_path, backup.original_content)

    // 3. 删除备份
    backupRepo.deleteByCliType(cliType)

    // 4. 更新状态
    configRepo.updateByCliType(cliType, { takeoverActive: false })

    console.log(`[ProxyTakeover] ${cliDef.displayName} 代理接管已禁用，原始配置已恢复`)
  }

  /**
   * 写入代理配置
   */
  private static async writeProxyConfig(
    cliType: CliType,
    configPath: string,
    proxyUrl: string
  ): Promise<void> {
    const cliDef = getCliDefinition(cliType)

    if (cliDef.configFormat === 'json') {
      await ClaudeConfigHandler.writeProxyTakeover(configPath, proxyUrl)
    } else if (cliDef.configFormat === 'toml') {
      await CodexConfigHandler.writeProxyTakeover(configPath, proxyUrl)
    } else {
      throw new Error(`不支持的配置格式: ${cliDef.configFormat}`)
    }
  }

  /**
   * 恢复配置
   */
  private static async restoreConfig(
    cliType: CliType,
    configPath: string,
    originalContent: string
  ): Promise<void> {
    const cliDef = getCliDefinition(cliType)

    if (cliDef.configFormat === 'json') {
      await ClaudeConfigHandler.restore(configPath, originalContent)
    } else if (cliDef.configFormat === 'toml') {
      await CodexConfigHandler.restore(configPath, originalContent)
    } else {
      throw new Error(`不支持的配置格式: ${cliDef.configFormat}`)
    }
  }

  /**
   * 同步 API key 到 provider（如果需要）
   * 从原始配置中提取 API key，并更新到当前 provider（如果 provider 没有 API key）
   */
  private static async syncApiKeyToProvider(
    cliType: CliType,
    originalContent: string
  ): Promise<void> {
    const configRepo = getCliCodeSwitchConfigRepository()
    const providerRepo = getProviderRepository()

    const cliConfig = configRepo.findByCliType(cliType)
    if (!cliConfig || !cliConfig.current_provider_id) {
      return // 尚未选择供应商
    }

    const provider = providerRepo.findById(cliConfig.current_provider_id)
    if (!provider || provider.api_key) {
      return // 供应商不存在或已有 API key
    }

    // 提取原始 API key
    let apiKey: string | null = null
    const cliDef = getCliDefinition(cliType)

    try {
      if (cliDef.configFormat === 'json') {
        const config = JSON.parse(originalContent)
        apiKey = ClaudeConfigHandler.extractApiKey(config)
      } else if (cliDef.configFormat === 'toml') {
        const configPath = PathResolver.getConfigPath(cliType)!
        apiKey = CodexConfigHandler.extractApiKey(configPath)
      }
    } catch (error) {
      console.error(`[ProxyTakeover] 提取 API key 失败:`, error)
      // 不抛出错误，允许继续（用户可能在 UI 中手动输入 API key）
    }

    // 更新 provider（如果提取到了有效的 API key）
    if (apiKey && apiKey !== 'PROXY_MANAGED') {
      providerRepo.update(provider.id, { apiKey })
      console.log(`[ProxyTakeover] API key 已同步到供应商 ${provider.name}`)
    }
  }

  /**
   * 检查配置文件是否处于代理模式
   */
  static isProxyMode(cliType: CliType, proxyPort: number = 3000): boolean {
    const configPath = PathResolver.getConfigPath(cliType)
    if (!configPath) {
      return false
    }

    const proxyUrl = getProxyUrl(cliType, proxyPort)
    const cliDef = getCliDefinition(cliType)

    if (cliDef.configFormat === 'json') {
      return ClaudeConfigHandler.isProxyMode(configPath, proxyUrl)
    } else if (cliDef.configFormat === 'toml') {
      return CodexConfigHandler.isProxyMode(configPath, proxyUrl)
    }

    return false
  }

  /**
   * 检查是否有备份
   */
  static hasBackup(cliType: CliType): boolean {
    const backupRepo = getCliLiveConfigBackupRepository()
    return backupRepo.hasBackup(cliType)
  }
}
