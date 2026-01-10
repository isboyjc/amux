import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const EyeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const pupilRef = useRef<SVGPathElement>(null);
    const eyeRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (pupilRef.current) {
        pupilRef.current.style.animation = "eye-pupil-contract 0.15s ease-out forwards";
      }
      if (eyeRef.current) {
        eyeRef.current.style.animation = "eye-narrow 0.15s ease-out forwards";
      }
    }, []);

    const stop = useCallback(() => {
      if (pupilRef.current) {
        pupilRef.current.style.animation = "eye-pupil-expand 0.2s ease-in-out forwards";
      }
      if (eyeRef.current) {
        eyeRef.current.style.animation = "eye-expand 0.2s ease-in-out forwards";
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
            @keyframes eye-pupil-contract {
              from { transform: scale(1); }
              to { transform: scale(0.7); }
            }
            @keyframes eye-pupil-expand {
              from { transform: scale(0.7); }
              to { transform: scale(1); }
            }
            @keyframes eye-narrow {
              from { transform: scaleY(1); }
              to { transform: scaleY(0.9); }
            }
            @keyframes eye-expand {
              from { transform: scaleY(0.9); }
              to { transform: scaleY(1); }
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
            ref={pupilRef}
            d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"
            style={{ transformOrigin: "50% 50%" }}
          />
          <path
            ref={eyeRef}
            d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"
            style={{ transformOrigin: "50% 50%" }}
          />
        </svg>
      </>
    );
  },
);

EyeIcon.displayName = "EyeIcon";
export default EyeIcon;
