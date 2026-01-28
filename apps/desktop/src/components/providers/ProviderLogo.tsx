/**
 * Provider Logo Component
 * Displays logos for each provider using base64 data URL
 * Falls back to showing provider name initial when no logo is available
 */

import { cn } from '../../lib/utils'

type SizePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<SizePreset, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48
}

interface ProviderLogoProps {
  /** Logo base64 data URL from provider data */
  logo?: string
  /** Provider name (used for fallback initial) */
  name?: string
  /** Background color for logo container (default: #ffffff) */
  color?: string
  /** Size can be a preset string ('xs', 'sm', 'md', 'lg', 'xl') or a number */
  size?: SizePreset | number
  className?: string
}

export function ProviderLogo({ 
  logo, 
  name = '', 
  color = '#ffffff', 
  size = 24, 
  className 
}: ProviderLogoProps) {
  // Convert size to number if it's a preset string
  const sizeValue = typeof size === 'string' ? SIZE_MAP[size] : size
  // Get first letter of name for fallback
  const initial = name.charAt(0).toUpperCase()

  if (!logo) {
    // Show initial letter when no logo
    return (
      <div 
        className={cn('flex items-center justify-center font-semibold text-zinc-600', className)}
        style={{ 
          width: sizeValue, 
          height: sizeValue,
          backgroundColor: color,
          fontSize: sizeValue * 0.5
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
        width: sizeValue, 
        height: sizeValue,
        backgroundColor: color
      }}
    >
      <img
        src={logo}
        alt={name || 'Provider Logo'}
        width={sizeValue * 0.7}
        height={sizeValue * 0.7}
        className="object-contain"
      />
    </div>
  )
}
