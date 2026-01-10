import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { PageContainer } from '@/components/layout'
import { useSettingsStore, useI18n } from '@/stores'
import { ipc } from '@/lib/ipc'
import {
  Settings2,
  Shield,
  ScrollText,
  Globe,
  Download,
  RefreshCw,
  Trash2,
  FolderOpen,
  ExternalLink,
  Palette,
  Languages,
  Sun,
  Moon
} from 'lucide-react'

export function Settings() {
  const { settings, fetch: fetchSettings, set: setSetting, theme, setTheme } = useSettingsStore()
  const { t, locale, setLocale } = useI18n()
  const [appVersion, setAppVersion] = useState('')
  const [platform, setPlatform] = useState('')

  useEffect(() => {
    fetchSettings()
    
    // Get app info
    ipc.invoke('app:get-version').then(setAppVersion)
    ipc.invoke('app:get-platform').then(setPlatform)
  }, [fetchSettings])

  const handleExportConfig = async () => {
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
    } catch (error) {
      console.error('Failed to export config:', error)
    }
  }

  const handleOpenUserDataFolder = async () => {
    const path = await ipc.invoke('app:get-path', 'userData')
    await ipc.invoke('app:show-item-in-folder', path)
  }

  const handleRefreshPresets = async () => {
    try {
      await ipc.invoke('presets:refresh')
    } catch (error) {
      console.error('Failed to refresh presets:', error)
    }
  }

  const handleCleanupLogs = async () => {
    try {
      await ipc.invoke('logs:cleanup')
    } catch (error) {
      console.error('Failed to cleanup logs:', error)
    }
  }

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.description')}
          </p>
        </div>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle>{t('settings.appearance')}</CardTitle>
          </div>
          <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <div>
                <Label>{t('settings.theme')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.themeDesc')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-1" />
                {t('settings.themeLight')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-1" />
                {t('settings.themeDark')}
              </Button>
            </div>
          </div>
          <Separator />
          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              <div>
                <Label>{t('settings.language')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.languageDesc')}
                </p>
              </div>
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            <CardTitle>{t('settings.general')}</CardTitle>
          </div>
          <CardDescription>{t('settings.generalDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.autoLaunch')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.autoLaunchDesc')}
              </p>
            </div>
            <Switch
              checked={settings['app.autoLaunch'] ?? false}
              onCheckedChange={(v) => setSetting('app.autoLaunch', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.minimizeToTray')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.minimizeToTrayDesc')}
              </p>
            </div>
            <Switch
              checked={settings['app.minimizeToTray'] ?? true}
              onCheckedChange={(v) => setSetting('app.minimizeToTray', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Proxy Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>{t('settings.proxy')}</CardTitle>
          </div>
          <CardDescription>{t('settings.proxyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.defaultPort')}</Label>
              <Input
                type="number"
                value={settings['proxy.port'] ?? 9527}
                onChange={(e) => setSetting('proxy.port', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.defaultHost')}</Label>
              <Input
                value={settings['proxy.host'] ?? '127.0.0.1'}
                onChange={(e) => setSetting('proxy.host', e.target.value)}
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.autoStartService')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.autoStartServiceDesc')}
              </p>
            </div>
            <Switch
              checked={settings['proxy.autoStart'] ?? false}
              onCheckedChange={(v) => setSetting('proxy.autoStart', v)}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>{t('settings.timeout')}</Label>
            <Input
              type="number"
              value={settings['proxy.timeout'] ?? 60}
              onChange={(e) => setSetting('proxy.timeout', parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Log Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            <CardTitle>{t('settings.logs')}</CardTitle>
          </div>
          <CardDescription>{t('settings.logsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.enableLogs')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.enableLogsDesc')}
              </p>
            </div>
            <Switch
              checked={settings['logs.enabled'] ?? true}
              onCheckedChange={(v) => setSetting('logs.enabled', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.saveRequestBody')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.saveRequestBodyDesc')}
              </p>
            </div>
            <Switch
              checked={settings['logs.saveRequestBody'] ?? false}
              onCheckedChange={(v) => setSetting('logs.saveRequestBody', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.saveResponseBody')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.saveResponseBodyDesc')}
              </p>
            </div>
            <Switch
              checked={settings['logs.saveResponseBody'] ?? false}
              onCheckedChange={(v) => setSetting('logs.saveResponseBody', v)}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.retentionDays')}</Label>
              <Input
                type="number"
                value={settings['logs.retentionDays'] ?? 30}
                onChange={(e) => setSetting('logs.retentionDays', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.maxEntries')}</Label>
              <Input
                type="number"
                value={settings['logs.maxEntries'] ?? 10000}
                onChange={(e) => setSetting('logs.maxEntries', parseInt(e.target.value))}
              />
            </div>
          </div>
          <div className="pt-2">
            <Button variant="outline" onClick={handleCleanupLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('settings.cleanupLogs')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>{t('settings.security')}</CardTitle>
          </div>
          <CardDescription>{t('settings.securityDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('settings.unifiedApiKey')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.unifiedApiKeyDesc')}
              </p>
            </div>
            <Switch
              checked={settings['security.unifiedApiKey.enabled'] ?? false}
              onCheckedChange={(v) => setSetting('security.unifiedApiKey.enabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.data')}</CardTitle>
          <CardDescription>{t('settings.dataDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="outline" onClick={handleExportConfig}>
              <Download className="h-4 w-4 mr-2" />
              {t('settings.exportConfig')}
            </Button>
            <Button variant="outline" onClick={handleRefreshPresets}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('settings.refreshPresets')}
            </Button>
            <Button variant="outline" onClick={handleOpenUserDataFolder}>
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('settings.openDataFolder')}
            </Button>
          </div>
        </CardContent>
      </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.about')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.version')}</span>
              <span>{appVersion || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.platform')}</span>
              <span>{platform || '-'}</span>
            </div>
            <div className="pt-2">
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => ipc.invoke('app:open-external', 'https://github.com/isboyjc/amux')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
