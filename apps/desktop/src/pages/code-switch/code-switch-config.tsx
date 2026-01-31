/**
 * Code Switch Configuration Component
 * Handles enable/disable, provider selection, and model mapping
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, XCircle, RefreshCw } from 'lucide-react'
import { toast as showToast } from 'sonner'
import { ProviderSelector } from './provider-selector'
import { ModelMappingEditor } from './model-mapping-editor'
import type { CodeSwitchConfig } from '@/types'
import { useI18n } from '@/stores/i18n-store'

interface CodeSwitchConfigProps {
  cliType: 'claudecode' | 'codex'
  config: CodeSwitchConfig | null
  onConfigChange: () => void
  loading: boolean
}

export function CodeSwitchConfig({ cliType, config, onConfigChange, loading }: CodeSwitchConfigProps) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [modelMappings, setModelMappings] = useState<Array<{ claudeModel: string; targetModel: string }>>([])
  const [originalMappings, setOriginalMappings] = useState<Array<{ claudeModel: string; targetModel: string }>>([])
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle')
  const [detectionError, setDetectionError] = useState<string>('')
  const [configPath, setConfigPath] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [currentConfigId, setCurrentConfigId] = useState<string>('') // Track current config ID

  // Initialize from config
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled)
      setSelectedProviderId(config.providerId)
      setConfigPath(config.configPath)
      setCurrentConfigId(config.id)
    } else {
      setEnabled(false)
      setSelectedProviderId('')
      setConfigPath('')
      setCurrentConfigId('')
    }
  }, [config])

  // 自动检测配置文件（仅首次加载且没有配置时）
  useEffect(() => {
    // 检查是否已经检测过
    const detectedKey = `code-switch-detected-${cliType}`
    const hasDetected = localStorage.getItem(detectedKey)
    
    // 只在未检测过且没有配置时自动检测
    if (!hasDetected && !config && !configPath && detectionStatus === 'idle') {
      detectConfig().then(() => {
        // 标记为已检测
        localStorage.setItem(detectedKey, 'true')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 空依赖数组，只在首次挂载时执行

  // Detect CLI configuration
  const detectConfig = async (isManual = false) => {
    setDetectionStatus('detecting')
    setDetectionError('')

    try {
      const detections = (await window.api.invoke('code-switch:detect-files')) as Array<{
        cliType: string
        detected: boolean
        valid: boolean
        configPath?: string
        error?: string
      }>
      const detection = detections.find((d) => d.cliType === cliType)

      if (detection?.detected && detection.valid && detection.configPath) {
        setDetectionStatus('success')
        setConfigPath(detection.configPath)
        // 只在手动检测时显示提示
        if (isManual) {
          showToast.success(t('codeSwitch.detectSuccess'), {
            description: detection.configPath
          })
        }
      } else {
        setDetectionStatus('error')
        setDetectionError(detection?.error || t('codeSwitch.configNotFound'))
      }
    } catch (error) {
      setDetectionStatus('error')
      setDetectionError(error instanceof Error ? error.message : t('codeSwitch.detectFailed'))
    }
  }

  // Enable Code Switch
  const handleEnable = async () => {
    if (!selectedProviderId) {
      showToast.error(t('codeSwitch.selectProviderRequired'), {
        description: t('codeSwitch.selectProviderRequiredDesc')
      })
      return
    }

    setProcessing(true)

    try {
      await window.api.invoke('code-switch:enable', {
        cliType,
        providerId: selectedProviderId,
        modelMappings
      })

      showToast.success(t('codeSwitch.enableSuccess'), {
        description: t('codeSwitch.enableSuccessDesc', { cliType })
      })

      onConfigChange()
    } catch (error) {
      showToast.error(t('codeSwitch.enableFailed'), {
        description: error instanceof Error ? error.message : t('codeSwitch.enableFailed')
      })
    } finally {
      setProcessing(false)
    }
  }

  // Disable Code Switch
  const handleDisable = async () => {
    setProcessing(true)

    try {
      await window.api.invoke('code-switch:disable', cliType)

      showToast.success(t('codeSwitch.disableSuccess'), {
        description: t('codeSwitch.disableSuccessDesc', { cliType })
      })

      onConfigChange()
    } catch (error) {
      showToast.error(t('codeSwitch.disableFailed'), {
        description: error instanceof Error ? error.message : t('codeSwitch.disableFailed')
      })
    } finally {
      setProcessing(false)
    }
  }

  // Update provider (dynamic switch)
  const handleProviderChange = async (providerId: string) => {
    setSelectedProviderId(providerId)

    // Initialize or update config to ensure we have a codeSwitchId for model mappings
    if (!enabled && configPath) {
      try {
        const initializedConfig = await window.api.invoke(
          'code-switch:init-config',
          cliType,
          providerId,
          configPath
        ) as CodeSwitchConfig
        setCurrentConfigId(initializedConfig.id)
        console.log('[CodeSwitch] Initialized config:', initializedConfig.id)
        // 不需要刷新整个配置，只是创建了一个 disabled 的记录
        // currentConfigId 已经设置，足够用于保存映射
        // onConfigChange() ← 移除，避免页面闪烁
      } catch (error) {
        console.error('[CodeSwitch] Failed to initialize config:', error)
      }
    }

    // If already enabled, switch provider only (don't update mappings)
    // Model mappings will be loaded from history by ModelMappingEditor
    if (enabled && config) {
      setProcessing(true)

      try {
        // Only switch provider, don't pass current modelMappings
        // This prevents overwriting historical mappings of the new provider
        await window.api.invoke('code-switch:switch-provider', cliType, providerId)

        showToast.success(t('codeSwitch.switchSuccess'), {
          description: t('codeSwitch.switchSuccessDesc')
        })

        // 不需要刷新整个配置，provider 已经在本地状态中了
        // ModelMappingEditor 会自动加载新供应商的映射
        // onConfigChange() ← 移除，避免页面闪烁
      } catch (error) {
        showToast.error(t('codeSwitch.switchFailed'), {
          description: error instanceof Error ? error.message : t('codeSwitch.switchFailed')
        })
      } finally {
        setProcessing(false)
      }
    }
  }

  // Update model mappings (dynamic)
  const handleModelMappingsChange = async (mappings: Array<{ claudeModel: string; targetModel: string }>) => {
    setModelMappings(mappings)
    
    // 如果是首次加载（originalMappings 为空），设置 originalMappings，不触发保存
    if (originalMappings.length === 0) {
      setOriginalMappings(mappings)
      return
    }
    
    // 防抖保存：用户停止编辑 1 秒后自动保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveModelMappings(mappings)
    }, 1000)
  }

  const saveTimeoutRef = React.useRef<NodeJS.Timeout>()

  // 组件卸载时清理定时器
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Save model mappings (called when user finishes editing)
  const saveModelMappings = async (mappings: Array<{ claudeModel: string; targetModel: string }>) => {
    // 需要有 config ID 和 provider 才能保存（不需要 enabled 状态）
    const configId = currentConfigId || config?.id
    if (!configId || !selectedProviderId) {
      console.log('[CodeSwitch] Cannot save mappings: no config ID or provider ID')
      return
    }

    // 检查是否真的改变了
    const hasChanged = JSON.stringify(mappings) !== JSON.stringify(originalMappings)
    if (!hasChanged) {
      return // 没有改变，不保存
    }

    setProcessing(true)

    try {
      await window.api.invoke('code-switch:update-provider', cliType, selectedProviderId, mappings)

      console.log('[CodeSwitch] Model mappings saved successfully (enabled:', enabled, ')')
      
      // 只在启用状态下才显示成功提示，避免频繁打扰用户
      if (enabled) {
        showToast.success(t('codeSwitch.updateSuccess'), {
          description: t('codeSwitch.updateSuccessDesc')
        })
      }

      // 更新原始映射
      setOriginalMappings(mappings)
      // 不需要刷新整个配置，映射已经在本地状态中了
      // onConfigChange() ← 移除，避免页面闪烁
    } catch (error) {
      console.error('[CodeSwitch] Failed to save mappings:', error)
      showToast.error(t('codeSwitch.updateFailed'), {
        description: error instanceof Error ? error.message : t('codeSwitch.updateFailed')
      })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Configuration Path Display */}
      {(config?.configPath || configPath) && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t('codeSwitch.configPath')}</Label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
            <code className="flex-1 text-xs font-mono break-all">
              {config?.configPath || configPath}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => detectConfig(true)}
              disabled={detectionStatus === 'detecting'}
              className="shrink-0 h-7 px-2"
              title={t('codeSwitch.refreshConfig')}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${detectionStatus === 'detecting' ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Detection Status (only when no config) */}
      {!config && !configPath && (
        <div className="space-y-3">
          {detectionStatus === 'detecting' && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 rounded-lg border bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('codeSwitch.detecting')}</span>
            </div>
          )}

          {detectionStatus === 'error' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-900 dark:text-red-100">
                  {detectionError}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => detectConfig(true)}
                disabled={detectionStatus === 'detecting'}
                className="shrink-0 h-7 px-2"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Configuration */}
      {(config || detectionStatus === 'success' || configPath) && (
        <div className="space-y-4">
          {/* Provider Selector */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('codeSwitch.selectProvider')}</Label>
            <ProviderSelector
              value={selectedProviderId}
              onChange={handleProviderChange}
              disabled={processing}
            />
          </div>

          {/* Model Mappings */}
          {selectedProviderId && (
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-medium">{t('codeSwitch.modelMapping')}</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('codeSwitch.modelMappingDesc')}
                </p>
              </div>
              <ModelMappingEditor
                cliType={cliType}
                codeSwitchId={currentConfigId || config?.id || ''}
                providerId={selectedProviderId}
                value={modelMappings}
                onChange={handleModelMappingsChange}
                disabled={processing}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
