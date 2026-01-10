/**
 * Proxy service state management
 */

import { create } from 'zustand'
import { ipc } from '@/lib/ipc'

type ProxyStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error'

interface ProxyState {
  status: ProxyStatus
  port: number | null
  host: string | null
  error: string | null
  metrics: {
    totalRequests: number
    successRequests: number
    failedRequests: number
    averageLatency: number
    requestsPerMinute: number
    activeConnections: number
  } | null
}

interface ProxyActions {
  fetchStatus: () => Promise<void>
  fetchMetrics: () => Promise<void>
  start: (config?: { port?: number; host?: string }) => Promise<void>
  stop: () => Promise<void>
  restart: (config?: { port?: number; host?: string }) => Promise<void>
}

export const useProxyStore = create<ProxyState & ProxyActions>((set) => ({
  status: 'stopped',
  port: null,
  host: null,
  error: null,
  metrics: null,

  fetchStatus: async () => {
    try {
      const state = await ipc.invoke('proxy-service:status')
      set({
        status: state.status,
        port: state.port,
        host: state.host,
        error: state.error
      })
    } catch (error) {
      console.error('Failed to fetch proxy status:', error)
    }
  },

  fetchMetrics: async () => {
    try {
      const metrics = await ipc.invoke('proxy-service:metrics')
      set({ metrics })
    } catch (error) {
      console.error('Failed to fetch proxy metrics:', error)
    }
  },

  start: async (config) => {
    set({ status: 'starting' })
    try {
      await ipc.invoke('proxy-service:start', config)
      set({ status: 'running', port: config?.port ?? 9527, host: config?.host ?? '127.0.0.1', error: null })
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Failed to start' })
    }
  },

  stop: async () => {
    set({ status: 'stopping' })
    try {
      await ipc.invoke('proxy-service:stop')
      set({ status: 'stopped', port: null, host: null, error: null })
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Failed to stop' })
    }
  },

  restart: async (config) => {
    set({ status: 'stopping' })
    try {
      await ipc.invoke('proxy-service:restart', config)
      set({ status: 'running', port: config?.port ?? 9527, host: config?.host ?? '127.0.0.1', error: null })
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Failed to restart' })
    }
  }
}))
