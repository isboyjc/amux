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

type SettingSection = 'appearance' | 'general' | 'proxy' | 'logs' | 'data' | 'about'

const SECTIONS: { id: SettingSection; icon: React.ReactNode; labelKey: string }[] = [
  { id: 'appearance', icon: <Palette className="h-4 w-4" />, labelKey: 'settings.appearance' },
  { id: 'general', icon: <GearIcon size={16} />, labelKey: 'settings.general' },
  { id: 'proxy', icon: <Globe className="h-4 w-4" />, labelKey: 'settings.proxy' },
  { id: 'logs', icon: <ScrollText className="h-4 w-4" />, labelKey: 'settings.logs' },
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
