/**
 * PageContainer - Standard single-card page layout wrapper
 * Use this for pages that need a single content card
 */

import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn('content-card h-full overflow-auto', className)}>
      <div className="p-6">
        {children}
      </div>
    </main>
  )
}
