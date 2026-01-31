/**
 * Code Switch IPC handlers
 */

import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import {
  CodeSwitchRepository,
  CodeModelMappingRepository
} from '../services/database/repositories'
import type { CodeSwitchConfigRow, CodeModelMappingRow } from '../services/database/types'
import type { CodeSwitchConfig, CodeModelMapping } from '../../src/types'
import {
  ConfigDetector,
  ConfigBackup,
  ConfigWriter,
  invalidateCodeSwitchCache
} from '../services/code-switch'

// Convert DB row to CodeSwitchConfig object
function toCodeSwitchConfig(row: CodeSwitchConfigRow): CodeSwitchConfig {
  return {
    id: row.id,
    cliType: row.cli_type as 'claudecode' | 'codex',
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
    claudeModel: row.claude_model,
    targetModel: row.target_model,
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
    async (_event, cliType: 'claudecode' | 'codex') => {
      const row = codeSwitchRepo.findByCLIType(cliType)
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
      cliType: 'claudecode' | 'codex',
      providerId: string,
      configPath: string
    ) => {
      // Check if config already exists
      let config = codeSwitchRepo.findByCLIType(cliType)
      
      if (!config) {
        // Create a new disabled config
        const proxyPath = `/code/${cliType}`
        config = codeSwitchRepo.create({
          cliType,
          providerId,
          configPath,
          backupConfig: '', // Will be set when enabling
          proxyPath
        })
        console.log(`[CodeSwitch] Initialized config for ${cliType}:`, config.id)
      } else if (config.provider_id !== providerId || config.config_path !== configPath) {
        // Update provider or config path if changed
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
    const detections = ConfigDetector.detectAll()
    return detections
  })

  /**
   * Enable Code Switch
   * Steps:
   * 1. Detect config file
   * 2. Backup original config
   * 3. Write proxy config
   * 4. Save to database
   * 5. Register proxy route (handled by proxy-server)
   */
  ipcMain.handle(
    'code-switch:enable',
    async (
      _event,
      data: {
        cliType: 'claudecode' | 'codex'
        providerId: string
        modelMappings: Array<{ claudeModel: string; targetModel: string }>
        customConfigPath?: string
      }
    ) => {
      const { cliType, providerId, modelMappings, customConfigPath } = data

      // Step 1: Detect or validate config file
      const detection = customConfigPath
        ? ConfigDetector.validateCustomPath(cliType, customConfigPath)
        : cliType === 'claudecode'
          ? ConfigDetector.detectClaudeCode()
          : ConfigDetector.detectCodex()

      if (!detection.detected || !detection.valid || !detection.configPath) {
        throw new Error(
          detection.error || `Failed to detect ${cliType} configuration file`
        )
      }

      const configPath = detection.configPath

      // Step 2: Backup original config
      const backupContent = ConfigBackup.backup(cliType, configPath)

      // Step 3: Generate API key and proxy URL
      const apiKey = `amux_code_${randomUUID().replace(/-/g, '')}`
      const proxyPath = `code/${cliType}`
      const proxyUrl = `http://127.0.0.1:9527/${proxyPath}`

      // Step 4: Write proxy config to CLI config file
      if (cliType === 'claudecode') {
        await ConfigWriter.writeClaudeCode({ configPath, proxyUrl, apiKey })
      } else {
        await ConfigWriter.writeCodex({ authPath: configPath, proxyUrl, apiKey })
      }

      // Step 5: Save to database
      const existingConfig = codeSwitchRepo.findByCLIType(cliType)

      let codeSwitchConfig: CodeSwitchConfigRow

      if (existingConfig) {
        // Update existing config
        codeSwitchConfig = codeSwitchRepo.update(existingConfig.id, {
          providerId,
          configPath,
          backupConfig: backupContent,
          enabled: true
        })!
      } else {
        // Create new config
        codeSwitchConfig = codeSwitchRepo.create({
          cliType,
          providerId,
          configPath,
          backupConfig: backupContent,
          proxyPath
        })
        // Enable it
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
      invalidateCodeSwitchCache(cliType as 'claudecode' | 'codex')

      return toCodeSwitchConfig(codeSwitchConfig)
    }
  )

  /**
   * Disable Code Switch
   * Steps:
   * 1. Restore original config
   * 2. Update database
   */
  ipcMain.handle(
    'code-switch:disable',
    async (_event, cliType: 'claudecode' | 'codex') => {
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config) {
        throw new Error(`Code Switch config not found for ${cliType}`)
      }

      // Step 1: Restore original config
      if (config.backup_config) {
        await ConfigBackup.restore(cliType, config.config_path, config.backup_config)
      }

      // Step 2: Disable in database
      codeSwitchRepo.setEnabled(cliType, false)

      // Step 3: Invalidate cache
      invalidateCodeSwitchCache(cliType as 'claudecode' | 'codex')
    }
  )

  /**
   * Switch provider only (without updating model mappings)
   * Used when user switches provider in enabled state
   * Model mappings will be loaded from history automatically
   */
  ipcMain.handle(
    'code-switch:switch-provider',
    async (
      _event,
      cliType: 'claudecode' | 'codex',
      providerId: string
    ) => {
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config) {
        throw new Error(`Code Switch config not found for ${cliType}`)
      }

      // Update provider only, don't touch model mappings
      codeSwitchRepo.updateProvider(cliType, providerId)

      // Invalidate cache for dynamic switching
      invalidateCodeSwitchCache(cliType as 'claudecode' | 'codex')
      
      console.log(`[CodeSwitch] Switched provider to ${providerId} for ${cliType}`)
    }
  )

  /**
   * Update provider and model mappings (dynamic switch)
   * This does NOT modify CLI config, only updates database
   * Proxy will pick up changes automatically
   */
  ipcMain.handle(
    'code-switch:update-provider',
    async (
      _event,
      cliType: 'claudecode' | 'codex',
      providerId: string,
      modelMappings: Array<{ claudeModel: string; targetModel: string }>
    ) => {
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

      // Invalidate cache for dynamic switching
      invalidateCodeSwitchCache(cliType as 'claudecode' | 'codex')
    }
  )

  /**
   * Get historical model mappings for a provider
   * Used to auto-restore mappings when switching back
   */
  ipcMain.handle(
    'code-switch:get-historical-mappings',
    async (_event, codeSwitchId: string, providerId: string) => {
      const rows = modelMappingRepo.findByProvider(codeSwitchId, providerId)
      return rows.map(toCodeModelMapping)
    }
  )

  /**
   * Test connection to Code Switch proxy
   * Sends a simple request to verify the setup
   */
  ipcMain.handle(
    'code-switch:test-connection',
    async (_event, cliType: 'claudecode' | 'codex') => {
      const config = codeSwitchRepo.findByCLIType(cliType)

      if (!config || !config.enabled) {
        return {
          success: false,
          error: 'Code Switch not enabled'
        }
      }

      try {
        const startTime = Date.now()
        
        // Simply check if config is valid
        const proxyUrl = `http://127.0.0.1:9527/${config.proxy_path}`
        const configValid =
          cliType === 'claudecode'
            ? ConfigWriter.verifyClaudeCodeConfig(config.config_path, proxyUrl)
            : ConfigWriter.verifyCodexConfig(config.config_path, proxyUrl)

        const latency = Date.now() - startTime

        if (!configValid) {
          return {
            success: false,
            error: 'Configuration file validation failed'
          }
        }

        return {
          success: true,
          latency
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )
}
