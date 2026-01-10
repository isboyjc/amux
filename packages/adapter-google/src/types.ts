/**
 * Gemini content part types
 */
export type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string
        data: string // base64
      }
    }
  | {
      fileData: {
        mimeType: string
        fileUri: string
      }
    }
  | {
      functionCall: {
        name: string
        args: Record<string, unknown>
      }
    }
  | {
      functionResponse: {
        name: string
        response: Record<string, unknown>
      }
    }

/**
 * Gemini content (message)
 */
export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

/**
 * Gemini function declaration
 */
export interface GeminiFunctionDeclaration {
  name: string
  description?: string
  parameters?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Gemini tool
 */
export interface GeminiTool {
  functionDeclarations?: GeminiFunctionDeclaration[]
}

/**
 * Gemini tool config
 */
export interface GeminiToolConfig {
  functionCallingConfig?: {
    mode: 'AUTO' | 'ANY' | 'NONE'
    allowedFunctionNames?: string[]
  }
}

/**
 * Gemini safety setting
 */
export interface GeminiSafetySetting {
  category: string
  threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE'
}

/**
 * Gemini generation config
 */
export interface GeminiGenerationConfig {
  stopSequences?: string[]
  responseMimeType?: 'text/plain' | 'application/json'
  responseSchema?: Record<string, unknown>
  candidateCount?: number
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  topK?: number
}

/**
 * Gemini request format (native API)
 */
export interface GeminiRequest {
  contents: GeminiContent[]
  tools?: GeminiTool[]
  toolConfig?: GeminiToolConfig
  safetySettings?: GeminiSafetySetting[]
  systemInstruction?: {
    parts: Array<{ text: string }>
  }
  generationConfig?: GeminiGenerationConfig
  cachedContent?: string
}

/**
 * Gemini safety rating
 */
export interface GeminiSafetyRating {
  category: string
  probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH'
}

/**
 * Gemini candidate
 */
export interface GeminiCandidate {
  content: GeminiContent
  finishReason?: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER'
  index?: number
  safetyRatings?: GeminiSafetyRating[]
}

/**
 * Gemini usage metadata
 */
export interface GeminiUsageMetadata {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
  cachedContentTokenCount?: number
}

/**
 * Gemini response format
 */
export interface GeminiResponse {
  candidates: GeminiCandidate[]
  promptFeedback?: {
    safetyRatings?: GeminiSafetyRating[]
    blockReason?: 'SAFETY' | 'OTHER'
  }
  usageMetadata?: GeminiUsageMetadata
  modelVersion?: string
  responseId?: string
}

/**
 * Gemini stream chunk format
 */
export interface GeminiStreamChunk {
  candidates?: GeminiCandidate[]
  usageMetadata?: GeminiUsageMetadata
  modelVersion?: string
}

/**
 * Gemini error format
 */
export interface GeminiError {
  error: {
    code: number
    message: string
    status: string
  }
}
