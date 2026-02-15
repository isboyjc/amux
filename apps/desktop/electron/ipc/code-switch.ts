/**
 * Code Switch IPC handlers
 * Currently supports Claude Code only
 */

import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import {
  CodeSwitchRepository,
  CodeModelMappingRepository,
} from '../services/database/repositories'
import type { CodeSwitchConfigRow, CodeModelMappingRow } from '../services/database/types'
import type { CodeSwitchConfig, CodeModelMapping } from '../../src/types'
import {
  ConfigDetector,
  ConfigBackup,
  ConfigWriter,
  invalidateCodeSwitchCache,
  PathResolver
} from '../services/code-switch'
import { isAuthEnabled } from '../services/proxy-server/utils'
import { getCLIPreset, getDefaultModels } from '../services/presets/code-switch-preset'

// Convert DB row to CodeSwitchConfig object
function toCodeSwitchConfig(row: CodeSwitchConfigRow): CodeSwitchConfig {
  return {
    id: row.id,
    cliType: row.cli_type as 'claudecode',
    enabled: row.enabled === 1,
    providerId: row.provider_id,
    configPath: row.config_path,
    backupConfig: row.backup_config,
    proxyPath: row.proxy_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// Convert DB row to CodeModelMapping object
function toCodeModelMapping(row: CodeModelMappingRow): CodeModelMapping {
  return {
    id: row.id,
    codeSwitchId: row.code_switch_id,
    providerId: row.provider_id,
    sourceModel: row.source_model,
    targetModel: row.target_model,
    mappingType: row.mapping_type as CodeModelMapping['mappingType'],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function registerCodeSwitchHandlers(): void {
  const codeSwitchRepo = new CodeSwitchRepository()
  const modelMappingRepo = new CodeModelMappingRepository()

  /**
   * Get Code Switch config by CLI type
   */
  ipcMain.handle(
    'code-switch:get-config',
    async (_event, _cliType: string) => {
      const row = codeSwitchRepo.findByCLIType('claudecode')
      return row ? toCodeSwitchConfig(row) : null
    }
  )

  /**
   * Initialize or get Code Switch config
   * Creates a disabled config record if not exists
   * This ensures we have a codeSwitchId for saving model mappings before enabling
   */
  ipcMain.handle(
    'code-switch:init-config',
    async (
      _event,
      _cliType: string,
      providerId: string,
      configPath: string
    ) => {
      const cliType = 'claudecode'
      
      // Check if config already exists
      let config = codeSwitchRepo.findByCLIType(cliType)
      
      if (!config) {
        const proxyPath = `code/${cliType}`
        config = codeSwitchRepo.create({
          cliType,
          providerId,
          configPath,
          backupConfig: '',
          proxyPath
        })
        console.log(`[CodeSwitch] Initialized config for ${cliType}:`, config.id)
      } else if (config.provider_id !== providerId || config.config_path !== configPath) {
        config = codeSwitchRepo.update(config.id, {
          providerId,
          configPath
        })!
        console.log(`[CodeSwitch] Updated config for ${cliType}:`, config.id)
      }
      
      return toCodeSwitchConfig(config)
    }
  )

  /**
   * Detect CLI configuration files
   */
  ipcMain.handle('code-switch:detect-files', async () => {
    return ConfigDetector.detectAll()
  })

  /**
   * Enable Code Switch
   * Steps:
   * 1. Detect config file
   * 2. Backup original config
   * 3. Write proxy config
   * 4. Save to database
   */
  ipcMain.handle(
    'code-switch:enable',
    async (
      _event,
      data: {
        cliType: string
        providerId: string
        modelMappings: Array<{ sourceModel: string; targetModel: string }>
        customConfigPath?: string
      }
    ) => {
      const { providerId, modelMappings, customConfigPath } = data
      const cliType = 'claudecode'

      // Step 1: Detect or validate config file
      const detection = customConfigPath
        ? ConfigDetector.validateCustomPath(customConfigPath)
        : ConfigDetector.detectClaudeCode()

      let configPath: string

      // Claude Code official path is ~/.claude/settings.json; create if missing
      if (detection.detected && detection.valid && detection.configPath) {
        configPath = detection.configPath
      } else if (customConfigPath) {
        throw new Error(detection.error || `Invalid path: ${customConfigPath}`)
      } else {
        configPath = PathResolver.getClaudeCodeUserSettingsPath()
      }

      // Step 2: Backup original config
      const backupContent = ConfigBackup.backup(configPath)

      // Step 3: Generate API key and proxy URL
      const authEnabled = isAuthEnabled()
      const apiKey = authEnabled 
        ? `amux_code_${randomUUID().replace(/-/g, '')}` 
        : 'amux'
      
      console.log(`[CodeSwitch] Auth enabled: ${authEnabled}, using API key: ${authEnabled ? apiKey : 'amux (placeholder)'}`)
      
      const proxyPath = `code/${cliType}`
      const proxyUrl = `http://127.0.0.1:9527/${proxyPath}`

      // Step 4: Write proxy config to CLI config file
      await ConfigWriter.writeClaudeCode({ configPath, proxyUrl, apiKey })

      // Step 5: Save to database
      const existingConfig = codeSwitchRepo.findByCLIType(cliType)

      let codeSwitchConfig: CodeSwitchConfigRow

      if (existingConfig) {
        codeSwitchConfig = codeSwitchRepo.update(existingConfig.id, {
          providerId,
          configPath,
          backupConfig: backupContent,
          enabled: true
        })!
      } else {
        codeSwitchConfig = codeSwitchRepo.create({
          cliType,
          providerId,
          configPath,
          backupConfig: backupContent,
          proxyPath
        })
        codeSwitchRepo.setEnabled(cliType, true)
        codeSwitchConfig = codeSwitchRepo.findByCLIType(cliType)!
      }

      // Step 6: Save model mappings
      if (modelMappings.length > 0) {
        modelMappingRepo.updateMappingsForProvider({
          codeSwitchId: codeSwitchConfig.id,
          providerId,
          mappings: modelMappings
        })
      }

      // Step 7: Invalidate cache to pick up new config
      invalidateCodeSwitchCache(cliType)

      return toCodeSwitchConfig(codeSwitchConfig)
    }
  )

  /**
   * Disable Code Switch
   */
  ipcMain.handle(
    'code-switch:disable',
    async (_event, _cliType: string) => {
      const cliType = 'claudecode'
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config) {
        throw new Error(`Code Switch config not found for ${cliType}`)
      }

      // Step 1: Restore original config
      if (config.backup_config) {
        await ConfigBackup.restore(config.config_path, config.backup_config)
      }

      // Step 2: Disable in database
      codeSwitchRepo.setEnabled(cliType, false)

      // Step 3: Invalidate cache
      invalidateCodeSwitchCache(cliType)
    }
  )

  /**
   * Switch provider (and activate historical mappings immediately)
   * Historical mappings for the new provider are activated right away
   * so the proxy has valid mappings without waiting for the frontend debounce
   */
  ipcMain.handle(
    'code-switch:switch-provider',
    async (_event, _cliType: string, providerId: string) => {
      const cliType = 'claudecode'
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config) {
        throw new Error(`Code Switch config not found for ${cliType}`)
      }

      // Update provider
      codeSwitchRepo.updateProvider(cliType, providerId)

      // Activate historical mappings for the new provider immediately
      // This ensures the proxy has valid mappings right after the switch
      const historicalMappings = modelMappingRepo.findByProvider(config.id, providerId)
      if (historicalMappings.length > 0) {
        modelMappingRepo.updateMappingsForProvider({
          codeSwitchId: config.id,
          providerId,
          mappings: historicalMappings.map(m => ({
            sourceModel: m.source_model,
            targetModel: m.target_model,
            mappingType: m.mapping_type as 'exact' | 'family' | 'reasoning' | 'default' | undefined
          }))
        })
      }

      invalidateCodeSwitchCache(cliType)
      
      console.log(`[CodeSwitch] Switched provider to ${providerId} for ${cliType}, activated ${historicalMappings.length} historical mappings`)
    }
  )

  /**
   * Update provider and model mappings (dynamic switch)
   * This does NOT modify CLI config, only updates database
   * Proxy will pick up changes automatically via cache invalidation
   */
  ipcMain.handle(
    'code-switch:update-provider',
    async (
      _event,
      _cliType: string,
      providerId: string,
      modelMappings: Array<{ sourceModel: string; targetModel: string; mappingType?: 'exact' | 'family' | 'reasoning' | 'default' }>
    ) => {
      const cliType = 'claudecode'
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config) {
        throw new Error(`Code Switch config not found for ${cliType}`)
      }

      // Update provider
      codeSwitchRepo.updateProvider(cliType, providerId)

      // Update model mappings
      if (modelMappings.length > 0) {
        modelMappingRepo.updateMappingsForProvider({
          codeSwitchId: config.id,
          providerId,
          mappings: modelMappings
        })
      }

      console.log(`[IPC] Updated ${cliType} mappings for provider ${providerId}`)

      // Invalidate cache for dynamic switching
      invalidateCodeSwitchCache(cliType)
    }
  )

  /**
   * Get historical model mappings for a provider
   * Used to auto-restore mappings when switching back
   */
  ipcMain.handle(
    'code-switch:get-historical-mappings',
    async (_event, codeSwitchId: string, providerId?: string) => {
      let rows: CodeModelMappingRow[]
      
      if (providerId) {
        rows = modelMappingRepo.findByProvider(codeSwitchId, providerId)
      } else {
        rows = modelMappingRepo.findActiveByCodeSwitchId(codeSwitchId)
      }
      
      return rows.map(toCodeModelMapping)
    }
  )

  /**
   * Test connection to Code Switch proxy
   */
  ipcMain.handle(
    'code-switch:test-connection',
    async (_event, _cliType: string) => {
      const cliType = 'claudecode'
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config || !config.enabled) {
        return { success: false, error: 'Code Switch not enabled' }
      }

      try {
        const startTime = Date.now()
        const proxyUrl = `http://127.0.0.1:9527/${config.proxy_path}`
        const configValid = ConfigWriter.verifyClaudeCodeConfig(config.config_path, proxyUrl)
        const latency = Date.now() - startTime

        if (!configValid) {
          return { success: false, error: 'Configuration file validation failed' }
        }

        return { success: true, latency }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )

  // ============================================================================
  // Code Switch Preset Handlers
  // ============================================================================

  ipcMain.handle('code-switch:get-cli-preset', async (_, cliId: string) => {
    try {
      return getCLIPreset(cliId)
    } catch (error) {
      console.error('[IPC] Failed to get CLI preset:', error)
      throw new Error(`Failed to get CLI preset: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  ipcMain.handle('code-switch:get-default-models', async (_, cliId: string) => {
    try {
      return getDefaultModels(cliId)
    } catch (error) {
      console.error('[IPC] Failed to get default models:', error)
      throw new Error(`Failed to get default models: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })
}
