/**
 * CLI Config Panel Component
 * 单个 CLI 的配置面板（供应商选择 + 模型映射 + 开关）
 */

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  RefreshCw, 
  Zap,
  Settings,
  FileText
} from 'lucide-react'
import { toast as showToast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ProviderSelector } from './provider-selector'
import { ModelMappingEditor } from './model-mapping-editor'
import type { CliType, CliCodeSwitchFullConfig, CliSwitchResult, CliConfigDetection, CliModelMappingItem } from '@/types'
import { useI18n } from '@/stores/i18n-store'

interface CliConfigPanelProps {
  cliType: CliType
  cliName: string
}

export function CliConfigPanel({ cliType, cliName }: CliConfigPanelProps) {
  const { t: _ } = useI18n()
  
  const [config, setConfig] = useState<CliCodeSwitchFullConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [detection, setDetection] = useState<CliConfigDetection | null>(null)
  const [processing, setProcessing] = useState(false)
  const [switchingProvider, setSwitchingProvider] = useState(false)

  useEffect(() => {
    loadConfig()
    detectConfig()
  }, [cliType])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const result = await window.api.invoke('cli-cs:get-config', { cliType }) as {
        success: boolean
        config?: CliCodeSwitchFullConfig['config']
        provider?: CliCodeSwitchFullConfig['provider']
        mappings?: CliCodeSwitchFullConfig['mappings']
        error?: string
      }
      if (result.success) {
        setConfig({
          config: result.config!,
          provider: result.provider || null,
          mappings: result.mappings || [],
        })
      } else {
        console.error('Failed to load config:', result.error)
      }
    } catch (error) {
      console.error('Failed to load CLI config:', error)
    } finally {
      setLoading(false)
    }
  }

  const detectConfig = async () => {
    try {
      const result = await window.api.invoke('cli-cs:detect-config', { cliType }) as {
        success: boolean
        detection?: CliConfigDetection
      }
      if (result.success && result.detection) {
        setDetection(result.detection)
      }
    } catch (error) {
      console.error('Failed to detect config:', error)
    }
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      // 启用前检查是否已选择供应商
      if (!config?.config.currentProviderId) {
        showToast.error('请先选择一个供应商')
        return
      }

      setProcessing(true)
      try {
        const result = await window.api.invoke('cli-cs:toggle', {
          cliType,
          enabled: true,
          providerId: config.config.currentProviderId,
        }) as {
          success: boolean
          message?: string
          error?: string
        }

        if (result.success) {
          showToast.success(result.message || '已启用')
          await loadConfig()
          await detectConfig()
        } else {
          showToast.error(result.error || '启用失败')
        }
      } catch (error) {
        console.error('Toggle error:', error)
        showToast.error(error instanceof Error ? error.message : '操作失败')
      } finally {
        setProcessing(false)
      }
    } else {
      // 禁用
      setProcessing(true)
      try {
        const result = await window.api.invoke('cli-cs:toggle', {
          cliType,
          enabled: false,
        }) as {
          success: boolean
          message?: string
          error?: string
        }

        if (result.success) {
          showToast.success(result.message || '已禁用')
          await loadConfig()
          await detectConfig()
        } else {
          showToast.error(result.error || '禁用失败')
        }
      } catch (error) {
        console.error('Toggle error:', error)
        showToast.error(error instanceof Error ? error.message : '操作失败')
      } finally {
        setProcessing(false)
      }
    }
  }

  const handleProviderChange = async (providerId: string) => {
    setSwitchingProvider(true)
    try {
      const result = await window.api.invoke('cli-cs:switch-provider', {
        cliType,
        providerId,
      }) as CliSwitchResult

      if (result.success) {
        showToast.success(result.message, {
          description: result.hasHistoricalMappings 
            ? '已恢复历史模型映射' 
            : '请配置模型映射',
        })
        await loadConfig()
      } else {
        showToast.error('切换供应商失败')
      }
    } catch (error) {
      console.error('Switch provider error:', error)
      showToast.error(error instanceof Error ? error.message : '切换失败')
    } finally {
      setSwitchingProvider(false)
    }
  }

  const handleMappingsChange = async (mappings: CliModelMappingItem[]) => {
    if (!config?.config.currentProviderId) {
      return
    }

    try {
      const result = await window.api.invoke('cli-cs:update-mappings', {
        cliType,
        providerId: config.config.currentProviderId,
        mappings,
      }) as {
        success: boolean
        error?: string
      }

      if (result.success) {
        showToast.success('模型映射已更新')
        await loadConfig()
      } else {
        showToast.error(result.error || '更新失败')
      }
    } catch (error) {
      console.error('Update mappings error:', error)
      showToast.error(error instanceof Error ? error.message : '更新失败')
    }
  }

  const handleRefresh = async () => {
    await Promise.all([loadConfig(), detectConfig()])
    showToast.success('已刷新')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isEnabled = config?.config.enabled || false
  const isTakeoverActive = config?.config.takeoverActive || false
  const currentProvider = config?.provider

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">{cliName}</Label>
              {isEnabled && (
                <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-3 w-3" />
                  已启用
                </Badge>
              )}
              {isTakeoverActive && (
                <Badge variant="outline" className="gap-1 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                  <Zap className="h-3 w-3" />
                  热切换
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isEnabled ? '当前已启用代理模式' : '使用此开关启用供应商切换'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={processing || switchingProvider}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={processing || loading || switchingProvider}
            />
          </div>
        </div>

        {/* Config Detection Status */}
        {detection && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-1">
                <div>配置文件: {detection.configPath}</div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>存在: {detection.exists ? '✓' : '✗'}</span>
                  <span>代理模式: {detection.isProxyMode ? '✓' : '✗'}</span>
                  <span>已备份: {detection.hasBackup ? '✓' : '✗'}</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Config Not Detected Warning */}
        {detection && !detection.exists && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              未找到配置文件，请先运行 {cliName} 生成配置文件后再启用
            </AlertDescription>
          </Alert>
        )}

        {/* Provider Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">选择供应商</Label>
          <ProviderSelector
            value={config?.config.currentProviderId || ''}
            onChange={handleProviderChange}
            disabled={switchingProvider || processing}
            currentProvider={currentProvider}
          />
        </div>

        {/* Model Mappings */}
        {config?.config.currentProviderId && currentProvider && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">模型映射</Label>
              {isTakeoverActive && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Zap className="h-3 w-3" />
                  立即生效
                </Badge>
              )}
            </div>
            <ModelMappingEditor
              cliType={cliType}
              providerId={config.config.currentProviderId}
              provider={currentProvider}
              mappings={config.mappings}
              onMappingsChange={handleMappingsChange}
              disabled={processing}
            />
          </div>
        )}

        {/* Help Info */}
        {!isEnabled && (
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription className="text-sm space-y-2">
              <p className="font-medium">启用步骤：</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>选择一个供应商</li>
                <li>配置模型映射（可选，启用后也可修改）</li>
                <li>打开上方的开关启用</li>
                <li>重启 {cliName} 使其生效</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {/* Hot Switch Info */}
        {isEnabled && isTakeoverActive && (
          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">热切换模式已激活</p>
              <p className="text-blue-700 dark:text-blue-300">
                切换供应商或修改模型映射将立即生效（{'<'}0.1s），无需重启 {cliName}
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
