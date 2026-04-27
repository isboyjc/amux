/**
 * Model auto-refresh service
 *
 * On app startup, fetches the latest model lists from providers
 * that have a configured API key and models endpoint.
 * Runs in the background and does not block the startup flow.
 */

import { decryptApiKey } from '../crypto'
import { getProviderRepository } from '../database/repositories'
import type { ProviderRow } from '../database/types'

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  deepseek: 'https://api.deepseek.com',
  moonshot: 'https://api.moonshot.cn',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  zhipu: 'https://open.bigmodel.cn/api/paas',
  google: 'https://generativelanguage.googleapis.com',
}

const DEFAULT_MODELS_PATHS: Record<string, string> = {
  openai: '/v1/models',
  anthropic: '/v1/models',
  deepseek: '/v1/models',
  moonshot: '/v1/models',
  qwen: '/v1/models',
  zhipu: '/v4/models',
  google: '/v1beta/models',
}

interface FetchedModel {
  id: string
  name?: string
}

/**
 * Refresh model lists for all providers that have API keys configured.
 * This is a fire-and-forget background task.
 */
export async function refreshAllProviderModels(): Promise<void> {
  const repo = getProviderRepository()
  const providers = repo.findAllEnabled()

  console.log(`[ModelRefresh] Starting model refresh for ${providers.length} enabled providers`)

  const results = await Promise.allSettled(
    providers.map((provider) => refreshProviderModels(provider, repo))
  )

  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value === 'skipped') {
        skipCount++
      } else {
        successCount++
      }
    } else {
      failCount++
    }
  }

  console.log(
    `[ModelRefresh] Complete: ${successCount} updated, ${skipCount} skipped, ${failCount} failed`
  )
}

async function refreshProviderModels(
  provider: ProviderRow,
  repo: ReturnType<typeof getProviderRepository>
): Promise<'updated' | 'skipped'> {
  // Skip if no API key
  if (!provider.api_key) {
    return 'skipped'
  }

  // Skip if adapter type has no known models endpoint (e.g. minimax)
  const adapterType = provider.adapter_type
  const modelsPath = provider.models_path || DEFAULT_MODELS_PATHS[adapterType]
  if (!modelsPath) {
    return 'skipped'
  }

  const apiKey = decryptApiKey(provider.api_key)
  if (!apiKey) {
    return 'skipped'
  }

  const baseUrl = provider.base_url || DEFAULT_BASE_URLS[adapterType] || ''
  if (!baseUrl) {
    return 'skipped'
  }

  const url = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}${modelsPath}`

  try {
    // Build headers based on adapter type
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (adapterType === 'anthropic') {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else if (adapterType === 'google') {
      // Google uses API key as query parameter, handled below
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Google uses ?key= query parameter
    const fetchUrl = adapterType === 'google' ? `${url}?key=${apiKey}` : url

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.warn(
        `[ModelRefresh] ${provider.name}: HTTP ${response.status} ${response.statusText}`
      )
      return 'skipped'
    }

    const data = await response.json()
    const models = parseModelsResponse(data, adapterType)

    if (models.length === 0) {
      return 'skipped'
    }

    // Merge with existing models: keep existing model metadata, add new ones
    const existingModels: FetchedModel[] = JSON.parse(provider.models || '[]')
    const existingIds = new Set(existingModels.map((m) => (typeof m === 'string' ? m : m.id)))
    const fetchedIds = new Set(models.map((m) => m.id))

    // Check if there are any new models
    const hasNewModels = models.some((m) => !existingIds.has(m.id))
    const hasRemovedModels = existingModels.some((m) => {
      const id = typeof m === 'string' ? m : m.id
      return !fetchedIds.has(id)
    })

    if (!hasNewModels && !hasRemovedModels) {
      return 'skipped'
    }

    // Build merged list: preserve existing entries with their metadata,
    // add new models from API
    const mergedModels = models.map((fetchedModel) => {
      // If model existed before, preserve its existing metadata
      const existing = existingModels.find((m) =>
        (typeof m === 'string' ? m : m.id) === fetchedModel.id
      )
      if (existing && typeof existing === 'object') {
        return existing
      }
      return fetchedModel
    })

    // Store as string[] (model IDs) to match UpdateProviderDTO type
    repo.update(provider.id, {
      models: mergedModels.map((m) => (typeof m === 'string' ? m : m.id)),
    })

    console.log(
      `[ModelRefresh] ${provider.name}: updated ${mergedModels.length} models` +
        (hasNewModels ? ' (new models found)' : '') +
        (hasRemovedModels ? ' (removed stale models)' : '')
    )

    return 'updated'
  } catch (error) {
    console.warn(
      `[ModelRefresh] ${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return 'skipped'
  }
}

/**
 * Parse the model list response based on adapter type.
 */
function parseModelsResponse(
  data: unknown,
  adapterType: string
): FetchedModel[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>

  // OpenAI-compatible format: { data: [{ id, ... }] }
  if (Array.isArray(obj.data)) {
    return obj.data
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object' && !!m.id)
      .map((m) => ({
        id: String(m.id),
        name: String(m.id),
      }))
  }

  // Google Gemini format: { models: [{ name: "models/xxx", displayName, ... }] }
  if (adapterType === 'google' && Array.isArray(obj.models)) {
    return obj.models
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => {
        const fullName = String(m.name || '')
        const id = fullName.startsWith('models/') ? fullName.slice(7) : fullName
        if (!id) return null
        return {
          id,
          name: String(m.displayName || id),
        }
      })
      .filter((m): m is FetchedModel => m !== null)
  }

  // Fallback: try array format
  if (Array.isArray(data)) {
    return data
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({
        id: String(m.id || m.name || ''),
        name: String(m.name || m.id || ''),
      }))
      .filter((m) => !!m.id)
  }

  return []
}
