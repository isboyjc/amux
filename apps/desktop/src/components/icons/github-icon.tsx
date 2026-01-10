import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const GithubIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const iconRef = useRef<SVGGElement>(null);

    const start = useCallback(() => {
      if (iconRef.current) {
        iconRef.current.style.animation = "github-shake-anim 0.5s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (iconRef.current) {
        iconRef.current.style.animation = "";
      }
    }, []);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <>
        <style>
          {`
            @keyframes github-shake-anim {
              0% { transform: scale(1) rotate(0deg); }
              25% { transform: scale(1.1) rotate(-5deg); }
              50% { transform: scale(1.1) rotate(5deg); }
              75% { transform: scale(1.1) rotate(-5deg); }
              100% { transform: scale(1) rotate(0deg); }
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
          style={{ overflow: "visible" }}
        >
          <g ref={iconRef} style={{ transformOrigin: "12px 12px" }}>
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
          </g>
        </svg>
      </>
    );
  },
);

GithubIcon.displayName = "GithubIcon";

export default GithubIcon;
