import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const EyeOffIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const strikeRef = useRef<SVGPathElement>(null);
    const partsRef = useRef<SVGGElement>(null);

    const start = useCallback(() => {
      if (strikeRef.current) {
        strikeRef.current.style.animation = "strike-extend 0.3s ease-out forwards";
      }
      if (partsRef.current) {
        partsRef.current.style.animation = "parts-fade 0.3s ease-out forwards";
      }
    }, []);

    const stop = useCallback(() => {
      if (strikeRef.current) {
        strikeRef.current.style.animation = "strike-normal 0.2s ease-in-out forwards";
      }
      if (partsRef.current) {
        partsRef.current.style.animation = "parts-normal 0.2s ease-in-out forwards";
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
            @keyframes strike-extend {
              0% { stroke-dashoffset: 25; opacity: 0.5; }
              100% { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes strike-normal {
              from { stroke-dashoffset: 0; opacity: 1; }
              to { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes parts-fade {
              from { opacity: 1; transform: scale(1); }
              to { opacity: 0.6; transform: scale(0.98); }
            }
            @keyframes parts-normal {
              from { opacity: 0.6; transform: scale(0.98); }
              to { opacity: 1; transform: scale(1); }
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
          <g ref={partsRef} style={{ transformOrigin: "50% 50%" }}>
            <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
            <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
          </g>
          <path
            ref={strikeRef}
            d="M3 3l18 18"
            style={{ strokeDasharray: 25, strokeDashoffset: 0 }}
          />
        </svg>
      </>
    );
  },
);

EyeOffIcon.displayName = "EyeOffIcon";
export default EyeOffIcon;
