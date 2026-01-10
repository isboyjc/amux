import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

export const Logo = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 32, color = "currentColor", className = "" },
    ref,
  ) => {
    const logoRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (logoRef.current) {
        logoRef.current.style.animation = "logo-bounce 0.6s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (logoRef.current) {
        logoRef.current.style.animation = "";
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
            @keyframes logo-bounce {
              0% { transform: translateY(0) scale(1); }
              30% { transform: translateY(-3px) scale(1.05); }
              50% { transform: translateY(0) scale(1); }
              70% { transform: translateY(-1px) scale(1.02); }
              100% { transform: translateY(0) scale(1); }
            }
          `}
        </style>
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          style={{ overflow: "visible" }}
        >
          <path
            ref={logoRef}
            d="M4 96 
               C4 96, 24 12, 64 12
               C104 12, 124 96, 124 96
               Q124 102, 118 102
               C94 102, 92 64, 64 64
               C36 64, 34 102, 10 102
               Q4 102, 4 96
               Z"
            fill={color}
            style={{ transformOrigin: "64px 57px" }}
          />
        </svg>
      </>
    );
  },
);

Logo.displayName = "Logo";
