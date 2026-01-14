import { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Loader2,
  ShieldCheck,
  ShieldOff
} from 'lucide-react'

import { TrashIcon } from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks'
import { useSettingsStore, useI18n } from '@/stores'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { API_KEY_MASK_LENGTH, API_KEY_VISIBLE_PREFIX, API_KEY_VISIBLE_SUFFIX, COPY_FEEDBACK_DURATION } from '@/lib/constants'
import type { ApiKey } from '@/types'

export function Tokens() {
  const { t } = useI18n()
  const { settings, set: setSetting } = useSettingsStore()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const trashIconRefs = useRef<Map<string, AnimatedIconHandle | null>>(new Map())
  const { copy: copyToClipboard } = useCopyToClipboard({
    duration: COPY_FEEDBACK_DURATION,
    showToast: true,
    toastMessage: t('common.copied'),
  })
  
  const unifiedKeyEnabled = (settings['security.unifiedApiKey.enabled'] as boolean) ?? false

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    setLoading(true)
    try {
      const keys = await ipc.invoke('api-key:list') as ApiKey[]
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
      toast.error(t('tokens.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (unifiedKeyEnabled) {
      fetchApiKeys()
    }
  }, [unifiedKeyEnabled, fetchApiKeys])

  const handleCreateKey = async () => {
    if (creating) return
    
    setCreating(true)
    try {
      const newKey = await ipc.invoke('api-key:create', newKeyName || undefined) as ApiKey
      setApiKeys(prev => [newKey, ...prev])
      setNewKeyName('')
      toast.success(t('settings.apiKeyCreated'))
      // Auto-show the new key
      setVisibleKeys(prev => new Set(prev).add(newKey.id))
    } catch (error) {
      console.error('Failed to create API key:', error)
      toast.error(t('settings.apiKeyCreateFailed'))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteKey = async (id: string) => {
    // Confirm before deleting
    if (!confirm(t('tokens.deleteConfirm') || 'Are you sure you want to delete this API key?')) {
      return
    }
    
    try {
      const success = await ipc.invoke('api-key:delete', id) as boolean
      if (success) {
        setApiKeys(prev => prev.filter(k => k.id !== id))
        toast.success(t('settings.apiKeyDeleted'))
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
      toast.error(t('tokens.deleteFailed'))
    }
  }

  const handleToggleKey = async (id: string, enabled: boolean) => {
    try {
      await ipc.invoke('api-key:toggle', id, enabled)
      setApiKeys(prev => prev.map(k => k.id === id ? { ...k, enabled } : k))
      toast.success(enabled ? t('tokens.enableSuccess') : t('tokens.disableSuccess'))
    } catch (error) {
      console.error('Failed to toggle API key:', error)
      toast.error(t('tokens.toggleFailed'))
    }
  }

  const handleCopyKey = (key: string) => {
    copyToClipboard(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), COPY_FEEDBACK_DURATION)
  }

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const maskKey = (key: string) => {
    if (key.length <= 15) return key
    return key.slice(0, API_KEY_VISIBLE_PREFIX) + '•'.repeat(API_KEY_MASK_LENGTH) + key.slice(-API_KEY_VISIBLE_SUFFIX)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('tokens.title')}</h1>
              <p className="text-muted-foreground text-sm mt-1">{t('tokens.description')}</p>
            </div>
            
            {/* Auth Toggle */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
              unifiedKeyEnabled 
                ? "bg-green-500/10 border-green-500/20" 
                : "bg-muted/50 border-border"
            )}>
              {unifiedKeyEnabled ? (
                <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-500" />
              ) : (
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{t('tokens.authentication')}</span>
              <Switch
                checked={unifiedKeyEnabled}
                onCheckedChange={(v) => setSetting('security.unifiedApiKey.enabled', v)}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!unifiedKeyEnabled ? (
            // Auth Disabled State
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShieldOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">{t('tokens.authDisabled')}</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                {t('tokens.authDisabledDesc')}
              </p>
              <Button onClick={() => setSetting('security.unifiedApiKey.enabled', true)}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {t('tokens.enableAuth')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Create New Key */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t('settings.apiKeyNamePlaceholder')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                />
                <Button onClick={handleCreateKey} disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {t('common.create')}
                </Button>
              </div>

              {/* API Keys List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{t('settings.noApiKeys')}</p>
                  <p className="text-xs mt-1">{t('tokens.createFirstKey')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className={cn(
                        "group relative border rounded-lg p-3 transition-all",
                        apiKey.enabled 
                          ? "bg-card border-border hover:border-primary/30" 
                          : "bg-muted/30 border-border/50 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Key Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">
                              {apiKey.name || t('settings.unnamedKey')}
                            </span>
                            {!apiKey.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                {t('common.disabled')}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                              {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                            </code>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => toggleKeyVisibility(apiKey.id)}
                                      className="p-1 hover:bg-muted rounded transition-colors"
                                    >
                                      {visibleKeys.has(apiKey.id) ? (
                                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                      ) : (
                                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {visibleKeys.has(apiKey.id) ? t('common.hide') : t('common.show')}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleCopyKey(apiKey.key)}
                                      className="p-1 hover:bg-muted rounded transition-colors"
                                    >
                                      {copiedKey === apiKey.key ? (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('common.copy')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{t('settings.createdAt')}: {formatDate(apiKey.createdAt)}</span>
                            {apiKey.lastUsedAt && (
                              <span>{t('settings.lastUsed')}: {formatDate(apiKey.lastUsedAt)}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={apiKey.enabled}
                            onCheckedChange={(v) => handleToggleKey(apiKey.id, v)}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteKey(apiKey.id)}
                                  onMouseEnter={() => trashIconRefs.current.get(apiKey.id)?.startAnimation()}
                                  onMouseLeave={() => trashIconRefs.current.get(apiKey.id)?.stopAnimation()}
                                >
                                  <TrashIcon 
                                    ref={(ref) => trashIconRefs.current.set(apiKey.id, ref)}
                                    size={16} 
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('common.delete')}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
