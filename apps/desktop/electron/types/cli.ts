/**
 * CLI 类型定义和配置抽象
 * 支持多个 AI CLI 工具的统一管理
 */

/**
 * 支持的 CLI 类型
 */
export enum CliType {
  ClaudeCode = 'claude',
  Codex = 'codex',
}

/**
 * CLI 定义
 */
export interface CliDefinition {
  /** CLI 类型 */
  type: CliType
  
  /** 显示名称 */
  displayName: string
  
  /** 配置文件格式 */
  configFormat: 'json' | 'toml'
  
  /** 各平台的配置文件路径 */
  configPaths: {
    darwin: string
    win32: string
    linux: string
  }
  
  /** 代理端点路径 */
  proxyEndpoint: string
  
  /** 是否支持热切换（配置热重载） */
  supportsHotSwitch: boolean
  
  /** 需要清除的模型覆盖环境变量 */
  modelOverrideEnvKeys?: string[]
}

/**
 * CLI 定义配置表
 */
export const CLI_DEFINITIONS: Record<CliType, CliDefinition> = {
  [CliType.ClaudeCode]: {
    type: CliType.ClaudeCode,
    displayName: 'Claude Code',
    configFormat: 'json',
    configPaths: {
      darwin: '~/.claude/settings.json',
      win32: '%APPDATA%\\Claude\\settings.json',
      linux: '~/.claude/settings.json',
    },
    proxyEndpoint: '/api/v1/cc',
    supportsHotSwitch: true,
    modelOverrideEnvKeys: [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_REASONING_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_SMALL_FAST_MODEL',
    ],
  },
  
  [CliType.Codex]: {
    type: CliType.Codex,
    displayName: 'Codex',
    configFormat: 'toml',
    configPaths: {
      darwin: '~/.codex/config.toml',
      win32: '%USERPROFILE%\\.codex\\config.toml',
      linux: '~/.codex/config.toml',
    },
    proxyEndpoint: '/api/v1/codex',
    supportsHotSwitch: false,  // 待验证，保守设为 false
  },
}

/**
 * 获取 CLI 定义
 */
export function getCliDefinition(cliType: CliType): CliDefinition {
  const def = CLI_DEFINITIONS[cliType]
  if (!def) {
    throw new Error(`不支持的 CLI 类型: ${cliType}`)
  }
  return def
}

/**
 * 获取代理 URL
 */
export function getProxyUrl(cliType: CliType, port: number = 3000): string {
  const def = getCliDefinition(cliType)
  return `http://localhost:${port}${def.proxyEndpoint}`
}

/**
 * 获取配置文件路径（根据当前操作系统）
 */
export function getConfigPath(cliType: CliType): string {
  const def = getCliDefinition(cliType)
  const platform = process.platform as 'darwin' | 'win32' | 'linux'
  return def.configPaths[platform] || def.configPaths.linux
}

/**
 * 获取所有支持的 CLI 类型
 */
export function getAllCliTypes(): CliType[] {
  return Object.values(CliType)
}

/**
 * 检查是否为有效的 CLI 类型
 */
export function isValidCliType(value: string): value is CliType {
  return Object.values(CliType).includes(value as CliType)
}
