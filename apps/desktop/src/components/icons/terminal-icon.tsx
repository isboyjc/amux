import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const TerminalIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const cursorRef = useRef<SVGPathElement>(null);
    const chevronRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (cursorRef.current) {
        cursorRef.current.style.animation = "cursor-blink 0.8s ease-in-out";
      }
      if (chevronRef.current) {
        chevronRef.current.style.animation = "chevron-move 0.3s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (cursorRef.current) {
        cursorRef.current.style.animation = "";
      }
      if (chevronRef.current) {
        chevronRef.current.style.animation = "";
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
            @keyframes cursor-blink {
              0% { opacity: 1; }
              25% { opacity: 0; }
              50% { opacity: 1; }
              75% { opacity: 0; }
              100% { opacity: 1; }
            }
            @keyframes chevron-move {
              0% { transform: translateX(0); }
              50% { transform: translateX(2px); }
              100% { transform: translateX(0); }
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
          <path ref={chevronRef} d="M5 7l5 5l-5 5" />
          <path ref={cursorRef} d="M12 19l7 0" />
        </svg>
      </>
    );
  },
);

TerminalIcon.displayName = "TerminalIcon";
export default TerminalIcon;
