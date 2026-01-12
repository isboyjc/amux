import {
  Activity,
  TrendingUp,
  BarChart3,
  Timer,
  Workflow,
  Database,
  Boxes,
  Coins,
  Copy,
  Shield,
  ShieldCheck,
  Key,
  ArrowRight
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { toast } from 'sonner'

import { PageContainer } from '@/components/layout'
import { ProviderLogo } from '@/components/providers'
import { Switch } from '@/components/ui/switch'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { useProxyStore, useProviderStore, useBridgeProxyStore } from '@/stores'
import { useI18n } from '@/stores/i18n-store'
import { useSettingsStore } from '@/stores/settings-store'

interface TimeSeriesPoint {
  timestamp: number
  proxyPath: string
  sourceModel: string
  targetModel: string
  inputTokens: number
  outputTokens: number
  latency: number
  success: boolean
}

interface ProxyColor {
  main: string
  light: string
}

// 预定义的颜色方案
const PROXY_COLORS: ProxyColor[] = [
  { main: 'hsl(220, 70%, 50%)', light: 'hsl(220, 70%, 90%)' }, // 蓝色
  { main: 'hsl(160, 60%, 45%)', light: 'hsl(160, 60%, 90%)' }, // 绿色
  { main: 'hsl(30, 80%, 55%)', light: 'hsl(30, 80%, 90%)' },   // 橙色
  { main: 'hsl(280, 65%, 60%)', light: 'hsl(280, 65%, 90%)' }, // 紫色
  { main: 'hsl(340, 75%, 55%)', light: 'hsl(340, 75%, 90%)' }, // 粉色
  { main: 'hsl(200, 70%, 50%)', light: 'hsl(200, 70%, 90%)' }, // 青色
  { main: 'hsl(45, 90%, 55%)', light: 'hsl(45, 90%, 90%)' },   // 黄色
  { main: 'hsl(120, 60%, 45%)', light: 'hsl(120, 60%, 90%)' }  // 草绿
]

interface ApiKey {
  id: string
  name: string
  key: string
  enabled: boolean
  createdAt: number
}

export function Dashboard() {
  const navigate = useNavigate()
  const { status, port, host, metrics, fetchMetrics } = useProxyStore()
  const { providers, fetch: fetchProviders } = useProviderStore()
  const { proxies, fetch: fetchProxies } = useBridgeProxyStore()
  const { settings, fetch: fetchSettings, setMany: updateSettings } = useSettingsStore()
  const { t } = useI18n()

  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [hoveredLogoIndex, setHoveredLogoIndex] = useState<number | null>(null)

  // Get configured and enabled providers for logo display
  const configuredProviders = providers.filter(p => p.enabled && p.apiKey)
  
  // Get passthrough providers count
  const passthroughProviders = providers.filter(p => p.enabled && p.enableAsProxy)
  

  useEffect(() => {
    const init = async () => {
      await fetchSettings()
      fetchProviders()
      fetchProxies()
      fetchMetrics()
      fetchTimeSeriesData()
    }
    init()

    const interval = setInterval(() => {
      fetchMetrics()
      fetchTimeSeriesData()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchProviders, fetchProxies, fetchMetrics, fetchSettings])

  useEffect(() => {
    const authEnabled = (settings['security.unifiedApiKey.enabled'] as boolean) ?? false
    if (authEnabled) {
      fetchApiKeys()
    } else {
      setApiKeys([])
    }
  }, [settings['security.unifiedApiKey.enabled']])

  const fetchTimeSeriesData = async () => {
    try {
      const data = await ipc.invoke('logs:get-time-series-stats', 24)
      setTimeSeriesData(data as TimeSeriesPoint[])
    } catch (error) {
      console.error('Failed to fetch time series data:', error)
    }
  }

  const fetchApiKeys = async () => {
    try {
      const keys = await ipc.invoke('api-key:list')
      setApiKeys(keys.filter((key: ApiKey) => key.enabled))
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    }
  }

  const handleAuthToggle = async (enabled: boolean) => {
    try {
      await updateSettings({ 'security.unifiedApiKey.enabled': enabled })
      if (enabled) {
        await fetchApiKeys()
      } else {
        setApiKeys([])
      }
      toast.success(enabled ? t('settings.authEnabled') : t('settings.authDisabled'))
    } catch (error) {
      console.error('Failed to toggle auth:', error)
      toast.error(t('settings.authToggleFailed'))
    }
  }

  const handleCopyKey = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} ${t('common.copied')}`)
  }

  const enabledProviders = providers.filter((p) => p.enabled).length
  const successRate =
    metrics && metrics.totalRequests > 0
      ? Math.round((metrics.successRequests / metrics.totalRequests) * 100)
      : 100

  // Get auth enabled state from settings
  const unifiedKeyEnabled = (settings['security.unifiedApiKey.enabled'] as boolean) ?? false

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in max-w-[1800px] mx-auto">
        {/* Header with Auth Toggle and Status */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground text-sm mt-2">{t('dashboard.description')}</p>
          </div>
          <div className="flex items-center gap-3">
            <AuthToggle
              enabled={unifiedKeyEnabled}
              onChange={handleAuthToggle}
              t={t}
            />
            <ServiceStatus status={status} host={host} port={port} t={t} />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Requests */}
          <StatCard
            title={t('dashboard.totalRequests')}
              value={metrics?.totalRequests ?? 0}
            subtitle={metrics?.requestsPerMinute ? `${metrics.requestsPerMinute}/min` : undefined}
              icon={BarChart3}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
          />

          {/* Success Rate */}
          <StatCard
            title={t('dashboard.successRate')}
              value={`${successRate}%`}
              icon={TrendingUp}
            iconColor={successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500'}
            iconBg={successRate >= 95 ? 'bg-green-500/10' : successRate >= 80 ? 'bg-yellow-500/10' : 'bg-red-500/10'}
          />

          {/* Average Latency */}
          <StatCard
            title={t('dashboard.avgLatency')}
              value={`${metrics?.averageLatency ?? 0}ms`}
              icon={Timer}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
          />

          {/* Active Connections */}
          <StatCard
            title={t('dashboard.activeConnections')}
              value={metrics?.activeConnections ?? 0}
              icon={Workflow}
            iconColor="text-orange-500"
            iconBg="bg-orange-500/10"
            pulse={(metrics?.activeConnections ?? 0) > 0}
          />
        </div>

        {/* Resources and Tokens */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Providers - Clickable */}
          <button
            onClick={() => navigate('/providers')}
            className="bg-card rounded-xl p-4 border border-border/50 shadow-sm hover:border-cyan-500/30 hover:shadow-md transition-all text-left group relative overflow-visible"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                  <Database className="h-4 w-4 text-cyan-500" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {t('dashboard.providers')}
                </h3>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold tabular-nums">{providers.length}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {enabledProviders} {t('common.enabled')}
          </div>
        </div>

              {/* Provider Logo Stack - macOS Dock-style magnification effect */}
              {configuredProviders.length > 0 && (() => {
                // Show more logos when there are many providers
                const displayCount = configuredProviders.length > 8 ? 6 : Math.min(configuredProviders.length, 8)
                const total = displayCount
                const hasMoreBadge = configuredProviders.length > displayCount
                const totalItems = hasMoreBadge ? total + 1 : total
                
                // macOS Dock magnification - smooth scale based on distance
                const getScale = (index: number) => {
                  if (hoveredLogoIndex === null) return 1
                  const distance = Math.abs(hoveredLogoIndex - index)
                  // Magnification curve: peak at 1.6x, smoothly decreases with distance
                  if (distance === 0) return 1.6  // Hovered: 60% larger
                  if (distance === 1) return 1.35 // Adjacent: 35% larger
                  if (distance === 2) return 1.15 // Next: 15% larger
                  return 1 // Others: normal
                }
                
                // Calculate dynamic offset with magnification
                const getOffset = (index: number) => {
                  if (hoveredLogoIndex === null) {
                    return (totalItems - 1 - index) * 16
                  }
                  
                  // Calculate cumulative width with magnification
                  let offset = 0
                  for (let i = totalItems - 1; i > index; i--) {
                    const scale = getScale(i)
                    offset += 36 * scale * 0.5 // Half width overlap for stacking
                  }
                  
                  // If current item is on the right side of hovered item, push it right (decrease right value)
                  if (index > hoveredLogoIndex) {
                    const hoveredScale = getScale(hoveredLogoIndex)
                    const extraSpace = (hoveredScale - 1) * 36 * 0.8 // Extra space needed by magnified item
                    offset -= extraSpace // Decrease right value to move right
                  }
                  
                  return offset
                }
                
                // Calculate dynamic container width with max limit
                const getContainerWidth = () => {
                  if (hoveredLogoIndex === null) {
                    return totalItems * 18 + 32
                  }
                  // Sum up all scaled widths
                  let width = 0
                  for (let i = 0; i < totalItems; i++) {
                    const scale = getScale(i)
                    width += 36 * scale * 0.5
                  }
                  // Add extra padding and cap at max width
                  return Math.min(width + 40, 200)
                }
                
                const handleLogoClick = (provider: typeof configuredProviders[0], e: React.MouseEvent) => {
                  e.stopPropagation()
                  navigate('/providers', { state: { selectedProviderId: provider.id } })
                }
                
                const handleBadgeClick = (e: React.MouseEvent) => {
                  e.stopPropagation()
                  navigate('/providers')
                }
                
                return (
                  <div 
                    className="provider-logo-stack relative flex items-center justify-end"
                    style={{ 
                      height: 60,
                      width: getContainerWidth(),
                      transition: 'width 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                    }}
                    onMouseLeave={() => setHoveredLogoIndex(null)}
                  >
                    {/* +N badge */}
                    {hasMoreBadge && (
                      <div
                        className="absolute rounded-md flex items-center justify-center overflow-hidden border-[3px] border-background shadow-md bg-muted/80 cursor-pointer"
                        style={{
                          width: 36,
                          height: 36,
                          left: 0,
                          zIndex: 0,
                          transform: `rotate(-8deg) translateY(-50%) scale(${getScale(-1)})`,
                          top: '50%',
                          transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                        }}
                        onMouseEnter={() => setHoveredLogoIndex(-1)}
                        onClick={handleBadgeClick}
                      >
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          +{configuredProviders.length - displayCount}
                        </span>
                      </div>
                    )}
                    
                    {/* Provider logos */}
                    {configuredProviders.slice(0, displayCount).map((provider, index) => {
                      const rotation = index % 2 === 0 ? -8 : 8
                      const actualIndex = hasMoreBadge ? index : index
                      const scale = getScale(actualIndex)
                      const offset = getOffset(actualIndex)
                      
                      return (
                        <div
                          key={`${provider.id}-${index}`}
                          className="absolute rounded-md flex items-center justify-center overflow-hidden border-[3px] border-background shadow-md cursor-pointer"
                          style={{
                            width: 36,
                            height: 36,
                            backgroundColor: provider.color || '#f4f4f5',
                            right: offset,
                            top: '50%',
                            zIndex: actualIndex + 1,
                            transform: `rotate(${rotation}deg) translateY(-50%) scale(${scale})`,
                            transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), right 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                          }}
                          onMouseEnter={() => setHoveredLogoIndex(actualIndex)}
                          onClick={(e) => handleLogoClick(provider, e)}
                        >
                          <ProviderLogo
                            logo={provider.logo}
                            name={provider.name}
                            color="transparent"
                            size={28}
                            className="pointer-events-none"
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </button>

          {/* Proxies - Clickable */}
          <button
            onClick={() => navigate('/proxies')}
            className="bg-card rounded-xl p-4 border border-border/50 shadow-sm hover:border-purple-500/30 hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Boxes className="h-4 w-4 text-purple-500" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {t('dashboard.proxies')}
                </h3>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums">{proxies.length + passthroughProviders.length}</div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span>{proxies.length} {t('dashboard.conversionProxy')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  <span>{passthroughProviders.length} {t('dashboard.passthroughProxy')}</span>
                </div>
              </div>
            </div>
          </button>

          {/* Token Usage */}
          <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-emerald-500/10">
                <Coins className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Token Usage</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums">
                  {formatNumber((metrics?.totalInputTokens ?? 0) + (metrics?.totalOutputTokens ?? 0))}
                </span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">{t('dashboard.inputTokens')}</span>
                  <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {formatNumber(metrics?.totalInputTokens ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">{t('dashboard.outputTokens')}</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatNumber(metrics?.totalOutputTokens ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* API Keys (only when auth enabled) */}
          {unifiedKeyEnabled && (
          <div className="bg-card rounded-xl p-6 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10">
                  <Key className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{t('dashboard.availableKeys')}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {apiKeys.length > 0 
                      ? `${apiKeys.length} ${apiKeys.length === 1 ? 'key' : 'keys'} ${t('common.enabled')}`
                      : t('dashboard.noKeysDesc')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/settings?section=security')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-sm font-medium group"
              >
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {t('dashboard.manageKeys') || '管理密钥'}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
                  <Key className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-base font-medium text-foreground mb-2">
                  {t('dashboard.noKeys')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.noKeysDesc') || '鉴权已开启，但还没有配置 API 密钥'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {apiKeys.slice(0, 6).map((key) => {
                  const maskedKey = `${key.key.substring(0, 9)}${'•'.repeat(16)}${key.key.substring(key.key.length - 4)}`
                  return (
                    <div
                      key={key.id}
                      className="group relative p-4 rounded-lg border border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {key.name}
                          </p>
                          <button
                            onClick={() => handleCopyKey(key.key, key.name)}
                            className="flex-shrink-0 p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100"
                            title={t('common.copy')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {maskedKey}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {apiKeys.length > 6 && (
                  <button
                    onClick={() => navigate('/settings?section=security')}
                    className="p-4 rounded-lg border border-dashed border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-blue-500"
                  >
                    <ArrowRight className="h-5 w-5" />
                    <span className="text-xs font-medium">
                      {t('dashboard.moreKeys') || `还有 ${apiKeys.length - 6} 个`}
                    </span>
                  </button>
          )}
        </div>
            )}
          </div>
        )}

        {/* Model Usage Chart */}
        <div className="bg-card rounded-xl p-6 border border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-semibold">{t('dashboard.modelUsage')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.modelUsageDesc')}</p>
            </div>
          </div>
          <ModelUsageChart data={timeSeriesData} />
        </div>
      </div>
    </PageContainer>
  )
}

// ==================== Auth Toggle ====================
function AuthToggle({
  enabled,
  onChange,
  t
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  t: (key: string) => string
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-4 py-2.5 rounded-lg border bg-card shadow-sm transition-all",
      enabled ? "border-blue-500/20 bg-blue-500/5" : "border-border/50"
    )}>
      {enabled ? (
        <ShieldCheck className="h-4 w-4 text-blue-500" />
      ) : (
        <Shield className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={cn(
        "text-sm font-medium transition-colors",
        enabled ? "text-foreground" : "text-muted-foreground"
      )}>
        {t('settings.enableAuth')}
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-blue-500"
      />
    </div>
  )
}

// ==================== Service Status ====================
function ServiceStatus({
  status,
  host,
  port,
  t
}: {
  status: string
  host: string | null
  port: number | null
  t: (key: string) => string
}) {
  const isRunning = status === 'running'

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all shadow-sm',
        isRunning
          ? 'bg-green-500/5 border-green-500/20'
          : 'bg-muted/50 border-border/50'
      )}
    >
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          isRunning ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-muted-foreground/50'
        )}
      />
      <span className={cn(
        'text-sm font-medium',
        isRunning ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
      )}>
        {isRunning ? `${host}:${port}` : t('service.stopped')}
      </span>
    </div>
  )
}

// ==================== Stat Card ====================
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  pulse
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  pulse?: boolean
}) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border/50 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-1.5 rounded-md', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor, pulse && 'animate-pulse')} />
          </div>
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  )
}

// ==================== Model Usage Chart ====================
function ModelUsageChart({ data }: { data: TimeSeriesPoint[] }) {
  const [hiddenProxies, setHiddenProxies] = useState<Set<string>>(new Set())

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No data available</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Start making requests to see statistics</p>
        </div>
      </div>
    )
  }

  // 获取所有唯一的代理路径
  const allProxies = Array.from(new Set(data.map((d) => d.proxyPath))).sort()
  
  // 为每个代理分配颜色
  const proxyColorMap = new Map<string, ProxyColor>()
  allProxies.forEach((proxy, index) => {
    proxyColorMap.set(proxy, PROXY_COLORS[index % PROXY_COLORS.length])
  })

  // 按时间桶聚合数据（30分钟）
  const bucketSize = 30 * 60 * 1000
  const now = Date.now()
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000
  
  // 创建完整的 24 小时时间桶（48 个桶）
  const allBuckets = new Map<number, Map<string, TimeSeriesPoint[]>>()
  const startBucket = Math.floor(twentyFourHoursAgo / bucketSize) * bucketSize
  
  // 初始化所有时间桶
  for (let i = 0; i < 48; i++) {
    const bucketKey = startBucket + i * bucketSize
    allBuckets.set(bucketKey, new Map())
  }

  // 填充实际数据
  data.forEach((point) => {
    const bucketKey = Math.floor(point.timestamp / bucketSize) * bucketSize
    if (allBuckets.has(bucketKey)) {
      const proxyMap = allBuckets.get(bucketKey)!
      if (!proxyMap.has(point.proxyPath)) {
        proxyMap.set(point.proxyPath, [])
      }
      proxyMap.get(point.proxyPath)!.push(point)
    }
  })

  // 构建图表数据（包含所有时间桶）
  const chartData = Array.from(allBuckets.entries())
    .map(([timestamp, proxyMap]) => {
      const dataPoint: any = {
        timestamp,
        time: new Date(timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        _raw: proxyMap // 保存原始数据用于 tooltip
      }
      
      // 为每个代理添加计数（没有数据的为 0）
      allProxies.forEach((proxy) => {
        dataPoint[proxy] = proxyMap.has(proxy) ? proxyMap.get(proxy)!.length : 0
      })
      
      return dataPoint
    })
    .sort((a, b) => a.timestamp - b.timestamp)

  // 处理图例点击
  const handleLegendClick = (dataKey: string) => {
    setHiddenProxies((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey)
      } else {
        newSet.add(dataKey)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-3">
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Requests', angle: -90, position: 'insideLeft', fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip 
              content={<CustomTooltip proxyColorMap={proxyColorMap} hiddenProxies={hiddenProxies} />}
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
            />
            <Legend
              content={
                <CustomLegend
                  proxyColorMap={proxyColorMap}
                  hiddenProxies={hiddenProxies}
                  onLegendClick={handleLegendClick}
                />
              }
            />
            {allProxies.map((proxy) => {
              const color = proxyColorMap.get(proxy)
              if (!color) return null
              return (
                <Bar
                  key={proxy}
                  dataKey={proxy}
                  stackId="stack"
                  fill={color.main}
                  radius={[0, 0, 0, 0]}
                  hide={hiddenProxies.has(proxy)}
                  minPointSize={0}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ==================== Custom Legend ====================
function CustomLegend({
  payload,
  proxyColorMap,
  hiddenProxies,
  onLegendClick
}: any) {
  if (!payload || payload.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border/50">
      {payload.map((entry: any) => {
        const isHidden = hiddenProxies.has(entry.value)
        const color = proxyColorMap.get(entry.value)
        
        return (
          <button
            key={entry.value}
            onClick={() => onLegendClick(entry.value)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              isHidden
                ? 'bg-muted text-muted-foreground opacity-50'
                : 'bg-card border border-border hover:bg-accent'
            )}
          >
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: isHidden ? 'currentColor' : color?.main }}
            />
            <span className="max-w-[150px] truncate">{entry.value}</span>
          </button>
        )
      })}
    </div>
  )
}

// ==================== Compact Tooltip ====================
function CustomTooltip({ active, payload, proxyColorMap, hiddenProxies }: any) {
  if (!active || !payload || !payload[0]) {
    return null
  }

  const data = payload[0].payload
  const rawProxyMap: Map<string, TimeSeriesPoint[]> = data._raw || new Map()
  
  // 过滤掉隐藏的代理
  const proxyMap = new Map<string, TimeSeriesPoint[]>()
  rawProxyMap.forEach((points, proxyPath) => {
    if (!hiddenProxies.has(proxyPath)) {
      proxyMap.set(proxyPath, points)
    }
  })

  // 计算汇总统计
  const totalRequests = Array.from(proxyMap.values()).reduce((sum, points) => sum + points.length, 0)
  const allPoints = Array.from(proxyMap.values()).flat()
  const totalInputTokens = allPoints.reduce((sum, p) => sum + p.inputTokens, 0)
  const totalOutputTokens = allPoints.reduce((sum, p) => sum + p.outputTokens, 0)
  const avgLatency = allPoints.length > 0 
    ? Math.round(allPoints.reduce((sum, p) => sum + p.latency, 0) / allPoints.length)
    : 0
  const successCount = allPoints.filter(p => p.success).length
  const successRate = allPoints.length > 0 
    ? Math.round((successCount / allPoints.length) * 100)
    : 100

  if (totalRequests === 0) return null

  // 按请求数排序代理
  const sortedProxies = Array.from(proxyMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5) // 最多显示前5个

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl overflow-hidden w-[320px]">
      {/* Compact Header */}
      <div className="bg-muted/20 px-3 py-2 border-b border-border/30 flex items-center justify-between">
        <span className="text-sm font-semibold">{data.time}</span>
        <span className="text-xs font-medium text-muted-foreground">
          {totalRequests} req{totalRequests > 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="p-3 border-b border-border/30">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between bg-muted/20 px-2 py-1.5 rounded">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-medium tabular-nums">
              {formatNumber(totalInputTokens + totalOutputTokens)}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted/20 px-2 py-1.5 rounded">
            <span className="text-muted-foreground">Latency</span>
            <span className="font-medium tabular-nums">{avgLatency}ms</span>
          </div>
          <div className="flex items-center justify-between bg-muted/20 px-2 py-1.5 rounded">
            <span className="text-muted-foreground">In/Out</span>
            <span className="font-medium tabular-nums text-[10px]">
              {formatNumber(totalInputTokens)}/{formatNumber(totalOutputTokens)}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted/20 px-2 py-1.5 rounded">
            <span className="text-muted-foreground">Success</span>
            <span className={cn(
              'font-medium tabular-nums',
              successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500'
            )}>
              {successRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Top Proxies */}
      <div className="p-3">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Top Proxies</div>
        <div className="space-y-1.5">
          {sortedProxies.map(([proxyPath, points]) => {
            const color = proxyColorMap.get(proxyPath)
            const percentage = Math.round((points.length / totalRequests) * 100)
            
            // 找出最常用的模型组合
            const modelCombos = new Map<string, number>()
            points.forEach(p => {
              const key = `${p.sourceModel}→${p.targetModel}`
              modelCombos.set(key, (modelCombos.get(key) || 0) + 1)
            })
            const topModel = Array.from(modelCombos.entries())
              .sort((a, b) => b[1] - a[1])[0]?.[0] || ''

            return (
              <div key={proxyPath} className="flex items-center gap-2 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: color?.main }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate text-[11px]">{proxyPath}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {points.length} ({percentage}%)
                    </span>
                  </div>
                  {topModel && (
                    <div className="text-[10px] text-muted-foreground/70 font-mono truncate">
                      {topModel}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {proxyMap.size > 5 && (
            <div className="text-[10px] text-muted-foreground/50 text-center pt-1">
              +{proxyMap.size - 5} more proxies
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}
