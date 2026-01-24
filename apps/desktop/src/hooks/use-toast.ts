/**
 * Toast Hook
 * 
 * Wrapper around sonner toast for consistent API
 */

import { toast as sonnerToast } from 'sonner'

type ToastVariant = 'default' | 'destructive' | 'success'

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default', duration = 2500 } = options

    switch (variant) {
      case 'destructive':
        sonnerToast.error(title, {
          description,
          duration
        })
        break
      
      case 'success':
        sonnerToast.success(title, {
          description,
          duration
        })
        break
      
      default:
        sonnerToast(title, {
          description,
          duration
        })
        break
    }
  }

  return { toast }
}
