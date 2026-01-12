import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Shield,
  Globe,
  Download,
  FolderOpen,
  ExternalLink,
  Sun,
  Moon,
  Info,
  Loader2,
  ChevronRight,
  Plus,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  Palette,
  Database,
  ScrollText
} from 'lucide-react'

import { GearIcon, RefreshIcon, TrashIcon, GithubIcon } from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettingsStore, useI18n } from '@/stores'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import type { ApiKey } from '@/types'

type SettingSection = 'appearance' | 'general' | 'proxy' | 'logs' | 'security' | 'data' | 'about'

const SECTIONS: { id: SettingSection; icon: React.ReactNode; labelKey: string }[] = [
  { id: 'appearance', icon: <Palette className="h-4 w-4" />, labelKey: 'settings.appearance' },
  { id: 'general', icon: <GearIcon size={16} />, labelKey: 'settings.general' },
  { id: 'proxy', icon: <Globe className="h-4 w-4" />, labelKey: 'settings.proxy' },
  { id: 'logs', icon: <ScrollText className="h-4 w-4" />, labelKey: 'settings.logs' },
  { id: 'security', icon: <Shield className="h-4 w-4" />, labelKey: 'settings.security' },
  { id: 'data', icon: <Database className="h-4 w-4" />, labelKey: 'settings.data' },
  { id: 'about', icon: <Info className="h-4 w-4" />, labelKey: 'settings.about' },
]

export function Settings() {
  const [searchParams] = useSearchParams()
  const { settings, fetch: fetchSettings, set: setSetting, theme, setTheme } = useSettingsStore()
  const { t, locale, setLocale } = useI18n()
  const [activeSection, setActiveSection] = useState<SettingSection>(() => {
    const section = searchParams.get('section') as SettingSection
    return section && SECTIONS.some(s => s.id === section) ? section : 'appearance'
  })
  const [appVersion, setAppVersion] = useState('')
  const [platform, setPlatform] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    ipc.invoke('app:get-version').then(setAppVersion)
    ipc.invoke('app:get-platform').then(setPlatform)
  }, [fetchSettings])

  // Update URL when section changes
  useEffect(() => {
    const section = searchParams.get('section') as SettingSection
    if (section && SECTIONS.some(s => s.id === section) && section !== activeSection) {
      setActiveSection(section)
    }
  }, [searchParams, activeSection])

  const handleExportConfig = async () => {
    setLoading('export')
    try {
      const data = await ipc.invoke('config:export', {
        includeProviders: true,
        includeProxies: true,
        includeApiKeys: false,
        includeSettings: true
      })
      
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `amux-config-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('settings.exportSuccess') || 'Config exported successfully')
    } catch (error) {
      console.error('Failed to export config:', error)
      toast.error(t('settings.exportFailed') || 'Export failed')
    } finally {
      setLoading(null)
    }
  }

  const handleOpenUserDataFolder = async () => {
    const path = await ipc.invoke('app:get-path', 'userData')
    await ipc.invoke('app:show-item-in-folder', path)
  }

  const handleRefreshPresets = async () => {
    setLoading('refresh')
    try {
      await ipc.invoke('presets:refresh')
      toast.success(t('settings.refreshSuccess') || 'Presets refreshed')
    } catch (error) {
      console.error('Failed to refresh presets:', error)
      toast.error(t('settings.refreshFailed') || 'Refresh failed')
    } finally {
      setLoading(null)
    }
  }

  const handleCleanupLogs = async () => {
    setLoading('cleanup')
    try {
      const result = await ipc.invoke('logs:cleanup') as { deletedByDate: number; deletedByCount: number }
      const totalDeleted = result.deletedByDate + result.deletedByCount
      if (totalDeleted > 0) {
        toast.success(
          t('settings.cleanupSuccess') || 'Logs cleaned up',
          { description: `${t('settings.deletedLogs') || 'Deleted'}: ${totalDeleted} ${t('settings.entries') || 'entries'}` }
        )
      } else {
        toast.info(t('settings.noLogsToCleanup') || 'No logs to cleanup')
      }
    } catch (error) {
      console.error('Failed to cleanup logs:', error)
      toast.error(t('settings.cleanupFailed') || 'Failed to cleanup logs')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="h-full flex gap-3 animate-fade-in">
      {/* Left Panel - Navigation */}
      <div className="content-card w-56 shrink-0 flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <GearIcon size={16} />
            {t('settings.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('settings.description')}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                  activeSection === section.id
                    ? 'bg-foreground/5 dark:bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5 dark:hover:bg-foreground/10'
                )}
              >
                {section.icon}
                <span className="flex-1">{t(section.labelKey)}</span>
                {activeSection === section.id && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Right Panel - Content */}
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'appearance' && (
            <AppearanceSection theme={theme} setTheme={setTheme} locale={locale} setLocale={setLocale} t={t} />
          )}
          {activeSection === 'general' && (
            <GeneralSection settings={settings} setSetting={setSetting} t={t} />
          )}
          {activeSection === 'proxy' && (
            <ProxySection settings={settings} setSetting={setSetting} t={t} />
          )}
          {activeSection === 'logs' && (
            <LogsSection 
              settings={settings} 
              setSetting={setSetting} 
              onCleanup={handleCleanupLogs}
              loading={loading === 'cleanup'}
              t={t} 
            />
          )}
          {activeSection === 'security' && (
            <SecuritySection settings={settings} setSetting={setSetting} t={t} />
          )}
          {activeSection === 'data' && (
            <DataSection 
              onExport={handleExportConfig}
              onRefresh={handleRefreshPresets}
              onOpenFolder={handleOpenUserDataFolder}
              loading={loading}
              t={t}
            />
          )}
          {activeSection === 'about' && (
            <AboutSection appVersion={appVersion} platform={platform} t={t} />
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Section Components ====================

interface SectionProps {
  t: (key: string) => string
}

interface SettingsSectionProps extends SectionProps {
  settings: Record<string, unknown>
  setSetting: (key: string, value: unknown) => void
}

// Appearance Section
function AppearanceSection({ 
  theme, 
  setTheme, 
  locale, 
  setLocale, 
  t 
}: SectionProps & { 
  theme: string
  setTheme: (theme: 'light' | 'dark') => void
  locale: string
  setLocale: (locale: 'en-US' | 'zh-CN') => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<Sun className="h-5 w-5" />}
        title={t('settings.appearance')}
        description={t('settings.appearanceDesc')}
      />

      {/* Theme */}
      <SettingItem
        icon={theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        label={t('settings.theme')}
        description={t('settings.themeDesc')}
      >
        <div className="flex gap-2">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('light')}
          >
            <Sun className="h-4 w-4 mr-1.5" />
            {t('settings.themeLight')}
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('dark')}
          >
            <Moon className="h-4 w-4 mr-1.5" />
            {t('settings.themeDark')}
          </Button>
        </div>
      </SettingItem>

      {/* Language */}
      <SettingItem
        icon={<Globe className="h-4 w-4" />}
        label={t('settings.language')}
        description={t('settings.languageDesc')}
      >
        <div className="flex gap-2">
          <Button
            variant={locale === 'en-US' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocale('en-US')}
          >
            English
          </Button>
          <Button
            variant={locale === 'zh-CN' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocale('zh-CN')}
          >
            中文
          </Button>
        </div>
      </SettingItem>
    </div>
  )
}

// General Section
function GeneralSection({ settings, setSetting, t }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<GearIcon size={20} />}
        title={t('settings.general')}
        description={t('settings.generalDesc')}
      />

      <SettingItem
        label={t('settings.autoLaunch')}
        description={t('settings.autoLaunchDesc')}
      >
        <Switch
          checked={settings['app.autoLaunch'] as boolean ?? false}
          onCheckedChange={(v) => setSetting('app.autoLaunch', v)}
        />
      </SettingItem>

      <SettingItem
        label={t('settings.minimizeToTray')}
        description={t('settings.minimizeToTrayDesc')}
      >
        <Switch
          checked={settings['app.minimizeToTray'] as boolean ?? true}
          onCheckedChange={(v) => setSetting('app.minimizeToTray', v)}
        />
      </SettingItem>
    </div>
  )
}

// Proxy Section
function ProxySection({ settings, setSetting, t }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<Globe className="h-5 w-5" />}
        title={t('settings.proxy')}
        description={t('settings.proxyDesc')}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">{t('settings.defaultPort')}</Label>
          <Input
            type="number"
            value={settings['proxy.port'] as number ?? 9527}
            onChange={(e) => setSetting('proxy.port', parseInt(e.target.value))}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">{t('settings.defaultHost')}</Label>
          <Input
            value={settings['proxy.host'] as string ?? '127.0.0.1'}
            onChange={(e) => setSetting('proxy.host', e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <SettingItem
        label={t('settings.autoStartService')}
        description={t('settings.autoStartServiceDesc')}
      >
        <Switch
          checked={settings['proxy.autoStart'] as boolean ?? false}
          onCheckedChange={(v) => setSetting('proxy.autoStart', v)}
        />
      </SettingItem>

      <div className="space-y-2">
        <Label className="text-sm">{t('settings.timeout')}</Label>
        <Input
          type="number"
          value={settings['proxy.timeout'] as number ?? 60}
          onChange={(e) => setSetting('proxy.timeout', parseInt(e.target.value))}
          className="h-9 w-32"
        />
        <p className="text-xs text-muted-foreground">{t('settings.timeoutUnit') || 'seconds'}</p>
      </div>
    </div>
  )
}

// Logs Section
function LogsSection({ 
  settings, 
  setSetting, 
  onCleanup,
  loading,
  t 
}: SettingsSectionProps & { onCleanup: () => void; loading: boolean }) {
  const trashIconRef = useRef<AnimatedIconHandle>(null)

  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<Info className="h-5 w-5" />}
        title={t('settings.logs')}
        description={t('settings.logsDesc')}
      />

      <SettingItem
        label={t('settings.enableLogs')}
        description={t('settings.enableLogsDesc')}
      >
        <Switch
          checked={settings['logs.enabled'] as boolean ?? true}
          onCheckedChange={(v) => setSetting('logs.enabled', v)}
        />
      </SettingItem>

      <SettingItem
        label={t('settings.saveRequestBody')}
        description={t('settings.saveRequestBodyDesc')}
      >
        <Switch
          checked={settings['logs.saveRequestBody'] as boolean ?? false}
          onCheckedChange={(v) => setSetting('logs.saveRequestBody', v)}
        />
      </SettingItem>

      <SettingItem
        label={t('settings.saveResponseBody')}
        description={t('settings.saveResponseBodyDesc')}
      >
        <Switch
          checked={settings['logs.saveResponseBody'] as boolean ?? false}
          onCheckedChange={(v) => setSetting('logs.saveResponseBody', v)}
        />
      </SettingItem>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">{t('settings.retentionDays')}</Label>
          <Input
            type="number"
            value={settings['logs.retentionDays'] as number ?? 30}
            onChange={(e) => setSetting('logs.retentionDays', parseInt(e.target.value))}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">{t('settings.maxEntries')}</Label>
          <Input
            type="number"
            value={settings['logs.maxEntries'] as number ?? 10000}
            onChange={(e) => setSetting('logs.maxEntries', parseInt(e.target.value))}
            className="h-9"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button 
          variant="outline" 
          onClick={onCleanup}
          disabled={loading}
          onMouseEnter={() => trashIconRef.current?.startAnimation()}
          onMouseLeave={() => trashIconRef.current?.stopAnimation()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <TrashIcon ref={trashIconRef} size={16} className="mr-2" />
          )}
          {t('settings.cleanupLogs')}
        </Button>
      </div>
    </div>
  )
}

// Security Section
function SecuritySection({ settings, setSetting, t }: SettingsSectionProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const trashIconRefs = useRef<Map<string, AnimatedIconHandle | null>>(new Map())
  
  const unifiedKeyEnabled = (settings['security.unifiedApiKey.enabled'] as boolean) ?? false

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    setLoading(true)
    try {
      const keys = await ipc.invoke('api-key:list') as ApiKey[]
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (unifiedKeyEnabled) {
      fetchApiKeys()
    }
  }, [unifiedKeyEnabled, fetchApiKeys])

  const handleCreateKey = async () => {
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
    try {
      const success = await ipc.invoke('api-key:delete', id) as boolean
      if (success) {
        setApiKeys(prev => prev.filter(k => k.id !== id))
        toast.success(t('settings.apiKeyDeleted'))
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  const handleToggleKey = async (id: string, enabled: boolean) => {
    try {
      await ipc.invoke('api-key:toggle', id, enabled)
      setApiKeys(prev => prev.map(k => k.id === id ? { ...k, enabled } : k))
    } catch (error) {
      console.error('Failed to toggle API key:', error)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    toast.success(t('common.copied'))
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
    // Show full sk-amux. prefix (9 chars) + dots + last 4 chars
    return key.slice(0, 9) + '•'.repeat(16) + key.slice(-4)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<Shield className="h-5 w-5" />}
        title={t('settings.security')}
        description={t('settings.securityDesc')}
      />

      <SettingItem
        label={t('settings.unifiedApiKey')}
        description={t('settings.unifiedApiKeyDesc')}
      >
        <Switch
          checked={unifiedKeyEnabled}
          onCheckedChange={(v) => setSetting('security.unifiedApiKey.enabled', v)}
        />
      </SettingItem>

      {/* API Keys Management - only show when enabled */}
      {unifiedKeyEnabled && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                {t('settings.apiKeys')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('settings.apiKeysDesc')}
              </p>
            </div>
          </div>

          {/* Create new key */}
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('settings.apiKeyNamePlaceholder')}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 h-9"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            />
            <Button
              size="sm"
              onClick={handleCreateKey}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {t('common.create')}
            </Button>
          </div>

          {/* API Keys List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('settings.noApiKeys')}
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    apiKey.enabled 
                      ? "bg-background border-border" 
                      : "bg-muted/50 border-transparent opacity-60"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {apiKey.name || t('settings.unnamedKey')}
                      </span>
                      {!apiKey.enabled && (
                        <Badge variant="secondary" className="text-xs">
                          {t('common.disabled')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                      </code>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {visibleKeys.has(apiKey.id) ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{visibleKeys.has(apiKey.id) ? t('common.hide') : t('common.show')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleCopyKey(apiKey.key)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedKey === apiKey.key ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{t('common.copy')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{t('settings.createdAt')}: {formatDate(apiKey.createdAt)}</span>
                      {apiKey.lastUsedAt && (
                        <span>{t('settings.lastUsed')}: {formatDate(apiKey.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
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
                        <TooltipContent side="top">
                          <p>{t('common.delete')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Usage hint */}
          {apiKeys.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">{t('settings.apiKeyUsageHint')}</p>
              <code className="block bg-background/50 rounded px-2 py-1 mt-1">
                Authorization: Bearer sk-xxxxx
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Data Section
function DataSection({ 
  onExport, 
  onRefresh, 
  onOpenFolder,
  loading,
  t 
}: SectionProps & { 
  onExport: () => void
  onRefresh: () => void
  onOpenFolder: () => void
  loading: string | null
}) {
  const refreshIconRef = useRef<AnimatedIconHandle>(null)

  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<FolderOpen className="h-5 w-5" />}
        title={t('settings.data')}
        description={t('settings.dataDesc')}
      />

      <div className="flex flex-wrap gap-3">
        <Button 
          variant="outline" 
          onClick={onExport}
          disabled={loading === 'export'}
        >
          {loading === 'export' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {t('settings.exportConfig')}
        </Button>
        <Button 
          variant="outline" 
          onClick={onRefresh}
          disabled={loading === 'refresh'}
          onMouseEnter={() => refreshIconRef.current?.startAnimation()}
          onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
        >
          {loading === 'refresh' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshIcon ref={refreshIconRef} size={16} className="mr-2" />
          )}
          {t('settings.refreshPresets')}
        </Button>
        <Button variant="outline" onClick={onOpenFolder}>
          <FolderOpen className="h-4 w-4 mr-2" />
          {t('settings.openDataFolder')}
        </Button>
      </div>
    </div>
  )
}

// About Section
function AboutSection({ 
  appVersion, 
  platform, 
  t 
}: SectionProps & { appVersion: string; platform: string }) {
  const githubIconRef = useRef<AnimatedIconHandle>(null)

  return (
    <div className="space-y-6">
      <SectionHeader 
        icon={<Info className="h-5 w-5" />}
        title={t('settings.about')}
        description="Amux Desktop"
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">{t('settings.version')}</span>
          <Badge variant="secondary">{appVersion || '-'}</Badge>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">{t('settings.platform')}</span>
          <Badge variant="outline">{platform || '-'}</Badge>
        </div>
      </div>

      <div className="pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => ipc.invoke('app:open-external', 'https://github.com/isboyjc/amux')}
          onMouseEnter={() => githubIconRef.current?.startAnimation()}
          onMouseLeave={() => githubIconRef.current?.stopAnimation()}
        >
          <GithubIcon ref={githubIconRef} size={16} className="mr-2" />
          GitHub
          <ExternalLink className="h-3 w-3 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// ==================== Helper Components ====================

function SectionHeader({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode
  title: string
  description: string 
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SettingItem({ 
  icon, 
  label, 
  description, 
  children 
}: { 
  icon?: React.ReactNode
  label: string
  description: string
  children: React.ReactNode 
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="shrink-0 ml-4">
        {children}
      </div>
    </div>
  )
}
