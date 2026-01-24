/**
 * OAuth Account List Component
 * 
 * Display and manage OAuth accounts
 */

import { 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  BarChart3,
  User,
  Crown,
  Sparkles,
  Building2,
  Circle,
  Loader2,
  Clock
} from 'lucide-react'
import { useState, useEffect } from 'react'

import { CodexIcon, AntigravityIcon } from '@/components/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'
import type { OAuthAccount, OAuthProviderType, CodexUsageStats, AntigravityQuotaInfo, OAuthAccountStats, OAuthStatsTimeRange } from '@/types/oauth'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/**
 * 格式化剩余时间
 */
function formatTimeRemaining(resetTime: string): string {
  const targetDate = new Date(resetTime)
  const now = new Date()
  const diffMs = targetDate.getTime() - now.getTime()

  if (diffMs <= 0) return '0h 0m'

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  // 如果超过 24 小时，显示天数
  if (diffHrs >= 24) {
    const diffDays = Math.floor(diffHrs / 24)
    const remainingHrs = diffHrs % 24
    return `${diffDays}d ${remainingHrs}h`
  }

  // 如果超过 1 小时，显示小时 + 分钟
  if (diffHrs > 0) {
    return `${diffHrs}h ${diffMins}m`
  }

  // 小于 1 小时，只显示分钟
  return `${diffMins}m`
}

/**
 * 单个模型配额卡片（带自动倒计时）
 */
interface ModelQuotaCardProps {
  model: {
    name: string
    percentage: number
    reset_time: string
  }
  isHighQuota: boolean
  isLowQuota: boolean
}

function ModelQuotaCard({ model, isHighQuota, isLowQuota }: ModelQuotaCardProps) {
  // 使用 state 来存储倒计时，每分钟更新一次
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(model.reset_time))

  useEffect(() => {
    // 立即更新一次
    setTimeRemaining(formatTimeRemaining(model.reset_time))

    // 每 30 秒更新一次倒计时
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(model.reset_time))
    }, 30000)

    return () => clearInterval(interval)
  }, [model.reset_time])

  return (
    <div className="space-y-0.5 p-1.5 rounded bg-background/40 border border-border/30">
      {/* Model Name & Percentage */}
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[7px] text-foreground/90 truncate font-medium flex-1">
          {model.name}
        </span>
        <span className={cn(
          "font-bold font-mono text-[7.5px] px-0.5 py-0.5 rounded shrink-0",
          isHighQuota 
            ? "text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20" 
            : isLowQuota
            ? "text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20"
            : "text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20"
        )}>
          {model.percentage}%
        </span>
      </div>
      
      {/* Progress Bar & Reset Time */}
      <div className="flex items-center gap-1">
        <Progress 
          value={model.percentage} 
          className={cn(
            "h-0.5 flex-1",
            isLowQuota && "[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-orange-500",
            isHighQuota && "[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-emerald-500",
            !isLowQuota && !isHighQuota && "[&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-purple-500"
          )}
        />
        <div className="flex items-center gap-0.5 text-[6px] text-muted-foreground/70 shrink-0">
          <Clock className="h-1.5 w-1.5" />
          <span className="font-medium">
            {timeRemaining}
          </span>
        </div>
      </div>
    </div>
  )
}

interface OAuthAccountListProps {
  accounts: OAuthAccount[]
  providerType: OAuthProviderType
  onDelete: (accountId: string) => void
  onRefreshToken: (accountId: string) => void
  onTogglePoolEnabled: (accountId: string, enabled: boolean) => void
  onUpdateQuota: (accountId: string) => void
}

export function OAuthAccountList({
  accounts,
  providerType,
  onDelete,
  onRefreshToken,
  onTogglePoolEnabled,
  onUpdateQuota
}: OAuthAccountListProps) {
  const { t } = useI18n()
  const providerName = providerType === 'codex' ? t('oauth.openai') : t('oauth.google')
  
  // ✅ 统一的时间范围状态（所有卡片共享）
  // 从 localStorage 读取上次选择的时间范围，默认为 'today'
  const [timeRange, setTimeRange] = useState<OAuthStatsTimeRange>(() => {
    const saved = localStorage.getItem('oauth-stats-time-range')
    if (saved && ['today', 'week', 'month', 'total'].includes(saved)) {
      return saved as OAuthStatsTimeRange
    }
    return 'today'
  })
  
  // ✅ 当时间范围改变时，保存到 localStorage
  const handleTimeRangeChange = (value: string) => {
    if (value) {
      const newRange = value as OAuthStatsTimeRange
      setTimeRange(newRange)
      localStorage.setItem('oauth-stats-time-range', newRange)
    }
  }
  
  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1.5">{t('oauth.noAccounts')}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t('oauth.noAccountsDesc').replace('{provider}', providerName)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ✅ 统一的时间范围选择器 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t('oauth.stats.localCalls')}
          </span>
        </div>
        
        <ToggleGroup 
          type="single" 
          value={timeRange} 
          onValueChange={handleTimeRangeChange}
          className="gap-1"
        >
          <ToggleGroupItem 
            value="today" 
            className="h-7 px-3 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {t('oauth.stats.today')}
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="week" 
            className="h-7 px-3 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {t('oauth.stats.week')}
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="month" 
            className="h-7 px-3 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {t('oauth.stats.month')}
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="total" 
            className="h-7 px-3 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {t('oauth.stats.total')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      {/* 账号卡片网格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 auto-rows-fr">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            providerType={providerType}
            timeRange={timeRange}
            onDelete={() => onDelete(account.id)}
            onRefreshToken={() => onRefreshToken(account.id)}
            onTogglePoolEnabled={(enabled) => onTogglePoolEnabled(account.id, enabled)}
            onUpdateQuota={() => onUpdateQuota(account.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface AccountCardProps {
  account: OAuthAccount
  providerType: OAuthProviderType
  timeRange: OAuthStatsTimeRange
  onDelete: () => void
  onRefreshToken: () => void
  onTogglePoolEnabled: (enabled: boolean) => void
  onUpdateQuota: () => void
}

function AccountCard({
  account,
  providerType,
  timeRange,
  onDelete,
  onRefreshToken,
  onTogglePoolEnabled,
  onUpdateQuota
}: AccountCardProps) {
  const { t } = useI18n()
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const healthColor = getHealthColor(account.health_status)
  
  // 解析等级信息
  const metadata = account.provider_metadata ? JSON.parse(account.provider_metadata) : {}
  
  // ✅ 对于 Antigravity，从 quota_info 中获取 subscription_tier
  let planType = 'unknown'
  if (providerType === 'codex') {
    planType = metadata.plan_type || 'unknown'
  } else if (providerType === 'antigravity') {
    const quotaInfo = account.quota_info ? JSON.parse(account.quota_info) : {}
    planType = quotaInfo.subscription_tier || metadata.subscription_tier || 'unknown'
  }

  const ProviderLogo = providerType === 'codex' ? CodexIcon : AntigravityIcon
  
  // 统一刷新函数：同时刷新统计和配额
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      // 1. 刷新 Token（自动刷新统计）
      await onRefreshToken()
      
      // 2. 如果是 Antigravity，也刷新配额
      if (providerType === 'antigravity') {
        await onUpdateQuota()
      }
    } catch (error) {
      console.error('Failed to refresh account:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className={cn(
      "group relative p-3 rounded-lg bg-card border transition-all hover:shadow-md hover:border-primary/30 flex flex-col h-full overflow-hidden",
      account.is_active ? 'border-border' : 'opacity-60 border-border/50'
    )}>
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/3 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
      
      <div className="relative space-y-2.5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          {/* Provider Logo */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center border border-border/50 group-hover:border-primary/30 transition-all">
            <ProviderLogo className="w-5 h-5" />
          </div>
          
          {/* Account Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="font-semibold text-sm truncate">{account.email}</div>
              {getPlanBadge(providerType, planType)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {/* Health Status Indicator */}
              <div className="flex items-center gap-1">
                <Circle 
                  className={cn(
                    "h-1.5 w-1.5 fill-current",
                    healthColor.text
                  )} 
                />
                <span className={cn("text-[10px] font-medium", healthColor.text)}>
                  {t(`oauth.accountCard.healthStatus.${account.health_status}`)}
                </span>
              </div>
              {account.is_active === 0 && (
                <>
                  <span className="text-muted-foreground text-[10px]">•</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t('oauth.accountCard.inactive')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {account.error_message && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-destructive/8 border border-destructive/15">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-destructive" />
            <span className="text-[10px] text-destructive leading-relaxed">{account.error_message}</span>
          </div>
        )}

        {/* Stats/Quota */}
        <div className="flex-1 flex flex-col">
          {/* Codex Free 账号：只显示警告，不显示统计 */}
          {providerType === 'codex' && planType === 'free' ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-[9px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-md border border-amber-200/50 dark:border-amber-800/30">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{t('oauth.quota.codex.freeAccountWarning')}</span>
              </div>
            </div>
          ) : (
            <>
              {/* 本地调用统计（非 Codex Free 账号都显示） */}
              <div className="flex-1">
                <OAuthLocalStatsDisplay 
                  accountId={account.id} 
                  providerType={providerType}
                  timeRange={timeRange}
                  quotaInfo={providerType === 'antigravity' && account.quota_info ? JSON.parse(account.quota_info) : undefined}
                />
              </div>
              
              {/* Codex 特定信息 */}
              {providerType === 'codex' && (
                <div className="text-[8px] text-muted-foreground/60 flex items-center gap-1 px-2 pt-2 mt-auto">
                  <AlertCircle className="h-2 w-2 flex-shrink-0" />
                  <span className="leading-tight">{t('oauth.quota.codex.noOfficialQuota')}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-auto">
          <label className="flex items-center gap-1.5 cursor-pointer group">
            <Switch
              checked={account.pool_enabled === 1}
              onCheckedChange={onTogglePoolEnabled}
              disabled={account.is_active === 0}
              className="scale-75"
            />
            <span className="text-[9px] text-muted-foreground/80 group-hover:text-foreground transition-colors font-medium">
              {t('oauth.accountCard.poolEnabled')}
            </span>
          </label>

          <div className="flex items-center gap-0.5">
            {/* 统一刷新按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 hover:text-primary transition-all"
              title={t('oauth.accountCard.refreshAll')}
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('oauth.accountCard.deleteConfirm')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('oauth.accountCard.deleteConfirmDesc').replace('{email}', account.email)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={onDelete} 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * OAuth 账号本地调用统计展示组件
 */
interface OAuthLocalStatsDisplayProps {
  accountId: string
  providerType: OAuthProviderType
  timeRange: OAuthStatsTimeRange
  quotaInfo?: AntigravityQuotaInfo  // Antigravity 配额信息
}

function OAuthLocalStatsDisplay({ accountId, providerType, timeRange, quotaInfo }: OAuthLocalStatsDisplayProps) {
  const { t } = useI18n()
  const [stats, setStats] = useState<OAuthAccountStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadStats(timeRange)
  }, [accountId, timeRange])
  
  const loadStats = async (range: OAuthStatsTimeRange) => {
    setLoading(true)
    try {
      const data = await ipc.invoke('oauth:get-account-stats', accountId, range)
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 辅助函数：获取时间范围标签
  const getTimeRangeLabel = (range: OAuthStatsTimeRange): string => {
    switch (range) {
      case 'today':
        return t('oauth.stats.today')
      case 'week':
        return t('oauth.stats.thisWeek')
      case 'month':
        return t('oauth.stats.thisMonth')
      case 'total':
        return t('oauth.stats.cumulative')
    }
  }
  
  const hasData = stats && stats.requestCount > 0
  
  return (
    <div className={cn(
      "rounded-lg bg-gradient-to-br from-blue-50/40 to-cyan-50/40 dark:from-blue-950/15 dark:to-cyan-950/15 border border-blue-100/40 dark:border-blue-900/25",
      hasData ? "space-y-2 p-2.5" : "space-y-1.5 p-2"
    )}>
      {/* Header - 简化版，只保留刷新按钮 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-foreground/70">
          {getTimeRangeLabel(timeRange)}
        </span>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => loadStats(timeRange)} 
          className="h-5 w-5 p-0 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </Button>
      </div>
      
      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : hasData ? (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-2">
            {/* Requests */}
            <div className="space-y-0.5">
              <div className="text-[9px] text-muted-foreground/70 font-medium">
                {getTimeRangeLabel(timeRange)}{t('oauth.stats.requests')}
              </div>
              <div className="font-mono font-semibold text-sm text-blue-600 dark:text-blue-400">
                {stats.requestCount.toLocaleString()}
              </div>
              <div className="text-[8px] text-muted-foreground/60">
                {t('oauth.stats.successRate')}: {stats.successRate}%
              </div>
            </div>
            
            {/* Tokens */}
            <div className="space-y-0.5">
              <div className="text-[9px] text-muted-foreground/70 font-medium">
                {getTimeRangeLabel(timeRange)}{t('oauth.stats.tokens')}
              </div>
              <div className="font-mono font-semibold text-sm text-cyan-600 dark:text-cyan-400">
                {stats.totalTokens.toLocaleString()}
              </div>
              <div className="text-[8px] text-muted-foreground/60">
                {stats.inputTokens.toLocaleString()} / {stats.outputTokens.toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Last Used (不在 Total 模式显示) */}
          {stats.lastUsedAt && timeRange !== 'total' && (
            <div className="text-[8px] text-muted-foreground/60 pt-1.5 border-t border-border/20 leading-tight">
              {t('oauth.stats.lastUsed')}: {new Date(stats.lastUsedAt).toLocaleString()}
            </div>
          )}
          
          {/* ✅ Antigravity: 在统计信息后显示配额信息 */}
          {quotaInfo && providerType === 'antigravity' && (
            <>
              {quotaInfo.is_forbidden ? (
                <div className="pt-2 border-t border-border/20">
                  <div className="flex items-center gap-1.5 p-2 rounded bg-destructive/5 border border-destructive/20">
                    <Ban className="h-3 w-3 text-destructive flex-shrink-0" />
                    <span className="text-destructive font-medium text-[9px]">{t('oauth.quota.antigravity.forbidden')}</span>
                  </div>
                </div>
              ) : quotaInfo.models && quotaInfo.models.length > 0 ? (
                <div className="pt-2 border-t border-border/20">
                  <AntigravityQuotaSection quotaInfo={quotaInfo} />
                </div>
              ) : (
                <div className="pt-2 border-t border-border/20">
                  <div className="p-2 rounded bg-muted/20 border border-border/30">
                    <span className="text-[9px] text-muted-foreground">{t('oauth.quota.antigravity.noQuota')}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-center py-2">
            <div className="text-center space-y-0.5">
              <BarChart3 className="h-4 w-4 mx-auto text-muted-foreground/30" />
              <div className="text-[9px] text-muted-foreground/70 font-medium">
                {t('oauth.stats.noData')}
              </div>
              <div className="text-[7px] text-muted-foreground/50">
                {t('oauth.stats.tryOtherRange')}
              </div>
            </div>
          </div>
          
          {/* ✅ Antigravity: 即使无统计数据，也显示配额信息 */}
          {quotaInfo && providerType === 'antigravity' && (
            <>
              {quotaInfo.is_forbidden ? (
                <div className="pt-2 border-t border-border/20">
                  <div className="flex items-center gap-1.5 p-2 rounded bg-destructive/5 border border-destructive/20">
                    <Ban className="h-3 w-3 text-destructive flex-shrink-0" />
                    <span className="text-destructive font-medium text-[9px]">{t('oauth.quota.antigravity.forbidden')}</span>
                  </div>
                </div>
              ) : quotaInfo.models && quotaInfo.models.length > 0 ? (
                <div className="pt-2 border-t border-border/20">
                  <AntigravityQuotaSection quotaInfo={quotaInfo} />
                </div>
              ) : (
                <div className="pt-2 border-t border-border/20">
                  <div className="p-2 rounded bg-muted/20 border border-border/30">
                    <span className="text-[9px] text-muted-foreground">{t('oauth.quota.antigravity.noQuota')}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function CodexUsageDisplay({ usageStats }: { usageStats: CodexUsageStats }) {
  const { t } = useI18n()
  const todayRequests = usageStats.today?.requests || 0
  const todayPromptTokens = usageStats.today?.prompt_tokens || 0
  const todayCompletionTokens = usageStats.today?.completion_tokens || 0
  const todayTotalTokens = todayPromptTokens + todayCompletionTokens
  const totalRequests = usageStats.total_requests || 0

  return (
    <div className="space-y-2 p-2.5 rounded-lg bg-gradient-to-br from-emerald-50/40 to-teal-50/40 dark:from-emerald-950/15 dark:to-teal-950/15 border border-emerald-100/40 dark:border-emerald-900/25">
      {/* Main Stats - Horizontal Layout */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[9px] text-muted-foreground/70 font-medium">{t('oauth.quota.codex.todayRequests')}</div>
            <div className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">
              {todayRequests}
            </div>
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div>
            <div className="text-[9px] text-muted-foreground/70 font-medium">{t('oauth.quota.codex.todayTokens')}</div>
            <div className="font-mono font-semibold text-sm text-teal-600 dark:text-teal-400">
              {todayTotalTokens.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-muted-foreground/70">{t('oauth.quota.codex.cumulative')}</div>
          <div className="font-mono text-[10px] font-semibold text-foreground/70">
            {totalRequests.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-[8px] text-muted-foreground/60 pt-1.5 border-t border-border/20 flex items-center gap-1">
        <AlertCircle className="h-2 w-2 flex-shrink-0" />
        <span className="leading-tight">{t('oauth.quota.codex.noOfficialQuota')}</span>
      </div>
    </div>
  )
}


/**
 * Antigravity 配额信息区块（整合在统计卡片内）
 */
interface AntigravityQuotaSectionProps {
  quotaInfo: AntigravityQuotaInfo
}

function AntigravityQuotaSection({ quotaInfo }: AntigravityQuotaSectionProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-1.5">
      {/* Header - Inline */}
      <div className="flex items-center gap-1.5">
        <div className="w-0.5 h-2.5 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" />
        <span className="text-[9px] font-semibold text-foreground/80">
          {t('oauth.quota.antigravity.modelQuotas')}
        </span>
        <span className="text-[7px] font-medium text-muted-foreground/60 bg-muted/40 px-1 py-0.5 rounded">
          {quotaInfo.models.length}
        </span>
      </div>

      {/* Models Grid - 显示所有模型，无折叠 */}
      <div className="grid grid-cols-2 gap-1.5">
        {quotaInfo.models.map((model) => {
          const isHighQuota = model.percentage >= 80
          const isLowQuota = model.percentage < 20
          
          return (
            <ModelQuotaCard 
              key={model.name}
              model={model}
              isHighQuota={isHighQuota}
              isLowQuota={isLowQuota}
            />
          )
        })}
      </div>

      {/* Footer - 更新时间 */}
      <div className="flex items-center gap-1 text-[7px] text-muted-foreground/50 pt-0.5">
        <span className="truncate">
          {t('oauth.quota.antigravity.updated')}: {new Date(quotaInfo.last_updated).toLocaleString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  )
}

function getHealthIcon(status: string) {
  const className = "h-4 w-4"
  switch (status) {
    case 'active':
      return <CheckCircle2 className={cn(className, "text-green-600 dark:text-green-400")} />
    case 'rate_limited':
      return <AlertCircle className={cn(className, "text-yellow-600 dark:text-yellow-400")} />
    case 'expired':
      return <AlertCircle className={cn(className, "text-orange-600 dark:text-orange-400")} />
    case 'forbidden':
      return <Ban className={cn(className, "text-red-600 dark:text-red-400")} />
    case 'error':
      return <XCircle className={cn(className, "text-red-600 dark:text-red-400")} />
    default:
      return <AlertCircle className={cn(className, "text-gray-600 dark:text-gray-400")} />
  }
}

function getHealthColor(status: string) {
  switch (status) {
    case 'active':
      return { 
        bg: 'bg-green-100 dark:bg-green-900/30', 
        text: 'text-green-700 dark:text-green-400' 
      }
    case 'rate_limited':
      return { 
        bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
        text: 'text-yellow-700 dark:text-yellow-400' 
      }
    case 'expired':
      return { 
        bg: 'bg-orange-100 dark:bg-orange-900/30', 
        text: 'text-orange-700 dark:text-orange-400' 
      }
    case 'forbidden':
      return { 
        bg: 'bg-red-100 dark:bg-red-900/30', 
        text: 'text-red-700 dark:text-red-400' 
      }
    case 'error':
      return { 
        bg: 'bg-red-100 dark:bg-red-900/30', 
        text: 'text-red-700 dark:text-red-400' 
      }
    default:
      return { 
        bg: 'bg-gray-100 dark:bg-gray-900/30', 
        text: 'text-gray-700 dark:text-gray-400' 
      }
  }
}

function getPlanBadge(providerType: OAuthProviderType, planType: string) {
  if (providerType === 'codex') {
    switch (planType.toLowerCase()) {
      case 'chatgptplusplan':
      case 'plus':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 text-[9px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
            <Crown className="h-2 w-2" />
            Plus
          </Badge>
        )
      case 'team':
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 text-[9px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
            <Building2 className="h-2 w-2" />
            Team
          </Badge>
        )
      case 'enterprise':
        return (
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-[9px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
            <Sparkles className="h-2 w-2" />
            Enterprise
          </Badge>
        )
      case 'free':
        return (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-medium">
            Free
          </Badge>
        )
      default:
        return null
    }
  } else if (providerType === 'antigravity') {
    // Antigravity: ULTRA / PRO / FREE
    const tier = planType.toLowerCase()
    
    if (tier.includes('ultra')) {
      return (
        <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 text-[9px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
          <Sparkles className="h-2 w-2 fill-current" />
          ULTRA
        </Badge>
      )
    } else if (tier.includes('pro')) {
      return (
        <Badge className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 text-[9px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
          <Crown className="h-2 w-2 fill-current" />
          PRO
        </Badge>
      )
    } else if (tier === 'free') {
      return (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-medium flex items-center gap-0.5">
          <Circle className="h-2 w-2" />
          FREE
        </Badge>
      )
    }
    return null
  }
  
  return null
}
