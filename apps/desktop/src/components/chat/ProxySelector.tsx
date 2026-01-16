/**
 * Proxy and model selector component
 * Shows only logo for passthrough proxy, logo group for bridge proxy
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Zap, ArrowLeftRight } from 'lucide-react'

import { ProviderLogo } from '@/components/providers'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import { useI18n } from '@/stores/i18n-store'
import type { Provider, BridgeProxy, ProviderPreset, AdapterPreset } from '@/types'

// Unified size constants
const LOGO_SIZE = 18
const AVATAR_SIZE = 22
const BUTTON_HEIGHT = 28

interface ProxySelectorProps {
  providers: Provider[]
  providerPresets: ProviderPreset[]
  proxies: BridgeProxy[]
  selectedProxy: { type: 'provider' | 'proxy'; id: string } | null
  selectedModel: string | null
  onProxyChange: (proxy: { type: 'provider' | 'proxy'; id: string } | null) => void
  onModelChange: (model: string | null) => void
  disabled?: boolean
}

interface AvatarInfo {
  logo?: string
  color?: string
  name?: string
}

/**
 * Get logo and color for an adapter type
 */
function getAdapterLogoInfo(
  adapterType: string,
  providers: Provider[],
  providerPresets: ProviderPreset[]
): AvatarInfo {
  // First, try to find from user configured providers
  const userProvider = providers.find(p => p.adapterType === adapterType)
  if (userProvider?.logo) {
    return {
      logo: userProvider.logo,
      color: userProvider.color || '#ffffff',
      name: userProvider.name
    }
  }

  // Then, try to find from provider presets
  const preset = providerPresets.find(p => p.adapterType === adapterType)
  if (preset) {
    return {
      logo: preset.logo,
      color: preset.color || '#ffffff',
      name: preset.name
    }
  }

  return { name: adapterType }
}

/**
 * Recursively collect all avatars in the proxy chain
 */
function collectProxyChainAvatars(
  inboundAdapter: string,
  outboundType: 'provider' | 'proxy',
  outboundId: string,
  providers: Provider[],
  providerPresets: ProviderPreset[],
  adapterPresets: AdapterPreset[],
  proxies: BridgeProxy[],
  visited: Set<string> = new Set()
): AvatarInfo[] {
  const avatars: AvatarInfo[] = []

  // Add inbound adapter avatar
  const adapterInfo = adapterPresets.find(a => a.id === inboundAdapter)
  const inboundInfo = getAdapterLogoInfo(adapterInfo?.provider || inboundAdapter, providers, providerPresets)
  avatars.push(inboundInfo)

  // Add outbound avatar(s)
  if (outboundType === 'provider') {
    const provider = providers.find(p => p.id === outboundId)
    if (provider) {
      avatars.push({
        logo: provider.logo,
        color: provider.color || '#ffffff',
        name: provider.name
      })
    } else {
      const preset = providerPresets.find(p => p.id === outboundId)
      if (preset) {
        avatars.push({ logo: preset.logo, color: preset.color, name: preset.name })
      }
    }
  } else {
    // Chain proxy - recursively get chain avatars
    const chainProxy = proxies.find(p => p.id === outboundId)
    if (chainProxy && !visited.has(chainProxy.id)) {
      visited.add(chainProxy.id)
      const chainAvatars = collectProxyChainAvatars(
        chainProxy.inboundAdapter,
        chainProxy.outboundType,
        chainProxy.outboundId,
        providers,
        providerPresets,
        adapterPresets,
        proxies,
        visited
      )
      avatars.push(...chainAvatars)
    }
  }

  return avatars
}

/**
 * Avatar group component for bridge proxy
 */
function ProxyAvatarGroup({
  avatars
}: {
  avatars: AvatarInfo[]
}) {
  // Limit display to max 3 avatars
  const displayAvatars = avatars.slice(0, 3)
  const totalCount = avatars.length

  const first = displayAvatars[0] || { name: '?' }
  const second = displayAvatars[1] || { name: '?' }
  const third = displayAvatars[2] || { name: '?' }

  const renderAvatar = (avatar: AvatarInfo, style: React.CSSProperties) => (
    <div
      className="absolute rounded-md flex items-center justify-center overflow-hidden border-2 border-background shadow-sm"
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        backgroundColor: avatar.color || '#f4f4f5',
        ...style
      }}
    >
      {avatar.logo ? (
        <ProviderLogo
          logo={avatar.logo}
          name={avatar.name}
          color="transparent"
          size={LOGO_SIZE}
        />
      ) : (
        <span className="text-[8px] font-semibold text-zinc-600">
          {(avatar.name || '?').charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )

  // Single avatar - centered
  if (displayAvatars.length === 1) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        {renderAvatar(first, { position: 'relative' })}
      </div>
    )
  }

  // Two avatars - overlapping
  if (displayAvatars.length === 2) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: AVATAR_SIZE + 12, height: AVATAR_SIZE }}
      >
        {renderAvatar(first, { transform: 'rotate(-8deg)', left: 0, zIndex: 2 })}
        {renderAvatar(second, { transform: 'rotate(8deg)', right: 0, zIndex: 1 })}
      </div>
    )
  }

  // Three+ avatars
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: AVATAR_SIZE + 20, height: AVATAR_SIZE }}
    >
      {renderAvatar(first, { transform: 'rotate(-10deg)', left: 0, zIndex: 3 })}
      {renderAvatar(second, { left: '50%', transform: 'translateX(-50%)', zIndex: 2 })}
      <div
        className="absolute rounded-md flex items-center justify-center overflow-hidden border-2 border-background shadow-sm"
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          backgroundColor: totalCount > 3 ? '#e4e4e7' : (third.color || '#f4f4f5'),
          transform: 'rotate(10deg)',
          right: 0,
          zIndex: 1
        }}
      >
        {totalCount > 3 ? (
          <span className="text-[8px] font-semibold text-muted-foreground">
            +{totalCount - 2}
          </span>
        ) : third.logo ? (
          <ProviderLogo
            logo={third.logo}
            name={third.name}
            color="transparent"
            size={LOGO_SIZE}
          />
        ) : (
          <span className="text-[8px] font-semibold text-zinc-600">
            {(third.name || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

export function ProxySelector({
  providers,
  providerPresets,
  proxies,
  selectedProxy,
  selectedModel,
  onProxyChange,
  onModelChange,
  disabled = false
}: ProxySelectorProps) {
  const { t } = useI18n()
  const [proxyOpen, setProxyOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [adapterPresets, setAdapterPresets] = useState<AdapterPreset[]>([])
  const proxyRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  // Load adapter presets
  useEffect(() => {
    ipc.invoke('presets:get-adapters').then(setAdapterPresets)
  }, [])

  // Filter available providers (enabled + passthrough enabled)
  const availableProviders = useMemo(() => {
    return providers.filter(p => p.enabled && p.enableAsProxy && p.apiKey)
  }, [providers])

  // Filter available proxies (enabled)
  const availableProxies = useMemo(() => {
    return proxies.filter(p => p.enabled)
  }, [proxies])

  // Get available models based on selected proxy
  const availableModels = useMemo(() => {
    if (!selectedProxy) return []

    if (selectedProxy.type === 'provider') {
      const provider = providers.find(p => p.id === selectedProxy.id)
      return provider?.models || []
    } else {
      // For bridge proxy, get models from the target provider
      const proxy = proxies.find(p => p.id === selectedProxy.id)
      if (proxy?.outboundType === 'provider') {
        const provider = providers.find(p => p.id === proxy.outboundId)
        return provider?.models || []
      }
    }
    return []
  }, [selectedProxy, providers, proxies])

  // Get selected proxy display info
  const selectedProxyInfo = useMemo(() => {
    if (!selectedProxy) return null

    if (selectedProxy.type === 'provider') {
      const provider = providers.find(p => p.id === selectedProxy.id)
      if (!provider) return null

      // Get logo from provider or preset
      let logo = provider.logo
      let color = provider.color
      if (!logo) {
        const preset = providerPresets.find(p => p.adapterType === provider.adapterType)
        logo = preset?.logo
        color = preset?.color
      }

      return {
        name: provider.name,
        logo,
        color,
        type: 'provider' as const
      }
    } else {
      const proxy = proxies.find(p => p.id === selectedProxy.id)
      if (!proxy) return null

      // Collect avatars for bridge proxy
      const avatars = collectProxyChainAvatars(
        proxy.inboundAdapter,
        proxy.outboundType,
        proxy.outboundId,
        providers,
        providerPresets,
        adapterPresets,
        proxies
      )

      return {
        name: proxy.name || proxy.proxyPath,
        avatars,
        type: 'proxy' as const
      }
    }
  }, [selectedProxy, providers, providerPresets, proxies, adapterPresets])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (proxyRef.current && !proxyRef.current.contains(event.target as Node)) {
        setProxyOpen(false)
      }
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setModelOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-select first model when proxy changes
  useEffect(() => {
    if (selectedProxy && availableModels.length > 0 && !selectedModel) {
      const firstModel = availableModels[0]
      if (firstModel) {
        onModelChange(firstModel)
      }
    }
  }, [selectedProxy, availableModels, selectedModel, onModelChange])

  const handleProxySelect = (type: 'provider' | 'proxy', id: string) => {
    onProxyChange({ type, id })
    onModelChange(null) // Reset model when proxy changes
    setProxyOpen(false)
  }

  const handleModelSelect = (model: string) => {
    onModelChange(model)
    setModelOpen(false)
  }

  const hasOptions = availableProviders.length > 0 || availableProxies.length > 0

  return (
    <div className="flex items-center">
      {/* Proxy Selector - Logo only */}
      <div className="relative" ref={proxyRef}>
        <button
          onClick={() => !disabled && setProxyOpen(!proxyOpen)}
          disabled={disabled || !hasOptions}
          className={cn(
            'flex items-center justify-center rounded-md transition-all',
            'hover:bg-muted/50 px-1',
            disabled && 'opacity-50 cursor-not-allowed',
            !hasOptions && 'opacity-50'
          )}
          style={{ height: BUTTON_HEIGHT }}
        >
          {selectedProxyInfo ? (
            selectedProxyInfo.type === 'provider' ? (
              // Single provider logo
              <div
                className="rounded-md overflow-hidden flex items-center justify-center border-2 border-background shadow-sm"
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  backgroundColor: selectedProxyInfo.color || '#f4f4f5'
                }}
              >
                {selectedProxyInfo.logo ? (
                  <ProviderLogo
                    logo={selectedProxyInfo.logo}
                    name={selectedProxyInfo.name}
                    color="transparent"
                    size={LOGO_SIZE}
                  />
                ) : (
                  <Zap className="h-3 w-3 text-cyan-500" />
                )}
              </div>
            ) : (
              // Bridge proxy avatar group
              <ProxyAvatarGroup avatars={selectedProxyInfo.avatars || []} />
            )
          ) : (
            // No selection - show placeholder
            <div
              className="rounded-md bg-muted flex items-center justify-center border-2 border-background shadow-sm"
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
            >
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </button>

        {proxyOpen && (
          <div className={cn(
            'absolute left-0 bottom-full mb-2 z-50',
            'w-56 max-h-64 overflow-y-auto',
            'bg-popover border border-border rounded-lg shadow-lg',
            'animate-in fade-in-0 zoom-in-95'
          )}>
            {/* Passthrough Providers */}
            {availableProviders.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50">
                  {t('chat.passthroughProxy')}
                </div>
                {availableProviders.map((provider) => {
                  const preset = providerPresets.find(p => p.adapterType === provider.adapterType)
                  const logo = provider.logo || preset?.logo
                  const color = provider.color || preset?.color

                  return (
                    <div
                      key={provider.id}
                      onClick={() => handleProxySelect('provider', provider.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 cursor-pointer',
                        'hover:bg-muted/50 transition-colors',
                        selectedProxy?.type === 'provider' && selectedProxy.id === provider.id && 'bg-muted'
                      )}
                    >
                      <div
                        className="rounded-md overflow-hidden flex items-center justify-center shrink-0"
                        style={{ width: 20, height: 20, backgroundColor: color || '#f4f4f5' }}
                      >
                        {logo ? (
                          <ProviderLogo
                            logo={logo}
                            name={provider.name}
                            color="transparent"
                            size={14}
                          />
                        ) : (
                          <Zap className="h-3 w-3 text-cyan-500" />
                        )}
                      </div>
                      <span className="flex-1 text-sm truncate">{provider.name}</span>
                      {selectedProxy?.type === 'provider' && selectedProxy.id === provider.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* Bridge Proxies */}
            {availableProxies.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50">
                  {t('chat.bridgeProxy')}
                </div>
                {availableProxies.map((proxy) => {
                  const avatars = collectProxyChainAvatars(
                    proxy.inboundAdapter,
                    proxy.outboundType,
                    proxy.outboundId,
                    providers,
                    providerPresets,
                    adapterPresets,
                    proxies
                  )

                  return (
                    <div
                      key={proxy.id}
                      onClick={() => handleProxySelect('proxy', proxy.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 cursor-pointer',
                        'hover:bg-muted/50 transition-colors',
                        selectedProxy?.type === 'proxy' && selectedProxy.id === proxy.id && 'bg-muted'
                      )}
                    >
                      <div className="shrink-0">
                        <ProxyAvatarGroup avatars={avatars} />
                      </div>
                      <span className="flex-1 text-sm truncate">{proxy.name || proxy.proxyPath}</span>
                      {selectedProxy?.type === 'proxy' && selectedProxy.id === proxy.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Model Selector */}
      <div className="relative" ref={modelRef}>
        <button
          onClick={() => !disabled && selectedProxy && setModelOpen(!modelOpen)}
          disabled={disabled || !selectedProxy || availableModels.length === 0}
          className={cn(
            'flex items-center gap-1 px-1.5 rounded-md text-xs',
            'hover:bg-muted/50 transition-colors',
            'text-muted-foreground',
            (disabled || !selectedProxy || availableModels.length === 0) && 'opacity-50 cursor-not-allowed'
          )}
          style={{ height: BUTTON_HEIGHT }}
        >
          <span className="truncate max-w-[120px] font-mono">
            {selectedModel || t('chat.selectModel')}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>

        {modelOpen && availableModels.length > 0 && (
          <div className={cn(
            'absolute left-0 bottom-full mb-2 z-50',
            'w-56 max-h-64 overflow-y-auto',
            'bg-popover border border-border rounded-lg shadow-lg',
            'animate-in fade-in-0 zoom-in-95'
          )}>
            {availableModels.map((model) => (
              <div
                key={model}
                onClick={() => handleModelSelect(model)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 cursor-pointer',
                  'hover:bg-muted/50 transition-colors',
                  selectedModel === model && 'bg-muted'
                )}
              >
                <span className="flex-1 text-sm truncate font-mono">{model}</span>
                {selectedModel === model && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
