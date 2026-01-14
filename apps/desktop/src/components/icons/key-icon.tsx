import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const KeyIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const keyRef = useRef<SVGGElement>(null);

    const start = useCallback(() => {
      if (keyRef.current) {
        keyRef.current.style.animation = "key-shake-anim 0.6s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (keyRef.current) {
        keyRef.current.style.animation = "";
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
            @keyframes key-shake-anim {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-15deg); }
              75% { transform: rotate(15deg); }
            }
          `}
        </style>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ overflow: "visible" }}
        >
          <g
            ref={keyRef}
            style={{ transformOrigin: "16px 16px" }}
          >
            <circle cx="10" cy="22" r="6" />
            <path d="M14.83 17.17L28 4" />
            <path d="M24 4v4h4" />
          </g>
        </svg>
      </>
    );
  },
);

KeyIcon.displayName = "KeyIcon";
export default KeyIcon;
