/**
 * JSON Schema definition
 */
export interface JSONSchema {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
  description?: string
  [key: string]: unknown
}

/**
 * Function definition
 */
export interface FunctionDefinition {
  name: string
  description?: string
  parameters?: JSONSchema
  strict?: boolean // OpenAI structured outputs
}

/**
 * Tool definition
 */
export interface Tool {
  type: 'function'
  function: FunctionDefinition
}

/**
 * Tool choice options
 */
export type ToolChoice =
  | 'auto' // Let the model decide
  | 'none' // Don't use tools
  | 'required' // Must use a tool
  | {
      // Specific tool
      type: 'function'
      function: {
        name: string
      }
    }
