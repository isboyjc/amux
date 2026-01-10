/**
 * Route configurations - define all available bridge routes
 *
 * Model Support by Endpoint:
 * - Chat Completions API (/v1/chat/completions): GPT-3.5, GPT-4, GPT-4o series (NOT GPT-5)
 * - Responses API (/v1/responses): GPT-4, GPT-5, GPT-5.2, o3, o4-mini (recommended for new models)
 */
import type { RouteConfig } from '../types'

export const routes: RouteConfig[] = [
  // ============================================================================
  // OpenAI Chat Completions API Routes (supports GPT-4, GPT-4o, GPT-4o-mini)
  // Note: GPT-5 series is NOT supported on this endpoint
  // ============================================================================

  // OpenAI <-> Anthropic
  {
    inbound: 'openai',
    outbound: 'anthropic',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'gpt-4': 'claude-haiku-4-5-20251001',
      'gpt-4o': 'claude-sonnet-4-5-20250929',
      'gpt-4o-mini': 'claude-haiku-4-5-20251001',
    },
    defaultModel: 'claude-haiku-4-5-20251001',
  },
  {
    inbound: 'anthropic',
    outbound: 'openai',
    endpoint: '/v1/messages',
    modelMapping: {
      'claude-haiku-4-5-20251001': 'gpt-4o-mini',
      'claude-sonnet-4-5-20250929': 'gpt-4o',
      'claude-opus-4-5-20251101': 'gpt-4o',
    },
    defaultModel: 'gpt-4',
  },

  // OpenAI <-> DeepSeek
  {
    inbound: 'openai',
    outbound: 'deepseek',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'gpt-4': 'deepseek-chat',
      'gpt-4o': 'deepseek-reasoner',
      'gpt-4o-mini': 'deepseek-chat',
    },
    defaultModel: 'deepseek-chat',
  },
  {
    inbound: 'deepseek',
    outbound: 'openai',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'deepseek-chat': 'gpt-4',
      'deepseek-reasoner': 'gpt-4o',
    },
    defaultModel: 'gpt-4',
  },

  // OpenAI <-> Moonshot
  {
    inbound: 'openai',
    outbound: 'moonshot',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'gpt-4': 'moonshot-v1-8k',
      'gpt-4o': 'kimi-k2-0905-preview',
      'gpt-4o-mini': 'moonshot-v1-8k',
    },
    defaultModel: 'moonshot-v1-8k',
  },
  {
    inbound: 'moonshot',
    outbound: 'openai',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'moonshot-v1-8k': 'gpt-4o-mini',
      'kimi-k2-0905-preview': 'gpt-4o',
      'kimi-k2-thinking': 'gpt-4o',
    },
    defaultModel: 'gpt-4',
  },

  // OpenAI <-> Zhipu
  {
    inbound: 'openai',
    outbound: 'zhipu',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'gpt-4': 'glm-4.5',
      'gpt-4o': 'glm-4.6',
      'gpt-4o-mini': 'glm-4.5',
    },
    defaultModel: 'glm-4.5',
  },
  {
    inbound: 'zhipu',
    outbound: 'openai',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'glm-4.5': 'gpt-4o-mini',
      'glm-4.6': 'gpt-4o',
      'glm-4.7': 'gpt-4o',
    },
    defaultModel: 'gpt-4',
  },

  // ============================================================================
  // OpenAI Responses API Routes (supports GPT-4o, GPT-5, GPT-5.1)
  // This is the recommended endpoint for GPT-5 series and reasoning models
  // ============================================================================

  // OpenAI Responses <-> Anthropic
  {
    inbound: 'openai-responses',
    outbound: 'anthropic',
    endpoint: '/v1/responses',
    modelMapping: {
      'gpt-4o': 'claude-sonnet-4-5-20250929',
      'gpt-5': 'claude-opus-4-5-20251101',
      'gpt-5.1': 'claude-opus-4-5-20251101',
    },
    defaultModel: 'claude-sonnet-4-5-20250929',
  },
  {
    inbound: 'anthropic',
    outbound: 'openai-responses',
    endpoint: '/v1/messages',
    modelMapping: {
      'claude-haiku-4-5-20251001': 'gpt-4o',
      'claude-sonnet-4-5-20250929': 'gpt-5',
      'claude-opus-4-5-20251101': 'gpt-5.1',
    },
    defaultModel: 'gpt-5',
  },

  // OpenAI Responses <-> DeepSeek
  {
    inbound: 'openai-responses',
    outbound: 'deepseek',
    endpoint: '/v1/responses',
    modelMapping: {
      'gpt-4o': 'deepseek-chat',
      'gpt-5': 'deepseek-chat',
      'gpt-5.1': 'deepseek-reasoner',
    },
    defaultModel: 'deepseek-chat',
  },
  {
    inbound: 'deepseek',
    outbound: 'openai-responses',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'deepseek-chat': 'gpt-4o',
      'deepseek-reasoner': 'gpt-5.1',
    },
    defaultModel: 'gpt-5',
  },

  // OpenAI Responses <-> Moonshot
  {
    inbound: 'openai-responses',
    outbound: 'moonshot',
    endpoint: '/v1/responses',
    modelMapping: {
      'gpt-4o': 'kimi-k2-0905-preview',
      'gpt-5': 'kimi-k2-thinking',
      'gpt-5.1': 'kimi-k2-thinking',
    },
    defaultModel: 'kimi-k2-0905-preview',
  },
  {
    inbound: 'moonshot',
    outbound: 'openai-responses',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'moonshot-v1-8k': 'gpt-4o',
      'kimi-k2-0905-preview': 'gpt-5',
      'kimi-k2-thinking': 'gpt-5.1',
    },
    defaultModel: 'gpt-5',
  },

  // OpenAI Responses <-> Zhipu
  {
    inbound: 'openai-responses',
    outbound: 'zhipu',
    endpoint: '/v1/responses',
    modelMapping: {
      'gpt-4o': 'glm-4.6',
      'gpt-5': 'glm-4.7',
      'gpt-5.1': 'glm-4.7',
    },
    defaultModel: 'glm-4.6',
  },
  {
    inbound: 'zhipu',
    outbound: 'openai-responses',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'glm-4.5': 'gpt-4o',
      'glm-4.6': 'gpt-5',
      'glm-4.7': 'gpt-5.1',
    },
    defaultModel: 'gpt-5',
  },

  // OpenAI Chat Completions -> OpenAI Responses (upgrade path)
  {
    inbound: 'openai',
    outbound: 'openai-responses',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'gpt-4': 'gpt-4o',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o',
    },
    defaultModel: 'gpt-4o',
  },
  // OpenAI Responses -> OpenAI Chat Completions (downgrade path)
  // Note: GPT-5 models will be mapped to GPT-4o (best available on old endpoint)
  {
    inbound: 'openai-responses',
    outbound: 'openai',
    endpoint: '/v1/responses',
    modelMapping: {
      'gpt-4o': 'gpt-4o',
      'gpt-5': 'gpt-4o',
      'gpt-5.1': 'gpt-4o',
    },
    defaultModel: 'gpt-4',
  },

  // ============================================================================
  // Anthropic <-> DeepSeek
  // ============================================================================
  {
    inbound: 'anthropic',
    outbound: 'deepseek',
    endpoint: '/v1/messages',
    modelMapping: {
      'claude-haiku-4-5-20251001': 'deepseek-chat',
      'claude-sonnet-4-5-20250929': 'deepseek-reasoner',
      'claude-opus-4-5-20251101': 'deepseek-reasoner',
    },
    defaultModel: 'deepseek-chat',
  },
  {
    inbound: 'deepseek',
    outbound: 'anthropic',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'deepseek-chat': 'claude-haiku-4-5-20251001',
      'deepseek-reasoner': 'claude-sonnet-4-5-20250929',
    },
    defaultModel: 'claude-haiku-4-5-20251001',
  },

  // ============================================================================
  // Anthropic <-> Moonshot
  // ============================================================================
  {
    inbound: 'anthropic',
    outbound: 'moonshot',
    endpoint: '/v1/messages',
    modelMapping: {
      'claude-haiku-4-5-20251001': 'moonshot-v1-8k',
      'claude-sonnet-4-5-20250929': 'kimi-k2-0905-preview',
      'claude-opus-4-5-20251101': 'kimi-k2-thinking',
    },
    defaultModel: 'moonshot-v1-8k',
  },
  {
    inbound: 'moonshot',
    outbound: 'anthropic',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'moonshot-v1-8k': 'claude-haiku-4-5-20251001',
      'kimi-k2-0905-preview': 'claude-sonnet-4-5-20250929',
      'kimi-k2-thinking': 'claude-opus-4-5-20251101',
    },
    defaultModel: 'claude-haiku-4-5-20251001',
  },

  // ============================================================================
  // DeepSeek <-> Moonshot
  // ============================================================================
  {
    inbound: 'deepseek',
    outbound: 'moonshot',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'deepseek-chat': 'moonshot-v1-8k',
      'deepseek-reasoner': 'kimi-k2-thinking',
    },
    defaultModel: 'moonshot-v1-8k',
  },
  {
    inbound: 'moonshot',
    outbound: 'deepseek',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'moonshot-v1-8k': 'deepseek-chat',
      'kimi-k2-0905-preview': 'deepseek-chat',
      'kimi-k2-thinking': 'deepseek-reasoner',
    },
    defaultModel: 'deepseek-chat',
  },

  // ============================================================================
  // Anthropic <-> Zhipu
  // ============================================================================
  {
    inbound: 'anthropic',
    outbound: 'zhipu',
    endpoint: '/v1/messages',
    modelMapping: {
      'claude-haiku-4-5-20251001': 'glm-4.5',
      'claude-sonnet-4-5-20250929': 'glm-4.6',
      'claude-opus-4-5-20251101': 'glm-4.7',
    },
    defaultModel: 'glm-4.5',
  },
  {
    inbound: 'zhipu',
    outbound: 'anthropic',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'glm-4.5': 'claude-haiku-4-5-20251001',
      'glm-4.6': 'claude-sonnet-4-5-20250929',
      'glm-4.7': 'claude-opus-4-5-20251101',
    },
    defaultModel: 'claude-haiku-4-5-20251001',
  },

  // ============================================================================
  // DeepSeek <-> Zhipu
  // ============================================================================
  {
    inbound: 'deepseek',
    outbound: 'zhipu',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'deepseek-chat': 'glm-4.5',
      'deepseek-reasoner': 'glm-4.7',
    },
    defaultModel: 'glm-4.5',
  },
  {
    inbound: 'zhipu',
    outbound: 'deepseek',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'glm-4.5': 'deepseek-chat',
      'glm-4.6': 'deepseek-chat',
      'glm-4.7': 'deepseek-reasoner',
    },
    defaultModel: 'deepseek-chat',
  },

  // ============================================================================
  // Moonshot <-> Zhipu
  // ============================================================================
  {
    inbound: 'moonshot',
    outbound: 'zhipu',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'moonshot-v1-8k': 'glm-4.5',
      'kimi-k2-0905-preview': 'glm-4.6',
      'kimi-k2-thinking': 'glm-4.7',
    },
    defaultModel: 'glm-4.5',
  },
  {
    inbound: 'zhipu',
    outbound: 'moonshot',
    endpoint: '/v1/chat/completions',
    modelMapping: {
      'glm-4.5': 'moonshot-v1-8k',
      'glm-4.6': 'kimi-k2-0905-preview',
      'glm-4.7': 'kimi-k2-thinking',
    },
    defaultModel: 'moonshot-v1-8k',
  },
]
