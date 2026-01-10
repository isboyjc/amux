import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalHeader, ModalContent } from '@/components/ui/modal'
import { PageContainer } from '@/components/layout'
import { ipc } from '@/lib/ipc'
import {
  Search,
  RefreshCw,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RequestLog } from '@/types'
import type { LogFilter, PaginatedResult } from '@/types/ipc'

export function Logs() {
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filter: LogFilter = {
        search: search || undefined,
        statusRange: statusFilter
      }
      const result = await ipc.invoke('logs:query', filter, { page, pageSize }) as PaginatedResult<RequestLog>
      setLogs(result.data)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const filter: LogFilter = {
        search: search || undefined,
        statusRange: statusFilter
      }
      const data = await ipc.invoke('logs:export', filter, format)
      
      // Create download
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const handleClear = async () => {
    if (confirm('确定要清空所有日志吗？此操作不可撤销。')) {
      try {
        await ipc.invoke('logs:clear')
        fetchLogs()
      } catch (error) {
        console.error('Failed to clear logs:', error)
      }
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">请求日志</h1>
            <p className="text-muted-foreground">
              查看代理请求历史记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" />
              导出 JSON
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              导出 CSV
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
          </div>
        </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索代理路径、模型名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="success">成功</option>
                <option value="error">失败</option>
              </select>
            </div>
            <Button variant="outline" size="icon" onClick={fetchLogs}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">时间</th>
                  <th className="text-left p-3 text-sm font-medium">代理路径</th>
                  <th className="text-left p-3 text-sm font-medium">模型</th>
                  <th className="text-left p-3 text-sm font-medium">状态</th>
                  <th className="text-right p-3 text-sm font-medium">延迟</th>
                  <th className="text-right p-3 text-sm font-medium">Token</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      暂无日志记录
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatTime(log.createdAt)}
                      </td>
                      <td className="p-3">
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                          /{log.proxyPath}
                        </code>
                      </td>
                      <td className="p-3 text-sm">
                        <div className="flex flex-col">
                          <span>{log.sourceModel}</span>
                          {log.targetModel !== log.sourceModel && (
                            <span className="text-xs text-muted-foreground">
                              → {log.targetModel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={log.statusCode >= 200 && log.statusCode < 300 ? 'success' : 'destructive'}
                        >
                          {log.statusCode}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-sm tabular-nums">
                        {log.latencyMs}ms
                      </td>
                      <td className="p-3 text-right text-sm text-muted-foreground tabular-nums">
                        {log.inputTokens ?? '-'} / {log.outputTokens ?? '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {total} 条记录，第 {page} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

        {/* Log Detail Modal */}
        <LogDetailModal 
          log={selectedLog} 
          onClose={() => setSelectedLog(null)} 
        />
      </div>
    </PageContainer>
  )
}

function LogDetailModal({
  log,
  onClose
}: {
  log: RequestLog | null
  onClose: () => void
}) {
  if (!log) return null
  
  return (
    <Modal open={!!log} onClose={onClose} className="w-full max-w-2xl">
      <ModalHeader onClose={onClose}>
        <h2 className="text-lg font-semibold">请求详情</h2>
        <p className="text-sm text-muted-foreground">{formatTime(log.createdAt)}</p>
      </ModalHeader>
      <ModalContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">代理路径</Label>
            <p className="font-mono">/{log.proxyPath}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">状态码</Label>
            <p>
              <Badge
                variant={log.statusCode >= 200 && log.statusCode < 300 ? 'success' : 'destructive'}
              >
                {log.statusCode}
              </Badge>
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">源模型</Label>
            <p>{log.sourceModel}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">目标模型</Label>
            <p>{log.targetModel}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">延迟</Label>
            <p>{log.latencyMs}ms</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Token 用量</Label>
            <p>
              输入: {log.inputTokens ?? '-'} / 输出: {log.outputTokens ?? '-'}
            </p>
          </div>
        </div>
        
        {log.error && (
          <div>
            <Label className="text-muted-foreground">错误信息</Label>
            <pre className="mt-1 p-3 bg-destructive/10 rounded-lg text-sm text-destructive overflow-x-auto">
              {log.error}
            </pre>
          </div>
        )}

        {log.requestBody && (
          <div>
            <Label className="text-muted-foreground">请求体</Label>
            <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-x-auto max-h-[200px]">
              {formatJson(log.requestBody)}
            </pre>
          </div>
        )}

        {log.responseBody && (
          <div>
            <Label className="text-muted-foreground">响应体</Label>
            <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-x-auto max-h-[200px]">
              {formatJson(log.responseBody)}
            </pre>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
