/**
 * Chat history dropdown component
 */

import { useState, useRef, useEffect } from 'react'
import { History, Trash2, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'
import type { Conversation } from '@/types'

interface ChatHistoryProps {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function ChatHistory({
  conversations,
  currentId,
  onSelect,
  onDelete
}: ChatHistoryProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onSelect(id)
    setIsOpen(false)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onDelete(id)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return t('chat.yesterday')
    } else if (days < 7) {
      return `${days} ${t('chat.daysAgo')}`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2 gap-1.5"
      >
        <History className="h-4 w-4" />
        <span className="text-xs">{t('chat.history')}</span>
      </Button>

      {isOpen && (
        <div className={cn(
          'absolute right-0 top-full mt-1 z-50',
          'w-72 max-h-80 overflow-y-auto',
          'bg-popover border border-border rounded-lg shadow-lg',
          'animate-in fade-in-0 zoom-in-95'
        )}>
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('chat.noHistory')}</p>
            </div>
          ) : (
            <div className="py-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  onMouseEnter={() => setHoveredId(conv.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 cursor-pointer',
                    'hover:bg-muted/50 transition-colors',
                    currentId === conv.id && 'bg-muted'
                  )}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-sm font-medium truncate">
                      {conv.title || t('chat.untitled')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(conv.updatedAt)}
                    </div>
                  </div>

                  {hoveredId === conv.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
