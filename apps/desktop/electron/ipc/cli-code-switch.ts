/**
 * CLI Code Switch IPC Handlers (V2)
 * 
 * 处理前端与 CLI Code Switch 相关的 IPC 通信
 * 支持多 CLI（Claude Code, Codex）独立管理
 */

import { ipcMain } from 'electron'
import * as fs from 'fs'
import { CliType, getCliDefinition } from '../types/cli'
import { ProxyTakeoverManager } from '../services/proxy-takeover/takeover-manager'
import { CliProviderSwitchService } from '../services/cli-switch/switch-service'
import { getCliCodeSwitchConfigRepository } from '../services/database/repositories/cli-code-switch-config'
import { getCliProviderModelMappingRepository, type CliModelMappingItem } from '../services/database/repositories/cli-provider-model-mapping'
import { getProviderRepository } from '../services/database/repositories/provider'
import { getSettingsRepository } from '../services/database/repositories/settings'
import { PathResolver } from '../services/code-switch/path-resolver'

export function registerCliCodeSwitchHandlers(): void {
  console.log('[IPC] Registering CLI Code Switch V2 handlers...')

  /**
   * 获取 CLI 配置
   */
  ipcMain.handle('cli-cs:get-config', async (_event, data: { cliType: CliType }) => {
    try {
      const { cliType } = data
      const configRepo = getCliCodeSwitchConfigRepository()
      const mappingRepo = getCliProviderModelMappingRepository()
      const providerRepo = getProviderRepository()

      const config = configRepo.getOrCreate(cliType)

      let provider: ReturnType<typeof providerRepo.findById> = null
      let mappings: ReturnType<typeof mappingRepo.findActive> = []

      if (config.current_provider_id) {
        provider = providerRepo.findById(config.current_provider_id)
        mappings = mappingRepo.findActive(cliType, config.current_provider_id)
      }

      return {
        success: true,
        config: {
          cliType: config.cli_type,
          enabled: config.enabled === 1,
          takeoverActive: config.takeover_active === 1,
          currentProviderId: config.current_provider_id,
        },
        provider,
        mappings: mappings.map((m) => ({
          id: m.id,
          mappingType: m.mapping_type,
          sourceModel: m.source_model,
          targetModel: m.target_model,
          keywords: m.keywords ? JSON.parse(m.keywords) : null,
          priority: m.priority,
        })),
      }
    } catch (error) {
      console.error('[IPC] cli-cs:get-config error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取配置失败',
      }
    }
  })

  /**
   * 启用/禁用 CLI C/S
   */
  ipcMain.handle(
    'cli-cs:toggle',
    async (
      _event,
      data: {
        cliType: CliType
        enabled: boolean
        providerId?: string
        proxyPort?: number
      }
    ) => {
      try {
        const { cliType, enabled, providerId } = data
        const configRepo = getCliCodeSwitchConfigRepository()
        const settingsRepo = getSettingsRepository()
        const cliDef = getCliDefinition(cliType)
        
        // 从 settings 读取代理端口（默认 9527）
        const proxyPort = settingsRepo.get('proxy.port') ?? 9527

        if (enabled) {
          // 启用 C/S
          const config = configRepo.getOrCreate(cliType)

          // 如果提供了 providerId，先设置
          if (providerId) {
            configRepo.updateByCliType(cliType, {
              currentProviderId: providerId,
            })
          } else if (!config.current_provider_id) {
            // 没有提供 providerId 且当前也没有配置过，提示用户
            return {
              success: false,
              error: '请先选择一个供应商',
            }
          }

          // 启用代理接管
          await ProxyTakeoverManager.enable(cliType, proxyPort)

          // 更新 enabled 状态
          configRepo.updateByCliType(cliType, { enabled: true })

          return {
            success: true,
            message: `${cliDef.displayName} C/S 已启用，请重启 ${cliDef.displayName} 使其生效`,
            requiresRestart: true,
          }
        } else {
          // 禁用 C/S
          await ProxyTakeoverManager.disable(cliType)
          configRepo.updateByCliType(cliType, { enabled: false })

          return {
            success: true,
            message: `${cliDef.displayName} C/S 已禁用，已恢复原始配置`,
            requiresRestart: true,
          }
        }
      } catch (error) {
        console.error('[IPC] cli-cs:toggle error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '操作失败',
        }
      }
    }
  )

  /**
   * 切换供应商
   */
  ipcMain.handle(
    'cli-cs:switch-provider',
    async (
      _event,
      data: {
        cliType: CliType
        providerId: string
      }
    ) => {
      try {
        const { cliType, providerId } = data
        const result = await CliProviderSwitchService.switch(cliType, providerId)
        return result
      } catch (error) {
        console.error('[IPC] cli-cs:switch-provider error:', error)
        return {
          success: false,
          requiresRestart: false,
          message: error instanceof Error ? error.message : '切换供应商失败',
        }
      }
    }
  )

  /**
   * 更新模型映射
   */
  ipcMain.handle(
    'cli-cs:update-mappings',
    async (
      _event,
      data: {
        cliType: CliType
        providerId: string
        mappings: CliModelMappingItem[]
      }
    ) => {
      try {
        const { cliType, providerId, mappings } = data
        await CliProviderSwitchService.updateMappings(cliType, providerId, mappings)
        return { success: true }
      } catch (error) {
        console.error('[IPC] cli-cs:update-mappings error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '更新映射失败',
        }
      }
    }
  )

  /**
   * 获取供应商的历史映射
   */
  ipcMain.handle(
    'cli-cs:get-historical-mappings',
    async (
      _event,
      data: {
        cliType: CliType
        providerId: string
      }
    ) => {
      try {
        const { cliType, providerId } = data
        const mappings = CliProviderSwitchService.getHistoricalMappings(cliType, providerId)

        return {
          success: true,
          mappings: mappings.map((m) => ({
            id: m.id,
            mappingType: m.mapping_type,
            sourceModel: m.source_model,
            targetModel: m.target_model,
            keywords: m.keywords ? JSON.parse(m.keywords) : null,
            priority: m.priority,
            isActive: m.is_active === 1,
          })),
        }
      } catch (error) {
        console.error('[IPC] cli-cs:get-historical-mappings error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '获取历史映射失败',
        }
      }
    }
  )

  /**
   * 检测配置文件
   */
  ipcMain.handle('cli-cs:detect-config', async (_event, data: { cliType: CliType }) => {
    try {
      const { cliType } = data
      const cliDef = getCliDefinition(cliType)
      const configPath = PathResolver.getConfigPath(cliType)

      if (!configPath) {
        return {
          success: false,
          detected: false,
          path: null,
          error: `无法解析 ${cliDef.displayName} 的配置路径`,
        }
      }

      const normalizedPath = PathResolver.normalizePath(configPath)
      const exists = fs.existsSync(normalizedPath)

      return {
        success: true,
        detected: exists,
        path: configPath,
        displayName: cliDef.displayName,
      }
    } catch (error) {
      console.error('[IPC] cli-cs:detect-config error:', error)
      return {
        success: false,
        detected: false,
        error: error instanceof Error ? error.message : '检测配置文件失败',
      }
    }
  })

  /**
   * 获取所有可用的供应商列表
   */
  ipcMain.handle('cli-cs:get-providers', async () => {
    try {
      const providerRepo = getProviderRepository()
      const providers = providerRepo.findAllEnabled()

      return {
        success: true,
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          adapterType: p.adapter_type,
          logo: p.logo,
          color: p.color,
        })),
      }
    } catch (error) {
      console.error('[IPC] cli-cs:get-providers error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取供应商列表失败',
      }
    }
  })

  /**
   * 获取供应商的模型列表
   */
  ipcMain.handle('cli-cs:get-provider-models', async (_event, data: { providerId: string }) => {
    try {
      const { providerId } = data
      const providerRepo = getProviderRepository()
      const provider = providerRepo.findById(providerId)

      if (!provider) {
        return {
          success: false,
          error: '供应商不存在',
        }
      }

      let models: string[] = []
      try {
        models = JSON.parse(provider.models)
      } catch {
        models = []
      }

      return {
        success: true,
        models,
      }
    } catch (error) {
      console.error('[IPC] cli-cs:get-provider-models error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取模型列表失败',
      }
    }
  })

  console.log('[IPC] ✅ CLI Code Switch V2 handlers registered')
}
