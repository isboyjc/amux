/**
 * Adapter configuration types
 */
import type { LLMAdapter } from '@amux/llm-bridge'

export interface AdapterConfig {
  adapter: LLMAdapter
  baseURL?: string
  apiKeyEnv: string
  apiKeyHeader: string
  authHeaderName?: string
  authHeaderPrefix?: string
}

export interface RouteConfig {
  inbound: string
  outbound: string
  endpoint: string
  modelMapping: Record<string, string>
  defaultModel: string
}
