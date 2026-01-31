/**
 * Code Switch Proxy List Component
 * Displays read-only CLI proxy configurations
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/stores/i18n-store'
import type { CodeSwitchConfig, Provider } from '@/types'

export function CodeSwitchProxyList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<CodeSwitchConfig[]>([])
  const [providers, setProviders] = useState<Map<string, Provider>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      
      // Load both Claude Code and Codex configs
      const [claudeCode, codex, allProviders] = await Promise.all([
        window.api.invoke('code-switch:get-config', 'claudecode') as Promise<CodeSwitchConfig | null>,
        window.api.invoke('code-switch:get-config', 'codex') as Promise<CodeSwitchConfig | null>,
        window.api.invoke('provider:list') as Promise<Provider[]>
      ])

      const enabledConfigs = [claudeCode, codex].filter((c): c is CodeSwitchConfig => c !== null && c.enabled)
      setConfigs(enabledConfigs)

      // Create provider map
      const providerMap = new Map<string, Provider>()
      allProviders.forEach((p) => providerMap.set(p.id, p))
      setProviders(providerMap)
    } catch (error) {
      console.error('Failed to load Code Switch configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCliDisplayName = (cliType: string) => {
    return cliType === 'claudecode' ? 'Claude Code' : 'Codex'
  }

  const getProxyUrl = (cliType: string) => {
    return `http://127.0.0.1:9527/code/${cliType}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-4">{t('codeSwitch.noCliProxies')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/code-switch')}
            >
              {t('codeSwitch.goToConfig')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {configs.map((config) => {
        const provider = providers.get(config.providerId)
        
        return (
          <Card key={config.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {getCliDisplayName(config.cliType)}
                </CardTitle>
                <Badge variant="default">{t('codeSwitch.enabled')}</Badge>
              </div>
              <CardDescription className="text-xs font-mono">
                {getProxyUrl(config.cliType)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Provider Info */}
              {provider && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('codeSwitch.currentProvider')}
                  </p>
                  <div className="flex items-center gap-2">
                    {provider.logo && (
                      <img
                        src={provider.logo}
                        alt={provider.name}
                        className="h-4 w-4 rounded"
                      />
                    )}
                    <span className="text-sm font-medium">{provider.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({provider.adapterType})
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate('/code-switch')}
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                {t('codeSwitch.manageConfig')}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
