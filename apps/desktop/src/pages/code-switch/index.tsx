/**
 * Code Switch Page
 * Allows users to configure Claude Code CLI to use different providers
 */

import { useState, useEffect } from 'react'
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
import { ipc } from '@/lib/ipc'

export default function CodeSwitch() {
  const { t } = useI18n()
  
  const [claudeCodeLogo, setClaudeCodeLogo] = useState<string>('')
  const [config, setConfig] = useState<CodeSwitchConfigType | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      
      const [claudeCode, claudeCodePreset] = await Promise.all([
        window.api.invoke('code-switch:get-config', 'claudecode') as Promise<CodeSwitchConfigType | null>,
        ipc.invoke('code-switch:get-cli-preset', 'claudecode') as Promise<{ logo?: string } | null>
      ])
      
      setConfig(claudeCode)
      if (claudeCodePreset?.logo) {
        setClaudeCodeLogo(claudeCodePreset.logo)
      }
    } catch (error) {
      console.error('Failed to load Code Switch config:', error)
      showToast.error(t('codeSwitch.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      if (!config?.providerId) {
        showToast.error(t('codeSwitch.selectProviderRequired'), {
          description: t('codeSwitch.selectProviderRequiredDesc')
        })
        return
      }

      setProcessing(true)
      try {
        await window.api.invoke('code-switch:enable', {
          cliType: 'claudecode',
          providerId: config.providerId,
          modelMappings: []
        })
        await loadConfig()
      } catch (error) {
        showToast.error(t('codeSwitch.enableFailed'), {
          description: error instanceof Error ? error.message : t('codeSwitch.enableFailed')
        })
      } finally {
        setProcessing(false)
      }
    } else {
      setProcessing(true)
      try {
        await window.api.invoke('code-switch:disable', 'claudecode')
        await loadConfig()
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
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="p-6 pb-5 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {claudeCodeLogo && (
                  <img 
                    src={claudeCodeLogo} 
                    alt="Claude Code" 
                    className="w-6 h-6 rounded"
                  />
                )}
                <h1 className="text-2xl font-bold">{t('codeSwitch.title')}</h1>
                {config?.enabled && (
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t('codeSwitch.description')}
              </p>
            </div>
            
            {/* Enable/Disable Button */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !processing && !loading && handleToggle(!config?.enabled)}
                    disabled={processing || loading}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                      config?.enabled 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-700' 
                        : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30 hover:border-green-300 dark:hover:border-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {config?.enabled ? (
                      <Square className="h-4 w-4 text-red-600 dark:text-red-500 transition-colors" />
                    ) : (
                      <Play className="h-4 w-4 text-green-600 dark:text-green-500 transition-colors" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {config?.enabled ? t('codeSwitch.disable') : t('codeSwitch.enable')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            <CodeSwitchConfig
              config={config}
              onConfigChange={loadConfig}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
