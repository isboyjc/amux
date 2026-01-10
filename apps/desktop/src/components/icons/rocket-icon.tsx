import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const RocketIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const rocketRef = useRef<SVGGElement>(null);
    const flameRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (rocketRef.current) {
        rocketRef.current.style.animation = "rocket-launch 0.6s ease-in-out";
      }
      if (flameRef.current) {
        flameRef.current.style.animation = "flame-burst 0.5s ease-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (rocketRef.current) {
        rocketRef.current.style.animation = "";
      }
      if (flameRef.current) {
        flameRef.current.style.animation = "";
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
            @keyframes rocket-launch {
              0% { transform: translate(0, 0); opacity: 1; }
              35% { transform: translate(12px, -12px); opacity: 0; }
              36% { transform: translate(-12px, 12px); opacity: 0; }
              100% { transform: translate(0, 0); opacity: 1; }
            }
            @keyframes flame-burst {
              0% { transform: translate(0, 0) scale(1); opacity: 1; }
              50% { transform: translate(-6px, 6px) scale(1.2); opacity: 0; }
              100% { transform: translate(0, 0) scale(1); opacity: 1; }
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
          strokeMiterlimit="10"
          className={className}
          style={{ overflow: "visible" }}
        >
          <g ref={rocketRef}>
            <path d="m13.299,9h-3.891c-.892,0-1.738.397-2.308,1.083l-5.1,6.139,6.31,1.51" />
            <path d="m23,18.701v3.891c0,.892-.397,1.738-1.083,2.308l-6.139,5.1-1.51-6.31" />
            <path d="m14.268,23.69c7.986-2.194,14.642-9.015,15.732-21.69-12.675,1.09-19.496,7.746-21.69,15.732l5.958,5.958Z" />
            <path d="m19,5c4.111,1.389,6.778,4.056,8,8" strokeLinecap="round" />
            <circle cx="19" cy="13" r="2" fill="currentColor" />
          </g>

          <path
            ref={flameRef}
            d="m2,30s.707-4.95,2.121-6.364c1.172-1.172,3.071-1.172,4.243,0s1.172,3.071,0,4.243c-1.414,1.414-6.364,2.121-6.364,2.121Z"
          />
        </svg>
      </>
    );
  },
);

RocketIcon.displayName = "RocketIcon";

export default RocketIcon;
