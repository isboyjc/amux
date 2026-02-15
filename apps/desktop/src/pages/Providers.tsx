import {
  Plus,
  Search,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Copy,
  RefreshCw,
  Info,
  Zap
} from 'lucide-react'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'  // ✅ 添加 useSearchParams
import { toast } from 'sonner'

import { CopyIcon, RefreshIcon, ResetIcon, EyeIcon, EyeOffIcon, TerminalIcon, CheckIcon, TrashIcon } from '@/components/icons'
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
import { COPY_FEEDBACK_DURATION, COPY_FEEDBACK_DURATION_SHORT, RESET_FEEDBACK_DURATION } from '@/lib/constants'
import { getPresetByType, parseModelName } from '@/lib/provider-utils'
import { cn } from '@/lib/utils'
import { useProviderStore, useI18n } from '@/stores'
import type { Provider, ProviderPreset } from '@/types'
import type { CreateProviderDTO } from '@/types/ipc'

// Provider status type
type ProviderStatus = 'unconfigured' | 'configured-enabled' | 'configured-disabled'

// Get provider status
function getProviderStatus(provider: Provider | undefined): ProviderStatus {
  if (!provider) return 'unconfigured'
  if (!provider.apiKey) return 'unconfigured'
  return provider.enabled ? 'configured-enabled' : 'configured-disabled'
}

export function Providers() {
  const { 
    providers, 
    presets, 
    loading, 
    fetch, 
    fetchPresets, 
    create, 
    update, 
    remove, 
    toggle, 
    test,
    validateProxyPath,
    generateProxyPath
  } = useProviderStore()
  const { t } = useI18n()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()  // ✅ 添加 searchParams
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const hasProcessedInitialState = useRef(false)  // 🆕 标记是否已处理初始状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Fetch providers and presets on mount
  useEffect(() => {
    fetch()
    fetchPresets()
  }, [fetch, fetchPresets])
  
  // 🆕 当 providers 列表改变时，重置初始状态标志（例如删除 provider 后）
  useEffect(() => {
    // 如果当前选中的 provider 已经不存在了，重置标志以允许重新选择
    if (selectedProviderId && !providers.find(p => p.id === selectedProviderId)) {
      hasProcessedInitialState.current = false
    }
  }, [providers, selectedProviderId])

  // 🆕 Auto-select from URL query params, location state, or first provider
  useEffect(() => {
    // 只在第一次或 providers 列表变化时处理初始状态
    if (hasProcessedInitialState.current && providers.length > 0) {
      return
    }
    
    // 1. 优先检查 URL 查询参数 ?select={providerId}
    const selectId = searchParams.get('select')
    if (selectId && providers.find(p => p.id === selectId)) {
      setSelectedProviderId(selectId)
      // 清除 URL 参数（保持 URL 干净）
      searchParams.delete('select')
      setSearchParams(searchParams, { replace: true })
      hasProcessedInitialState.current = true
      return
    }
    
    // 2. 检查 location state（用于页面内跳转）
    const state = location.state as { selectedProviderId?: string } | null
    const stateProviderId = state?.selectedProviderId
    if (stateProviderId && providers.find(p => p.id === stateProviderId)) {
      setSelectedProviderId(stateProviderId)
      hasProcessedInitialState.current = true
      return
    }
    
    // 3. 默认选中第一个 provider
    if (providers.length > 0 && !selectedProviderId) {
      setSelectedProviderId(providers[0]?.id ?? null)
      hasProcessedInitialState.current = true
    }
  }, [providers, selectedProviderId, location.state, searchParams, setSearchParams])

  const selectedProvider = useMemo(() => {
    return providers.find(p => p.id === selectedProviderId) || null
  }, [providers, selectedProviderId])

  const handleAddProvider = async (data: { name: string; type: string }) => {
    const preset = getPresetByType(presets, data.type)
    if (!preset) return

    await create({
      name: data.name,
      adapterType: data.type as Provider['adapterType'],
      apiKey: '',
      baseUrl: preset.baseUrl,
      chatPath: preset.chatPath || '',
      modelsPath: preset.modelsPath || '',
      models: preset.models.map(m => m.id),
      enabled: false,
      logo: preset.logo,
      color: preset.color,
    })
    setShowAddModal(false)
  }

  const handleDeleteProvider = async (id: string) => {
    if (confirm(t('providers.deleteConfirm'))) {
      await remove(id)
      if (selectedProviderId === id) {
        setSelectedProviderId(providers.find(p => p.id !== id)?.id || null)
      }
    }
  }

  const handleSaveProvider = async (data: Partial<CreateProviderDTO>) => {
    if (!selectedProviderId) return
    await update(selectedProviderId, data)
    toast.success(t('common.saved'))
  }

  const handleTestConnection = async (modelId: string) => {
    if (!selectedProviderId) return
    setTestingId(selectedProviderId)
    try {
      const result = await test(selectedProviderId, modelId)
      if (result.success) {
        toast.success(t('providers.testSuccess'), {
          description: `${t('providers.latency')}: ${result.latency}ms`
        })
      } else {
        toast.error(t('providers.testFailed'), {
          description: result.error
        })
      }
    } catch (error) {
      toast.error(t('providers.testFailed'), {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="h-full flex gap-3 animate-fade-in">
      {/* Left Panel - Provider List (content-card style) */}
      <div className="content-card w-72 shrink-0 flex flex-col overflow-hidden">
        <ProviderListPanel
          providers={providers}
          presets={presets}
          selectedId={selectedProviderId}
          onSelect={setSelectedProviderId}
          onAdd={() => setShowAddModal(true)}
          onDelete={handleDeleteProvider}
          loading={loading}
          t={t}
        />
      </div>

      {/* Right Panel - Provider Configuration (content-card style) */}
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        <ProviderConfigPanel
          provider={selectedProvider}
          presets={presets}
          onSave={handleSaveProvider}
          onToggle={(enabled) => selectedProviderId && toggle(selectedProviderId, enabled)}
          onTest={handleTestConnection}
          onModelsUpdate={async (models) => {
            if (selectedProviderId) {
              await update(selectedProviderId, { models })
            }
          }}
          testing={testingId === selectedProviderId}
          validateProxyPath={validateProxyPath}
          generateProxyPath={generateProxyPath}
          t={t}
        />
      </div>

      {/* Add Provider Modal */}
      <AddProviderModal
        open={showAddModal}
        presets={presets}
        existingNames={providers.map(p => p.name)}
        onAdd={handleAddProvider}
        onClose={() => setShowAddModal(false)}
        t={t}
      />
    </div>
  )
}

// ==================== Provider List Panel ====================

interface ProviderListPanelProps {
  providers: Provider[]
  presets: ProviderPreset[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  loading: boolean
  t: (key: string) => string
}

function ProviderListPanel({
  providers,
  presets,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  loading,
  t
}: ProviderListPanelProps) {
  const [search, setSearch] = useState('')

  const filteredProviders = providers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* Header */}
      <div className="p-4 pb-3 space-y-3 shrink-0 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('providers.list')}</h2>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={onAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('providers.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {search ? t('common.noData') : t('providers.noProviders')}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredProviders.map((provider) => (
              <ProviderListItem
                key={provider.id}
                provider={provider}
                presets={presets}
                isSelected={selectedId === provider.id}
                onSelect={() => onSelect(provider.id)}
                onDelete={() => onDelete(provider.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ==================== Provider List Item ====================

interface ProviderListItemProps {
  provider: Provider
  presets: ProviderPreset[]
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  t: (key: string) => string
}

function ProviderListItem({ provider, presets, isSelected, onSelect, onDelete, t }: ProviderListItemProps) {
  const status = getProviderStatus(provider)
  const preset = getPresetByType(presets, provider.adapterType)
  const trashIconRef = useRef<AnimatedIconHandle>(null)

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors',
        isSelected
          ? 'bg-muted/80 text-foreground'
          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
      onClick={onSelect}
    >
      {/* Logo with Status Badge */}
      <div className="relative shrink-0">
        <ProviderLogo logo={provider.logo} name={provider.name} color={provider.color} size={32} className="rounded-md" />
        {/* Status Badge */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -bottom-0.5 -right-0.5">
                {status === 'configured-enabled' && (
                  <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                )}
                {status === 'configured-disabled' && (
                  <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-background" />
                )}
                {status === 'unconfigured' && (
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30 border-2 border-background" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {status === 'configured-enabled' && t('providers.statusEnabled')}
              {status === 'configured-disabled' && t('providers.statusDisabled')}
              {status === 'unconfigured' && t('providers.statusUnconfigured')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Name & Type */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{provider.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {preset?.name || provider.adapterType}
        </div>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-destructive hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        onMouseEnter={() => trashIconRef.current?.startAnimation()}
        onMouseLeave={() => trashIconRef.current?.stopAnimation()}
      >
        <TrashIcon ref={trashIconRef} size={14} dangerHover />
      </Button>
    </div>
  )
}

// ==================== Provider Config Panel ====================

interface ProviderConfigPanelProps {
  provider: Provider | null
  presets: ProviderPreset[]
  onSave: (data: Partial<CreateProviderDTO>) => void
  onToggle: (enabled: boolean) => void
  onTest: (modelId: string) => void
  onModelsUpdate: (models: string[]) => Promise<void>
  testing: boolean
  validateProxyPath: (path: string, excludeId?: string) => Promise<boolean>
  generateProxyPath: (name: string, adapterType: string) => Promise<string>
  t: (key: string) => string
}

function ProviderConfigPanel({
  provider,
  presets,
  onSave,
  onToggle,
  onTest,
  onModelsUpdate,
  testing,
  validateProxyPath,
  generateProxyPath,
  t
}: ProviderConfigPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  
  const [customModelId, setCustomModelId] = useState('')
  const [showTestModal, setShowTestModal] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const { copied, copy: copyEndpoint } = useCopyToClipboard({ duration: COPY_FEEDBACK_DURATION_SHORT })
  
  // Passthrough proxy state
  const [enableAsProxy, setEnableAsProxy] = useState(false)
  const [proxyPath, setProxyPath] = useState('')
  const [proxyPathError, setProxyPathError] = useState<string | null>(null)
  const [proxyPathValidating, setProxyPathValidating] = useState(false)
  const { copied: copiedProxyUrl, copy: copyProxyUrl } = useCopyToClipboard({ duration: COPY_FEEDBACK_DURATION })

  // Icon refs for animations
  const copyIconRef = useRef<AnimatedIconHandle>(null)
  const resetIconRef = useRef<AnimatedIconHandle>(null)
  const refreshIconRef = useRef<AnimatedIconHandle>(null)
  const testIconRef = useRef<AnimatedIconHandle>(null)
  const eyeIconRef = useRef<AnimatedIconHandle>(null)

  const preset = provider ? getPresetByType(presets, provider.adapterType) : null

  // Sync form state with provider
  useEffect(() => {
    if (provider) {
      setApiKey(provider.apiKey || '')
      setBaseUrl(provider.baseUrl || preset?.baseUrl || '')
      setSelectedModels(provider.models || [])
      setEnableAsProxy(provider.enableAsProxy || false)
      setProxyPath(provider.proxyPath || '')
      setProxyPathError(null)
    }
  }, [provider?.id, preset])

  if (!provider) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('providers.selectProvider')}</p>
        </div>
      </div>
    )
  }

  const handleSave = () => {
    onSave({
      apiKey,
      baseUrl,
      models: selectedModels,
      enableAsProxy,
      proxyPath: enableAsProxy ? proxyPath || null : null,
    })
  }
  
  // Handle proxy path change with debounced validation
  const handleProxyPathChange = async (newPath: string) => {
    setProxyPath(newPath)
    setProxyPathError(null)
    
    if (!newPath) {
      setProxyPathError(null)
      return
    }
    
    setProxyPathValidating(true)
    try {
      const isValid = await validateProxyPath(newPath, provider?.id)
      if (!isValid) {
        setProxyPathError(t('providers.proxyPathTaken'))
      }
    } catch (error) {
      setProxyPathError(t('providers.proxyPathInvalid'))
    } finally {
      setProxyPathValidating(false)
    }
  }
  
  // Generate proxy path from provider name
  const handleGenerateProxyPath = async () => {
    if (!provider) return
    try {
      const generated = await generateProxyPath(provider.name, provider.adapterType)
      setProxyPath(generated)
      setProxyPathError(null)
    } catch (error) {
      toast.error(t('providers.generateProxyPathFailed'))
    }
  }
  
  // Copy proxy URL (base URL only, without endpoint path)
  const handleCopyProxyUrl = () => {
    if (!proxyPath) return
    const url = `http://127.0.0.1:9527/providers/${proxyPath}`
    copyProxyUrl(url)
  }

  // 获取直通代理的端点（从 Provider 配置或预设中读取）
  // 获取直通代理端点（保留 {model} 占位符用于展示）
  const getProxyEndpoint = () => {
    if (!provider) return '/v1/chat/completions'
    
    // 优先使用 Provider 自己的 chatPath
    let chatPath = provider.chatPath
    
    // 如果 Provider 没有设置，使用预设的 chatPath
    if (!chatPath && preset?.chatPath) {
      chatPath = preset.chatPath
    }
    
    // 如果还是没有，使用默认值
    if (!chatPath) {
      chatPath = '/v1/chat/completions'
    }
    
    return chatPath
  }

  const handleAddCustomModel = () => {
    if (customModelId && !selectedModels.includes(customModelId)) {
      setSelectedModels([...selectedModels, customModelId])
      setCustomModelId('')
    }
  }

  const handleRemoveModel = (modelId: string) => {
    setSelectedModels(selectedModels.filter(m => m !== modelId))
  }

  const handleResetBaseUrl = () => {
    if (preset?.baseUrl) {
      setBaseUrl(preset.baseUrl)
      // Show success feedback
      setResetSuccess(true)
      setTimeout(() => {
        setResetSuccess(false)
      }, RESET_FEEDBACK_DURATION)
    }
  }

  const handleCopyEndpoint = () => {
    copyEndpoint(baseUrl)
  }

  const handleFetchModels = async () => {
    // Regular Provider: use existing logic
    const modelsPath = provider.modelsPath || preset?.modelsPath
    if (!modelsPath || !apiKey || !baseUrl || !provider?.adapterType) {
      toast.warning(t('providers.apiKeyRequired'))
      return
    }
    setFetchingModels(true)
    
    // Start animation
    refreshIconRef.current?.startAnimation()
    
    try {
      // Call IPC to fetch models from provider API
      const result = await window.api.invoke('providers:fetch-models', {
        baseUrl,
        apiKey,
        modelsPath,
        adapterType: provider.adapterType
      }) as { success: boolean; models: Array<{ id: string; name?: string }>; error?: string }
      
      if (result.success && result.models && result.models.length > 0) {
        const fetchedModelIds = result.models.map((m) => m.id)
        
        // When we successfully fetch models (especially more than 1), replace the entire model list
        if (result.models.length > 1) {
          // Clear selected models
          setSelectedModels([])
          console.log(`[FetchModels] Cleared selected models, replacing model list with ${fetchedModelIds.length} new models`)
        }
        
        // Update provider's models via store (will update both database and UI)
        // Replace with new models instead of merging
        await onModelsUpdate(fetchedModelIds)
        
        toast.success(t('providers.fetchModelsSuccess').replace('{count}', String(result.models.length)))
        console.log(`[FetchModels] Successfully fetched and updated ${fetchedModelIds.length} models`)
      } else if (result.error) {
        toast.error(t('providers.fetchModelsFailed'), {
          description: result.error
        })
        console.error('Failed to fetch models:', result.error)
      } else {
        toast.info(t('providers.fetchModelsEmpty'))
      }
    } catch (error) {
      toast.error(t('providers.fetchModelsFailed'), {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
      console.error('Error fetching models:', error)
    } finally {
      setFetchingModels(false)
      refreshIconRef.current?.stopAnimation()
    }
  }

  const handleTestClick = () => {
    if (!apiKey) {
      alert(t('providers.apiKeyRequired'))
      return
    }
    if (selectedModels.length === 0) {
      alert(t('providers.modelRequired'))
      return
    }
    setShowTestModal(true)
  }

  // API endpoint for display - use provider's chatPath or preset's chatPath
  const chatPath = provider.chatPath || preset?.chatPath || '/v1/chat/completions'
  const availableModelIds = provider.models && provider.models.length > 0
    ? provider.models
    : (preset?.models.map(m => m.id) || [])

  const handleSelectAllModels = () => {
    if (availableModelIds.length === 0) return
    setSelectedModels(Array.from(new Set([...selectedModels, ...availableModelIds])))
  }

  const handleClearModels = () => {
    setSelectedModels([])
  }

  const canSave = apiKey && baseUrl && selectedModels.length > 0
  const status = getProviderStatus(provider)

  return (
    <>
      {/* Header */}
      <div className="p-4 pb-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProviderLogo logo={provider.logo} name={provider.name} color={provider.color} size={40} className="rounded-lg" />
            <div>
              <h2 className="text-lg font-semibold">{provider.name}</h2>
              <p className="text-sm text-muted-foreground">{preset?.name || provider.adapterType}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('providers.enabled')}</span>
              <Switch
                checked={provider.enabled}
                onCheckedChange={onToggle}
                disabled={status === 'unconfigured'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* API Key */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('providers.apiKey')} *</Label>
          <div className="flex items-center gap-2">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="font-mono text-sm flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setShowPassword(!showPassword)}
              onMouseEnter={() => eyeIconRef.current?.startAnimation()}
              onMouseLeave={() => eyeIconRef.current?.stopAnimation()}
            >
              {showPassword ? (
                <EyeOffIcon ref={eyeIconRef} size={18} />
              ) : (
                <EyeIcon ref={eyeIconRef} size={18} />
              )}
            </Button>
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('providers.baseUrl')} *</Label>
          <div className="flex items-center gap-2">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={preset?.baseUrl}
              className="text-sm flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleResetBaseUrl}
              onMouseEnter={() => !resetSuccess && resetIconRef.current?.startAnimation()}
              onMouseLeave={() => !resetSuccess && resetIconRef.current?.stopAnimation()}
              title={t('providers.resetBaseUrl')}
            >
              {resetSuccess ? (
                <CheckIcon size={18} success />
              ) : (
                <ResetIcon ref={resetIconRef} size={18} />
              )}
            </Button>
          </div>
        </div>

        {/* API Endpoint (Read-only) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('providers.apiEndpoint')}</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-muted rounded-md text-xs font-mono truncate">
              <span className="font-semibold text-foreground">{baseUrl}</span>
              <span className="text-muted-foreground">{chatPath}</span>
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCopyEndpoint}
              onMouseEnter={() => !copied && copyIconRef.current?.startAnimation()}
              onMouseLeave={() => !copied && copyIconRef.current?.stopAnimation()}
            >
              {copied ? (
                <CheckIcon size={16} success />
              ) : (
                <CopyIcon ref={copyIconRef} size={16} />
              )}
            </Button>
          </div>
        </div>

        {/* Models */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t('providers.models')} *</Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSelectAllModels}
                disabled={availableModelIds.length === 0}
              >
                {t('common.selectAll')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleClearModels}
                disabled={selectedModels.length === 0}
              >
                {t('common.clear')}
              </Button>
              {(provider.modelsPath || preset?.modelsPath) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleFetchModels}
                  onMouseEnter={() => refreshIconRef.current?.startAnimation()}
                  onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
                  disabled={fetchingModels || !apiKey || !baseUrl}
                >
                  {fetchingModels ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshIcon ref={refreshIconRef} size={14} className="mr-1.5" />
                  )}
                  Fetch Models
                </Button>
              )}
            </div>
          </div>

          {/* Selected Models */}
          <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-muted/50 rounded-md">
            {selectedModels.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t('providers.noModelsSelected')}</span>
            ) : (
              selectedModels.map((modelId) => (
                <Badge
                  key={modelId}
                  variant="secondary"
                  className="text-xs pl-2 pr-1 py-0.5 gap-1"
                >
                  {parseModelName(modelId)}
                  <button
                    className="ml-0.5 hover:text-destructive"
                    onClick={() => handleRemoveModel(modelId)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>

          {/* Available Models (from provider data or preset) */}
          {availableModelIds.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('providers.presetModels')}</Label>
              <div className="flex flex-wrap gap-1">
                {availableModelIds.map((modelId) => {
                  const presetModel = preset?.models.find(m => m.id === modelId)
                  const displayName = presetModel?.name || parseModelName(modelId)

                  return (
                    <button
                      key={modelId}
                      className={cn(
                        'px-2 py-0.5 text-xs rounded-md border transition-colors',
                        selectedModels.includes(modelId)
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-background hover:bg-muted border-border'
                      )}
                      onClick={() => {
                        if (selectedModels.includes(modelId)) {
                          handleRemoveModel(modelId)
                        } else {
                          setSelectedModels([...selectedModels, modelId])
                        }
                      }}
                    >
                      {displayName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add Custom Model */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('providers.addCustomModel')}</Label>
            <div className="flex gap-2">
              <Input
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                placeholder={t('providers.modelIdPlaceholder')}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomModel()}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleAddCustomModel}
                disabled={!customModelId}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Passthrough Proxy Configuration */}
        <div className="space-y-3 p-4 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold text-primary">{t('providers.passthroughProxy')}</Label>
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">{t('providers.passthroughProxyTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              checked={enableAsProxy}
              onCheckedChange={(checked) => {
                setEnableAsProxy(checked)
                if (checked && !proxyPath) {
                  handleGenerateProxyPath()
                }
              }}
              disabled={!provider?.enabled || !apiKey}
            />
          </div>

          {enableAsProxy && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              {/* Proxy Path Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('providers.proxyPath')} *</Label>
                <div className="flex gap-2">
                  <Input
                    value={proxyPath}
                    onChange={(e) => handleProxyPathChange(e.target.value)}
                    placeholder="openai-personal"
                    className={cn(
                      "h-8 text-sm font-mono flex-1",
                      proxyPathError && "border-destructive focus-visible:ring-destructive"
                    )}
                    disabled={!enableAsProxy}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleGenerateProxyPath}
                    disabled={!enableAsProxy}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {proxyPathValidating && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('providers.validating')}
                  </p>
                )}
                {proxyPathError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {proxyPathError}
                  </p>
                )}
                {!proxyPathError && !proxyPathValidating && proxyPath && (
                  <p className="text-xs text-muted-foreground">
                    {t('providers.proxyPathFormat')}
                  </p>
                )}
              </div>

              {/* Proxy URL Preview */}
              {proxyPath && !proxyPathError && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('providers.proxyUrl')}</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted px-2.5 py-1.5 rounded-md text-xs font-mono truncate border">
                      <span className="font-semibold text-foreground">http://127.0.0.1:9527/providers/{proxyPath}</span>
                      <span className="text-muted-foreground">{getProxyEndpoint()}</span>
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleCopyProxyUrl}
                    >
                      {copiedProxyUrl ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('providers.proxyUrlHint')}
                  </p>
                </div>
              )}

              {/* Warning for disabled provider */}
              {!provider?.enabled && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t('providers.enableProviderFirst')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestClick}
          onMouseEnter={() => testIconRef.current?.startAnimation()}
          onMouseLeave={() => testIconRef.current?.stopAnimation()}
          disabled={testing || !apiKey || selectedModels.length === 0}
        >
          {testing ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <TerminalIcon ref={testIconRef} size={16} className="mr-1.5" />
          )}
          {t('providers.test')}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
        >
          <Check className="h-4 w-4 mr-1.5" />
          {t('common.save')}
        </Button>
      </div>

      {/* Test Model Selection Modal */}
      <TestModelModal
        open={showTestModal}
        models={selectedModels}
        onSelect={(modelId) => {
          setShowTestModal(false)
          onTest(modelId)
        }}
        onClose={() => setShowTestModal(false)}
        t={t}
      />
    </>
  )
}

// ==================== Add Provider Modal ====================

interface AddProviderModalProps {
  open: boolean
  presets: ProviderPreset[]
  existingNames: string[]
  onAdd: (data: { name: string; type: string }) => void
  onClose: () => void
  t: (key: string) => string
}

function AddProviderModal({ open, presets, existingNames, onAdd, onClose, t }: AddProviderModalProps) {
  const [selectedType, setSelectedType] = useState<string>('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const selectedPreset = presets.find(p => p.adapterType === selectedType)

  useEffect(() => {
    if (selectedPreset && !name) {
      setName(selectedPreset.name)
    }
  }, [selectedType, selectedPreset, name])

  useEffect(() => {
    if (open && presets.length > 0) {
      const firstPreset = presets[0]
      if (firstPreset) {
        setSelectedType(firstPreset.adapterType)
        setName(firstPreset.name)
      }
      setError('')
    }
  }, [open, presets])

  const handleSubmit = () => {
    if (!name.trim()) {
      setError(t('providers.nameRequired'))
      return
    }
    if (existingNames.includes(name.trim())) {
      setError(t('providers.nameDuplicate'))
      return
    }
    onAdd({ name: name.trim(), type: selectedType })
  }

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-md">
      <ModalHeader onClose={onClose}>
        <h2 className="text-lg font-semibold">{t('providers.add')}</h2>
        <p className="text-sm text-muted-foreground">{t('providers.addDesc')}</p>
      </ModalHeader>
      <ModalContent className="space-y-4">
        {/* Provider Type Selection */}
        <div className="space-y-2">
          <Label className="text-sm">{t('providers.adapterType')}</Label>
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {presets.map((preset) => (
              <button
                key={preset.adapterType}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 transition-colors text-left',
                  selectedType === preset.adapterType
                    ? 'bg-muted/80'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setSelectedType(preset.adapterType)
                  setName(preset.name)
                  setError('')
                }}
              >
                <ProviderLogo logo={preset.logo} name={preset.name} color={preset.color} size={28} className="rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{preset.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{preset.adapterType}</div>
                </div>
                {selectedType === preset.adapterType && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Provider Name */}
        <div className="space-y-2">
          <Label className="text-sm">{t('providers.name')}</Label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder={selectedPreset?.name}
            className="h-9"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" onClick={handleSubmit}>
          {t('common.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

// ==================== Test Model Modal ====================

interface TestModelModalProps {
  open: boolean
  models: string[]
  onSelect: (modelId: string) => void
  onClose: () => void
  t: (key: string) => string
}

function TestModelModal({ open, models, onSelect, onClose, t }: TestModelModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-sm">
      <ModalHeader onClose={onClose}>
        <h2 className="text-lg font-semibold">{t('providers.selectTestModel')}</h2>
        <p className="text-sm text-muted-foreground">{t('providers.selectTestModelDesc')}</p>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-1">
          {models.map((modelId) => (
            <button
              key={modelId}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors text-left"
              onClick={() => onSelect(modelId)}
            >
              <span className="text-sm">{parseModelName(modelId)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </ModalContent>
    </Modal>
  )
}
