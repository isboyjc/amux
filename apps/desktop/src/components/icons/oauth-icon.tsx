/**
 * OAuth Icon (Cloud with Key)
 */

import { motion, useAnimate } from 'motion/react'
import { forwardRef, useImperativeHandle, useCallback } from 'react'

import type { AnimatedIconHandle, AnimatedIconProps } from './types'

const OAuthIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = 'currentColor', strokeWidth = 2, className = '' },
    ref,
  ) => {
    const [scope, animate] = useAnimate()

    const start = useCallback(async () => {
      await animate(
        scope.current,
        {
          scale: [1, 1.15, 1],
          rotate: [0, 5, -5, 0],
        },
        {
          duration: 0.5,
          ease: 'easeInOut',
        }
      )
    }, [animate, scope])

    const stop = useCallback(() => {
      animate(
        scope.current,
        {
          scale: 1,
          rotate: 0,
        },
        {
          duration: 0.2,
        }
      )
    }, [animate, scope])

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }))

    return (
      <motion.svg
        ref={scope}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`cursor-pointer ${className}`}
        onHoverStart={start}
        onHoverEnd={stop}
      >
        <motion.path stroke="none" d="M0 0h24v24H0z" fill="none" />
        {/* Cloud */}
        <motion.path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        {/* Key */}
        <motion.circle cx="12" cy="12" r="2" />
        <motion.path d="m12 10-2 2 2 2" />
      </motion.svg>
    )
  },
)

OAuthIcon.displayName = 'OAuthIcon'

export default OAuthIcon