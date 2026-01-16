/**
 * Chat input component with proxy and model selection
 */

import { useState, useRef, useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'

interface ChatInputProps {
  onSend: (content: string) => void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
  placeholder?: string
  className?: string
  proxySelector?: ReactNode
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  placeholder,
  className,
  proxySelector
}: ChatInputProps) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [content])

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled || isStreaming) return

    onSend(trimmed)
    setContent('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleStop = () => {
    onStop?.()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't send if composing (IME input like Chinese pinyin)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = content.trim().length > 0 && !disabled && !isStreaming

  return (
    <div className={cn(
      'flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-border/50',
      'transition-shadow duration-200 hover:shadow-lg hover:shadow-black/5',
      className
    )}>
      {/* Input area */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder || t('chat.inputPlaceholder')}
        disabled={disabled}
        rows={1}
        className={cn(
          'w-full resize-none bg-transparent border-0 outline-none text-sm',
          'placeholder:text-muted-foreground/60',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'min-h-[36px] max-h-[200px] py-2 px-1'
        )}
      />

      {/* Toolbar row - proxy selector on left, send/stop button on right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {proxySelector}
        </div>
        {isStreaming ? (
          <Button
            size="icon"
            onClick={handleStop}
            className={cn(
              'h-7 w-7 rounded-md shrink-0 transition-all',
              'bg-destructive hover:bg-destructive/90'
            )}
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'h-7 w-7 rounded-md shrink-0 transition-all',
              canSend
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
