/**
 * Tunnel Page - Internet Penetration Management
 */

import { useState, useEffect, useRef } from 'react'
import {
  Globe,
  Clock,
  Play,
  Square,
  RefreshCw,
  Cloud,
  CloudOff,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react'

import { CopyIcon, CheckIcon } from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard, usePolling } from '@/hooks'
import { ipc } from '@/lib/ipc'
import { TUNNEL_STATUS_POLL_INTERVAL } from '@/lib/constants'
import { showSuccess, showError } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'

interface TunnelConfig {
  tunnelId: string
  subdomain: string
  domain: string
  credentials: any
}

interface TunnelStatus {
  isRunning: boolean
  status: 'active' | 'inactive' | 'starting' | 'stopping' | 'error'
  config?: TunnelConfig
  error?: string
  uptime?: number
}

export default function TunnelPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<TunnelStatus>({ isRunning: false, status: 'inactive' })
  const [loading, setLoading] = useState(false)
  const { copied, copy: copyToClipboard } = useCopyToClipboard({
    showToast: true,
    toastMessage: t('common.copied'),
    toastDescription: t('tunnel.messages.copySuccess'),
  })
  const copyIconRef = useRef<AnimatedIconHandle>(null)

  const loadStatus = async () => {
    try {
      const result = await ipc.invoke('tunnel:get-status')
      if (result.success) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  }

  // Load status on mount
  useEffect(() => {
    loadStatus()
  }, [])

  // Auto-refresh status when running (for uptime counter)
  usePolling(loadStatus, {
    interval: TUNNEL_STATUS_POLL_INTERVAL,
    enabled: status.isRunning,
    immediate: false, // Already loaded in useEffect above
  })

  const handleStart = async () => {
    setLoading(true)
    try {
      const result = await ipc.invoke('tunnel:start')
      if (result.success) {
        showSuccess(t('tunnel.messages.started'), {
          description: `${t('tunnel.info.publicUrl')}: ${result.data.domain}`,
        })
        await loadStatus()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      showError(t('tunnel.messages.error'), {
        description: error.message || t('common.error'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      const result = await ipc.invoke('tunnel:stop')
      if (result.success) {
        showSuccess(t('tunnel.messages.stopped'))
        await loadStatus()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      showError(t('tunnel.messages.error'), {
        description: error.message || t('common.error'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (status.config) {
      copyToClipboard(`https://${status.config.domain}`)
    }
  }

  const formatUptime = (ms?: number) => {
    if (!ms) return '0s'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const isRunning = status.status === 'active'
  const isTransitioning = status.status === 'starting' || status.status === 'stopping'

  return (
    <PageContainer>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('tunnel.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('tunnel.description')}</p>
          </div>
          <TunnelStatusBadge status={status.status} t={t} />
        </div>

        {/* Main Control Card */}
        <div className="bg-card rounded-lg border overflow-hidden">
          {/* Status Header */}
          <div className={cn(
            "px-5 py-4 border-b flex items-center justify-between",
            isRunning ? "bg-muted/30" : "bg-muted/20"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isRunning ? "bg-green-500/10" : "bg-muted"
              )}>
                {isRunning ? (
                  <Cloud className="h-5 w-5 text-green-500" />
                ) : (
                  <CloudOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="font-medium">{t('tunnel.statusTitle')}</div>
                <div className="text-sm text-muted-foreground">
                  {isRunning
                    ? t('tunnel.status.active')
                    : isTransitioning
                      ? t(`tunnel.status.${status.status}`) + '...'
                      : t('tunnel.status.inactive')
                  }
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadStatus}
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Public URL Display */}
            {status.config && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  {t('tunnel.info.publicUrl')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-3 px-4 h-9 bg-muted/50 rounded-md border">
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      isRunning
                        ? "bg-green-500 animate-pulse"
                        : "bg-muted-foreground/50"
                    )} />
                    <code className="text-sm font-mono flex-1 truncate">
                      https://{status.config.domain}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    onMouseEnter={() => !copied && copyIconRef.current?.startAnimation()}
                    onMouseLeave={() => !copied && copyIconRef.current?.stopAnimation()}
                    className="h-9 w-9 shrink-0"
                  >
                    {copied ? (
                      <CheckIcon size={16} success />
                    ) : (
                      <CopyIcon ref={copyIconRef} size={16} />
                    )}
                  </Button>
                  {isRunning && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(`https://${status.config?.domain}`, '_blank')}
                      className="h-9 w-9 shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Uptime Display */}
            {isRunning && (
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{t('tunnel.info.uptime')}</div>
                  <div className="text-sm font-medium mt-0.5">{formatUptime(status.uptime)}</div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {status.error && (
              <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <Info className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">{status.error}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              {!isRunning ? (
                <Button
                  onClick={handleStart}
                  disabled={loading || isTransitioning}
                  className="flex-1 h-10 gap-2"
                >
                  {isTransitioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isTransitioning ? t('tunnel.status.starting') + '...' : t('tunnel.actions.start')}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  disabled={loading || isTransitioning}
                  className="flex-1 h-10 gap-2"
                >
                  {isTransitioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {isTransitioning ? t('tunnel.status.stopping') + '...' : t('tunnel.actions.stop')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Usage Tips */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">{t('tunnel.usageTitle')}</h3>
          </div>
          <div className="space-y-2">
            <TipItem text={t('tunnel.usage.tip1')} />
            <TipItem text={t('tunnel.usage.tip2')} />
            <TipItem text={t('tunnel.usage.tip3')} />
            <TipItem text={t('tunnel.usage.tip4')} />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

// ==================== Status Badge ====================
function TunnelStatusBadge({
  status,
  t
}: {
  status: TunnelStatus['status']
  t: (key: string) => string
}) {
  const isRunning = status === 'active'
  const isTransitioning = status === 'starting' || status === 'stopping'
  const isError = status === 'error'

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium",
      isRunning
        ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
        : isError
          ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
          : isTransitioning
            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
            : "bg-muted/50 border-border text-muted-foreground"
    )}>
      <span className={cn(
        "h-2 w-2 rounded-full",
        isRunning
          ? "bg-green-500 animate-pulse"
          : isError
            ? "bg-red-500"
            : isTransitioning
              ? "bg-yellow-500 animate-pulse"
              : "bg-muted-foreground/50"
      )} />
      {t(`tunnel.status.${status}`)}
    </div>
  )
}

// ==================== Tip Item ====================
function TipItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
      <span className="text-muted-foreground leading-relaxed">{text}</span>
    </div>
  )
}
