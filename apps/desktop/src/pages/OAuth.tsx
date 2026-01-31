/**
 * 2API OAuth Page
 * 
 * OAuth account authorization and management for Codex and Antigravity
 */

import { Loader2, Plus } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { OAuthAccountList, AuthorizationDialog } from './OAuth/components'

import { CodexIcon, AntigravityIcon, KeyframesIcon } from '@/components/icons'
import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { ipc } from '@/lib/ipc'
import { useI18n } from '@/stores/i18n-store'
import type { OAuthProviderType, OAuthAccount } from '@/types/oauth'

export function OAuth() {
  // ✅ 从 localStorage 读取上次选择的厂商，默认为 'antigravity'
  const [activeTab, setActiveTab] = useState<OAuthProviderType>(() => {
    const saved = localStorage.getItem('oauth-active-tab')
    if (saved && ['antigravity', 'codex'].includes(saved)) {
      return saved as OAuthProviderType
    }
    return 'antigravity'
  })
  const [accounts, setAccounts] = useState<OAuthAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [authProcessing, setAuthProcessing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [authState, setAuthState] = useState<string | null>(null)
  const [checkingPool, setCheckingPool] = useState(false)
  const { toast } = useToast()
  const { t } = useI18n()
  const navigate = useNavigate()  // ✅ 添加导航

  // Load accounts
  useEffect(() => {
    loadAccounts(activeTab)
  }, [activeTab])
  
  // ✅ 当厂商 tab 改变时，保存到 localStorage
  const handleTabChange = (value: string) => {
    const newTab = value as OAuthProviderType
    setActiveTab(newTab)
    localStorage.setItem('oauth-active-tab', newTab)
  }

  const loadAccounts = async (providerType: OAuthProviderType) => {
    setLoading(true)
    try {
      const result = await ipc.invoke('oauth:getAccounts', providerType)
      if (result.success) {
        setAccounts(result.accounts)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.loadFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.loadFailed'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = async () => {
    try {
      // 只获取授权URL，不打开浏览器
      const result = await ipc.invoke('oauth:getAuthUrl', activeTab)

      if (result.success && result.authUrl && result.state) {
        setAuthUrl(result.authUrl)
        setAuthState(result.state)
        setDialogOpen(true)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.authUrlFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.authUrlFailed'),
        variant: 'destructive'
      })
    }
  }

  const handleStartAuthorization = async () => {
    setAuthProcessing(true)
    try {
      // 开始授权流程（仅创建账号，不自动生成 Provider）
      const result = await ipc.invoke('oauth:authorize', activeTab)

      if (result.success) {
        toast({
          title: t('common.success'),
          description: t('oauth.messages.authSuccess'),
        })
        handleDialogClose()
        await loadAccounts(activeTab)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.authFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.authFailed'),
        variant: 'destructive'
      })
    } finally {
      setAuthProcessing(false)
    }
  }

  const handleDialogClose = async () => {
    // 如果正在授权中，取消授权
    if (authProcessing && authState) {
      try {
        await ipc.invoke('oauth:cancelAuthorize', activeTab, authState)
      } catch (error) {
        console.error('Failed to cancel authorization:', error)
      }
    }
    
    // 重置状态
    setDialogOpen(false)
    setAuthUrl(null)
    setAuthState(null)
    setAuthProcessing(false)
    
    // Reload accounts to check if new one was added
    loadAccounts(activeTab)
  }

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const result = await ipc.invoke('oauth:deleteAccount', accountId, {
        deleteIndividualProvider: true,
        cleanupPool: true
      })

      if (result.success) {
        toast({
          title: t('common.success'),
          description: t('common.deleted'),
        })
        await loadAccounts(activeTab)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.deleteFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.deleteFailed'),
        variant: 'destructive'
      })
    }
  }

  const handleRefreshToken = async (accountId: string) => {
    try {
      const result = await ipc.invoke('oauth:refreshToken', accountId)

      if (result.success) {
        toast({
          title: t('common.success'),
          description: t('oauth.messages.refreshSuccess'),
        })
        await loadAccounts(activeTab)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.refreshFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.refreshFailed'),
        variant: 'destructive'
      })
    }
  }

  const handleTogglePoolEnabled = async (accountId: string, enabled: boolean) => {
    try {
      const result = await ipc.invoke('oauth:togglePoolEnabled', accountId, enabled)

      if (result.success) {
        toast({
          title: t('common.success'),
          description: t('oauth.messages.poolToggleSuccess'),
        })
        await loadAccounts(activeTab)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.poolToggleFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.poolToggleFailed'),
        variant: 'destructive'
      })
    }
  }

  const handleUpdateQuota = async (accountId: string) => {
    try {
      const result = await ipc.invoke('oauth:updateQuota', accountId)

      if (result.success) {
        toast({
          title: t('common.success'),
          description: t('oauth.messages.quotaUpdateSuccess'),
        })
        await loadAccounts(activeTab)
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.quotaUpdateFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.quotaUpdateFailed'),
        variant: 'destructive'
      })
    }
  }

  // 🆕 检测 Pool Provider
  const handleCheckPoolProvider = async () => {
    setCheckingPool(true)
    try {
      const result = await ipc.invoke('oauth:check-pool-provider', {
        providerType: activeTab
      })

      if (result.success) {
        if (result.exists) {
          toast({
            title: t('oauth.messages.poolProviderExists'),
            description: t('oauth.messages.poolProviderStatus')
              .replace('{active}', result.accountsStatus.active)
              .replace('{healthy}', result.accountsStatus.healthy),
          })
        } else {
          toast({
            title: t('oauth.messages.poolProviderCreated'),
            description: t('oauth.messages.poolProviderAccountsAdded')
              .replace('{count}', result.accountsStatus.active),
          })
        }
        // 导航已在主进程中自动完成
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('oauth.messages.poolProviderCheckFailed'),
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('oauth.messages.poolProviderCheckFailed'),
        variant: 'destructive'
      })
    } finally {
      setCheckingPool(false)
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col h-full space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{t('oauth.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('oauth.description')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Tab Switcher */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="inline-flex h-10 p-1 bg-muted">
                <TabsTrigger 
                  value="antigravity"
                  className="flex items-center gap-1.5 h-8 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <AntigravityIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('oauth.antigravity')}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="codex"
                  className="flex items-center gap-1.5 h-8 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <CodexIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('oauth.codex')}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* 检测 Pool Provider 按钮 */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleCheckPoolProvider} 
                    variant="outline" 
                    size="icon"
                    className="w-10 h-10"
                    disabled={checkingPool || accounts.length === 0}
                  >
                    {checkingPool ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyframesIcon size={16} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{t('oauth.checkPoolProvider')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* 添加账号按钮 */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleOpenDialog} 
                    size="icon"
                    className="w-10 h-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{t('oauth.addAccount')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Accounts List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <OAuthAccountList
              accounts={accounts}
              providerType={activeTab}
              onDelete={handleDeleteAccount}
              onRefreshToken={handleRefreshToken}
              onTogglePoolEnabled={handleTogglePoolEnabled}
              onUpdateQuota={handleUpdateQuota}
            />
          )}
        </div>

        {/* Authorization Dialog */}
        <AuthorizationDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          providerType={activeTab}
          authUrl={authUrl}
          isLoading={authProcessing}
          onAuthorize={handleStartAuthorization}
        />
      </div>
    </PageContainer>
  )
}
