import {
  Plus,
  Search,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Zap,
  Copy,
  CheckCircle2
} from 'lucide-react'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { 
  CopyIcon, 
  RocketIcon, 
  TrashIcon, 
  CheckIcon, 
  GearIcon, 
  TerminalIcon
} from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { ProviderLogo } from '@/components/providers/ProviderLogo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks'
import { COPY_FEEDBACK_DURATION } from '@/lib/constants'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { useBridgeProxyStore, useProviderStore, useI18n } from '@/stores'
import type { BridgeProxy, Provider, AdapterType, AdapterPreset, ProviderPreset, CodeSwitchConfig } from '@/types'
import type { CreateProxyDTO } from '@/types/ipc'

// ==================== Helper Functions ====================

/**
 * Get endpoint for adapter type
 * @param adapterType - The adapter type (e.g., 'openai', 'anthropic', 'google')
 * @param providerPresets - Provider presets to look up chatPath
 * @returns The endpoint path (with {model} placeholder preserved for display)
 */
function getEndpointForAdapterType(
  adapterType: string,
  providerPresets: ProviderPreset[]
): string {
  // Find preset by adapter type
  const preset = providerPresets.find(p => p.adapterType === adapterType)
  return preset?.chatPath || '/v1/chat/completions'
}

/**
 * Get logo and color for an adapter type
 * Priority: provider presets > user configured providers
 * (Changed to fix issue with multiple providers of same type having different logos)
 */
function getAdapterLogoInfo(
  adapterType: string,
  providers: Provider[],
  providerPresets: ProviderPreset[]
): { logo?: string; color?: string; name?: string } {
  // First, try to find from provider presets (official logos)
  const preset = providerPresets.find(p => p.adapterType === adapterType)
  if (preset) {
    return {
      logo: preset.logo,
      color: preset.color || '#ffffff',
      name: preset.name
    }
  }
  
  // Then, try to find from user configured providers (custom providers)
  const userProvider = providers.find(p => p.adapterType === adapterType)
  if (userProvider?.logo) {
    return {
      logo: userProvider.logo,
      color: userProvider.color || '#ffffff',
      name: userProvider.name
    }
  }
  
  return { name: adapterType }
}

// ==================== Avatar Group Component ====================

interface AvatarInfo {
  logo?: string
  color?: string
  name?: string
}

interface ProxyAvatarGroupProps {
  inboundAdapter: string
  outboundType: 'provider' | 'proxy'
  outboundId: string
  providers: Provider[]
  providerPresets: ProviderPreset[]
  adapterPresets: AdapterPreset[]
  proxies: BridgeProxy[]
  size?: 'sm' | 'md' | 'lg'
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

function ProxyAvatarGroup({
  inboundAdapter,
  outboundType,
  outboundId,
  providers,
  providerPresets,
  adapterPresets,
  proxies,
  size = 'md'
}: ProxyAvatarGroupProps) {
  // Size config: larger avatars, fixed container width
  const sizeMap = {
    sm: { avatar: 24, containerWidth: 52, fontSize: 'text-[9px]' },
    md: { avatar: 30, containerWidth: 64, fontSize: 'text-[10px]' },
    lg: { avatar: 36, containerWidth: 76, fontSize: 'text-xs' }
  }
  const s = sizeMap[size]

  // Collect all avatars in the chain
  const avatars = useMemo(() => {
    return collectProxyChainAvatars(
      inboundAdapter,
      outboundType,
      outboundId,
      providers,
      providerPresets,
      adapterPresets,
      proxies
    )
  }, [inboundAdapter, outboundType, outboundId, providers, providerPresets, adapterPresets, proxies])

  // Limit display to max 3 avatars (for infinite chain proxy)
  const displayAvatars = avatars.slice(0, 3)
  const totalCount = avatars.length
  
  // Extract avatars with fallback to avoid undefined errors
  const first = displayAvatars[0] || { name: '?' }
  const second = displayAvatars[1] || { name: '?' }
  const third = displayAvatars[2] || { name: '?' }

  // Render single avatar item
  const renderAvatar = (avatar: AvatarInfo, style: React.CSSProperties) => (
    <div
      className="absolute rounded-md flex items-center justify-center overflow-hidden border-2 border-background shadow-sm"
      style={{
        width: s.avatar,
        height: s.avatar,
        backgroundColor: avatar.color || '#f4f4f5',
        ...style
      }}
    >
      {avatar.logo ? (
        <ProviderLogo
          logo={avatar.logo}
          name={avatar.name}
          color="transparent"
          size={s.avatar - 6}
        />
      ) : (
        <span className={cn(s.fontSize, "font-semibold text-zinc-600")}>
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
        style={{ width: s.containerWidth, height: s.avatar }}
      >
        {renderAvatar(first, { position: 'relative' })}
      </div>
    )
  }

  // Two avatars - left rotated, right rotated
  if (displayAvatars.length === 2) {
    return (
      <div 
        className="relative flex items-center justify-center"
        style={{ width: s.containerWidth, height: s.avatar + 8 }}
      >
        {renderAvatar(first, { transform: 'rotate(-8deg)', left: 4, zIndex: 2 })}
        {renderAvatar(second, { transform: 'rotate(8deg)', right: 4, zIndex: 1 })}
      </div>
    )
  }

  // Three+ avatars - left rotated, center straight, right rotated (or +N badge)
  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: s.containerWidth, height: s.avatar + 8 }}
    >
      {renderAvatar(first, { transform: 'rotate(-10deg)', left: 0, zIndex: 3 })}
      {renderAvatar(second, { left: '50%', transform: 'translateX(-50%)', zIndex: 2 })}
      {/* Third avatar or +N badge */}
      <div
        className="absolute rounded-md flex items-center justify-center overflow-hidden border-2 border-background shadow-sm"
        style={{
          width: s.avatar,
          height: s.avatar,
          backgroundColor: totalCount > 3 ? '#e4e4e7' : (third.color || '#f4f4f5'),
          transform: 'rotate(10deg)',
          right: 0,
          zIndex: 1
        }}
      >
        {totalCount > 3 ? (
          <span className={cn(s.fontSize, "font-semibold text-muted-foreground")}>
            +{totalCount - 2}
          </span>
        ) : third.logo ? (
          <ProviderLogo
            logo={third.logo}
            name={third.name}
            color="transparent"
            size={s.avatar - 6}
          />
        ) : (
          <span className={cn(s.fontSize, "font-semibold text-zinc-600")}>
            {(third.name || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

// Styled select component with proper padding for arrow
const StyledSelect = ({ 
  value, 
  onChange, 
  children, 
  className = '' 
}: { 
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  className?: string
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 py-1 text-sm shadow-sm",
      "focus:outline-none focus:ring-1 focus:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "appearance-none bg-no-repeat",
      "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
      "bg-[length:16px_16px] bg-[position:right_8px_center]",
      className
    )}
  >
    {children}
  </select>
)

export function Proxies() {
  const { proxies, loading, fetch, create, update, remove, toggle } = useBridgeProxyStore()
  const { providers, fetch: fetchProviders, fetchPresets, presets: providerPresets } = useProviderStore()
  const { t } = useI18n()
  const location = useLocation()
  const [selectedProxyId, setSelectedProxyId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [adapterPresets, setAdapterPresets] = useState<AdapterPreset[]>([])

  useEffect(() => {
    fetch()
    fetchProviders()
    fetchPresets()
    // Load adapter presets
    ipc.invoke('presets:get-adapters').then(setAdapterPresets)
  }, [fetch, fetchProviders, fetchPresets])

  // Auto-select from location state or first proxy
  useEffect(() => {
    // Check if there's a selectedProxyId passed from navigation
    const state = location.state as { selectedProxyId?: string } | null
    const stateProxyId = state?.selectedProxyId
    if (stateProxyId && proxies.find(p => p.id === stateProxyId)) {
      setSelectedProxyId(stateProxyId)
    } else if (proxies.length > 0 && !selectedProxyId) {
      setSelectedProxyId(proxies[0]?.id ?? null)
    }
  }, [proxies, selectedProxyId, location.state])

  const selectedProxy = useMemo(() => {
    return proxies.find(p => p.id === selectedProxyId) || null
  }, [proxies, selectedProxyId])

  const handleAddProxy = async (data: CreateProxyDTO) => {
    await create(data)
    setShowAddModal(false)
    toast.success(t('common.saved'))
  }

  const handleDeleteProxy = async (id: string) => {
    if (confirm(t('proxies.deleteConfirm'))) {
      await remove(id)
      if (selectedProxyId === id) {
        setSelectedProxyId(proxies.find(p => p.id !== id)?.id || null)
      }
      toast.success(t('common.deleted') || 'Deleted')
    }
  }

  const handleSaveProxy = async (data: Partial<CreateProxyDTO>) => {
    if (!selectedProxyId) return
    await update(selectedProxyId, data)
    toast.success(t('common.saved'))
  }

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">
      {/* Main Proxy Management Section */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left Panel - Proxy List */}
        <div className="content-card w-72 shrink-0 flex flex-col overflow-hidden">
        <ProxyListPanel
          proxies={proxies}
          providers={providers}
          providerPresets={providerPresets}
          adapterPresets={adapterPresets}
          selectedId={selectedProxyId}
          onSelect={setSelectedProxyId}
          onAdd={() => setShowAddModal(true)}
          onDelete={handleDeleteProxy}
          loading={loading}
          t={t}
        />
      </div>

      {/* Right Panel - Proxy Configuration */}
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        <ProxyConfigPanel
          proxy={selectedProxy}
          providers={providers}
          providerPresets={providerPresets}
          proxies={proxies}
          adapterPresets={adapterPresets}
          onSave={handleSaveProxy}
          onToggle={(enabled) => selectedProxyId && toggle(selectedProxyId, enabled)}
          t={t}
        />
      </div>

      {/* Add Proxy Modal */}
      <AddProxyModal
        open={showAddModal}
        providers={providers}
        providerPresets={providerPresets}
        proxies={proxies}
        adapterPresets={adapterPresets}
        onSave={handleAddProxy}
        onClose={() => setShowAddModal(false)}
        t={t}
      />
      </div>
    </div>
  )
}

// ==================== Proxy List Panel ====================

interface ProxyListPanelProps {
  proxies: BridgeProxy[]
  providers: Provider[]
  providerPresets: ProviderPreset[]
  adapterPresets: AdapterPreset[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  loading: boolean
  t: (key: string) => string
}

function ProxyListPanel({
  proxies,
  providers,
  providerPresets,
  adapterPresets,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  loading,
  t
}: ProxyListPanelProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showPassthrough, setShowPassthrough] = useState(false)
  const [showCodeSwitch, setShowCodeSwitch] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const { copy: copyUrl } = useCopyToClipboard({ duration: COPY_FEEDBACK_DURATION })
  
  // CS Proxies state
  const [csConfigs, setCsConfigs] = useState<CodeSwitchConfig[]>([])
  const [csProviders, setCsProviders] = useState<Map<string, Provider>>(new Map())

  const filteredProxies = proxies.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.proxyPath.toLowerCase().includes(search.toLowerCase())
  )

  const enabledCount = proxies.filter(p => p.enabled).length
  
  // Get passthrough providers
  const passthroughProviders = useMemo(() => {
    return providers.filter(p => p.enabled && p.enableAsProxy && p.proxyPath)
  }, [providers])
  
  // Load Code Switch configs
  useEffect(() => {
    loadCsConfigs()
  }, [])
  
  const loadCsConfigs = async () => {
    try {
      const [claudeCode, codex] = await Promise.all([
        window.api.invoke('code-switch:get-config', 'claudecode') as Promise<CodeSwitchConfig | null>,
        window.api.invoke('code-switch:get-config', 'codex') as Promise<CodeSwitchConfig | null>
      ])

      const enabledConfigs = [claudeCode, codex].filter((c): c is CodeSwitchConfig => c !== null && c.enabled)
      setCsConfigs(enabledConfigs)

      // Create provider map
      const providerMap = new Map<string, Provider>()
      providers.forEach((p) => providerMap.set(p.id, p))
      setCsProviders(providerMap)
    } catch (error) {
      console.error('Failed to load CS configs:', error)
    }
  }

  const getProviderName = (id: string) => {
    const provider = providers.find(p => p.id === id)
    return provider?.name || id
  }

  const getProxyName = (id: string) => {
    const proxy = proxies.find(p => p.id === id)
    return proxy?.name || proxy?.proxyPath || id
  }
  
  const handleCopyPassthroughUrl = (provider: Provider) => {
    const url = `http://127.0.0.1:9527/providers/${provider.proxyPath}`
    copyUrl(url)
    setCopiedUrl(provider.id)
    setTimeout(() => setCopiedUrl(null), COPY_FEEDBACK_DURATION)
  }

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">{t('proxies.title')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('proxies.total')}: {proxies.length} · {t('proxies.active')}: {enabledCount}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAdd}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('proxies.add')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('proxies.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Unified Scrollable Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Code Switch Proxies Section */}
        {csConfigs.length > 0 && (
          <div className="border-b">
            <button
              onClick={() => setShowCodeSwitch(!showCodeSwitch)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <TerminalIcon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold">
                  {t('proxies.cliProxies')}
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
                  {csConfigs.length}
                </Badge>
              </div>
              {showCodeSwitch ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>
            
            {showCodeSwitch && (
              <div className="px-3 pb-3 pt-1 space-y-2 animate-in slide-in-from-top-1 duration-200">
                {csConfigs.map((config) => {
                  const provider = csProviders.get(config.providerId)
                  const providerPreset = provider ? providerPresets.find(p => p.adapterType === provider.adapterType) : null
                  const cliName = config.cliType === 'claudecode' ? 'Claude Code' : 'Codex'
                  const proxyUrl = `http://127.0.0.1:9527/code/${config.cliType}`
                  
                  return (
                    <div
                      key={config.id}
                      className="group/item p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        {providerPreset?.logo && (
                          <div className="w-6 h-6 shrink-0 rounded-md overflow-hidden ring-1 ring-border/50">
                            <ProviderLogo
                              logo={providerPreset.logo}
                              name={provider?.name || ''}
                              size={24}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {cliName}
                          </div>
                          {provider && (
                            <div className="text-[10px] text-muted-foreground">
                              {provider.name} · {provider.adapterType}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 opacity-70 group-hover/item:opacity-100 hover:bg-muted"
                                  onClick={() => {
                                    copyUrl(proxyUrl)
                                    setCopiedUrl(config.cliType)
                                    setTimeout(() => setCopiedUrl(null), COPY_FEEDBACK_DURATION)
                                  }}
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
                        </div>
                      </div>
                      <code className="block text-[10px] font-mono text-muted-foreground truncate bg-muted/70 px-2 py-1.5 rounded border border-border/50">
                        /code/{config.cliType}
                      </code>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Passthrough Providers Section */}
        {passthroughProviders.length > 0 && (
          <div className="border-b">
            <button
              onClick={() => setShowPassthrough(!showPassthrough)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold">
                  {t('proxies.passthroughProviders')}
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
                  {passthroughProviders.length}
                </Badge>
              </div>
              {showPassthrough ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>
            
            {showPassthrough && (
              <div className="px-3 pb-3 pt-1 space-y-2 animate-in slide-in-from-top-1 duration-200">
                {passthroughProviders.map((provider) => {
                  const providerPreset = providerPresets.find(p => p.adapterType === provider.adapterType)
                  // 使用 Provider 自己的 chatPath，如果没有则从预设获取
                  const endpoint = provider.chatPath || getEndpointForAdapterType(provider.adapterType, providerPresets)
                  
                  return (
                    <div
                      key={provider.id}
                      className="group/item p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        {providerPreset?.logo && (
                          <div className="w-6 h-6 shrink-0 rounded-md overflow-hidden ring-1 ring-border/50">
                            <ProviderLogo
                              logo={providerPreset.logo}
                              name={provider.name}
                              size={24}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {provider.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {provider.adapterType}
                          </div>
                        </div>
                        <TooltipProvider>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 opacity-70 group-hover/item:opacity-100 hover:bg-muted"
                                onClick={() => handleCopyPassthroughUrl(provider)}
                              >
                                {copiedUrl === provider.id ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {copiedUrl === provider.id ? t('common.copied') : t('common.copy')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <code className="block text-[10px] font-mono text-muted-foreground truncate bg-muted/70 px-2 py-1.5 rounded border border-border/50">
                        <span className="text-foreground font-semibold">/providers/{provider.proxyPath}</span>
                        <span className="opacity-60">{endpoint}</span>
                      </code>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Conversion Proxies List */}
        <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProxies.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
              <RocketIcon size={18} className="text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {search ? t('common.noData') : t('proxies.noProxies')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredProxies.map((proxy) => (
              <ProxyListItem
                key={proxy.id}
                proxy={proxy}
                proxies={proxies}
                providers={providers}
                providerPresets={providerPresets}
                adapterPresets={adapterPresets}
                isSelected={selectedId === proxy.id}
                onSelect={() => onSelect(proxy.id)}
                onDelete={() => onDelete(proxy.id)}
                getProviderName={getProviderName}
                getProxyName={getProxyName}
              />
            ))}
          </div>
        )}
        </div>
      </div>
    </>
  )
}

// ==================== Proxy List Item ====================

interface ProxyListItemProps {
  proxy: BridgeProxy
  proxies: BridgeProxy[]
  providers: Provider[]
  providerPresets: ProviderPreset[]
  adapterPresets: AdapterPreset[]
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  getProviderName: (id: string) => string
  getProxyName: (id: string) => string
}

function ProxyListItem({
  proxy,
  proxies,
  providers,
  providerPresets,
  adapterPresets,
  isSelected,
  onSelect,
  onDelete,
  getProviderName,
  getProxyName,
}: ProxyListItemProps) {
  const adapterInfo = adapterPresets.find(a => a.id === proxy.inboundAdapter)
  const trashRef = useRef<AnimatedIconHandle>(null)

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
        isSelected ? 'bg-muted/80' : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      {/* Avatar Group: Inbound (top) → Outbound (bottom) */}
      <ProxyAvatarGroup
        inboundAdapter={proxy.inboundAdapter}
        outboundType={proxy.outboundType}
        outboundId={proxy.outboundId}
        providers={providers}
        providerPresets={providerPresets}
        adapterPresets={adapterPresets}
        proxies={proxies}
        size="sm"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">
            {proxy.name || `/${proxy.proxyPath}`}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
          <span>{adapterInfo?.name || proxy.inboundAdapter}</span>
          <span>→</span>
          <span className="truncate">
            {proxy.outboundType === 'provider'
              ? getProviderName(proxy.outboundId)
              : getProxyName(proxy.outboundId)
            }
          </span>
        </div>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        onMouseEnter={() => trashRef.current?.startAnimation()}
        onMouseLeave={() => trashRef.current?.stopAnimation()}
      >
        <TrashIcon ref={trashRef} size={14} dangerHover />
      </Button>
    </div>
  )
}

// ==================== Model Mapping Item ====================

interface ModelMappingItemProps {
  sourceModel: string
  targetModel: string
  onRemove: () => void
  onUpdate: (source: string, target: string) => void
  sourceModels: string[]
  targetModels: string[]
  t: (key: string) => string
  index: number
}

function ModelMappingItem({
  sourceModel,
  targetModel,
  onRemove,
  onUpdate,
  sourceModels,
  targetModels,
  t,
  index
}: ModelMappingItemProps) {
  const trashRef = useRef<AnimatedIconHandle>(null)
  const datalistId = `source-models-${index}`
  
  const selectClass = cn(
    "flex-1 h-8 rounded-md border border-input bg-background pl-2 pr-7 text-xs",
    "appearance-none bg-no-repeat",
    "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
    "bg-[length:14px_14px] bg-[position:right_6px_center]"
  )
  
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
      {/* Source model - input with datalist for combo box effect */}
      <div className="flex-1 relative">
        <input
          type="text"
          list={datalistId}
          value={sourceModel}
          onChange={(e) => onUpdate(e.target.value, targetModel)}
          placeholder={t('proxies.sourceModelPlaceholder')}
          className={cn(
            "w-full h-8 rounded-md border border-input bg-background px-2 text-xs",
            "focus:outline-none focus:ring-1 focus:ring-ring"
          )}
        />
        <datalist id={datalistId}>
          {sourceModels.map(m => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      {/* Target model - select from provider's model list */}
      <select
        value={targetModel}
        onChange={(e) => onUpdate(sourceModel, e.target.value)}
        className={selectClass}
      >
        <option value="">{t('proxies.selectTargetModel')}</option>
        {targetModels.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 hover:text-destructive"
        onClick={onRemove}
        onMouseEnter={() => trashRef.current?.startAnimation()}
        onMouseLeave={() => trashRef.current?.stopAnimation()}
      >
        <TrashIcon ref={trashRef} size={14} dangerHover />
      </Button>
    </div>
  )
}

// ==================== Proxy Config Panel ====================

interface ProxyConfigPanelProps {
  proxy: BridgeProxy | null
  providers: Provider[]
  providerPresets: ProviderPreset[]
  proxies: BridgeProxy[]
  adapterPresets: AdapterPreset[]
  onSave: (data: Partial<CreateProxyDTO>) => void
  onToggle: (enabled: boolean) => void
  t: (key: string) => string
}

function ProxyConfigPanel({
  proxy,
  providers,
  providerPresets,
  proxies,
  adapterPresets,
  onSave,
  onToggle,
  t
}: ProxyConfigPanelProps) {
  const [formData, setFormData] = useState<Partial<CreateProxyDTO>>({})
  const { copied: copiedEndpoint, copy: copyEndpointUrl } = useCopyToClipboard({ duration: COPY_FEEDBACK_DURATION })
  const [modelMappings, setModelMappings] = useState<Array<{ source: string; target: string }>>([])
  const [originalMappings, setOriginalMappings] = useState<Array<{ source: string; target: string }>>([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  
  // Icon refs
  const copyIconRef = useRef<AnimatedIconHandle>(null)
  const testIconRef = useRef<AnimatedIconHandle>(null)

  // Sync form data with selected proxy
  useEffect(() => {
    if (proxy) {
      setFormData({
        name: proxy.name || '',
        inboundAdapter: proxy.inboundAdapter,
        outboundType: proxy.outboundType,
        outboundId: proxy.outboundId,
        proxyPath: proxy.proxyPath,
        enabled: proxy.enabled
      })
      setTestResult(null)
      
      // Load model mappings from database
      ipc.invoke('proxy:get-mappings', proxy.id).then((mappings) => {
        const mapped = (mappings as Array<{ sourceModel: string; targetModel: string }>).map(m => ({
          source: m.sourceModel,
          target: m.targetModel
        }))
        setModelMappings(mapped)
        setOriginalMappings(mapped)
      })
    } else {
      setFormData({})
      setModelMappings([])
      setOriginalMappings([])
    }
  }, [proxy])

  // 获取代理的访问端点（保留 {model} 占位符用于展示）
  const getProxyEndpointPath = () => {
    const inboundAdapter = formData.inboundAdapter || (proxy?.inboundAdapter)
    if (!inboundAdapter) return '/v1/chat/completions'
    
    const adapterInfo = adapterPresets.find(a => a.id === inboundAdapter)
    const adapterType = adapterInfo?.provider || inboundAdapter
    return getEndpointForAdapterType(adapterType, providerPresets)
  }

  const handleCopyEndpoint = async () => {
    if (!proxy) return
    const endpoint = `http://127.0.0.1:9527/proxies/${proxy.proxyPath}`
    copyEndpointUrl(endpoint)
  }

  const handleSave = async () => {
    if (!proxy) return
    
    // Save model mappings to database
    const validMappings = modelMappings.filter(m => m.source && m.target)
    await ipc.invoke('proxy:set-mappings', proxy.id, validMappings.map(m => ({
      sourceModel: m.source,
      targetModel: m.target
    })))
    
    // Update original mappings after save
    setOriginalMappings([...modelMappings])
    
    // Save proxy config
    onSave(formData)
  }

  const handleTest = async () => {
    if (!proxy || !formData.outboundId) return
    setTesting(true)
    setTestResult(null)
    
    try {
      // Test connectivity through the proxy (Level 1 + Level 2)
      const result = await ipc.invoke('proxy:test', proxy.id) as { 
        success: boolean
        error?: string
        details?: string
        latency?: number
        provider?: { name: string; type: string }
      }
      
      setTestResult({ success: result.success, error: result.error })
      
      if (result.success) {
        // Success toast with detailed info
        toast.success(t('proxies.testSuccess'), { 
          description: result.details || `✅ All checks passed (${result.latency}ms)`
        })
      } else {
        // Error toast with detailed info
        const description = result.details 
          ? `${result.error || 'Test failed'}\n${result.details}`
          : result.error
        toast.error(t('proxies.testFailed'), { 
          description: description || 'Unknown error'
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setTestResult({ success: false, error: errorMsg })
      toast.error(t('proxies.testFailed'), { description: errorMsg })
    } finally {
      setTesting(false)
    }
  }

  const addModelMapping = () => {
    setModelMappings([...modelMappings, { source: '', target: '' }])
  }

  const removeModelMapping = (index: number) => {
    setModelMappings(modelMappings.filter((_, i) => i !== index))
  }

  const updateModelMapping = (index: number, source: string, target: string) => {
    const updated = [...modelMappings]
    updated[index] = { source, target }
    setModelMappings(updated)
  }

  // Check if mappings have changed
  const mappingsChanged = useMemo(() => {
    if (modelMappings.length !== originalMappings.length) return true
    return modelMappings.some((m, i) => 
      m.source !== originalMappings[i]?.source || 
      m.target !== originalMappings[i]?.target
    )
  }, [modelMappings, originalMappings])
  
  const hasChanges = proxy && (
    formData.name !== (proxy.name || '') ||
    formData.inboundAdapter !== proxy.inboundAdapter ||
    formData.outboundType !== proxy.outboundType ||
    formData.outboundId !== proxy.outboundId ||
    formData.proxyPath !== proxy.proxyPath ||
    mappingsChanged
  )

  // Filter out current proxy from chain options
  const availableProxies = proxies.filter(p => p.id !== proxy?.id)

  // Get adapter info
  const adapterInfo = adapterPresets.find(a => a.id === formData.inboundAdapter)
  
  // Get models for source (based on inbound adapter)
  // Priority: user configured provider > provider preset
  const sourceModels = useMemo(() => {
    if (!adapterInfo) return []
    const adapterType = adapterInfo.provider // e.g., 'openai', 'anthropic'
    
    // First check if user has configured a provider of this type
    const userProvider = providers.find(p => p.adapterType === adapterType)
    if (userProvider?.models?.length) {
      return userProvider.models
    }
    
    // Fall back to provider preset
    const preset = providerPresets.find(p => p.adapterType === adapterType)
    return preset?.models?.map(m => m.id) || []
  }, [adapterInfo, providers, providerPresets])
  
  // Get models for target (based on outbound provider or proxy chain)
  const targetModels = useMemo(() => {
    if (formData.outboundType === 'provider') {
      const outboundProvider = providers.find(p => p.id === formData.outboundId)
      return outboundProvider?.models || []
    } else {
      // For proxy chain, get target proxy's outbound provider models
      const targetProxy = proxies.find(p => p.id === formData.outboundId)
      if (targetProxy?.outboundType === 'provider') {
        const chainProvider = providers.find(p => p.id === targetProxy.outboundId)
        return chainProvider?.models || []
      }
      return []
    }
  }, [formData.outboundType, formData.outboundId, providers, proxies])
  
  const outboundProvider = formData.outboundType === 'provider'
    ? providers.find(p => p.id === formData.outboundId)
    : null

  if (!proxy) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <RocketIcon size={40} className="mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm">{t('proxies.noProxies')}</p>
          <p className="text-xs mt-1">{t('proxies.noProxiesDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar Group */}
          <ProxyAvatarGroup
            inboundAdapter={proxy.inboundAdapter}
            outboundType={proxy.outboundType}
            outboundId={proxy.outboundId}
            providers={providers}
            providerPresets={providerPresets}
            adapterPresets={adapterPresets}
            proxies={proxies}
            size="md"
          />
          
          <div>
            <h2 className="font-semibold">{proxy.name || `/${proxy.proxyPath}`}</h2>
            <p className="text-xs text-muted-foreground">
              {adapterInfo?.name || proxy.inboundAdapter} → {
                formData.outboundType === 'provider' 
                  ? (outboundProvider?.name || t('providers.provider'))
                  : t('proxies.typeChain')
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={proxy.enabled}
            onCheckedChange={onToggle}
          />
          <Badge variant={proxy.enabled ? 'default' : 'secondary'} className="text-xs">
            {proxy.enabled ? t('common.enabled') : t('common.disabled')}
          </Badge>
        </div>
      </div>

      {/* Config Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <GearIcon size={16} />
            {t('proxies.formDesc')}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t('proxies.name')} <span className="text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Proxy"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('proxies.proxyPath')}</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={formData.proxyPath || ''}
                  onChange={(e) => setFormData({ ...formData, proxyPath: e.target.value })}
                  placeholder="openai"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* API Endpoint */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('proxies.accessUrl')}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md text-xs font-mono truncate">
                <span className="text-foreground font-semibold">http://127.0.0.1:9527/proxies/{formData.proxyPath || 'path'}</span>
                <span className="text-muted-foreground opacity-60">{getProxyEndpointPath()}</span>
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopyEndpoint}
                onMouseEnter={() => !copiedEndpoint && copyIconRef.current?.startAnimation()}
                onMouseLeave={() => !copiedEndpoint && copyIconRef.current?.stopAnimation()}
              >
                {copiedEndpoint ? (
                  <CheckIcon size={16} success />
                ) : (
                  <CopyIcon ref={copyIconRef} size={16} />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Adapter Config */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium">{t('proxies.inboundAdapter')}</h3>
          
          <div className="space-y-1.5">
            <Label className="text-xs">{t('proxies.inboundAdapter')}</Label>
            <StyledSelect
              value={formData.inboundAdapter || 'openai'}
              onChange={(value) => setFormData({ ...formData, inboundAdapter: value as AdapterType })}
            >
              {adapterPresets.map((adapter) => (
                <option key={adapter.id} value={adapter.id}>
                  {adapter.name}
                </option>
              ))}
            </StyledSelect>
            <p className="text-xs text-muted-foreground">
              {t('proxies.inboundAdapterDesc')}
            </p>
          </div>
        </div>

        {/* Outbound Config */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium">{t('proxies.outboundType')}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('proxies.outboundType')}</Label>
              <StyledSelect
                value={formData.outboundType || 'provider'}
                onChange={(value) => setFormData({
                  ...formData,
                  outboundType: value as 'provider' | 'proxy',
                  outboundId: ''
                })}
              >
                <option value="provider">{t('proxies.typeProvider')}</option>
                <option value="proxy">{t('proxies.typeChain')}</option>
              </StyledSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('proxies.outboundId')}</Label>
              <StyledSelect
                value={formData.outboundId || ''}
                onChange={(value) => setFormData({ ...formData, outboundId: value })}
              >
                <option value="">{t('proxies.selectTarget')}</option>
                {formData.outboundType === 'provider' ? (
                  providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.enabled ? '✓' : ''}
                    </option>
                  ))
                ) : (
                  availableProxies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.proxyPath} {p.enabled ? '✓' : ''}
                    </option>
                  ))
                )}
              </StyledSelect>
            </div>
          </div>
        </div>

        {/* Model Mapping */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('proxies.modelMapping')}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={addModelMapping}
              className="h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('common.add')}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {t('proxies.modelMappingDesc')}
          </p>
          
          {modelMappings.length > 0 ? (
            <div className="space-y-2">
              {modelMappings.map((mapping, index) => (
                <ModelMappingItem
                  key={index}
                  index={index}
                  sourceModel={mapping.source}
                  targetModel={mapping.target}
                  onRemove={() => removeModelMapping(index)}
                  onUpdate={(source, target) => updateModelMapping(index, source, target)}
                  sourceModels={sourceModels}
                  targetModels={targetModels}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <div className="bg-muted/30 rounded-md p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {t('proxies.noModelMappings')}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center justify-between">
          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !formData.outboundId}
              onMouseEnter={() => testIconRef.current?.startAnimation()}
              onMouseLeave={() => testIconRef.current?.stopAnimation()}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TerminalIcon ref={testIconRef} size={16} className="mr-2" />
              )}
              {t('proxies.test')}
            </Button>
            
            {testResult && (
              <Badge variant={testResult.success ? 'default' : 'destructive'} className="text-xs">
                {testResult.success ? t('common.success') : t('common.failed')}
              </Badge>
            )}
            
            {testResult?.error && (
              <span className="text-xs text-destructive truncate max-w-[200px]" title={testResult.error}>
                {testResult.error}
              </span>
            )}
          </div>
          
          {/* Save Button */}
          <Button onClick={handleSave} disabled={!hasChanges}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ==================== Add Proxy Modal ====================

interface AddProxyModalProps {
  open: boolean
  providers: Provider[]
  providerPresets: ProviderPreset[]
  proxies: BridgeProxy[]
  adapterPresets: AdapterPreset[]
  onSave: (data: CreateProxyDTO) => void
  onClose: () => void
  t: (key: string) => string
}

function AddProxyModal({
  open,
  providers,
  providerPresets,
  proxies,
  adapterPresets,
  onSave,
  onClose,
  t
}: AddProxyModalProps) {
  const [formData, setFormData] = useState<CreateProxyDTO>({
    name: '',
    inboundAdapter: 'openai',
    outboundType: 'provider',
    outboundId: '',
    proxyPath: '',
    enabled: true
  })
  
  // 获取当前 inbound adapter 的端点（保留 {model} 占位符用于展示）
  const getModalEndpointPath = () => {
    const adapterInfo = adapterPresets.find(a => a.id === formData.inboundAdapter)
    const adapterType = adapterInfo?.provider || formData.inboundAdapter
    return getEndpointForAdapterType(adapterType, providerPresets)
  }

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        inboundAdapter: 'openai',
        outboundType: 'provider',
        outboundId: providers[0]?.id || '',
        proxyPath: '',
        enabled: true
      })
    }
  }, [open, providers])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.proxyPath || !formData.outboundId) {
      toast.error(t('common.error'), {
        description: 'Please fill in all required fields'
      })
      return
    }
    onSave(formData)
  }

  const availableProxies = proxies

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <ModalHeader onClose={onClose}>
          <h2 className="text-lg font-semibold">{t('proxies.add')}</h2>
          <p className="text-sm text-muted-foreground">{t('proxies.formDesc')}</p>
        </ModalHeader>
        <ModalContent className="space-y-4">
          {/* Name & Path */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                {t('proxies.name')} <span className="text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Proxy"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proxyPath" className="text-xs">{t('proxies.proxyPath')} *</Label>
              <div className="flex items-center">
                <span className="text-muted-foreground text-sm mr-1">/</span>
                <Input
                  id="proxyPath"
                  value={formData.proxyPath}
                  onChange={(e) => setFormData({ ...formData, proxyPath: e.target.value })}
                  placeholder="openai"
                  className="h-9"
                  required
                />
              </div>
            </div>
          </div>

          {/* Access URL Preview */}
          <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded">
            {t('proxies.accessUrl')}: <code className="font-mono"><span className="text-foreground font-semibold">http://127.0.0.1:9527/proxies/{formData.proxyPath || 'path'}</span><span className="opacity-60">{getModalEndpointPath()}</span></code>
          </div>

          {/* Inbound Adapter */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('proxies.inboundAdapter')}</Label>
            <StyledSelect
              value={formData.inboundAdapter}
              onChange={(value) => setFormData({ ...formData, inboundAdapter: value as AdapterType })}
            >
              {adapterPresets.map((adapter) => (
                <option key={adapter.id} value={adapter.id}>
                  {adapter.name}
                </option>
              ))}
            </StyledSelect>
          </div>

          {/* Outbound Type & Target */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('proxies.outboundType')}</Label>
              <StyledSelect
                value={formData.outboundType}
                onChange={(value) => setFormData({
                  ...formData,
                  outboundType: value as 'provider' | 'proxy',
                  outboundId: ''
                })}
              >
                <option value="provider">{t('proxies.typeProvider')}</option>
                <option value="proxy">{t('proxies.typeChain')}</option>
              </StyledSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('proxies.outboundId')} *</Label>
              <StyledSelect
                value={formData.outboundId}
                onChange={(value) => setFormData({ ...formData, outboundId: value })}
              >
                <option value="">{t('proxies.selectTarget')}</option>
                {formData.outboundType === 'provider' ? (
                  providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  availableProxies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.proxyPath}
                    </option>
                  ))
                )}
              </StyledSelect>
            </div>
          </div>

          {/* Enabled Switch */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label className="text-sm">{t('proxies.enabled')}</Label>
              <p className="text-xs text-muted-foreground">{t('proxies.enabledDesc')}</p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} size="sm">
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm">
            {t('common.save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
