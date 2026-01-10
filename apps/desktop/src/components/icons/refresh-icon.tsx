import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const RefreshIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);

    const start = useCallback(() => {
      if (svgRef.current) {
        svgRef.current.style.animation = "refresh-spin 0.5s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (svgRef.current) {
        svgRef.current.style.animation = "";
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
            @keyframes refresh-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(180deg); }
            }
          `}
        </style>
        <svg
          ref={svgRef}
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
          style={{ transformOrigin: "50% 50%" }}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </svg>
      </>
    );
  },
);

RefreshIcon.displayName = "RefreshIcon";

export default RefreshIcon;
