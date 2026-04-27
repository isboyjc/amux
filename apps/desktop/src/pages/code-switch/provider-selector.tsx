/**
 * Provider Selector Component
 * 供应商选择器（使用现有 providers 表）
 */

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Provider } from '@/types'

interface ProviderSelectorProps {
  value: string
  onChange: (providerId: string) => void
  disabled?: boolean
  currentProvider?: Provider | null
}

export function ProviderSelector({
  value,
  onChange,
  disabled,
  currentProvider,
}: ProviderSelectorProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const result = await window.api.invoke('cli-cs:get-providers') as {
        success: boolean
        providers?: Provider[]
      }
      if (result.success) {
        setProviders(result.providers || [])
      }
    } catch (error) {
      console.error('Failed to load providers:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">加载供应商...</span>
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="选择供应商">
          {currentProvider && (
            <div className="flex items-center gap-2">
              {currentProvider.logo && (
                <img
                  src={currentProvider.logo}
                  alt={currentProvider.name}
                  className="w-4 h-4 rounded"
                />
              )}
              <span>{currentProvider.name}</span>
              {currentProvider.adapterType && (
                <span className="text-xs text-muted-foreground">
                  ({currentProvider.adapterType})
                </span>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {providers.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            暂无可用供应商
            <div className="text-xs mt-1">请先在供应商管理页面添加</div>
          </div>
        ) : (
          providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              <div className="flex items-center gap-2">
                {provider.logo && (
                  <img
                    src={provider.logo}
                    alt={provider.name}
                    className="w-4 h-4 rounded"
                  />
                )}
                <span>{provider.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({provider.adapterType})
                </span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
