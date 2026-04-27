/**
 * Model Mapping Editor Component
 * 支持四种映射类型：Reasoning、Exact、Family、Default
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Brain, Hash, Tags, Star, Loader2 } from 'lucide-react'
import type { CliModelMappingItem, Provider } from '@/types'

interface ModelMappingEditorProps {
  cliType: string
  providerId: string
  provider: Provider
  mappings: CliModelMappingItem[]
  onMappingsChange: (mappings: CliModelMappingItem[]) => void
  disabled?: boolean
}

export function ModelMappingEditor({
  cliType: _cliType,
  providerId,
  provider: _provider,
  mappings,
  onMappingsChange,
  disabled,
}: ModelMappingEditorProps) {
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  
  // 分类映射
  const reasoningMapping = mappings.find((m) => m.mappingType === 'reasoning')
  const defaultMapping = mappings.find((m) => m.mappingType === 'default')
  const exactMappings = mappings.filter((m) => m.mappingType === 'exact')
  const familyMappings = mappings.filter((m) => m.mappingType === 'family')

  useEffect(() => {
    loadProviderModels()
  }, [providerId])

  const loadProviderModels = async () => {
    try {
      setLoadingModels(true)
      const result = await window.api.invoke('cli-cs:get-provider-models', { providerId }) as {
        success: boolean
        models?: string[]
      }
      if (result.success) {
        setProviderModels(result.models || [])
      }
    } catch (error) {
      console.error('Failed to load provider models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleReasoningChange = (targetModel: string) => {
    const newMappings = mappings.filter((m) => m.mappingType !== 'reasoning')
    if (targetModel) {
      newMappings.push({
        id: `reasoning-${Date.now()}`,
        mappingType: 'reasoning',
        targetModel,
      })
    }
    onMappingsChange(newMappings)
  }

  const handleDefaultChange = (targetModel: string) => {
    const newMappings = mappings.filter((m) => m.mappingType !== 'default')
    if (targetModel) {
      newMappings.push({
        id: `default-${Date.now()}`,
        mappingType: 'default',
        targetModel,
      })
    }
    onMappingsChange(newMappings)
  }

  const handleAddExactMapping = () => {
    const newMappings = [...mappings]
    newMappings.push({
      id: `exact-${Date.now()}`,
      mappingType: 'exact',
      sourceModel: '',
      targetModel: providerModels[0] || '',
    })
    onMappingsChange(newMappings)
  }

  const handleUpdateExactMapping = (id: string, field: 'sourceModel' | 'targetModel', value: string) => {
    const newMappings = mappings.map((m) =>
      m.id === id ? { ...m, [field]: value } : m
    )
    onMappingsChange(newMappings)
  }

  const handleDeleteExactMapping = (id: string) => {
    const newMappings = mappings.filter((m) => m.id !== id)
    onMappingsChange(newMappings)
  }

  const handleAddFamilyMapping = () => {
    const newMappings = [...mappings]
    newMappings.push({
      id: `family-${Date.now()}`,
      mappingType: 'family',
      keywords: [],
      targetModel: providerModels[0] || '',
      priority: 0,
    })
    onMappingsChange(newMappings)
  }

  const handleUpdateFamilyMapping = (
    id: string,
    field: 'keywords' | 'targetModel' | 'priority',
    value: string[] | string | number
  ) => {
    const newMappings = mappings.map((m) =>
      m.id === id ? { ...m, [field]: value } : m
    )
    onMappingsChange(newMappings)
  }

  const handleDeleteFamilyMapping = (id: string) => {
    const newMappings = mappings.filter((m) => m.id !== id)
    onMappingsChange(newMappings)
  }

  if (loadingModels) {
    return (
      <div className="flex items-center justify-center h-32 border rounded-lg bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="quick" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quick">快速配置</TabsTrigger>
          <TabsTrigger value="advanced">高级映射</TabsTrigger>
        </TabsList>

        {/* Quick Config Tab */}
        <TabsContent value="quick" className="space-y-4 mt-4">
          {/* Reasoning Model */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <Label className="text-sm font-medium">推理模型</Label>
              <Badge variant="secondary" className="text-xs">可选</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              当请求包含 thinking、effort 参数或复杂的 system prompt 时使用
            </p>
            <Select
              value={reasoningMapping?.targetModel || ''}
              onValueChange={handleReasoningChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="不使用推理模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">不使用推理模型</SelectItem>
                {providerModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Model */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <Label className="text-sm font-medium">默认模型</Label>
              <Badge variant="secondary" className="text-xs">推荐</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              当没有匹配到其他映射规则时使用此模型（兜底）
            </p>
            <Select
              value={defaultMapping?.targetModel || ''}
              onValueChange={handleDefaultChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择默认模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">不使用默认模型</SelectItem>
                {providerModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* Advanced Mappings Tab */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          {/* Exact Mappings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-500" />
                <Label className="text-sm font-medium">精确映射</Label>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddExactMapping}
                disabled={disabled}
              >
                <Plus className="h-3 w-3 mr-1" />
                添加
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              精确匹配源模型名称，优先级最高
            </p>
            
            {exactMappings.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">暂无精确映射</p>
              </div>
            ) : (
              <div className="space-y-2">
                {exactMappings.map((mapping) => (
                  <div key={mapping.id} className="flex items-center gap-2 p-3 border rounded-lg">
                    <Input
                      placeholder="源模型（如 claude-3-7-sonnet-20250219）"
                      value={mapping.sourceModel || ''}
                      onChange={(e) => handleUpdateExactMapping(mapping.id, 'sourceModel', e.target.value)}
                      disabled={disabled}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping.targetModel}
                      onValueChange={(v) => handleUpdateExactMapping(mapping.id, 'targetModel', v)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteExactMapping(mapping.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Family Mappings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-green-500" />
                <Label className="text-sm font-medium">家族映射</Label>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddFamilyMapping}
                disabled={disabled}
              >
                <Plus className="h-3 w-3 mr-1" />
                添加
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              通过关键词匹配模型家族（如 haiku、sonnet、opus）
            </p>
            
            {familyMappings.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">暂无家族映射</p>
              </div>
            ) : (
              <div className="space-y-3">
                {familyMappings.map((mapping) => (
                  <div key={mapping.id} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs">关键词（逗号分隔）</Label>
                        <Input
                          placeholder="haiku, sonnet, opus"
                          value={mapping.keywords?.join(', ') || ''}
                          onChange={(e) => {
                            const keywords = e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
                            handleUpdateFamilyMapping(mapping.id, 'keywords', keywords)
                          }}
                          disabled={disabled}
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteFamilyMapping(mapping.id)}
                        disabled={disabled}
                        className="mt-6"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs">目标模型</Label>
                        <Select
                          value={mapping.targetModel}
                          onValueChange={(v) => handleUpdateFamilyMapping(mapping.id, 'targetModel', v)}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {providerModels.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-2">
                        <Label className="text-xs">优先级</Label>
                        <Input
                          type="number"
                          value={mapping.priority || 0}
                          onChange={(e) => {
                            const priority = parseInt(e.target.value) || 0
                            handleUpdateFamilyMapping(mapping.id, 'priority', priority)
                          }}
                          disabled={disabled}
                          min={0}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Mapping Summary */}
      <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">映射优先级</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="gap-1">
            <Brain className="h-3 w-3" />
            推理模型
          </Badge>
          <span className="text-muted-foreground">{'>'}</span>
          <Badge variant="secondary" className="gap-1">
            <Hash className="h-3 w-3" />
            精确映射
          </Badge>
          <span className="text-muted-foreground">{'>'}</span>
          <Badge variant="secondary" className="gap-1">
            <Tags className="h-3 w-3" />
            家族映射
          </Badge>
          <span className="text-muted-foreground">{'>'}</span>
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3 w-3" />
            默认模型
          </Badge>
          <span className="text-muted-foreground">{'>'}</span>
          <span className="text-muted-foreground">原始模型</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>推理: {reasoningMapping ? '✓' : '✗'}</span>
        <span>默认: {defaultMapping ? '✓' : '✗'}</span>
        <span>精确: {exactMappings.length} 条</span>
        <span>家族: {familyMappings.length} 条</span>
      </div>
    </div>
  )
}
