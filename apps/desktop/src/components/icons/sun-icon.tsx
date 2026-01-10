import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const SunIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const centerRef = useRef<SVGPathElement>(null);
    const raysRef = useRef<SVGGElement>(null);

    const start = useCallback(() => {
      if (centerRef.current) {
        centerRef.current.style.animation = "sun-pulse 0.4s ease-in-out";
      }
      if (raysRef.current) {
        raysRef.current.style.animation = "sun-rays-fade 0.5s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (centerRef.current) {
        centerRef.current.style.animation = "";
      }
      if (raysRef.current) {
        raysRef.current.style.animation = "";
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
            @keyframes sun-pulse {
              0% { transform: scale(1); }
              50% { transform: scale(0.8); }
              100% { transform: scale(1); }
            }
            @keyframes sun-rays-fade {
              0% { opacity: 1; }
              50% { opacity: 0.4; }
              100% { opacity: 1; }
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
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path
            ref={centerRef}
            d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
            style={{ transformOrigin: "12px 12px" }}
          />
          <g ref={raysRef}>
            <path d="M12 5l0 .01" />
            <path d="M17 7l0 .01" />
            <path d="M19 12l0 .01" />
            <path d="M17 17l0 .01" />
            <path d="M12 19l0 .01" />
            <path d="M7 17l0 .01" />
            <path d="M5 12l0 .01" />
            <path d="M7 7l0 .01" />
          </g>
        </svg>
      </>
    );
  },
);

SunIcon.displayName = "SunIcon";

export default SunIcon;
