import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Loader2,
  Clock,
  Zap,
  Hash,
  ArrowRight,
  AlertCircle,
  Globe
} from 'lucide-react'

import { TerminalIcon, TrashIcon, RefreshIcon } from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalHeader, ModalContent } from '@/components/ui/modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { useI18n } from '@/stores'
import type { RequestLog } from '@/types'
import type { LogFilter, PaginatedResult } from '@/types/ipc'

export function Logs() {
  const { t, locale } = useI18n()
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null)
  const refreshIconRef = useRef<AnimatedIconHandle>(null)

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
      
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('logs.exportSuccess') || 'Exported successfully')
    } catch (error) {
      console.error('Failed to export logs:', error)
      toast.error(t('logs.exportFailed') || 'Export failed')
    }
  }

  const handleClear = async () => {
    if (confirm(t('logs.clearConfirm'))) {
      try {
        await ipc.invoke('logs:clear')
        fetchLogs()
        toast.success(t('logs.clearSuccess') || 'Logs cleared')
      } catch (error) {
        console.error('Failed to clear logs:', error)
      }
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const successCount = logs.filter(l => l.statusCode >= 200 && l.statusCode < 300).length
  const errorCount = logs.filter(l => l.statusCode >= 400).length

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">
      {/* Header Card */}
      <div className="content-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('logs.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('logs.description')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                    <Download className="h-4 w-4 mr-1.5" />
                    JSON
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('logs.export')} JSON</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                    <Download className="h-4 w-4 mr-1.5" />
                    CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('logs.export')} CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" size="sm" onClick={handleClear}>
                    <TrashIcon size={14} dangerHover className="mr-1.5" />
                    {t('logs.clear')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('logs.clear')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('logs.total') || 'Total'}:</span>
            <span className="font-medium">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">{t('logs.success') || 'Success'}:</span>
            <span className="font-medium text-green-600">{successCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">{t('logs.error') || 'Error'}:</span>
            <span className="font-medium text-red-600">{errorCount}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('logs.searchPlaceholder') || 'Search proxy path, model...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">{t('logs.filterAll') || 'All Status'}</option>
              <option value="success">{t('logs.filterSuccess') || 'Success'}</option>
              <option value="error">{t('logs.filterError') || 'Error'}</option>
            </select>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9"
                  onClick={fetchLogs}
                  onMouseEnter={() => refreshIconRef.current?.startAnimation()}
                  onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshIcon ref={refreshIconRef} size={16} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.refresh')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <TerminalIcon size={40} className="mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">{t('logs.noLogs')}</p>
              <p className="text-xs mt-1">{t('logs.noLogsDesc')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <LogItem 
                  key={log.id} 
                  log={log} 
                  onClick={() => setSelectedLog(log)}
                  formatTime={formatTime}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('logs.paginationInfo')
                ?.replace('{total}', String(total))
                .replace('{page}', String(page))
                .replace('{totalPages}', String(totalPages)) ||
                `Total ${total} records, Page ${page} / ${totalPages}`
              }
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      <LogDetailModal 
        log={selectedLog} 
        onClose={() => setSelectedLog(null)}
        t={t}
        locale={locale}
      />
    </div>
  )
}

// ==================== Log Item ====================

interface LogItemProps {
  log: RequestLog
  onClick: () => void
  formatTime: (timestamp: number) => string
  t: (key: string) => string
}

function LogItem({ log, onClick, formatTime, t }: LogItemProps) {
  const isSuccess = log.statusCode >= 200 && log.statusCode < 300
  const hasError = log.error || log.statusCode >= 400

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Status Icon */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        isSuccess ? "bg-green-500/10" : "bg-red-500/10"
      )}>
        {isSuccess ? (
          <Zap className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-500" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-medium bg-muted px-1.5 py-0.5 rounded">
            /{log.proxyPath}
          </code>
          <Badge
            variant={isSuccess ? 'success' : 'destructive'}
            className="text-[10px] px-1.5 py-0"
          >
            {log.statusCode}
          </Badge>
          {log.source === 'tunnel' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                  >
                    <Globe className="h-2.5 w-2.5 mr-1" />
                    {t('logs.tunnel') || 'Tunnel'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {t('logs.tunnelDesc') || 'Request from internet via tunnel'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="truncate max-w-[200px]">{log.sourceModel}</span>
          {log.targetModel !== log.sourceModel && (
            <>
              <ArrowRight className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{log.targetModel}</span>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          <span className="tabular-nums">{log.latencyMs}ms</span>
        </div>
        <div className="flex items-center gap-1 w-24 justify-end">
          <span className="tabular-nums">
            {log.inputTokens ?? '-'} / {log.outputTokens ?? '-'}
          </span>
        </div>
        <div className="flex items-center gap-1 w-32 justify-end">
          <Clock className="h-3 w-3" />
          <span>{formatTime(log.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ==================== Log Detail Modal ====================

interface LogDetailModalProps {
  log: RequestLog | null
  onClose: () => void
  t: (key: string) => string
  locale: string
}

function LogDetailModal({ log, onClose, t, locale }: LogDetailModalProps) {
  if (!log) return null

  const isSuccess = log.statusCode >= 200 && log.statusCode < 300

  const formatFullTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatJson = (str: string): string => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2)
    } catch {
      return str
    }
  }

  return (
    <Modal open={!!log} onClose={onClose} className="w-full max-w-2xl">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isSuccess ? "bg-green-500/10" : "bg-red-500/10"
          )}>
            {isSuccess ? (
              <Zap className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('logs.requestDetail') || 'Request Detail'}</h2>
            <p className="text-sm text-muted-foreground">{formatFullTime(log.createdAt)}</p>
          </div>
        </div>
      </ModalHeader>
      <ModalContent className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Basic Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.proxyPath')}</Label>
            <p className="font-mono text-sm">/{log.proxyPath}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.status')}</Label>
            <Badge variant={isSuccess ? 'success' : 'destructive'}>
              {log.statusCode}
            </Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.sourceModel') || 'Source Model'}</Label>
            <p className="text-sm">{log.sourceModel}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.targetModel') || 'Target Model'}</Label>
            <p className="text-sm">{log.targetModel}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.latency')}</Label>
            <p className="text-sm tabular-nums">{log.latencyMs}ms</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.tokens')}</Label>
            <p className="text-sm tabular-nums">
              {t('logs.input') || 'In'}: {log.inputTokens ?? '-'} / {t('logs.output') || 'Out'}: {log.outputTokens ?? '-'}
            </p>
          </div>
        </div>
        
        {/* Error */}
        {log.error && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('common.error')}</Label>
            <pre className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive overflow-x-auto">
              {log.error}
            </pre>
          </div>
        )}

        {/* Request Body */}
        {log.requestBody && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.requestBody') || 'Request Body'}</Label>
            <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto max-h-[200px]">
              {formatJson(log.requestBody)}
            </pre>
          </div>
        )}

        {/* Response Body */}
        {log.responseBody && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('logs.responseBody') || 'Response Body'}</Label>
            <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto max-h-[200px]">
              {formatJson(log.responseBody)}
            </pre>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}
