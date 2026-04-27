/**
 * Unified model information - IR representation of a provider model.
 * Normalizes different provider model list formats into a common shape.
 */
export interface ModelInfo {
  /** Unique model identifier (e.g. "gpt-4o", "claude-sonnet-4-5-20250929") */
  id: string
  /** Human-readable display name */
  name: string
  /** Context window size in tokens, if known */
  contextLength?: number
  /** Model capabilities */
  capabilities?: ModelCapabilities
  /** Whether this model is deprecated */
  deprecated?: boolean
  /** Owner or organization (e.g. "openai", "system") */
  ownedBy?: string
  /** Creation timestamp (unix seconds) */
  created?: number
}

/**
 * Model capability flags
 */
export interface ModelCapabilities {
  streaming?: boolean
  tools?: boolean
  vision?: boolean
  reasoning?: boolean
  jsonMode?: boolean
}

/**
 * Unified model list response
 */
export interface ModelListIR {
  /** List of available models */
  models: ModelInfo[]
  /** Provider name that returned these models */
  provider: string
}
