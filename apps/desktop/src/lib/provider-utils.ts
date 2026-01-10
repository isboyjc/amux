/**
 * Provider Utilities
 * 
 * Utility functions for working with provider data.
 */

import type { ProviderPreset } from '@/types'

/**
 * Get preset by adapter type from a presets array
 */
export function getPresetByType(presets: ProviderPreset[], type: string): ProviderPreset | undefined {
  return presets.find(preset => preset.adapterType === type)
}

/**
 * Parse model ID to display name
 * Converts model IDs like "gpt-4o-mini" to "GPT-4o Mini"
 */
export function parseModelName(modelId: string): string {
  return modelId
    .split('-')
    .map(part => {
      // Handle common abbreviations
      if (part.toLowerCase() === 'gpt') return 'GPT'
      if (part.toLowerCase() === 'glm') return 'GLM'
      // Capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}
