/**
 * Model Mapping Editor Component
 * Allows users to configure model name mappings
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, X } from 'lucide-react'
import type { Provider } from '@/types'
import { useI18n } from '@/stores/i18n-store'

// Default Claude model names with display labels
const DEFAULT_CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', labelKey: 'sonnetModel' },
  { value: 'claude-opus-4-5-20251101', labelKey: 'opusModel' },
  { value: 'claude-haiku-4-5-20251001', labelKey: 'haikuModel' }
]

interface ModelMapping {
  sourceModel: string
  targetModel: string
}

interface ModelMappingEditorProps {
  cliType: 'claudecode' | 'codex'
  codeSwitchId: string
  providerId: string
  value: ModelMapping[]
  onChange: (mappings: ModelMapping[]) => void
  disabled?: boolean
}

export function ModelMappingEditor({
  cliType,
  codeSwitchId,
  providerId,
  value,
  onChange,
  disabled
}: ModelMappingEditorProps) {
  const { t } = useI18n()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)
  const [localMappings, setLocalMappings] = useState<ModelMapping[]>(value)

  // 监听 value 变化，同步更新 localMappings
  useEffect(() => {
    setLocalMappings(value)
  }, [value])

  // Load provider details and initialize default mappings
  useEffect(() => {
    loadProviderAndMappings()
  }, [providerId])

  const loadProviderAndMappings = async () => {
    if (!providerId) {
      setLoading(false)
      setLocalMappings([])
      return
    }

    try {
      setLoading(true)

      // Load provider details
      const providerData = await window.api.invoke('provider:get', providerId)
      setProvider(providerData)

      // Load historical mappings if codeSwitchId exists
      let mappingsToUse: ModelMapping[] = []
      
      if (codeSwitchId) {
        try {
          const historicalMappings = await window.api.invoke(
            'code-switch:get-historical-mappings',
            codeSwitchId,
            providerId
          )

          if (historicalMappings && historicalMappings.length > 0) {
            // Use historical mappings
            mappingsToUse = historicalMappings.map((m: any) => ({
              sourceModel: m.sourceModel,
              targetModel: m.targetModel
            }))
          }
        } catch (err) {
          console.warn('[ModelMappingEditor] Failed to load historical mappings:', err)
        }
      }

      // If no historical mappings, initialize with default Claude models
      if (mappingsToUse.length === 0) {
        mappingsToUse = DEFAULT_CLAUDE_MODELS.map(model => ({
          sourceModel: model.value,
          targetModel: '' // Empty by default, user can fill or leave empty
        }))
      }

      setLocalMappings(mappingsToUse)
      // 初始化时通知父组件，让父组件设置 originalMappings
      onChange(mappingsToUse)
    } catch (error) {
      console.error('[ModelMappingEditor] Failed to load provider and mappings:', error)
      // Fallback to default mappings
      const defaultMappings = DEFAULT_CLAUDE_MODELS.map(model => ({
        sourceModel: model.value,
        targetModel: ''
      }))
      setLocalMappings(defaultMappings)
      onChange(defaultMappings)
    } finally {
      setLoading(false)
    }
  }

  // Removed addMapping - no longer needed, models are pre-populated

  const updateMapping = (index: number, field: 'sourceModel' | 'targetModel', value: string) => {
    const newMappings = [...localMappings]
    newMappings[index][field] = value
    setLocalMappings(newMappings)
    // 立即通知父组件，但父组件不会立即保存
    onChange(newMappings)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">{t('codeSwitch.loading')}</span>
      </div>
    )
  }

  // Get model display label
  const getModelLabel = (modelValue: string) => {
    const model = DEFAULT_CLAUDE_MODELS.find(m => m.value === modelValue)
    return model ? t(`codeSwitch.${model.labelKey}`) : modelValue
  }

  return (
    <div className="space-y-3">
      {localMappings.map((mapping, index) => {
        return (
          <div 
            key={index} 
            className="group relative flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card hover:border-primary/40 transition-all duration-200"
          >
            {/* Left: Claude Model Info */}
            <div className="flex-shrink-0 w-32">
              <div className="text-xs font-semibold text-foreground mb-0.5">
                {getModelLabel(mapping.sourceModel)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {mapping.sourceModel}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>

            {/* Right: Target Model Selector */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {provider?.models && provider.models.length > 0 ? (
                <>
                  <Select
                    value={mapping.targetModel || undefined}
                    onValueChange={(value) => updateMapping(index, 'targetModel', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9 text-sm border-dashed hover:border-primary/50 transition-colors">
                      <SelectValue placeholder={t('codeSwitch.optionalMapping')} />
                    </SelectTrigger>
                    <SelectContent>
                      {provider.models.map((model) => (
                        <SelectItem key={model} value={model} className="text-sm">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping.targetModel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateMapping(index, 'targetModel', '')}
                      disabled={disabled}
                      className="h-9 w-9 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      title={t('codeSwitch.clearMapping')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              ) : (
                <Input
                  value={mapping.targetModel}
                  onChange={(e) => updateMapping(index, 'targetModel', e.target.value)}
                  placeholder={t('codeSwitch.optionalMapping')}
                  className="h-9 text-sm border-dashed hover:border-primary/50 transition-colors"
                  disabled={disabled}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
