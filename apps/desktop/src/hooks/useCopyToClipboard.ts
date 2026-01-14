import { useState, useCallback } from 'react'
import { toast } from 'sonner'

interface UseCopyToClipboardOptions {
  /**
   * Duration in milliseconds to show the "copied" state
   * @default 1500
   */
  duration?: number
  /**
   * Show success toast notification
   * @default false
   */
  showToast?: boolean
  /**
   * Custom success message for toast
   */
  toastMessage?: string
  /**
   * Custom toast description
   */
  toastDescription?: string
}

interface UseCopyToClipboardReturn {
  /**
   * Whether the text is currently in "copied" state
   */
  copied: boolean
  /**
   * Copy text to clipboard
   */
  copy: (text: string) => Promise<void>
  /**
   * Reset the copied state
   */
  reset: () => void
}

/**
 * A unified hook for copying text to clipboard with feedback
 * 
 * @param options - Configuration options
 * @returns Object with copied state and copy function
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const { copied, copy } = useCopyToClipboard()
 * <Button onClick={() => copy('text')}>
 *   {copied ? 'Copied!' : 'Copy'}
 * </Button>
 * 
 * // With toast notification
 * const { copy } = useCopyToClipboard({
 *   showToast: true,
 *   toastMessage: 'Copied to clipboard'
 * })
 * 
 * // With custom duration
 * const { copied, copy } = useCopyToClipboard({ duration: 2000 })
 * ```
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const {
    duration = 1500,
    showToast = false,
    toastMessage,
    toastDescription,
  } = options

  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)

        if (showToast) {
          toast.success(toastMessage || 'Copied to clipboard', {
            description: toastDescription,
          })
        }

        // Reset after duration
        setTimeout(() => {
          setCopied(false)
        }, duration)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        toast.error('Failed to copy to clipboard')
      }
    },
    [duration, showToast, toastMessage, toastDescription]
  )

  const reset = useCallback(() => {
    setCopied(false)
  }, [])

  return { copied, copy, reset }
}
