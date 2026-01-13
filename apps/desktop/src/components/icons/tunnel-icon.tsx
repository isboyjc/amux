import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'
import type { AnimatedIconHandle, AnimatedIconProps } from './types'

const TunnelIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, color = 'currentColor', strokeWidth = 2, className = '' }, ref) => {
    const cloudRef = useRef<SVGPathElement>(null)

    const start = useCallback(() => {
      if (cloudRef.current) {
        cloudRef.current.style.animation = 'tunnel-cloud 0.6s ease-in-out'
      }
    }, [])

    const stop = useCallback(() => {
      if (cloudRef.current) {
        cloudRef.current.style.animation = ''
      }
    }, [])

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }))

    return (
      <>
        <style>
          {`
            @keyframes tunnel-cloud {
              0% { transform: translateY(0); }
              25% { transform: translateY(-2px); }
              50% { transform: translateY(0); }
              75% { transform: translateY(-1px); }
              100% { transform: translateY(0); }
            }
          `}
        </style>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path
            ref={cloudRef}
            d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
          />
        </svg>
      </>
    )
  }
)

TunnelIcon.displayName = 'TunnelIcon'

export default TunnelIcon
