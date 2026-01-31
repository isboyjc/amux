/**
 * Code Switch Icon
 * Represents switching between different LLM providers for CLI tools
 */

import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { AnimatedIconProps, AnimatedIconHandle } from './types'

const CodeSwitchIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, color = 'currentColor', className = '', ...props }, ref) => {
    const pathRef = useRef<SVGPathElement>(null)
    const isAnimatingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      startAnimation: () => {
        if (!isAnimatingRef.current && pathRef.current) {
          isAnimatingRef.current = true
          pathRef.current.style.animation = 'spin 1s linear infinite'
        }
      },
      stopAnimation: () => {
        if (isAnimatingRef.current && pathRef.current) {
          isAnimatingRef.current = false
          pathRef.current.style.animation = ''
        }
      }
    }))

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); transform-origin: center; }
            to { transform: rotate(360deg); transform-origin: center; }
          }
        `}</style>
        {/* Code brackets */}
        <path d="M16 18l6-6-6-6" />
        <path d="M8 6l-6 6 6 6" />
        {/* Switch/Refresh arrows in the middle */}
        <g ref={pathRef}>
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="M4.93 4.93l2.83 2.83" />
          <path d="M16.24 16.24l2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="M4.93 19.07l2.83-2.83" />
          <path d="M16.24 7.76l2.83-2.83" />
        </g>
      </svg>
    )
  }
)

CodeSwitchIcon.displayName = 'CodeSwitchIcon'

export default CodeSwitchIcon
