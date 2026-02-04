/**
 * Code Switch Proxy List Component
 * Displays read-only CLI proxy configurations in compact format
 */

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ExternalLink, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/stores/i18n-store'
import { ProviderLogo } from '@/components/providers/ProviderLogo'
import { useCopyToClipboard } from '@/hooks'
import { COPY_FEEDBACK_DURATION } from '@/lib/constants'
import type { CodeSwitchConfig, Provider, ProviderPreset } from '@/types'

export function CodeSwitchProxyList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<CodeSwitchConfig[]>([])
  const [providers, setProviders] = useState<Map<string, Provider>>(new Map())
  const [providerPresets, setProviderPresets] = useState<ProviderPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const { copy: copyUrl } = useCopyToClipboard({ duration: COPY_FEEDBACK_DURATION })

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      
      // Load configs, providers, and presets
      const [claudeCode, codex, allProviders, presets] = await Promise.all([
        window.api.invoke('code-switch:get-config', 'claudecode') as Promise<CodeSwitchConfig | null>,
        window.api.invoke('code-switch:get-config', 'codex') as Promise<CodeSwitchConfig | null>,
        window.api.invoke('provider:list') as Promise<Provider[]>,
        window.api.invoke('presets:get-providers') as Promise<ProviderPreset[]>
      ])

      const enabledConfigs = [claudeCode, codex].filter((c): c is CodeSwitchConfig => c !== null && c.enabled)
      setConfigs(enabledConfigs)

      // Create provider map
      const providerMap = new Map<string, Provider>()
      allProviders.forEach((p) => providerMap.set(p.id, p))
      setProviders(providerMap)
      setProviderPresets(presets)
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

  const handleCopyUrl = (cliType: string) => {
    copyUrl(getProxyUrl(cliType))
    setCopiedUrl(cliType)
    setTimeout(() => setCopiedUrl(null), COPY_FEEDBACK_DURATION)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <p className="mb-2">{t('codeSwitch.noCliProxies')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => navigate('/code-switch')}
        >
          <ExternalLink className="h-3 w-3 mr-1.5" />
          {t('codeSwitch.goToConfig')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {configs.map((config) => {
        const provider = providers.get(config.providerId)
        const providerPreset = provider ? providerPresets.find(p => p.adapterType === provider.adapterType) : null
        
        return (
          <div
            key={config.id}
            className="group/item p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2.5 mb-2">
              {/* Provider Logo */}
              {providerPreset?.logo && (
                <div className="w-6 h-6 shrink-0 rounded-md overflow-hidden ring-1 ring-border/50">
                  <ProviderLogo
                    logo={providerPreset.logo}
                    name={provider?.name || ''}
                    size={24}
                  />
                </div>
              )}
              
              {/* CLI Name & Provider */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{getCliDisplayName(config.cliType)}</span>
                  <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                    {t('codeSwitch.enabled')}
                  </Badge>
                </div>
                {provider && (
                  <div className="text-[10px] text-muted-foreground">
                    {provider.name} · {provider.adapterType}
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-70 group-hover/item:opacity-100 hover:bg-muted"
                        onClick={() => handleCopyUrl(config.cliType)}
                      >
                        {copiedUrl === config.cliType ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {copiedUrl === config.cliType ? t('common.copied') : t('common.copy')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-70 group-hover/item:opacity-100 hover:bg-muted"
                        onClick={() => navigate('/code-switch')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {t('codeSwitch.manageConfig')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            {/* Proxy URL */}
            <code className="block text-[10px] font-mono text-muted-foreground truncate bg-muted/70 px-2 py-1.5 rounded border border-border/50">
              /code/{config.cliType}
            </code>
          </div>
        )
      })}
    </div>
  )
}
