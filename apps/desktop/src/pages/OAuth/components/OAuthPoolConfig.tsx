/**
 * OAuth Pool Status Component
 * 
 * Display pool status statistics for OAuth accounts
 */

import React, { useState, useEffect } from 'react'
import { ipc } from '@/lib/ipc'
import { useI18n } from '@/stores/i18n-store'
import { Users, Activity, AlertCircle, XCircle } from 'lucide-react'
import type { OAuthProviderType, OAuthPoolStats } from '@/types/oauth'

interface OAuthPoolConfigProps {
  providerType: OAuthProviderType
  accountCount: number
}

export function OAuthPoolConfig({ providerType, accountCount }: OAuthPoolConfigProps) {
  const [stats, setStats] = useState<OAuthPoolStats | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    loadPoolStats()
  }, [providerType])

  const loadPoolStats = async () => {
    try {
      const result = await ipc.invoke('oauth:getPoolStats', providerType)
      if (result.success) {
        setStats(result.stats)
      }
    } catch (error: any) {
      console.error('Failed to load pool stats:', error)
    }
  }

  if (!stats) return null

  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: Title */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t('oauth.pool.accountStatus')}:
          </span>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-50 dark:bg-green-950/30">
            <Activity className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="font-semibold text-green-600 dark:text-green-400">{stats.active}</span>
          </div>
          {stats.inactive > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 dark:bg-gray-950/30">
              <Users className="h-3 w-3 text-gray-600 dark:text-gray-400" />
              <span className="font-semibold text-gray-600 dark:text-gray-400">{stats.inactive}</span>
            </div>
          )}
          {stats.rate_limited > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-950/30">
              <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.rate_limited}</span>
            </div>
          )}
          {stats.error > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30">
              <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
              <span className="font-semibold text-red-600 dark:text-red-400">{stats.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

