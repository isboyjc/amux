/**
 * Provider Selector Component
 * Allows users to select an enabled provider
 */

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Provider } from '@/types'
import { useI18n } from '@/stores/i18n-store'

interface ProviderSelectorProps {
  value: string
  onChange: (providerId: string) => void
  disabled?: boolean
}

export function ProviderSelector({ value, onChange, disabled }: ProviderSelectorProps) {
  const { t } = useI18n()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const allProviders = await window.api.invoke('provider:list')
      // Only show enabled providers
      const enabledProviders = allProviders.filter(p => p.enabled)
      setProviders(enabledProviders)
    } catch (error) {
      console.error('Failed to load providers:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-md border">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">{t('codeSwitch.loading')}</span>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 rounded-md border">
        {t('codeSwitch.noProviders')}
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={t('codeSwitch.selectProvider')} />
      </SelectTrigger>
      <SelectContent>
        {providers.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            <div className="flex items-center gap-2">
              {provider.logo && (
                <img
                  src={provider.logo}
                  alt={provider.name}
                  className="h-4 w-4 rounded"
                />
              )}
              <span>{provider.name}</span>
              <span className="text-xs text-muted-foreground">
                ({provider.adapterType})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
