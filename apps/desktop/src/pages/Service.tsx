import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PageContainer } from '@/components/layout'
import { useProxyStore, useSettingsStore } from '@/stores'
import {
  Play,
  Square,
  RefreshCw,
  Activity,
  Server,
  Gauge,
  Clock,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function Service() {
  const {
    status,
    port,
    host,
    error,
    metrics,
    start,
    stop,
    restart,
    fetchStatus,
    fetchMetrics
  } = useProxyStore()
  const { settings, fetch: fetchSettings, set: setSetting } = useSettingsStore()
  
  const [configPort, setConfigPort] = useState(port?.toString() || '9527')
  const [configHost, setConfigHost] = useState(host || '127.0.0.1')
  const [autoStart, setAutoStart] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchStatus()
    fetchMetrics()
    fetchSettings()

    // Refresh metrics every 3 seconds
    const interval = setInterval(() => {
      fetchMetrics()
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchStatus, fetchMetrics, fetchSettings])

  useEffect(() => {
    if (settings['proxy.port']) {
      setConfigPort(settings['proxy.port'].toString())
    }
    if (settings['proxy.host']) {
      setConfigHost(settings['proxy.host'])
    }
    if (settings['proxy.autoStart'] !== undefined) {
      setAutoStart(settings['proxy.autoStart'])
    }
  }, [settings])

  const handleStart = async () => {
    const portNum = parseInt(configPort) || 9527
    await start({ port: portNum, host: configHost })
  }

  const handleStop = async () => {
    await stop()
  }

  const handleRestart = async () => {
    const portNum = parseInt(configPort) || 9527
    await restart({ port: portNum, host: configHost })
  }

  const handleAutoStartChange = async (enabled: boolean) => {
    setAutoStart(enabled)
    await setSetting('proxy.autoStart', enabled)
  }

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(`http://${host}:${port}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const successRate = metrics && metrics.totalRequests > 0
    ? Math.round((metrics.successRequests / metrics.totalRequests) * 100)
    : 0

  const isRunning = status === 'running'

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">服务管理</h1>
            <p className="text-muted-foreground">
              控制代理服务和查看实时指标
            </p>
          </div>
        </div>

      {/* Service Control Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                isRunning ? 'bg-green-500/10' : 'bg-muted'
              )}>
                <Server className={cn(
                  'h-6 w-6',
                  isRunning ? 'text-green-500' : 'text-muted-foreground'
                )} />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  代理服务
                  <Badge
                    variant={isRunning ? 'success' : status === 'error' ? 'destructive' : 'secondary'}
                  >
                    {status === 'running' && '运行中'}
                    {status === 'stopped' && '已停止'}
                    {status === 'starting' && '启动中'}
                    {status === 'stopping' && '停止中'}
                    {status === 'error' && '错误'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {isRunning && port ? (
                    <span className="flex items-center gap-2">
                      监听地址: 
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        http://{host}:{port}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCopyAddress}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </span>
                  ) : error ? (
                    <span className="text-destructive">{error}</span>
                  ) : (
                    '服务未启动'
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  <Button variant="outline" onClick={handleStop}>
                    <Square className="h-4 w-4 mr-2" />
                    停止
                  </Button>
                  <Button onClick={handleRestart}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重启
                  </Button>
                </>
              ) : (
                <Button onClick={handleStart} disabled={status === 'starting'}>
                  <Play className="h-4 w-4 mr-2" />
                  {status === 'starting' ? '启动中...' : '启动'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">监听地址</Label>
              <Input
                id="host"
                value={configHost}
                onChange={(e) => setConfigHost(e.target.value)}
                disabled={isRunning}
                placeholder="127.0.0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                type="number"
                value={configPort}
                onChange={(e) => setConfigPort(e.target.value)}
                disabled={isRunning}
                placeholder="9527"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2 h-9">
                <Switch
                  checked={autoStart}
                  onCheckedChange={handleAutoStartChange}
                />
                <Label>开机自启</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="总请求"
          value={metrics?.totalRequests ?? 0}
          icon={Activity}
          description="累计处理请求数"
        />
        <MetricCard
          title="成功率"
          value={`${successRate}%`}
          icon={ArrowUpRight}
          description={`${metrics?.successRequests ?? 0} 成功 / ${metrics?.failedRequests ?? 0} 失败`}
          valueColor={successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500'}
        />
        <MetricCard
          title="平均延迟"
          value={`${metrics?.averageLatency ?? 0}ms`}
          icon={Clock}
          description={`P95: ${metrics?.p95Latency ?? 0}ms`}
        />
        <MetricCard
          title="活跃连接"
          value={metrics?.activeConnections ?? 0}
          icon={Zap}
          description="当前活跃的 SSE 连接"
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">延迟分布</CardTitle>
            <CardDescription>请求响应时间百分位</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <LatencyBar label="P50" value={metrics?.p50Latency ?? 0} max={1000} />
              <LatencyBar label="P95" value={metrics?.p95Latency ?? 0} max={1000} />
              <LatencyBar label="P99" value={metrics?.p99Latency ?? 0} max={1000} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Token 使用量</CardTitle>
            <CardDescription>累计 Token 消耗统计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">输入 Token</span>
                <span className="font-mono font-semibold">
                  {formatNumber(metrics?.totalInputTokens ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">输出 Token</span>
                <span className="font-mono font-semibold">
                  {formatNumber(metrics?.totalOutputTokens ?? 0)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">总计</span>
                <span className="font-mono font-semibold text-primary">
                  {formatNumber((metrics?.totalInputTokens ?? 0) + (metrics?.totalOutputTokens ?? 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Request Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              请求速率
            </CardTitle>
            <CardDescription>实时请求吞吐量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tabular-nums">
              {metrics?.requestsPerMinute ?? 0}
              <span className="text-lg font-normal text-muted-foreground ml-2">
                次/分钟
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  valueColor
}: {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
  valueColor?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', valueColor)}>{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function LatencyBar({
  label,
  value,
  max
}: {
  label: string
  value: number
  max: number
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const color = value < 200 ? 'bg-green-500' : value < 500 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}ms</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}
