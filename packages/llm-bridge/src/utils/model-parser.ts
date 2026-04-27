import type { ModelInfo } from '../ir/model'

/**
 * Parse an OpenAI-compatible /v1/models response into ModelInfo[].
 * Works for OpenAI, DeepSeek, Moonshot, Qwen, Zhipu and other
 * providers that follow the OpenAI models API format.
 *
 * Expected format: { data: [{ id, created?, owned_by?, ... }] }
 */
export function parseOpenAICompatModelList(response: unknown): ModelInfo[] {
  if (!response || typeof response !== 'object') return []

  const obj = response as Record<string, unknown>
  const data = Array.isArray(obj.data) ? obj.data : []

  return data
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const id = String(item.id || '')
      if (!id) return null

      const info: ModelInfo = {
        id,
        name: id,
      }

      if (typeof item.created === 'number') {
        info.created = item.created
      }
      if (typeof item.owned_by === 'string') {
        info.ownedBy = item.owned_by
      }

      return info
    })
    .filter((m): m is ModelInfo => m !== null)
}
