/**
 * Code Switch Page
 * Allows users to configure Claude Code and Codex CLI to use different providers
 */

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Square } from 'lucide-react'
import { toast as showToast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CodeSwitchConfig } from './code-switch-config'
import type { CodeSwitchConfig as CodeSwitchConfigType } from '@/types'
import { useI18n } from '@/stores/i18n-store'

export default function CodeSwitch() {
  const { t } = useI18n()
  
  // 从 localStorage 读取上次选择的 CLI，默认为 'claudecode'
  const [activeTab, setActiveTab] = useState<'claudecode' | 'codex'>(() => {
    const saved = localStorage.getItem('code-switch-active-tab')
    if (saved && ['claudecode', 'codex'].includes(saved)) {
      return saved as 'claudecode' | 'codex'
    }
    return 'claudecode'
  })
  
  const [claudeCodeConfig, setClaudeCodeConfig] = useState<CodeSwitchConfigType | null>(null)
  const [codexConfig, setCodexConfig] = useState<CodeSwitchConfigType | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Load existing configs
  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const [claudeCode, codex] = await Promise.all([
        window.api.invoke('code-switch:get-config', 'claudecode') as Promise<CodeSwitchConfigType | null>,
        window.api.invoke('code-switch:get-config', 'codex') as Promise<CodeSwitchConfigType | null>
      ])
      setClaudeCodeConfig(claudeCode)
      setCodexConfig(codex)
    } catch (error) {
      console.error('Failed to load Code Switch configs:', error)
    } finally {
      setLoading(false)
    }
  }

  // 当 CLI tab 改变时，保存到 localStorage
  const handleTabChange = (value: string) => {
    const newTab = value as 'claudecode' | 'codex'
    setActiveTab(newTab)
    localStorage.setItem('code-switch-active-tab', newTab)
  }

  // 获取当前 tab 的配置
  const getCurrentConfig = () => {
    return activeTab === 'claudecode' ? claudeCodeConfig : codexConfig
  }

  // 启用/禁用当前 CLI
  const handleToggle = async (checked: boolean) => {
    const currentConfig = getCurrentConfig()
    
    if (checked) {
      // 启用：检查是否有 provider 选中
      if (!currentConfig?.providerId) {
        showToast.error(t('codeSwitch.selectProviderRequired'), {
          description: t('codeSwitch.selectProviderRequiredDesc')
        })
        return
      }

      setProcessing(true)
      try {
        await window.api.invoke('code-switch:enable', {
          cliType: activeTab,
          providerId: currentConfig.providerId,
          modelMappings: [] // 模型映射由子组件管理
        })

        // 不显示成功提示，避免遮挡按钮
        await loadConfigs()
      } catch (error) {
        showToast.error(t('codeSwitch.enableFailed'), {
          description: error instanceof Error ? error.message : t('codeSwitch.enableFailed')
        })
      } finally {
        setProcessing(false)
      }
    } else {
      // 禁用
      setProcessing(true)
      try {
        await window.api.invoke('code-switch:disable', activeTab)

        // 不显示成功提示，避免遮挡按钮
        await loadConfigs()
      } catch (error) {
        showToast.error(t('codeSwitch.disableFailed'), {
          description: error instanceof Error ? error.message : t('codeSwitch.disableFailed')
        })
      } finally {
        setProcessing(false)
      }
    }
  }

  return (
    <div className="h-full flex animate-fade-in gap-3">
      {/* Main Content - Single Column Layout */}
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          {/* Header Section - Fixed */}
          <div className="p-6 pb-5 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold">{t('codeSwitch.title')}</h1>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t('codeSwitch.description')}
                </p>
              </div>
              {/* Tab Switcher + Enable/Disable Toggle */}
              <div className="flex items-center gap-3 shrink-0">
                <TabsList className="inline-flex h-10 p-1 bg-muted">
                  <TabsTrigger 
                    value="claudecode"
                    className="relative flex items-center gap-1.5 h-8 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <span className="text-sm font-medium">Claude Code</span>
                    {claudeCodeConfig?.enabled && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-background" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="codex"
                    className="relative flex items-center gap-1.5 h-8 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <span className="text-sm font-medium">Codex</span>
                    {codexConfig?.enabled && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-background" />
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* Enable/Disable Button */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => !processing && !loading && handleToggle(!getCurrentConfig()?.enabled)}
                        disabled={processing || loading}
                        className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                          getCurrentConfig()?.enabled 
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-700' 
                            : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30 hover:border-green-300 dark:hover:border-green-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {getCurrentConfig()?.enabled ? (
                          <Square className="h-4 w-4 text-red-600 dark:text-red-500 transition-colors" />
                        ) : (
                          <Play className="h-4 w-4 text-green-600 dark:text-green-500 transition-colors" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        {getCurrentConfig()?.enabled ? t('codeSwitch.disable') : t('codeSwitch.enable')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Scrollable Content - No nested cards */}
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="claudecode" className="mt-0 h-full">
              <div className="p-6 space-y-5">
                <CodeSwitchConfig
                  cliType="claudecode"
                  config={claudeCodeConfig}
                  onConfigChange={loadConfigs}
                  loading={loading}
                />
              </div>
            </TabsContent>

            <TabsContent value="codex" className="mt-0 h-full">
              <div className="p-6 space-y-5">
                <CodeSwitchConfig
                  cliType="codex"
                  config={codexConfig}
                  onConfigChange={loadConfigs}
                  loading={loading}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
