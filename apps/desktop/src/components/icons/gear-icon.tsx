import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const GearIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const gearRef = useRef<SVGGElement>(null);

    const start = useCallback(() => {
      if (gearRef.current) {
        gearRef.current.style.animation = "gear-rotate-anim 0.9s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (gearRef.current) {
        gearRef.current.style.animation = "";
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
            @keyframes gear-rotate-anim {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="square"
          strokeMiterlimit="10"
          className={className}
          style={{ overflow: "visible" }}
        >
          <g
            ref={gearRef}
            style={{ transformOrigin: "16px 16px" }}
          >
            <circle cx="16" cy="16" r="5" />
            <path d="m30,17.5v-3l-3.388-1.355c-.25-.933-.617-1.815-1.089-2.633l1.436-3.351-2.121-2.121-3.351,1.436c-.817-.472-1.7-.838-2.633-1.089l-1.355-3.388h-3l-1.355,3.388c-.933.25-1.815.617-2.633,1.089l-3.351-1.436-2.121,2.121 1.436,3.351c-.472.817-.838,1.7-1.089,2.633l-3.388,1.355v3l3.388,1.355c.25.933.617,1.815,1.089,2.633l-1.436,3.351 2.121,2.121 3.351-1.436c.817.472 1.7.838 2.633,1.089l1.355,3.388h3l1.355-3.388c.933-.25 1.815-.617 2.633-1.089l3.351,1.436 2.121-2.121-1.436-3.351c.472-.817.838-1.7 1.089-2.633l3.388-1.355Z" />
          </g>
        </svg>
      </>
    );
  },
);

GearIcon.displayName = "GearIcon";
export default GearIcon;
