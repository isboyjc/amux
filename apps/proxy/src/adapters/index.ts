/**
 * Adapter registry - centralized adapter configurations
 */
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { openaiAdapter, openaiResponsesAdapter } from '@amux.ai/adapter-openai'
import { zhipuAdapter } from '@amux.ai/adapter-zhipu'
import type { AdapterConfig } from '../types'

export const adapters: Record<string, AdapterConfig> = {
  anthropic: {
    adapter: anthropicAdapter,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://52ai.org',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeyHeader: 'x-api-key',
    authHeaderName: 'x-api-key',
    authHeaderPrefix: '',
  },
  deepseek: {
    adapter: deepseekAdapter,
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    apiKeyHeader: 'authorization',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer',
  },
  moonshot: {
    adapter: moonshotAdapter,
    baseURL: process.env.MOONSHOT_BASE_URL,
    apiKeyEnv: 'MOONSHOT_API_KEY',
    apiKeyHeader: 'authorization',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer',
  },
  openai: {
    adapter: openaiAdapter,
    baseURL: process.env.OPENAI_BASE_URL,
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyHeader: 'authorization',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer',
  },
  'openai-responses': {
    adapter: openaiResponsesAdapter,
    baseURL: process.env.OPENAI_BASE_URL,
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyHeader: 'authorization',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer',
  },
  zhipu: {
    adapter: zhipuAdapter,
    baseURL: process.env.ZHIPU_BASE_URL,
    apiKeyEnv: 'ZHIPU_API_KEY',
    apiKeyHeader: 'authorization',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer',
  },
}
