/**
 * Main chat card component
 */

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { Logo } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ipc } from '@/lib/ipc'
import { useI18n } from '@/stores/i18n-store'
import { useChatStore, useProviderStore, useBridgeProxyStore } from '@/stores'

import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { ChatHistory } from './ChatHistory'
import { ProxySelector } from './ProxySelector'

export function ChatCard() {
  const { t } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [serviceStatus, setServiceStatus] = useState<'running' | 'stopped' | 'error'>('stopped')
  const [isStartingService, setIsStartingService] = useState(false)

  // Chat store
  const {
    conversations,
    currentConversation,
    messages,
    isStreaming,
    streamingContent,
    streamingReasoning,
    selectedProxy,
    selectedModel,
    error,
    fetchConversations,
    deleteConversation,
    selectConversation,
    sendMessage,
    stopStreaming,
    setSelectedProxy,
    setSelectedModel,
    deleteMessage,
    deleteMessagePair,
    regenerate,
    handleStreamStart,
    handleStreamContent,
    handleStreamReasoning,
    handleStreamEnd,
    handleStreamError
  } = useChatStore()

  // Provider and proxy stores
  const { providers, fetch: fetchProviders, fetchPresets, presets: providerPresets } = useProviderStore()
  const { proxies, fetch: fetchProxies } = useBridgeProxyStore()

  // Initial data fetch
  useEffect(() => {
    fetchConversations()
    fetchProviders()
    fetchProxies()
    fetchPresets()

    // Check proxy service status
    checkServiceStatus()
  }, [fetchConversations, fetchProviders, fetchProxies, fetchPresets])

  // Check and auto-start proxy service
  const checkServiceStatus = async () => {
    try {
      const status = await ipc.invoke('proxy-service:status')
      setServiceStatus(status.status)

      // Auto-start service only if explicitly stopped
      if (status.status === 'stopped' && !isStartingService) {
        await startProxyService()
      }
    } catch (error) {
      console.error('[ChatCard] Failed to check service status:', error)
      setServiceStatus('error')
    }
  }

  // Start proxy service
  const startProxyService = async () => {
    setIsStartingService(true)
    try {
      await ipc.invoke('proxy-service:start')
      setServiceStatus('running')
    } catch (error) {
      console.error('[ChatCard] Failed to start service:', error)
      // If error is "already running", treat as success
      if (error instanceof Error && error.message.includes('already running')) {
        setServiceStatus('running')
      } else {
        setServiceStatus('error')
      }
    } finally {
      setIsStartingService(false)
    }
  }

  // Setup IPC event listeners for streaming
  useEffect(() => {
    const api = (window as any).api
    if (!api) return

    const unsubStart = api.on('chat:stream-start', handleStreamStart)
    const unsubContent = api.on('chat:stream-content', handleStreamContent)
    const unsubReasoning = api.on('chat:stream-reasoning', handleStreamReasoning)
    const unsubEnd = api.on('chat:stream-end', handleStreamEnd)
    const unsubError = api.on('chat:stream-error', handleStreamError)

    return () => {
      unsubStart?.()
      unsubContent?.()
      unsubReasoning?.()
      unsubEnd?.()
      unsubError?.()
    }
  }, [handleStreamStart, handleStreamContent, handleStreamReasoning, handleStreamEnd, handleStreamError])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleNewConversation = () => {
    selectConversation(null)
  }

  const handleSend = async (content: string) => {
    // Check service status before sending
    if (serviceStatus !== 'running') {
      if (isStartingService) {
        return // Wait for service to start
      }
      // Try to start service
      await startProxyService()
      if (serviceStatus !== 'running') {
        return // Service failed to start
      }
    }

    await sendMessage(content)
  }

  const hasMessages = messages.length > 0 || currentConversation

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {hasMessages ? (
        // Conversation view
        <>
          {/* Header - no border */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {currentConversation?.title ? (
                <h2 className="text-sm font-medium truncate">
                  {currentConversation.title}
                </h2>
              ) : (
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t('chat.newConversation')}
                </h2>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className="h-7 px-2 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">{t('chat.new')}</span>
              </Button>

              <ChatHistory
                conversations={conversations}
                currentId={currentConversation?.id || null}
                onSelect={selectConversation}
                onDelete={deleteConversation}
              />
            </div>
          </div>

          {/* Messages - with bottom padding for input */}
          <div className="flex-1 overflow-y-auto pb-24">
            <div className="max-w-2xl mx-auto px-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={
                    isStreaming &&
                    index === messages.length - 1 &&
                    message.role === 'assistant'
                  }
                  streamingContent={
                    index === messages.length - 1 ? streamingContent : undefined
                  }
                  streamingReasoning={
                    index === messages.length - 1 ? streamingReasoning : undefined
                  }
                  onDelete={() => {
                    if (message.role === 'user') {
                      deleteMessagePair(message.id)
                    } else {
                      deleteMessage(message.id)
                    }
                  }}
                  onRegenerate={message.role === 'assistant' ? () => regenerate(message.id) : undefined}
                />
              ))}

              {/* Streaming assistant message placeholder */}
              {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <ChatMessage
                  message={{
                    id: 'streaming',
                    conversationId: currentConversation?.id || '',
                    role: 'assistant',
                    content: null,
                    reasoning: null,
                    toolCalls: null,
                    usage: null,
                    createdAt: Date.now()
                  }}
                  isStreaming={true}
                  streamingContent={streamingContent}
                  streamingReasoning={streamingReasoning}
                />
              )}

              {/* Error message display */}
              {error && !isStreaming && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium mb-1">{t('chat.streamError')}</p>
                  <p className="text-xs text-destructive/80">{error}</p>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Input floating at absolute bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-2">
            <div className="max-w-2xl mx-auto">
              <ChatInput
                onSend={handleSend}
                onStop={stopStreaming}
                disabled={!selectedProxy || !selectedModel || serviceStatus !== 'running'}
                isStreaming={isStreaming}
                proxySelector={
                  <ProxySelector
                    providers={providers}
                    providerPresets={providerPresets}
                    proxies={proxies}
                    selectedProxy={selectedProxy}
                    selectedModel={selectedModel}
                    onProxyChange={setSelectedProxy}
                    onModelChange={setSelectedModel}
                    disabled={isStreaming}
                  />
                }
              />
              {serviceStatus !== 'running' && (
                <p className="text-xs text-muted-foreground mt-2">
                  {isStartingService
                    ? t('chat.serviceStarting') || 'Starting proxy service...'
                    : serviceStatus === 'error'
                    ? t('chat.serviceError') || 'Proxy service error. Please check settings.'
                    : t('chat.serviceStopped') || 'Proxy service stopped. Starting...'}
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        // Welcome view - full height centered
        <>
          {/* Header with actions - top right */}
          <div className="flex items-center justify-end px-3 py-2 shrink-0">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className="h-7 px-2 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">{t('chat.new')}</span>
              </Button>

              <ChatHistory
                conversations={conversations}
                currentId={null}
                onSelect={selectConversation}
                onDelete={deleteConversation}
              />
            </div>
          </div>

          {/* Centered content - takes remaining height */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
            <div className="flex flex-col items-center mb-8">
              <Logo size={48} color="currentColor" className="text-foreground mb-4" />
              <h1 className="text-xl font-semibold mb-2">{t('chat.welcome')}</h1>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {t('chat.welcomeDesc')}
              </p>
            </div>

            <div className="w-full max-w-2xl">
              <ChatInput
                onSend={handleSend}
                onStop={stopStreaming}
                disabled={!selectedProxy || !selectedModel || serviceStatus !== 'running'}
                isStreaming={isStreaming}
                proxySelector={
                  <ProxySelector
                    providers={providers}
                    providerPresets={providerPresets}
                    proxies={proxies}
                    selectedProxy={selectedProxy}
                    selectedModel={selectedModel}
                    onProxyChange={setSelectedProxy}
                    onModelChange={setSelectedModel}
                    disabled={isStreaming}
                  />
                }
              />
              {serviceStatus !== 'running' && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {isStartingService
                    ? t('chat.serviceStarting') || 'Starting proxy service...'
                    : serviceStatus === 'error'
                    ? t('chat.serviceError') || 'Proxy service error. Please check settings.'
                    : t('chat.serviceStopped') || 'Proxy service stopped. Starting...'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
