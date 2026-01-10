/**
 * Bridge Proxy state management
 */

import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import type { BridgeProxy, ModelMapping } from '@/types'
import type { CreateProxyDTO, UpdateProxyDTO } from '@/types/ipc'

interface ProxyState {
  proxies: BridgeProxy[]
  loading: boolean
  error: string | null
}

interface ProxyActions {
  fetch: () => Promise<void>
  create: (data: CreateProxyDTO) => Promise<BridgeProxy>
  update: (id: string, data: UpdateProxyDTO) => Promise<BridgeProxy | null>
  remove: (id: string) => Promise<boolean>
  toggle: (id: string, enabled: boolean) => Promise<boolean>
  validatePath: (path: string, excludeId?: string) => Promise<boolean>
  checkCircular: (proxyId: string, outboundId: string) => Promise<string[] | null>
  getMappings: (proxyId: string) => Promise<ModelMapping[]>
  setMappings: (proxyId: string, mappings: Array<{
    sourceModel: string
    targetModel: string
    isDefault?: boolean
  }>) => Promise<ModelMapping[]>
}

export const useBridgeProxyStore = create<ProxyState & ProxyActions>((set, get) => ({
  proxies: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const proxies = await ipc.invoke('proxy:list')
      set({ proxies, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch proxies',
        loading: false
      })
    }
  },

  create: async (data) => {
    const proxy = await ipc.invoke('proxy:create', data)
    set({ proxies: [...get().proxies, proxy] })
    return proxy
  },

  update: async (id, data) => {
    const updated = await ipc.invoke('proxy:update', id, data)
    if (updated) {
      set({
        proxies: get().proxies.map(p => p.id === id ? updated : p)
      })
    }
    return updated
  },

  remove: async (id) => {
    const success = await ipc.invoke('proxy:delete', id)
    if (success) {
      set({
        proxies: get().proxies.filter(p => p.id !== id)
      })
    }
    return success
  },

  toggle: async (id, enabled) => {
    const success = await ipc.invoke('proxy:toggle', id, enabled)
    if (success) {
      set({
        proxies: get().proxies.map(p =>
          p.id === id ? { ...p, enabled } : p
        )
      })
    }
    return success
  },

  validatePath: async (path, excludeId) => {
    return ipc.invoke('proxy:validate-path', path, excludeId)
  },

  checkCircular: async (proxyId, outboundId) => {
    return ipc.invoke('proxy:check-circular', proxyId, outboundId)
  },

  getMappings: async (proxyId) => {
    return ipc.invoke('proxy:get-mappings', proxyId)
  },

  setMappings: async (proxyId, mappings) => {
    return ipc.invoke('proxy:set-mappings', proxyId, mappings)
  }
}))
