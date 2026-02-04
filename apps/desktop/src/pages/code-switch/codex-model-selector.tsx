/**
 * Codex Model Selector Component (Redesigned)
 * - Single 2-level dropdown for current model selection
 * - Default models group + Provider groups
 * - Optional mapping configuration for 4 main default models
 * - Reads current model from config.toml on every page entry
 */

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, X } from 'lucide-react'
import { toast as showToast } from 'sonner'
import { useI18n } from '@/stores/i18n-store'

// 默认模型将从预设加载
// 保留空数组作为初始值
const MAIN_DEFAULT_MODELS_FALLBACK = [
  { value: 'gpt-5.2-codex', i18nKey: 'codexModel52' },
  { value: 'gpt-5.2', i18nKey: 'codexModelBase' },
  { value: 'gpt-5.1-codex-max', i18nKey: 'codexModelMax' },
  { value: 'gpt-5.1-codex-mini', i18nKey: 'codexModelMini' }
]

interface CodexModelSelectorProps {
  codeSwitchId: string
  tomlPath: string
  enabled: boolean
  disabled?: boolean
}

interface AggregatedModel {
  providerId: string
  providerName: string
  adapterType: string
  models: Array<{ id: string; name: string }>
}

export function CodexModelSelector({
  codeSwitchId,
  tomlPath,
  enabled,
  disabled
}: CodexModelSelectorProps) {
  const { t } = useI18n()
  
  // Current model selection
  const [currentModel, setCurrentModel] = useState<string>('')
  const [loadingCurrent, setLoadingCurrent] = useState(false)
  
  // Default models loaded from preset
  const [defaultModels, setDefaultModels] = useState<Array<{ value: string; i18nKey: string }>>(MAIN_DEFAULT_MODELS_FALLBACK)
  
  // Model mappings for default models
  const [modelMappings, setModelMappings] = useState<Record<string, { provider: string; model: string }>>({})
  const [originalMappings, setOriginalMappings] = useState<Record<string, { provider: string; model: string }>>({})
  
  // Aggregated models for cascading select (grouped by provider)
  const [aggregatedModels, setAggregatedModels] = useState<AggregatedModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // Load default models from preset on component mount
  useEffect(() => {
    loadDefaultModels()
  }, [])

  // Load current model from config.toml on component mount
  useEffect(() => {
    if (tomlPath) {
      loadCurrentModel()
    }
  }, [tomlPath])

  // Load aggregated models for provider groups
  useEffect(() => {
    loadAggregatedModels()
  }, [])

  // Load model mappings (when codeSwitchId is available)
  useEffect(() => {
    if (codeSwitchId) {
      loadModelMappings()
    }
  }, [codeSwitchId])

  // When enabled changes from false to true, apply the selected model
  const prevEnabledRef = useRef(enabled)
  useEffect(() => {
    const wasDisabled = !prevEnabledRef.current
    const isNowEnabled = enabled

    if (wasDisabled && isNowEnabled && currentModel && tomlPath) {
      // User just enabled Code Switch
      // Apply the selected model to config.toml
      console.log(`[CodexModelSelector] Applying selected model after enable: ${currentModel}`)
      
      window.api.invoke('code-switch:update-codex-model', tomlPath, currentModel)
        .then(() => {
          console.log(`[CodexModelSelector] ✅ Model applied: ${currentModel}`)
        })
        .catch((error) => {
          console.error('[CodexModelSelector] Failed to apply model:', error)
        })
    }

    prevEnabledRef.current = enabled
  }, [enabled, currentModel, tomlPath])


  const loadDefaultModels = async () => {
    try {
      const models = await window.api.invoke('code-switch:get-default-models', 'codex') as Array<{
        id: string
        i18nKey: string
        capabilities: string[]
        isDefault?: boolean
      }>
      
      if (models && models.length > 0) {
        setDefaultModels(models.map((m: any) => ({ value: m.id, i18nKey: m.i18nKey })))
        console.log('[CodexModelSelector] Loaded default models from preset:', models)
      }
    } catch (error) {
      console.error('[CodexModelSelector] Failed to load default models from preset:', error)
      // Keep using fallback
    }
  }

  const loadCurrentModel = async () => {
    if (!tomlPath) return
    
    setLoadingCurrent(true)
    try {
      const model = await window.api.invoke('code-switch:get-codex-model', tomlPath) as string
      setCurrentModel(model || 'gpt-5.2-codex')
    } catch (error) {
      console.error('Failed to load current model:', error)
      setCurrentModel('')
    } finally {
      setLoadingCurrent(false)
    }
  }

  const loadAggregatedModels = async () => {
    setLoadingModels(true)
    try {
      const models = (await window.api.invoke(
        'code-switch:get-aggregated-models'
      )) as AggregatedModel[]
      
      setAggregatedModels(models || [])
    } catch (error) {
      console.error('Failed to load aggregated models:', error)
      setAggregatedModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const loadModelMappings = async () => {
    try {
      const mappings = (await window.api.invoke(
        'code-switch:get-historical-mappings',
        codeSwitchId
      )) as Array<{ sourceModel: string; targetModel: string }>
      
      // Convert array to record with provider/model split
      const mappingRecord: Record<string, { provider: string; model: string }> = {}
      mappings.forEach((m) => {
        if (m.targetModel && m.targetModel.includes('/')) {
          const [provider, model] = m.targetModel.split('/')
          if (provider && model) {
            mappingRecord[m.sourceModel] = { provider, model }
          }
        }
      })
      
      setModelMappings(mappingRecord)
      setOriginalMappings(JSON.parse(JSON.stringify(mappingRecord)))
    } catch (error) {
      console.error('Failed to load model mappings:', error)
    }
  }

  const handleCurrentModelChange = async (value: string) => {
    if (!value) return
    
    // If not enabled, only update local state (don't write to file)
    if (!enabled) {
      setCurrentModel(value)
      return
    }
    
    // If enabled, write to config.toml immediately
    if (!tomlPath) return
    
    setLoadingCurrent(true)
    try {
      await window.api.invoke('code-switch:update-codex-model', tomlPath, value)
      setCurrentModel(value)
      showToast.success(t('codeSwitch.modelUpdated'))
    } catch (error) {
      console.error('Failed to update current model:', error)
      showToast.error(t('codeSwitch.modelUpdateFailed'))
    } finally {
      setLoadingCurrent(false)
    }
  }

  const handleMappingProviderChange = (sourceModel: string, providerId: string) => {
    setModelMappings((prev) => {
      const newMappings = { ...prev }
      newMappings[sourceModel] = { provider: providerId, model: '' }
      return newMappings
    })
  }

  const handleMappingModelChange = (sourceModel: string, modelId: string) => {
    setModelMappings((prev) => {
      const newMappings = { ...prev }
      const existing = prev[sourceModel] || { provider: '', model: '' }
      newMappings[sourceModel] = { ...existing, model: modelId }
      return newMappings
    })
  }

  // 实时保存：监听 modelMappings 变化
  useEffect(() => {
    // 跳过初始加载
    if (JSON.stringify(modelMappings) === JSON.stringify(originalMappings)) {
      return
    }
    
    // 有变化时自动保存
    const saveTimeout = setTimeout(() => {
      saveModelMappingsToDatabase()
    }, 500) // 500ms 防抖
    
    return () => clearTimeout(saveTimeout)
  }, [modelMappings])

  const saveModelMappingsToDatabase = async () => {
    if (!codeSwitchId) return
    
    try {
      // Convert record to array format
      const mappingsArray = defaultModels
        .map((m) => {
          const mapping = modelMappings[m.value]
          if (mapping && mapping.provider && mapping.model) {
            return {
              sourceModel: m.value,
              targetModel: `${mapping.provider}/${mapping.model}`
            }
          }
          return null
        })
        .filter(Boolean) as Array<{ sourceModel: string; targetModel: string }>

      // Update via IPC (save to database only, not to config files)
      // Note: Passing 3 separate arguments as required by IPC handler
      await window.api.invoke(
        'code-switch:update-provider',
        'codex', // cliType
        'default', // providerId (not used for Codex, but required by interface)
        mappingsArray // modelMappings
      )

      // Invalidate cache
      await window.api.invoke('code-switch:invalidate-codex-model-mapping-cache', codeSwitchId)

      setOriginalMappings(JSON.parse(JSON.stringify(modelMappings)))
      console.log('[CodexModelSelector] Model mappings saved to database')
    } catch (error) {
      console.error('[CodexModelSelector] Failed to save model mappings:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Model Selection (Single 2-level dropdown) */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">{t('codeSwitch.currentModel')}</Label>
          <p className="text-xs text-muted-foreground mt-1">
            {t('codeSwitch.currentModelDesc')}
          </p>
          {!enabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {t('codeSwitch.modelWillApplyOnEnable')}
            </p>
          )}
        </div>

        {loadingCurrent ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 rounded-lg border bg-muted/30">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          <Select value={currentModel} onValueChange={handleCurrentModelChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder={t('codeSwitch.selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {/* Default Models Group */}
              <SelectGroup>
                <SelectLabel>Default</SelectLabel>
                {defaultModels.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {t(`codeSwitch.models.${model.i18nKey}`)}
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Provider Groups */}
              {aggregatedModels.map((provider) => (
                <SelectGroup key={provider.providerId}>
                  <SelectLabel>{provider.providerName}</SelectLabel>
                  {provider.models.map((model) => (
                    <SelectItem 
                      key={`${provider.adapterType}/${model.id}`} 
                      value={`${provider.adapterType}/${model.id}`}
                    >
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Model Mappings (Optional configuration for 4 main default models) */}
      <div className="space-y-4 border-t pt-6">
        <div>
          <Label className="text-sm font-medium">{t('codeSwitch.modelMapping')}</Label>
          <p className="text-xs text-muted-foreground mt-1">
            {t('codeSwitch.codexModelMappingDesc')}
          </p>
        </div>

        <div className="space-y-3">
          {defaultModels.map((defaultModel) => {
            const mapping = modelMappings[defaultModel.value] || { provider: '', model: '' }
            const selectedProvider = aggregatedModels.find((p) => p.adapterType === mapping.provider)
            const targetModelValue = mapping.provider && mapping.model ? `${mapping.provider}/${mapping.model}` : ''

            return (
              <div 
                key={defaultModel.value}
                className="group relative flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card hover:border-primary/40 transition-all duration-200"
              >
                {/* Left: Source Model Info */}
                <div className="flex-shrink-0 w-32">
                  <div className="text-xs font-semibold text-foreground mb-0.5">
                    {t(`codeSwitch.models.${defaultModel.i18nKey}`)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {defaultModel.value}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Right: Target Model Cascading Selects */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {/* Provider Select */}
                  <Select
                    value={mapping.provider}
                    onValueChange={(value) => handleMappingProviderChange(defaultModel.value, value)}
                    disabled={disabled || loadingModels}
                  >
                    <SelectTrigger className="h-9 text-sm border-dashed hover:border-primary/50 transition-colors">
                      <SelectValue placeholder={t('codeSwitch.selectProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      {aggregatedModels.map((provider) => (
                        <SelectItem key={provider.providerId} value={provider.adapterType}>
                          {provider.providerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Model Select */}
                  {mapping.provider && (
                    <Select
                      value={mapping.model}
                      onValueChange={(value) => handleMappingModelChange(defaultModel.value, value)}
                      disabled={disabled || loadingModels}
                    >
                      <SelectTrigger className="h-9 text-sm border-dashed hover:border-primary/50 transition-colors">
                        <SelectValue placeholder={t('codeSwitch.selectModel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProvider?.models.map((model) => (
                          <SelectItem key={model.id} value={model.id} className="text-sm">
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Clear Button */}
                  {targetModelValue && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMappingProviderChange(defaultModel.value, '')}
                      disabled={disabled}
                      className="h-9 w-9 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      title={t('codeSwitch.clearMapping')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
