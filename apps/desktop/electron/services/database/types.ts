/**
 * Database related type definitions
 */

import type Database from 'better-sqlite3'

// Database instance type
export type DatabaseInstance = Database.Database

// Migration interface
export interface Migration {
  version: number
  name: string
  up: (db: DatabaseInstance) => void
  down: (db: DatabaseInstance) => void
}

// Database options
export interface DatabaseOptions {
  /** Database file path */
  path?: string
  /** Enable verbose logging */
  verbose?: boolean
  /** Enable WAL mode */
  wal?: boolean
}

// Common database row types
export interface BaseRow {
  id: string
  created_at: number
  updated_at?: number
}

// Provider row from database
export interface ProviderRow extends BaseRow {
  name: string
  adapter_type: string
  api_key: string | null
  base_url: string | null
  chat_path: string | null // API endpoint for chat completions
  models_path: string | null // API endpoint for listing models
  models: string // JSON array
  enabled: number // 0 or 1
  sort_order: number
  logo: string | null // Base64 data URL for logo
  color: string | null // Brand color hex code
  enable_as_proxy: number // 0 or 1 - enable provider as passthrough proxy
  proxy_path: string | null // URL path identifier for passthrough proxy (e.g. "openai-personal")
  updated_at: number
}

// Bridge proxy row from database
export interface BridgeProxyRow extends BaseRow {
  name: string
  inbound_adapter: string
  outbound_type: string
  outbound_id: string
  proxy_path: string
  enabled: number
  sort_order: number
  updated_at: number
}

// Model mapping row from database
export interface ModelMappingRow {
  id: string
  proxy_id: string
  source_model: string
  target_model: string
  is_default: number
}

// API key row from database
export interface ApiKeyRow {
  id: string
  key: string
  name: string | null
  enabled: number
  created_at: number
  last_used_at: number | null
}

// Settings row from database
export interface SettingsRow {
  key: string
  value: string // JSON
  updated_at: number
}

// Request log row from database
export interface RequestLogRow {
  id: string
  proxy_id: string | null
  proxy_path: string
  source_model: string
  target_model: string
  status_code: number
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number
  request_body: string | null
  response_body: string | null
  error: string | null
  source: 'local' | 'tunnel'
  created_at: number
}

// Schema migration row from database
export interface SchemaMigrationRow {
  version: number
  applied_at: number
}

// Code Switch configuration row from database
export interface CodeSwitchConfigRow extends BaseRow {
  cli_type: string // 'claudecode' | 'codex'
  enabled: number // 0 or 1
  provider_id: string
  config_path: string
  backup_config: string | null // JSON string of original config
  proxy_path: string // e.g. 'code/claudecode'
  updated_at: number
}

// Mapping type for hybrid mapping strategy
export type CodeModelMappingType = 'exact' | 'family' | 'reasoning' | 'default'

// Code model mapping row from database (with historical mapping support)
export interface CodeModelMappingRow extends BaseRow {
  code_switch_id: string
  provider_id: string // Support for historical mappings per provider
  source_model: string // Source model name - Claude official models or Codex default/custom models
  target_model: string // Target provider model name (format: provider/model)
  mapping_type: CodeModelMappingType // exact | family | reasoning | default
  is_active: number // 0 or 1 - only active when provider matches code_switch config
  updated_at: number
}

// ============================================================
// V2: CLI Code Switch 新架构类型定义
// ============================================================

// CLI Code Switch 配置行（V2 架构）
export interface CliCodeSwitchConfigRow extends BaseRow {
  cli_type: string // 'claude' | 'codex'
  current_provider_id: string | null // FK → providers.id
  enabled: number // 0 or 1
  takeover_active: number // 0 or 1 - 是否处于代理接管模式
  updated_at: number
}

// CLI + Provider 模型映射行（V2 架构，支持历史记忆）
export interface CliProviderModelMappingRow extends BaseRow {
  cli_type: string // 'claude' | 'codex'
  provider_id: string // FK → providers.id
  mapping_type: CodeModelMappingType // exact | family | reasoning | default
  source_model: string | null // exact: 源模型名, family: NULL
  target_model: string // 目标模型名
  keywords: string | null // JSON array for family mapping
  priority: number // family 映射的优先级
  is_active: number // 0 or 1 - 当前 CLI 选择此 provider 时激活
  updated_at: number
}

// CLI 配置备份行
export interface CliLiveConfigBackupRow {
  cli_type: string // PK: 'claude' | 'codex'
  original_content: string // 原始配置文件内容
  backed_up_at: number
  config_file_path: string // 配置文件路径
}
