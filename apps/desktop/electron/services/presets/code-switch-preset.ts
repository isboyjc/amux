import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * Code Switch CLI 预设配置接口
 */
export interface CodeSwitchCLI {
  id: string
  logo: string
  color: string
  configFile?: string
  configFiles?: Array<{
    name: string
    type: 'auth' | 'config'
    path: Record<string, string>
  }>
  configPath?: Record<string, string>
  proxyEndpoint: string
  defaultModels: Array<{
    id: string
    family?: string
    i18nKey: string
    capabilities: string[]
    isDefault?: boolean
  }>
  modelFamilies?: Array<{
    id: string
    i18nKey: string
    keywords: string[]
    priority: number
  }>
  defaultConfig: Record<string, any>
  features: {
    requiresProvider: boolean
    supportsModelMapping: boolean
    supportsDynamicSwitch: boolean
    requiresRestart: boolean
    unifiedEndpoint?: boolean
    supportsReasoningMapping?: boolean
    supportsFamilyMapping?: boolean
    supportsDefaultMapping?: boolean
  }
}

/**
 * Code Switch 预设文件接口
 */
export interface CodeSwitchPreset {
  version: string
  minClientVersion: string
  updatedAt: string
  clis: CodeSwitchCLI[]
}

let cachedPreset: CodeSwitchPreset | null = null

/**
 * 加载 Code Switch 预设配置
 */
export function loadCodeSwitchPreset(): CodeSwitchPreset {
  if (cachedPreset) {
    return cachedPreset
  }

  try {
    // 开发环境和生产环境的路径处理
    const isDev = !app.isPackaged
    const presetPath = isDev
      ? join(__dirname, '../../../resources/presets/code-switch.json')
      : join(process.resourcesPath, 'presets/code-switch.json')

    console.log('[CodeSwitchPreset] Loading preset from:', presetPath)

    const content = readFileSync(presetPath, 'utf-8')
    cachedPreset = JSON.parse(content)

    console.log('[CodeSwitchPreset] Loaded preset version:', cachedPreset?.version)
    console.log('[CodeSwitchPreset] Available CLIs:', cachedPreset?.clis.map(c => c.id))

    return cachedPreset!
  } catch (error) {
    console.error('[CodeSwitchPreset] Failed to load preset:', error)
    throw new Error(`Failed to load code-switch preset: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 获取指定 CLI 的预设配置
 */
export function getCLIPreset(cliId: string): CodeSwitchCLI | null {
  try {
    const preset = loadCodeSwitchPreset()
    const cli = preset.clis.find(c => c.id === cliId)

    if (!cli) {
      console.warn(`[CodeSwitchPreset] CLI preset not found: ${cliId}`)
      return null
    }

    return cli
  } catch (error) {
    console.error(`[CodeSwitchPreset] Failed to get CLI preset for ${cliId}:`, error)
    return null
  }
}

/**
 * 获取 CLI 的默认模型列表
 */
export function getDefaultModels(cliId: string): CodeSwitchCLI['defaultModels'] {
  const cli = getCLIPreset(cliId)
  return cli?.defaultModels || []
}

/**
 * 获取 CLI 的默认配置
 */
export function getDefaultConfig(cliId: string): Record<string, any> {
  const cli = getCLIPreset(cliId)
  return cli?.defaultConfig || {}
}

/**
 * 获取 CLI 的配置文件路径（根据当前平台）
 */
export function getConfigPath(cliId: string): string | null {
  const cli = getCLIPreset(cliId)
  if (!cli) return null

  const platform = process.platform
  return cli.configPath?.[platform] || null
}

/**
 * 获取所有配置文件路径（用于 Codex）
 */
export function getAllConfigPaths(cliId: string): Array<{ name: string; type: string; path: string }> {
  const cli = getCLIPreset(cliId)
  if (!cli) return []

  const platform = process.platform
  const paths: Array<{ name: string; type: string; path: string }> = []

  if (cli.configPath) {
    const filePath = cli.configPath[platform]
    if (filePath) {
      paths.push({
        name: cli.configFile || 'settings.json',
        type: 'config',
        path: filePath
      })
    }
  }

  return paths
}

/**
 * 清除预设缓存（用于热更新）
 */
export function clearPresetCache(): void {
  cachedPreset = null
  console.log('[CodeSwitchPreset] Cache cleared')
}
