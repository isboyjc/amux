/**
 * Provider Logo Component
 * Displays logos for each provider using base64 data URL
 * Falls back to showing provider name initial when no logo is available
 */

import { cn } from '@/lib/utils'

interface ProviderLogoProps {
  /** Logo base64 data URL from provider data */
  logo?: string
  /** Provider name (used for fallback initial) */
  name?: string
  /** Background color for logo container (default: #ffffff) */
  color?: string
  size?: number
  className?: string
}

export function ProviderLogo({ 
  logo, 
  name = '', 
  color = '#ffffff', 
  size = 24, 
  className 
}: ProviderLogoProps) {
  // Get first letter of name for fallback
  const initial = name.charAt(0).toUpperCase()

  if (!logo) {
    // Show initial letter when no logo
    return (
      <div 
        className={cn('flex items-center justify-center font-semibold text-zinc-600', className)}
        style={{ 
          width: size, 
          height: size,
          backgroundColor: color,
          fontSize: size * 0.5
        }}
      >
        {initial || '?'}
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center', className)}
      style={{ 
        width: size, 
        height: size,
        backgroundColor: color
      }}
    >
      <img
        src={logo}
        alt={name || 'Provider Logo'}
        width={size * 0.7}
        height={size * 0.7}
        className="object-contain"
      />
    </div>
  )
}
