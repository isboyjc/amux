/**
 * Chat message component with reasoning support
 */

import { useState, useRef, useEffect } from 'react'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'
import { CopyIcon, RefreshIcon, TrashIcon, CheckIcon } from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons/types'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
  streamingContent?: string
  streamingReasoning?: string
  onDelete?: () => void
  onRegenerate?: () => void
}

export function ChatMessage({
  message,
  isStreaming = false,
  streamingContent,
  streamingReasoning,
  onDelete,
  onRegenerate
}: ChatMessageProps) {
  const { t } = useI18n()
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  const [copiedUser, setCopiedUser] = useState(false)
  const [copiedAssistant, setCopiedAssistant] = useState(false)
  const copyIconRef = useRef<AnimatedIconHandle>(null)
  const copyIconRefUser = useRef<AnimatedIconHandle>(null)
  const refreshIconRef = useRef<AnimatedIconHandle>(null)
  const trashIconRef = useRef<AnimatedIconHandle>(null)
  const trashIconRefUser = useRef<AnimatedIconHandle>(null)
  const reasoningPreviewRef = useRef<HTMLDivElement>(null)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Use streaming content if available, otherwise use message content
  const content = isStreaming && streamingContent !== undefined
    ? streamingContent
    : message.content || ''

  const reasoning = isStreaming && streamingReasoning !== undefined
    ? streamingReasoning
    : message.reasoning || ''

  const hasReasoning = reasoning.length > 0
  // Reasoning is streaming ONLY when we're streaming reasoning and NOT yet streaming content
  // Once content starts streaming, reasoning is complete
  const isReasoningStreaming = isStreaming &&
    streamingReasoning !== undefined &&
    streamingReasoning.length > 0 &&
    (!streamingContent || streamingContent.length === 0)
  // Reasoning is complete when we have reasoning but it's not streaming
  const isReasoningComplete = hasReasoning && !isReasoningStreaming

  // Auto-scroll to bottom when reasoning is streaming and collapsed
  useEffect(() => {
    if (isReasoningStreaming && !reasoningExpanded && reasoningPreviewRef.current) {
      reasoningPreviewRef.current.scrollTop = reasoningPreviewRef.current.scrollHeight
    }
  }, [reasoning, isReasoningStreaming, reasoningExpanded])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      if (isUser) {
        setCopiedUser(true)
        setTimeout(() => setCopiedUser(false), 2000)
      } else {
        setCopiedAssistant(true)
        setTimeout(() => setCopiedAssistant(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleRegenerate = () => {
    refreshIconRef.current?.startAnimation()
    onRegenerate?.()
  }

  const handleDelete = () => {
    onDelete?.()
  }

  return (
    <div
      className={cn(
        'py-4 group',
        isUser ? 'flex justify-end' : ''
      )}
    >
      {/* User message - bubble style, max 80% width, larger radius */}
      {isUser && (
        <div className="relative max-w-[80%]">
          <div className={cn(
            'rounded-2xl px-4 py-2.5',
            'bg-muted/80 text-foreground',
            'text-sm leading-relaxed'
          )}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="my-0">{children}</p>,
                pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
                code: ({ children }) => <code className="text-xs bg-muted/50 px-1 py-0.5 rounded">{children}</code>
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          {/* Action buttons - show on hover */}
          <div className="mt-1 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              onMouseEnter={() => !copiedUser && copyIconRefUser.current?.startAnimation()}
              onMouseLeave={() => !copiedUser && copyIconRefUser.current?.stopAnimation()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {copiedUser ? (
                <CheckIcon size={14} success />
              ) : (
                <CopyIcon ref={copyIconRefUser} size={14} />
              )}
            </button>
            <button
              onClick={handleDelete}
              onMouseEnter={() => trashIconRefUser.current?.startAnimation()}
              onMouseLeave={() => trashIconRefUser.current?.stopAnimation()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <TrashIcon ref={trashIconRefUser} size={14} dangerHover />
            </button>
          </div>
        </div>
      )}

      {/* Assistant message - no bubble, full width */}
      {isAssistant && (
        <div className="relative">
          {/* Reasoning block - collapsible, default collapsed */}
          {(hasReasoning || isReasoningStreaming) && (
            <div className="mb-4">
              {/* Thinking indicator - clickable to toggle */}
              <button
                onClick={() => setReasoningExpanded(!reasoningExpanded)}
                className="flex items-center gap-1.5 mb-2 text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors"
              >
                {isReasoningStreaming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                )}
                <span className="text-xs font-medium">
                  {isReasoningStreaming ? t('chat.thinkingInProgress') : t('chat.thinking')}
                </span>
                {reasoningExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {/* Reasoning content */}
              {reasoning && (
                <>
                  {/* Collapsed state - show last 2 lines when streaming, hide when complete */}
                  {!reasoningExpanded && isReasoningStreaming && (
                    <div
                      ref={reasoningPreviewRef}
                      className="h-[2.8rem] overflow-hidden text-[13px] text-muted-foreground/60 leading-[1.4rem]"
                    >
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="my-0 leading-[1.4rem]">{children}</p>,
                          pre: ({ children }) => <pre className="my-0 overflow-x-auto text-xs">{children}</pre>,
                          code: ({ children }) => <code className="text-xs bg-muted/30 px-1 py-0.5 rounded">{children}</code>,
                          ul: ({ children }) => <ul className="my-0 pl-4 list-disc">{children}</ul>,
                          ol: ({ children }) => <ol className="my-0 pl-4 list-decimal">{children}</ol>,
                          li: ({ children }) => <li className="my-0 leading-[1.4rem]">{children}</li>
                        }}
                      >
                        {reasoning}
                      </ReactMarkdown>
                      {/* Streaming cursor */}
                      <span className="inline-block w-1.5 h-3.5 bg-muted-foreground/30 animate-pulse ml-0.5 align-middle" />
                    </div>
                  )}

                  {/* Expanded state - show full content */}
                  {reasoningExpanded && (
                    <div className="text-sm text-muted-foreground/60 leading-relaxed">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="my-1.5 first:mt-0">{children}</p>,
                          pre: ({ children }) => <pre className="my-2 overflow-x-auto text-xs">{children}</pre>,
                          code: ({ children }) => <code className="text-xs bg-muted/30 px-1 py-0.5 rounded">{children}</code>,
                          ul: ({ children }) => <ul className="my-1.5 pl-4 list-disc">{children}</ul>,
                          ol: ({ children }) => <ol className="my-1.5 pl-4 list-decimal">{children}</ol>,
                          li: ({ children }) => <li className="my-0.5">{children}</li>
                        }}
                      >
                        {reasoning}
                      </ReactMarkdown>
                      {/* Streaming cursor - only show when reasoning is actively streaming */}
                      {isReasoningStreaming && (
                        <span className="inline-block w-1.5 h-3.5 bg-muted-foreground/30 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Main content - normal text color */}
          <div className="text-sm leading-relaxed text-foreground">
            {content ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                  pre: ({ children }) => (
                    <pre className="my-3 p-3 bg-muted/50 rounded-lg overflow-x-auto text-xs">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="text-xs bg-muted/50 px-1 py-0.5 rounded font-mono">{children}</code>
                    ) : (
                      <code className="text-xs font-mono">{children}</code>
                    )
                  },
                  ul: ({ children }) => <ul className="my-2 pl-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="my-2 pl-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="my-1">{children}</li>,
                  h1: ({ children }) => <h1 className="text-lg font-semibold my-3">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold my-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold my-2">{children}</h3>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  )
                }}
              >
                {content}
              </ReactMarkdown>
            ) : isStreaming && !isReasoningStreaming ? (
              // Breathing animation while waiting for response
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }} />
                <span className="text-sm text-muted-foreground/60">{t('chat.waiting')}</span>
              </div>
            ) : null}
            {isStreaming && streamingContent !== undefined && content && (
              <span className="inline-block w-1.5 h-4 bg-muted-foreground/50 animate-pulse ml-0.5 align-middle" />
            )}
          </div>

          {/* Action buttons - show on hover */}
          <div className="mt-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              onMouseEnter={() => !copiedAssistant && copyIconRef.current?.startAnimation()}
              onMouseLeave={() => !copiedAssistant && copyIconRef.current?.stopAnimation()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {copiedAssistant ? (
                <CheckIcon size={14} success />
              ) : (
                <CopyIcon ref={copyIconRef} size={14} />
              )}
            </button>
            <button
              onClick={handleRegenerate}
              onMouseEnter={() => refreshIconRef.current?.startAnimation()}
              onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <RefreshIcon ref={refreshIconRef} size={14} />
            </button>
            <button
              onClick={handleDelete}
              onMouseEnter={() => trashIconRef.current?.startAnimation()}
              onMouseLeave={() => trashIconRef.current?.stopAnimation()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <TrashIcon ref={trashIconRef} size={14} dangerHover />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
