import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const MoonIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const moonRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (moonRef.current) {
        moonRef.current.style.animation = "moon-wobble 0.5s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (moonRef.current) {
        moonRef.current.style.animation = "";
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
            @keyframes moon-wobble {
              0% { transform: rotate(0deg) scale(1); }
              25% { transform: rotate(-15deg) scale(1.1); }
              50% { transform: rotate(0deg) scale(1.1); }
              75% { transform: rotate(15deg) scale(1.05); }
              100% { transform: rotate(0deg) scale(1); }
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
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path
            ref={moonRef}
            d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"
            style={{ transformOrigin: "12px 12px" }}
          />
        </svg>
      </>
    );
  },
);

MoonIcon.displayName = "MoonIcon";

export default MoonIcon;
