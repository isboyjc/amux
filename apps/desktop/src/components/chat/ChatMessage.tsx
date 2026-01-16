/**
 * Chat message component with reasoning support
 */

import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Brain, Check, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { CopyIcon, RefreshIcon, TrashIcon } from '@/components/icons'
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
  const [isHovered, setIsHovered] = useState(false)
  const { copied, copy } = useCopyToClipboard({ duration: 1500 })
  const copyIconRef = useRef<AnimatedIconHandle>(null)
  const refreshIconRef = useRef<AnimatedIconHandle>(null)
  const trashIconRef = useRef<AnimatedIconHandle>(null)

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
  const isReasoningStreaming = isStreaming && streamingReasoning !== undefined && !content

  const handleCopy = () => {
    copyIconRef.current?.startAnimation()
    copy(content)
  }

  const handleRegenerate = () => {
    refreshIconRef.current?.startAnimation()
    onRegenerate?.()
  }

  const handleDelete = () => {
    onDelete?.()
  }

  const showActions = isHovered && content && !isStreaming

  return (
    <div
      className={cn(
        'py-4 group',
        isUser ? 'flex justify-end' : ''
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          {/* Action buttons placeholder - always reserve space */}
          <div className="h-8 flex items-center justify-end gap-0.5">
            <button
              onClick={handleCopy}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                'transition-all duration-200',
                showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <CopyIcon ref={copyIconRef} size={14} />
              )}
            </button>
            <button
              onClick={handleDelete}
              onMouseEnter={() => trashIconRef.current?.startAnimation()}
              onMouseLeave={() => trashIconRef.current?.stopAnimation()}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-red-500 hover:bg-red-500/10',
                'transition-all duration-200',
                showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <TrashIcon ref={trashIconRef} size={14} dangerHover />
            </button>
          </div>
        </div>
      )}

      {/* Assistant message - no bubble, full width */}
      {isAssistant && (
        <div className="relative mt-2">
          {/* Reasoning block (collapsible) - darker color, collapsed by default */}
          {(hasReasoning || isReasoningStreaming) && (
            <div className="mb-3">
              <button
                onClick={() => setReasoningExpanded(!reasoningExpanded)}
                className={cn(
                  'flex items-center gap-2 text-xs',
                  'text-muted-foreground/50 hover:text-muted-foreground/70',
                  'transition-colors',
                  'px-3 py-1.5 rounded-lg bg-muted/20 border border-border/20'
                )}
              >
                {isReasoningStreaming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Brain className="h-3 w-3" />
                )}
                <span>{isReasoningStreaming ? t('chat.thinkingInProgress') : t('chat.thinking')}</span>
                {!isReasoningStreaming && (
                  reasoningExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )
                )}
              </button>

              {reasoningExpanded && !isReasoningStreaming && (
                <div className={cn(
                  'mt-2 px-3 py-2 rounded-lg',
                  'bg-muted/10 border border-border/10',
                  'text-xs text-muted-foreground/40 leading-relaxed'
                )}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="my-1">{children}</p>,
                      pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>
                    }}
                  >
                    {reasoning}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* Main content - no background */}
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
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : null}
            {isStreaming && streamingContent !== undefined && content && (
              <span className="inline-block w-1.5 h-4 bg-muted-foreground/50 animate-pulse ml-0.5 align-middle" />
            )}
          </div>

          {/* Action buttons placeholder - always reserve space */}
          <div className="h-8 mt-2 flex items-center gap-0.5">
            <button
              onClick={handleCopy}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                'transition-all duration-200',
                showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <CopyIcon ref={copyIconRef} size={14} />
              )}
            </button>
            <button
              onClick={handleRegenerate}
              onMouseEnter={() => refreshIconRef.current?.startAnimation()}
              onMouseLeave={() => refreshIconRef.current?.stopAnimation()}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                'transition-all duration-200',
                showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <RefreshIcon ref={refreshIconRef} size={14} />
            </button>
            <button
              onClick={handleDelete}
              onMouseEnter={() => trashIconRef.current?.startAnimation()}
              onMouseLeave={() => trashIconRef.current?.stopAnimation()}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-red-500 hover:bg-red-500/10',
                'transition-all duration-200',
                showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <TrashIcon ref={trashIconRef} size={14} dangerHover />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
