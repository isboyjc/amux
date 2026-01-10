import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

interface CheckIconProps extends AnimatedIconProps {
  success?: boolean;
}

const CheckIcon = forwardRef<AnimatedIconHandle, CheckIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "", success = false },
    ref,
  ) => {
    const checkRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (checkRef.current) {
        checkRef.current.style.animation = "check-draw 0.3s ease-out forwards";
      }
    }, []);

    const stop = useCallback(() => {
      if (checkRef.current) {
        checkRef.current.style.animation = "";
      }
    }, []);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    const strokeColor = success ? "#22c55e" : color;

    return (
      <>
        <style>
          {`
            @keyframes check-draw {
              0% { stroke-dashoffset: 20; }
              100% { stroke-dashoffset: 0; }
            }
          `}
        </style>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path
            ref={checkRef}
            d="M5 12l5 5l10 -10"
            style={{ strokeDasharray: 20, strokeDashoffset: success ? 0 : 0 }}
          />
        </svg>
      </>
    );
  },
);

CheckIcon.displayName = "CheckIcon";
export default CheckIcon;
