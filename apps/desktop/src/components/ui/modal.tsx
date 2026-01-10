import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className={cn(
            "relative bg-card rounded-xl shadow-lg pointer-events-auto max-h-[90vh] overflow-auto",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

interface ModalHeaderProps {
  children: React.ReactNode
  onClose?: () => void
  className?: string
}

export function ModalHeader({ children, onClose, className }: ModalHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between p-6 pb-0", className)}>
      <div>{children}</div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

interface ModalContentProps {
  children: React.ReactNode
  className?: string
}

export function ModalContent({ children, className }: ModalContentProps) {
  return (
    <div className={cn("p-6", className)}>
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn("flex items-center justify-end gap-2 p-6 pt-0", className)}>
      {children}
    </div>
  )
}
