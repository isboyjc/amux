import { useEffect } from 'react'
import { useProxyStore, useProviderStore, useBridgeProxyStore } from '@/stores'
import { useI18n } from '@/stores/i18n-store'
import { PageContainer } from '@/components/layout'
import { Activity, Server, Network, Zap, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dashboard() {
  const { status, port, host, metrics, fetchMetrics } = useProxyStore()
  const { providers, fetch: fetchProviders } = useProviderStore()
  const { proxies, fetch: fetchProxies } = useBridgeProxyStore()
  const { t } = useI18n()

  useEffect(() => {
    fetchProviders()
    fetchProxies()
    fetchMetrics()

    const interval = setInterval(() => {
      fetchMetrics()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchProviders, fetchProxies, fetchMetrics])

  const enabledProviders = providers.filter(p => p.enabled).length
  const enabledProxies = proxies.filter(p => p.enabled).length
  const successRate = metrics && metrics.totalRequests > 0
    ? Math.round((metrics.successRequests / metrics.totalRequests) * 100)
    : 100

  return (
    <PageContainer>
      <div className="space-y-8 animate-fade-in">
        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('dashboard.description')}
            </p>
          </div>
          <ServiceStatus status={status} host={host} port={port} t={t} />
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label={t('dashboard.totalRequests')}
            value={metrics?.totalRequests ?? 0}
            icon={Activity}
            trend={metrics?.requestsPerMinute ? `${metrics.requestsPerMinute}/min` : undefined}
            trendUp={true}
          />
          <MetricCard
            label={t('dashboard.successRate')}
            value={`${successRate}%`}
            icon={TrendingUp}
            color={successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'danger'}
          />
          <MetricCard
            label={t('dashboard.avgLatency')}
            value={`${metrics?.averageLatency ?? 0}ms`}
            icon={Zap}
          />
          <MetricCard
            label={t('dashboard.activeConnections')}
            value={metrics?.activeConnections ?? 0}
            icon={Network}
          />
        </div>

        {/* Resources & Tokens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Providers */}
          <ResourceCard
            title={t('dashboard.providers')}
            total={providers.length}
            enabled={enabledProviders}
            icon={Server}
            color="blue"
          />
          
          {/* Proxies */}
          <ResourceCard
            title={t('dashboard.proxies')}
            total={proxies.length}
            enabled={enabledProxies}
            icon={Network}
            color="purple"
          />
          
          {/* Tokens Summary */}
          <div className="bg-gradient-to-br from-card to-card/80 rounded-xl p-5 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">Token Usage</span>
            </div>
            <div className="space-y-3">
              <TokenBar
                label={t('dashboard.inputTokens')}
                value={metrics?.totalInputTokens ?? 0}
                color="bg-blue-500"
              />
              <TokenBar
                label={t('dashboard.outputTokens')}
                value={metrics?.totalOutputTokens ?? 0}
                color="bg-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex items-center justify-center gap-8 py-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            {t('dashboard.enabledCount').replace('{count}', String(enabledProviders))} {t('dashboard.providers').toLowerCase()}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500"></span>
            {t('dashboard.enabledCount').replace('{count}', String(enabledProxies))} {t('dashboard.proxies').toLowerCase()}
          </span>
        </div>
      </div>
    </PageContainer>
  )
}

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
    <div className={cn(
      'flex items-center gap-3 px-4 py-2 rounded-full border transition-colors',
      isRunning 
        ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
        : 'bg-muted border-border text-muted-foreground'
    )}>
      <span className={cn(
        'h-2 w-2 rounded-full',
        isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
      )} />
      <span className="text-sm font-medium">
        {isRunning ? `${host}:${port}` : t('service.stopped')}
      </span>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  color
}: {
  label: string
  value: string | number
  icon: React.ElementType
  trend?: string
  trendUp?: boolean
  color?: 'success' | 'warning' | 'danger'
}) {
  const colorClasses = {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500'
  }

  return (
    <div className="group bg-card rounded-xl p-5 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex items-end justify-between">
        <span className={cn(
          'text-2xl font-bold tabular-nums',
          color && colorClasses[color]
        )}>
          {value}
        </span>
        {trend && (
          <span className={cn(
            'flex items-center gap-0.5 text-xs',
            trendUp ? 'text-green-500' : 'text-muted-foreground'
          )}>
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

function ResourceCard({
  title,
  total,
  enabled,
  icon: Icon,
  color
}: {
  title: string
  total: number
  enabled: number
  icon: React.ElementType
  color: 'blue' | 'purple'
}) {
  const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0
  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      bar: 'bg-blue-500'
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      bar: 'bg-purple-500'
    }
  }

  return (
    <div className="bg-card rounded-xl p-5 border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-lg', colorClasses[color].bg)}>
          <Icon className={cn('h-4 w-4', colorClasses[color].text)} />
        </div>
        <span className="text-3xl font-bold">{total}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{title}</span>
          <span className={cn('font-medium', colorClasses[color].text)}>{enabled} active</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full rounded-full transition-all duration-500', colorClasses[color].bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function TokenBar({
  label,
  value,
  color
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', color)} />
        <span className="text-sm font-medium tabular-nums">{formatNumber(value)}</span>
      </div>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}
