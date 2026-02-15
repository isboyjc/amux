/**
 * Code Switch Configuration Component
 * Handles provider selection and model mapping for Claude Code
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, XCircle, RefreshCw } from 'lucide-react'
import { toast as showToast } from 'sonner'
import { ProviderSelector } from './provider-selector'
import { ModelMappingEditor } from './model-mapping-editor'
import type { CodeSwitchConfig } from '@/types'
import { useI18n } from '@/stores/i18n-store'

interface CodeSwitchConfigProps {
  config: CodeSwitchConfig | null
  onConfigChange: () => void
  loading: boolean
}

interface MappingItem {
  sourceModel: string
  targetModel: string
  mappingType?: string
}

export function CodeSwitchConfig({ config, onConfigChange, loading }: CodeSwitchConfigProps) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [modelMappings, setModelMappings] = useState<MappingItem[]>([])
  const [originalMappings, setOriginalMappings] = useState<MappingItem[]>([])
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle')
  const [detectionError, setDetectionError] = useState<string>('')
  const [configPath, setConfigPath] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [currentConfigId, setCurrentConfigId] = useState<string>('')

  const saveTimeoutRef = React.useRef<NodeJS.Timeout>()
  // Use refs to avoid stale closure in debounced save
  const mappingsRef = React.useRef<MappingItem[]>([])
  const originalMappingsRef = React.useRef<MappingItem[]>([])

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

  // Flush pending debounced save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        // Synchronously trigger save if there are unsaved changes
        const latestMappings = mappingsRef.current
        const latestOriginal = originalMappingsRef.current
        const hasChanged = JSON.stringify(latestMappings) !== JSON.stringify(latestOriginal)
        if (hasChanged && latestMappings.length > 0) {
          // Fire-and-forget save (component is unmounting)
          saveModelMappings()
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-detect config file on first mount
  useEffect(() => {
    const detectedKey = 'code-switch-detected-claudecode'
    const hasDetected = localStorage.getItem(detectedKey)
    
    if (!hasDetected && !config && !configPath && detectionStatus === 'idle') {
      detectConfig().then(() => {
        localStorage.setItem(detectedKey, 'true')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

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
      const detection = detections.find((d) => d.cliType === 'claudecode')

      if (detection?.detected && detection.valid && detection.configPath) {
        setDetectionStatus('success')
        setConfigPath(detection.configPath)
        
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

  // Update provider (dynamic switch)
  const handleProviderChange = async (providerId: string) => {
    setSelectedProviderId(providerId)

    // Initialize config to ensure we have a codeSwitchId for model mappings
    if (!enabled && configPath) {
      try {
        const initializedConfig = await window.api.invoke(
          'code-switch:init-config',
          'claudecode',
          providerId,
          configPath
        ) as CodeSwitchConfig
        setCurrentConfigId(initializedConfig.id)
        console.log('[CodeSwitch] Initialized config:', initializedConfig.id)
        // Refresh parent config so Enable button can read providerId
        onConfigChange()
      } catch (error) {
        console.error('[CodeSwitch] Failed to initialize config:', error)
      }
    }

    // If already enabled, switch provider only
    if (enabled && config) {
      setProcessing(true)

      try {
        await window.api.invoke('code-switch:switch-provider', 'claudecode', providerId)

        showToast.success(t('codeSwitch.switchSuccess'), {
          description: t('codeSwitch.switchSuccessDesc')
        })
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
  const handleModelMappingsChange = async (mappings: MappingItem[]) => {
    setModelMappings(mappings)
    mappingsRef.current = mappings
    
    // First load: set original, don't save
    if (originalMappings.length === 0) {
      setOriginalMappings(mappings.map(m => ({ ...m })))
      originalMappingsRef.current = mappings.map(m => ({ ...m }))
      return
    }
    
    // Debounced save: wait 1s after user stops editing
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveModelMappings()
    }, 1000)
  }

  const saveModelMappings = async () => {
    const latestMappings = mappingsRef.current
    const latestOriginal = originalMappingsRef.current

    const configId = currentConfigId || config?.id
    if (!configId || !selectedProviderId) {
      console.log('[CodeSwitch] Cannot save mappings: no config ID or provider ID')
      return
    }

    const hasChanged = JSON.stringify(latestMappings) !== JSON.stringify(latestOriginal)
    if (!hasChanged) return

    setProcessing(true)

    try {
      await window.api.invoke('code-switch:update-provider', 'claudecode', selectedProviderId, latestMappings)

      console.log('[CodeSwitch] Model mappings saved successfully (enabled:', enabled, ')')
      
      if (enabled) {
        showToast.success(t('codeSwitch.updateSuccess'), {
          description: t('codeSwitch.updateSuccessDesc')
        })
      }

      const snapshot = latestMappings.map(m => ({ ...m }))
      setOriginalMappings(snapshot)
      originalMappingsRef.current = snapshot
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
          {detectionStatus === 'idle' && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {t('codeSwitch.needDetection')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => detectConfig(true)}
                className="shrink-0"
              >
                {t('codeSwitch.detectConfig')}
              </Button>
            </div>
          )}

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
                codeSwitchId={currentConfigId || config?.id || ''}
                providerId={selectedProviderId}
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
