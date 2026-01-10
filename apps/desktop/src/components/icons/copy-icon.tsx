import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const CopyIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const frontRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (frontRef.current) {
        frontRef.current.style.animation = "copy-move 0.3s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (frontRef.current) {
        frontRef.current.style.animation = "";
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
            @keyframes copy-move {
              0% { transform: translate(0, 0); }
              50% { transform: translate(2px, 2px); }
              100% { transform: translate(0, 0); }
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
          <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
          <path
            ref={frontRef}
            d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"
          />
        </svg>
      </>
    );
  },
);

CopyIcon.displayName = "CopyIcon";

export default CopyIcon;
