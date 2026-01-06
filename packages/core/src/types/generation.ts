/**
 * Response format configuration
 */
export interface ResponseFormat {
  /**
   * Response type: 'text' | 'json_object' | 'json_schema'
   */
  type: 'text' | 'json_object' | 'json_schema'

  /**
   * JSON schema for structured output (when type is 'json_schema')
   */
  jsonSchema?: {
    name: string
    description?: string
    schema: Record<string, unknown>
    strict?: boolean
  }
}

/**
 * Thinking/reasoning configuration
 * Supported by: DeepSeek, Qwen, Anthropic (extended thinking)
 */
export interface ThinkingConfig {
  /**
   * Enable thinking/reasoning mode
   */
  enabled: boolean

  /**
   * Budget tokens for thinking (Anthropic)
   */
  budgetTokens?: number
}

/**
 * Generation configuration parameters
 */
export interface GenerationConfig {
  /**
   * Temperature (0-2, typically 0-1)
   * Higher values make output more random
   */
  temperature?: number

  /**
   * Top-p sampling (nucleus sampling)
   * Alternative to temperature
   */
  topP?: number

  /**
   * Top-k sampling
   * Only consider top k tokens
   */
  topK?: number

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number

  /**
   * Stop sequences
   * Generation stops when any of these sequences is encountered
   */
  stopSequences?: string[]

  /**
   * Presence penalty (-2.0 to 2.0)
   * Positive values penalize new tokens based on whether they appear in the text so far
   */
  presencePenalty?: number

  /**
   * Frequency penalty (-2.0 to 2.0)
   * Positive values penalize new tokens based on their frequency in the text so far
   */
  frequencyPenalty?: number

  /**
   * Number of completions to generate
   */
  n?: number

  /**
   * Seed for deterministic generation
   */
  seed?: number

  /**
   * Response format configuration
   */
  responseFormat?: ResponseFormat

  /**
   * Thinking/reasoning configuration
   * Supported by: DeepSeek (deepseek-reasoner), Qwen (QwQ), Anthropic (extended thinking)
   */
  thinking?: ThinkingConfig

  /**
   * Enable web search (Qwen specific)
   */
  enableSearch?: boolean

  /**
   * Log probabilities configuration
   */
  logprobs?: boolean

  /**
   * Number of top log probabilities to return
   */
  topLogprobs?: number
}
