/**
 * CLI Provider 切换服务
 * 实现热切换逻辑和历史映射记忆
 */

import { CliType, getCliDefinition } from '../../types/cli'
import { getCliCodeSwitchConfigRepository } from '../database/repositories/cli-code-switch-config'
import { getCliProviderModelMappingRepository, type CliModelMappingItem } from '../database/repositories/cli-provider-model-mapping'
import { getProviderRepository } from '../database/repositories/provider'
import { invalidateCliCodeSwitchCache } from './cache'

export interface SwitchResult {
  success: boolean
  requiresRestart: boolean
  message: string
  previousProviderId?: string | null
  newProviderId: string
  hasHistoricalMappings: boolean
}

export class CliProviderSwitchService {
  /**
   * 切换供应商
   * 
   * 热切换条件（同时满足）：
   * 1. CLI 处于代理接管模式 (takeover_active = 1)
   * 2. CLI 支持热切换 (supportsHotSwitch = true)
   * 
   * 否则使用传统模式（需要重启 CLI）
   */
  static async switch(cliType: CliType, newProviderId: string): Promise<SwitchResult> {
    const cliDef = getCliDefinition(cliType)
    const configRepo = getCliCodeSwitchConfigRepository()
    const mappingRepo = getCliProviderModelMappingRepository()
    const providerRepo = getProviderRepository()

    // 1. 验证 provider 存在
    const newProvider = providerRepo.findById(newProviderId)
    if (!newProvider) {
      throw new Error(`供应商不存在: ${newProviderId}`)
    }

    // 2. 获取当前配置
    const cliConfig = configRepo.getOrCreate(cliType)
    const previousProviderId = cliConfig.current_provider_id

    // 3. 检查是否有历史映射
    const hasHistory = mappingRepo.hasHistoricalMappings(cliType, newProviderId)

    // 4. 数据库事务操作（Repository 内部已经有事务支持）
    // 4.1 更新 current_provider_id
    configRepo.updateByCliType(cliType, {
      currentProviderId: newProviderId,
    })

    // 4.2 激活新 provider 的映射（停用其他）
    if (hasHistory) {
      // 有历史映射，激活它们
      mappingRepo.activateMappings(cliType, newProviderId)
    } else {
      // 无历史映射，停用所有（前端会提示用户配置）
      mappingRepo.deactivateAll(cliType)
    }

    // 5. 刷新缓存
    invalidateCliCodeSwitchCache(cliType)

    // 6. 判断是否需要重启
    const canHotSwitch = cliConfig.takeover_active === 1 && cliDef.supportsHotSwitch
    const requiresRestart = !canHotSwitch

    return {
      success: true,
      requiresRestart,
      message: requiresRestart
        ? `已切换到 ${newProvider.name}，请重启 ${cliDef.displayName} 使其生效`
        : `已切换到 ${newProvider.name}，立即生效`,
      previousProviderId,
      newProviderId,
      hasHistoricalMappings: hasHistory,
    }
  }

  /**
   * 更新模型映射
   */
  static async updateMappings(
    cliType: CliType,
    providerId: string,
    mappings: CliModelMappingItem[]
  ): Promise<void> {
    const mappingRepo = getCliProviderModelMappingRepository()

    // 更新映射（事务内完成）
    mappingRepo.updateMappings({
      cliType,
      providerId,
      mappings,
    })

    // 刷新缓存
    invalidateCliCodeSwitchCache(cliType)
  }

  /**
   * 获取供应商的历史映射
   */
  static getHistoricalMappings(cliType: CliType, providerId: string) {
    const mappingRepo = getCliProviderModelMappingRepository()
    return mappingRepo.findAllByCliAndProvider(cliType, providerId)
  }

  /**
   * 获取当前活动的映射
   */
  static getActiveMappings(cliType: CliType, providerId: string) {
    const mappingRepo = getCliProviderModelMappingRepository()
    return mappingRepo.findActive(cliType, providerId)
  }

  /**
   * 删除供应商的所有映射（包括历史）
   */
  static deleteMappings(cliType: CliType, providerId: string): void {
    const mappingRepo = getCliProviderModelMappingRepository()
    mappingRepo.deleteByCliAndProvider(cliType, providerId)
    invalidateCliCodeSwitchCache(cliType)
  }
}
