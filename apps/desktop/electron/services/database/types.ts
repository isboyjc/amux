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
  created_at: number
}

// Schema migration row from database
export interface SchemaMigrationRow {
  version: number
  applied_at: number
}
