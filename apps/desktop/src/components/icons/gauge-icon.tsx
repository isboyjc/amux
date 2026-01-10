import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const GaugeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const needleRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (needleRef.current) {
        needleRef.current.style.animation = "gauge-needle 0.6s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (needleRef.current) {
        needleRef.current.style.animation = "";
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
            @keyframes gauge-needle {
              0% { transform: rotate(0deg); }
              25% { transform: rotate(45deg); }
              50% { transform: rotate(-20deg); }
              75% { transform: rotate(30deg); }
              100% { transform: rotate(0deg); }
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
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          <path
            ref={needleRef}
            d="m12 14 4-4"
            style={{ transformOrigin: "12px 14px" }}
          />
        </svg>
      </>
    );
  },
);

GaugeIcon.displayName = "GaugeIcon";
export default GaugeIcon;
