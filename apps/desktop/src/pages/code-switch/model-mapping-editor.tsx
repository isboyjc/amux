/**
 * Model Mapping Editor Component
 * Hybrid mapping: family, reasoning, default fallback, and exact overrides
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, X, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { Provider } from '@/types'
import type { CodeModelMappingType } from '@/types'
import { useI18n } from '@/stores/i18n-store'

const REASONING_SOURCE = '__reasoning__'
const DEFAULT_SOURCE = '__default__'

interface ModelMappingItem {
  sourceModel: string
  targetModel: string
  mappingType?: CodeModelMappingType
}

interface ModelFamily {
  id: string
  i18nKey: string
  keywords: string[]
  priority: number
}

interface ModelMappingEditorProps {
  codeSwitchId: string
  providerId: string
  onChange: (mappings: ModelMappingItem[]) => void
  disabled?: boolean
}

export function ModelMappingEditor({
  codeSwitchId,
  providerId,
  onChange,
  disabled
}: ModelMappingEditorProps) {
  const { t } = useI18n()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<{ modelFamilies?: ModelFamily[] } | null>(null)
  const [familyMappings, setFamilyMappings] = useState<Record<string, string>>({})
  const [reasoningModel, setReasoningModel] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [exactMappings, setExactMappings] = useState<Array<{ sourceModel: string; targetModel: string }>>([])
  const [exactOpen, setExactOpen] = useState(false)

  const emitChange = (
    family: Record<string, string>,
    reasoning: string,
    defaultVal: string,
    exact: Array<{ sourceModel: string; targetModel: string }>
  ) => {
    const items: ModelMappingItem[] = []
    preset?.modelFamilies?.forEach((f) => {
      const target = family[f.id]
      if (target) {
        items.push({ sourceModel: f.id, targetModel: target, mappingType: 'family' })
      }
    })
    if (reasoning) {
      items.push({ sourceModel: REASONING_SOURCE, targetModel: reasoning, mappingType: 'reasoning' })
    }
    if (defaultVal) {
      items.push({ sourceModel: DEFAULT_SOURCE, targetModel: defaultVal, mappingType: 'default' })
    }
    exact.forEach((m) => {
      items.push({ ...m, mappingType: 'exact' })
    })
    onChange(items)
  }

  const updateFamily = (familyId: string, targetModel: string) => {
    const next = { ...familyMappings }
    if (targetModel) next[familyId] = targetModel
    else delete next[familyId]
    setFamilyMappings(next)
    emitChange(next, reasoningModel, defaultModel, exactMappings)
  }

  const updateReasoning = (targetModel: string) => {
    setReasoningModel(targetModel)
    emitChange(familyMappings, targetModel, defaultModel, exactMappings)
  }

  const updateDefault = (targetModel: string) => {
    setDefaultModel(targetModel)
    emitChange(familyMappings, reasoningModel, targetModel, exactMappings)
  }

  const updateExact = (index: number, field: 'sourceModel' | 'targetModel', val: string) => {
    const next = exactMappings.map((m, i) =>
      i === index ? { ...m, [field]: val } : m
    )
    setExactMappings(next)
    emitChange(familyMappings, reasoningModel, defaultModel, next)
  }

  const removeExact = (index: number) => {
    const next = exactMappings.filter((_, i) => i !== index)
    setExactMappings(next)
    emitChange(familyMappings, reasoningModel, defaultModel, next)
  }

  const addExact = () => {
    const next = [...exactMappings, { sourceModel: '', targetModel: '' }]
    setExactMappings(next)
    setExactOpen(true)
    emitChange(familyMappings, reasoningModel, defaultModel, next)
  }

  useEffect(() => {
    loadProviderAndMappings()
  }, [providerId])

  const loadProviderAndMappings = async () => {
    if (!providerId) {
      setLoading(false)
      setFamilyMappings({})
      setReasoningModel('')
      setDefaultModel('')
      setExactMappings([])
      onChange([])
      return
    }

    try {
      setLoading(true)

      const [providerData, presetData] = await Promise.all([
        window.api.invoke('provider:get', providerId),
        window.api.invoke('code-switch:get-cli-preset', 'claudecode')
      ])

      setProvider(providerData as Provider)
      const cliPreset = presetData as { modelFamilies?: ModelFamily[] } | null
      setPreset(cliPreset ?? null)

      const families = cliPreset?.modelFamilies ?? []
      const familyMap: Record<string, string> = {}
      let reasoning = ''
      let defaultVal = ''
      const exact: Array<{ sourceModel: string; targetModel: string }> = []

      if (codeSwitchId) {
        try {
          const historical = (await window.api.invoke(
            'code-switch:get-historical-mappings',
            codeSwitchId,
            providerId
          )) as Array<{ sourceModel: string; targetModel: string; mappingType?: string }>

          for (const m of historical ?? []) {
            const type = (m.mappingType ?? 'exact') as CodeModelMappingType
            if (type === 'family' && families.some((f) => f.id === m.sourceModel)) {
              familyMap[m.sourceModel] = m.targetModel
            } else if (type === 'reasoning' && m.sourceModel === REASONING_SOURCE) {
              reasoning = m.targetModel
            } else if (type === 'default' && m.sourceModel === DEFAULT_SOURCE) {
              defaultVal = m.targetModel
            } else if (type === 'exact' || (!m.mappingType && m.sourceModel !== REASONING_SOURCE && m.sourceModel !== DEFAULT_SOURCE)) {
              exact.push({ sourceModel: m.sourceModel, targetModel: m.targetModel })
              // Backward compat: infer family from exact model name
              if (!m.mappingType || type === 'exact') {
                const sourceLower = m.sourceModel.toLowerCase()
                for (const f of families) {
                  if (!familyMap[f.id] && f.keywords.some((kw) => sourceLower.includes(kw.toLowerCase()))) {
                    familyMap[f.id] = m.targetModel
                    break
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[ModelMappingEditor] Failed to load historical mappings:', err)
        }
      }

      // Ensure we have keys for all families
      families.forEach((f) => {
        if (!(f.id in familyMap)) familyMap[f.id] = ''
      })

      setFamilyMappings(familyMap)
      setReasoningModel(reasoning)
      setDefaultModel(defaultVal)
      setExactMappings(exact.length ? exact : [])

      const items: ModelMappingItem[] = []
      families.forEach((f) => {
        const target = familyMap[f.id]
        if (target) {
          items.push({ sourceModel: f.id, targetModel: target, mappingType: 'family' })
        }
      })
      if (reasoning) items.push({ sourceModel: REASONING_SOURCE, targetModel: reasoning, mappingType: 'reasoning' })
      if (defaultVal) items.push({ sourceModel: DEFAULT_SOURCE, targetModel: defaultVal, mappingType: 'default' })
      exact.forEach((m) => items.push({ ...m, mappingType: 'exact' }))
      onChange(items)
    } catch (error) {
      console.error('[ModelMappingEditor] Failed to load:', error)
      setFamilyMappings({})
      setReasoningModel('')
      setDefaultModel('')
      setExactMappings([])
      onChange([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">{t('codeSwitch.loading')}</span>
      </div>
    )
  }

  const modelOptions = provider?.models ?? []
  const renderTargetSelect = (
    value: string,
    onChangeVal: (v: string) => void,
    placeholder?: string
  ) => {
    if (modelOptions.length > 0) {
      return (
        <Select value={value || undefined} onValueChange={onChangeVal} disabled={disabled}>
          <SelectTrigger className="h-9 text-sm border-dashed hover:border-primary/50">
            <SelectValue placeholder={placeholder ?? t('codeSwitch.optionalMapping')} />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((model) => (
              <SelectItem key={model} value={model} className="text-sm">
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    return (
      <Input
        value={value}
        onChange={(e) => onChangeVal(e.target.value)}
        placeholder={placeholder ?? t('codeSwitch.optionalMapping')}
        className="h-9 text-sm border-dashed"
        disabled={disabled}
      />
    )
  }

  const families = preset?.modelFamilies ?? []

  return (
    <div className="space-y-6">
      {/* Family Mapping */}
      {families.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-0.5">{t('codeSwitch.familyMapping')}</h4>
            <p className="text-xs text-muted-foreground">{t('codeSwitch.familyMappingDesc')}</p>
          </div>
          <div className="space-y-2">
            {families.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card/50"
              >
                <span className="flex-shrink-0 w-28 text-sm font-medium">
                  {t(`codeSwitch.${f.i18nKey}`) ?? f.id}
                </span>
                <span className="flex-shrink-0 text-muted-foreground">→</span>
                <div className="flex-1 min-w-0">
                  {renderTargetSelect(familyMappings[f.id] ?? '', (v) => updateFamily(f.id, v))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning Mapping */}
      <div className="space-y-2">
        <div>
          <h4 className="text-sm font-medium mb-0.5">{t('codeSwitch.reasoningMapping')}</h4>
          <p className="text-xs text-muted-foreground">{t('codeSwitch.reasoningMappingDesc')}</p>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
          <span className="flex-shrink-0 text-sm text-muted-foreground">Thinking enabled →</span>
          <div className="flex-1 min-w-0">
            {renderTargetSelect(reasoningModel, updateReasoning)}
          </div>
        </div>
      </div>

      {/* Default Mapping */}
      <div className="space-y-2">
        <div>
          <h4 className="text-sm font-medium mb-0.5">{t('codeSwitch.defaultMapping')}</h4>
          <p className="text-xs text-muted-foreground">{t('codeSwitch.defaultMappingDesc')}</p>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
          <span className="flex-shrink-0 text-sm text-muted-foreground">Other models →</span>
          <div className="flex-1 min-w-0">
            {renderTargetSelect(defaultModel, updateDefault)}
          </div>
        </div>
      </div>

      {/* Exact Overrides (collapsible) */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setExactOpen((o) => !o)}
        >
          <span>{t('codeSwitch.exactOverride')}</span>
          {exactOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        {exactOpen && (
          <div className="space-y-2 pt-2">
            {exactMappings.map((m, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded border bg-card/30"
              >
                <Input
                  value={m.sourceModel}
                  onChange={(e) => updateExact(index, 'sourceModel', e.target.value)}
                  placeholder="e.g. claude-opus-4-6-20260206"
                  className="h-8 text-xs font-mono flex-1 min-w-0"
                  disabled={disabled}
                />
                <span className="text-muted-foreground">→</span>
                {modelOptions.length > 0 ? (
                  <Select
                    value={m.targetModel || undefined}
                    onValueChange={(v) => updateExact(index, 'targetModel', v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                      <SelectValue placeholder={t('codeSwitch.optionalMapping')} />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((model) => (
                        <SelectItem key={model} value={model} className="text-sm">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={m.targetModel}
                    onChange={(e) => updateExact(index, 'targetModel', e.target.value)}
                    placeholder={t('codeSwitch.optionalMapping')}
                    className="h-8 text-xs flex-1 min-w-0"
                    disabled={disabled}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeExact(index)}
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addExact}
              disabled={disabled}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('codeSwitch.addExactOverride')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
