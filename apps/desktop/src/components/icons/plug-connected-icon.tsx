import { forwardRef, useImperativeHandle, useRef, useCallback, useEffect } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const PlugConnectedIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const upperRef = useRef<SVGPathElement>(null);
    const upperLineRef = useRef<SVGPathElement>(null);
    const lowerRef = useRef<SVGPathElement>(null);
    const lowerLineRef = useRef<SVGPathElement>(null);
    const legRefs = useRef<(SVGPathElement | null)[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const start = useCallback(() => {
      // Clear any pending reconnect animation
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Reset first to allow re-triggering
      [upperRef.current, upperLineRef.current, lowerRef.current, lowerLineRef.current, ...legRefs.current].forEach((el) => {
        if (el) {
          el.style.animation = "none";
          // Force reflow to restart animation
          void el.getBoundingClientRect();
        }
      });
      
      // Then animate upper part
      [upperRef.current, upperLineRef.current].forEach((el) => {
        if (el) {
          el.style.animation = "plug-upper-disconnect 0.35s ease-out forwards";
        }
      });
      
      // Animate lower part
      [lowerRef.current, lowerLineRef.current].forEach((el) => {
        if (el) {
          el.style.animation = "plug-lower-disconnect 0.35s ease-out forwards";
        }
      });
      
      // Fade out legs
      legRefs.current.forEach((el) => {
        if (el) {
          el.style.animation = "plug-leg-fade-out 0.2s ease-out forwards";
        }
      });
    }, []);

    const stop = useCallback(() => {
      // Delay the reconnect animation slightly
      timeoutRef.current = setTimeout(() => {
        // Reconnect upper parts
        [upperRef.current, upperLineRef.current].forEach((el) => {
          if (el) {
            el.style.animation = "plug-upper-reconnect 0.4s ease-in-out forwards";
          }
        });
        
        // Reconnect lower parts
        [lowerRef.current, lowerLineRef.current].forEach((el) => {
          if (el) {
            el.style.animation = "plug-lower-reconnect 0.4s ease-in-out forwards";
          }
        });
        
        // Fade in legs
        legRefs.current.forEach((el) => {
          if (el) {
            el.style.animation = "plug-leg-fade-in 0.4s ease-in-out forwards";
          }
        });
      }, 150);
    }, []);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <>
        <style>
          {`
            @keyframes plug-upper-disconnect {
              0% { transform: translate(0, 0); }
              100% { transform: translate(-2px, 2px); }
            }
            @keyframes plug-lower-disconnect {
              0% { transform: translate(0, 0); }
              100% { transform: translate(2px, -2px); }
            }
            @keyframes plug-leg-fade-out {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes plug-upper-reconnect {
              0% { transform: translate(-2px, 2px); }
              100% { transform: translate(0, 0); }
            }
            @keyframes plug-lower-reconnect {
              0% { transform: translate(2px, -2px); }
              100% { transform: translate(0, 0); }
            }
            @keyframes plug-leg-fade-in {
              0% { opacity: 0; }
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
          className={`cursor-pointer ${className}`}
          onMouseEnter={start}
          onMouseLeave={stop}
          style={{ overflow: "visible" }}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path
            ref={lowerRef}
            d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5z"
            style={{ transformOrigin: "center" }}
          />
          <path
            ref={upperRef}
            d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5z"
            style={{ transformOrigin: "center" }}
          />
          <path
            ref={lowerLineRef}
            d="M3 21l2.5 -2.5"
            style={{ transformOrigin: "center" }}
          />
          <path
            ref={upperLineRef}
            d="M18.5 5.5l2.5 -2.5"
            style={{ transformOrigin: "center" }}
          />
          <path
            ref={(el: SVGPathElement | null) => (legRefs.current[0] = el)}
            d="M10 11l-2 2"
            style={{ transformOrigin: "center" }}
          />
          <path
            ref={(el: SVGPathElement | null) => (legRefs.current[1] = el)}
            d="M13 14l-2 2"
            style={{ transformOrigin: "center" }}
          />
        </svg>
      </>
    );
  },
);

PlugConnectedIcon.displayName = "PlugConnectedIcon";
export default PlugConnectedIcon;
