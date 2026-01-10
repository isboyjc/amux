/**
 * Provider endpoint configuration
 */
export interface ProviderEndpoint {
  /**
   * Base URL for the API
   */
  baseUrl: string

  /**
   * Chat completions path (default: '/v1/chat/completions')
   */
  chatPath?: string

  /**
   * Models list path (default: '/v1/models')
   */
  modelsPath?: string
}

/**
 * Adapter capabilities
 */
export interface AdapterCapabilities {
  /**
   * Supports streaming
   */
  streaming: boolean

  /**
   * Supports tool/function calling
   */
  tools: boolean

  /**
   * Supports vision (image input)
   */
  vision: boolean

  /**
   * Supports multimodal content (images, audio, video, documents)
   */
  multimodal: boolean

  /**
   * Supports system prompt
   */
  systemPrompt: boolean

  /**
   * Supports tool choice
   */
  toolChoice: boolean

  /**
   * Supports reasoning/thinking mode (DeepSeek, Qwen QwQ, Anthropic)
   */
  reasoning?: boolean

  /**
   * Supports web search (Qwen)
   */
  webSearch?: boolean

  /**
   * Supports JSON mode / structured output
   */
  jsonMode?: boolean

  /**
   * Supports log probabilities
   */
  logprobs?: boolean

  /**
   * Supports seed for reproducibility
   */
  seed?: boolean
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Adapter information
 */
export interface AdapterInfo {
  name: string
  version: string
  capabilities: AdapterCapabilities

  /**
   * Default endpoint configuration
   */
  endpoint?: ProviderEndpoint
}
