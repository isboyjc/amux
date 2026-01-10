import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/modal'
import { PageContainer } from '@/components/layout'
import { useBridgeProxyStore, useProviderStore, useI18n } from '@/stores'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Check,
  Network,
  ArrowRight,
  Link2,
  RefreshCw,
  Server
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BridgeProxy, Provider } from '@/types'
import type { CreateProxyDTO } from '@/types/ipc'

const ADAPTER_TYPES = [
  { value: 'openai', label: 'OpenAI', color: 'text-emerald-500' },
  { value: 'anthropic', label: 'Anthropic', color: 'text-amber-500' },
  { value: 'deepseek', label: 'DeepSeek', color: 'text-blue-500' },
  { value: 'moonshot', label: 'Moonshot', color: 'text-violet-500' },
  { value: 'qwen', label: 'Qwen', color: 'text-indigo-500' },
  { value: 'zhipu', label: 'Zhipu', color: 'text-cyan-500' },
  { value: 'google', label: 'Google', color: 'text-rose-500' },
]

export function Proxies() {
  const { proxies, loading, fetch, create, update, remove, toggle } = useBridgeProxyStore()
  const { providers, fetch: fetchProviders } = useProviderStore()
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProxy, setEditingProxy] = useState<BridgeProxy | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  useEffect(() => {
    fetch()
    fetchProviders()
  }, [fetch, fetchProviders])

  const filteredProxies = proxies.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.proxyPath.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (data: CreateProxyDTO) => {
    await create(data)
    setShowForm(false)
  }

  const handleUpdate = async (id: string, data: Partial<CreateProxyDTO>) => {
    await update(id, data)
    setEditingProxy(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm(t('proxies.deleteConfirm'))) {
      await remove(id)
    }
  }

  const handleCopyPath = async (path: string) => {
    await navigator.clipboard.writeText(`http://127.0.0.1:9527/${path}`)
    setCopiedPath(path)
    setTimeout(() => setCopiedPath(null), 2000)
  }

  const getProviderName = (id: string) => {
    const provider = providers.find(p => p.id === id)
    return provider?.name || id
  }

  const getProxyName = (id: string) => {
    const proxy = proxies.find(p => p.id === id)
    return proxy?.name || proxy?.proxyPath || id
  }

  const enabledCount = proxies.filter(p => p.enabled).length

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('proxies.title')}</h1>
            <p className="text-muted-foreground">
              {t('proxies.description')}
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            {t('proxies.add')}
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Network className="h-4 w-4 text-primary" />
            </div>
            <span className="text-muted-foreground">{t('proxies.total')}:</span>
            <span className="font-semibold">{proxies.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">{t('proxies.active')}:</span>
            <span className="font-semibold">{enabledCount}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('proxies.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Proxy List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProxies.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Network className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">
                {search ? t('common.noData') : t('proxies.noProxies')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('proxies.noProxiesDesc')}
              </p>
              {!search && (
                <Button onClick={() => setShowForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t('proxies.add')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredProxies.map((proxy) => (
              <ProxyCard
                key={proxy.id}
                proxy={proxy}
                providers={providers}
                proxies={proxies}
                onToggle={(enabled) => toggle(proxy.id, enabled)}
                onEdit={() => setEditingProxy(proxy)}
                onDelete={() => handleDelete(proxy.id)}
                onCopyPath={() => handleCopyPath(proxy.proxyPath)}
                copied={copiedPath === proxy.proxyPath}
                getProviderName={getProviderName}
                getProxyName={getProxyName}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Form Modal */}
        <ProxyFormModal
          open={showForm || !!editingProxy}
          proxy={editingProxy}
          providers={providers}
          proxies={proxies}
          onSave={editingProxy
            ? (data) => handleUpdate(editingProxy.id, data)
            : handleCreate
          }
          onClose={() => {
            setShowForm(false)
            setEditingProxy(null)
          }}
          t={t}
        />
      </div>
    </PageContainer>
  )
}

function ProxyCard({
  proxy,
  onToggle,
  onEdit,
  onDelete,
  onCopyPath,
  copied,
  getProviderName,
  getProxyName,
  t
}: {
  proxy: BridgeProxy
  providers: Provider[]
  proxies: BridgeProxy[]
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onCopyPath: () => void
  copied: boolean
  getProviderName: (id: string) => string
  getProxyName: (id: string) => string
  t: (key: string) => string
}) {
  const inboundInfo = ADAPTER_TYPES.find(a => a.value === proxy.inboundAdapter)
  
  return (
    <Card className={cn(
      'group transition-all hover:shadow-md',
      !proxy.enabled && 'opacity-60'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Proxy Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Network className="h-5 w-5 text-primary" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{proxy.name || proxy.proxyPath}</h3>
              </div>

              {/* Path */}
              <div className="flex items-center gap-1.5 mb-2">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  /{proxy.proxyPath}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onCopyPath}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Flow: Inbound → Outbound */}
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', inboundInfo?.color)}>
                  {inboundInfo?.label || proxy.inboundAdapter}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {proxy.outboundType === 'provider' ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    {getProviderName(proxy.outboundId)}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    {getProxyName(proxy.outboundId)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Switch
              checked={proxy.enabled}
              onCheckedChange={onToggle}
              className="mr-1"
            />
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProxyFormModal({
  open,
  proxy,
  providers,
  proxies,
  onSave,
  onClose,
  t
}: {
  open: boolean
  proxy: BridgeProxy | null
  providers: Provider[]
  proxies: BridgeProxy[]
  onSave: (data: CreateProxyDTO) => void
  onClose: () => void
  t: (key: string) => string
}) {
  const [formData, setFormData] = useState<CreateProxyDTO>({
    name: proxy?.name || '',
    inboundAdapter: proxy?.inboundAdapter || 'openai',
    outboundType: proxy?.outboundType || 'provider',
    outboundId: proxy?.outboundId || '',
    proxyPath: proxy?.proxyPath || '',
    enabled: proxy?.enabled ?? true
  })

  useEffect(() => {
    if (proxy) {
      setFormData({
        name: proxy.name || '',
        inboundAdapter: proxy.inboundAdapter,
        outboundType: proxy.outboundType,
        outboundId: proxy.outboundId,
        proxyPath: proxy.proxyPath,
        enabled: proxy.enabled
      })
    } else {
      setFormData({
        name: '',
        inboundAdapter: 'openai',
        outboundType: 'provider',
        outboundId: '',
        proxyPath: '',
        enabled: true
      })
    }
  }, [proxy, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  // Filter out current proxy from chain options to prevent self-reference
  const availableProxies = proxies.filter(p => p.id !== proxy?.id)

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <ModalHeader onClose={onClose}>
          <h2 className="text-lg font-semibold">
            {proxy ? t('proxies.edit') : t('proxies.add')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('proxies.formDesc')}
          </p>
        </ModalHeader>
        <ModalContent className="space-y-4">
          {/* Name & Path Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                {t('proxies.name')} <span className="text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Proxy"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proxyPath" className="text-xs">{t('proxies.proxyPath')}</Label>
              <div className="flex items-center">
                <span className="text-muted-foreground text-sm mr-1">/</span>
                <Input
                  id="proxyPath"
                  value={formData.proxyPath}
                  onChange={(e) => setFormData({ ...formData, proxyPath: e.target.value })}
                  placeholder="openai"
                  className="h-9"
                  required
                />
              </div>
            </div>
          </div>

          {/* Access URL hint */}
          <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded">
            {t('proxies.accessUrl')}: <code className="font-mono">http://127.0.0.1:9527/{formData.proxyPath || 'path'}/v1/chat/completions</code>
          </div>

          {/* Inbound Adapter */}
          <div className="space-y-1.5">
            <Label htmlFor="inboundAdapter" className="text-xs">{t('proxies.inboundAdapter')}</Label>
            <select
              id="inboundAdapter"
              value={formData.inboundAdapter}
              onChange={(e) => setFormData({ ...formData, inboundAdapter: e.target.value as typeof formData.inboundAdapter })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ADAPTER_TYPES.map((adapter) => (
                <option key={adapter.value} value={adapter.value}>
                  {adapter.label}
                </option>
              ))}
            </select>
          </div>

          {/* Outbound Type & Target */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="outboundType" className="text-xs">{t('proxies.outboundType')}</Label>
              <select
                id="outboundType"
                value={formData.outboundType}
                onChange={(e) => setFormData({
                  ...formData,
                  outboundType: e.target.value as 'provider' | 'proxy',
                  outboundId: ''
                })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="provider">{t('proxies.typeProvider')}</option>
                <option value="proxy">{t('proxies.typeChain')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outboundId" className="text-xs">{t('proxies.outboundId')}</Label>
              <select
                id="outboundId"
                value={formData.outboundId}
                onChange={(e) => setFormData({ ...formData, outboundId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">{t('proxies.selectTarget')}</option>
                {formData.outboundType === 'provider' ? (
                  providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  availableProxies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.proxyPath}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Enabled Switch */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label className="text-sm">{t('proxies.enabled')}</Label>
              <p className="text-xs text-muted-foreground">{t('proxies.enabledDesc')}</p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} size="sm">
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm">
            {t('common.save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
