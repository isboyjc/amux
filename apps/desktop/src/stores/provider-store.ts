/**
 * Provider state management
 */

import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import type { Provider, ProviderPreset } from '@/types'
import type { CreateProviderDTO, UpdateProviderDTO, ProviderTestResult } from '@/types/ipc'

interface ProviderState {
  providers: Provider[]
  presets: ProviderPreset[]
  loading: boolean
  presetsLoading: boolean
  error: string | null
}

interface ProviderActions {
  fetch: () => Promise<void>
  fetchPresets: () => Promise<ProviderPreset[]>
  create: (data: CreateProviderDTO) => Promise<Provider>
  update: (id: string, data: UpdateProviderDTO) => Promise<Provider | null>
  remove: (id: string) => Promise<boolean>
  toggle: (id: string, enabled: boolean) => Promise<boolean>
  test: (id: string, modelId?: string) => Promise<ProviderTestResult>
  fetchModels: (id: string) => Promise<string[]>
}

export const useProviderStore = create<ProviderState & ProviderActions>((set, get) => ({
  providers: [],
  presets: [],
  loading: false,
  presetsLoading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const providers = await ipc.invoke('provider:list')
      set({ providers, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch providers',
        loading: false
      })
    }
  },

  fetchPresets: async () => {
    set({ presetsLoading: true })
    try {
      const presets = await ipc.invoke('presets:get-providers')
      set({ presets, presetsLoading: false })
      return presets
    } catch (error) {
      set({ presetsLoading: false })
      console.error('Failed to fetch presets:', error)
      return []
    }
  },

  create: async (data) => {
    const provider = await ipc.invoke('provider:create', data)
    set({ providers: [...get().providers, provider] })
    return provider
  },

  update: async (id, data) => {
    const updated = await ipc.invoke('provider:update', id, data)
    if (updated) {
      set({
        providers: get().providers.map(p => p.id === id ? updated : p)
      })
    }
    return updated
  },

  remove: async (id) => {
    const success = await ipc.invoke('provider:delete', id)
    if (success) {
      set({
        providers: get().providers.filter(p => p.id !== id)
      })
    }
    return success
  },

  toggle: async (id, enabled) => {
    const success = await ipc.invoke('provider:toggle', id, enabled)
    if (success) {
      set({
        providers: get().providers.map(p =>
          p.id === id ? { ...p, enabled } : p
        )
      })
    }
    return success
  },

  test: async (id, modelId) => {
    return ipc.invoke('provider:test', id, modelId)
  },

  fetchModels: async (id) => {
    return ipc.invoke('provider:fetch-models', id)
  }
}))
