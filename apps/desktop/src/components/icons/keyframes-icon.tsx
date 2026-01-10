import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const KeyframesIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const frame1Ref = useRef<SVGPathElement>(null);
    const frame2Ref = useRef<SVGPathElement>(null);
    const frame3Ref = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (frame1Ref.current) {
        frame1Ref.current.style.animation = "frame-shift 0.4s ease-in-out";
      }
      if (frame2Ref.current) {
        frame2Ref.current.style.animation = "frame-shift 0.4s ease-in-out 0.1s";
      }
      if (frame3Ref.current) {
        frame3Ref.current.style.animation = "frame-shift-far 0.4s ease-in-out 0.2s";
      }
    }, []);

    const stop = useCallback(() => {
      if (frame1Ref.current) {
        frame1Ref.current.style.animation = "";
      }
      if (frame2Ref.current) {
        frame2Ref.current.style.animation = "";
      }
      if (frame3Ref.current) {
        frame3Ref.current.style.animation = "";
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
            @keyframes frame-shift {
              0% { transform: translateX(0); }
              50% { transform: translateX(2px); }
              100% { transform: translateX(0); }
            }
            @keyframes frame-shift-far {
              0% { transform: translateX(0); }
              50% { transform: translateX(4px); }
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
          <path
            ref={frame1Ref}
            d="M9.225 18.412a1.595 1.595 0 0 1 -1.225 .588c-.468 0 -.914 -.214 -1.225 -.588l-4.361 -5.248a1.844 1.844 0 0 1 0 -2.328l4.361 -5.248a1.595 1.595 0 0 1 1.225 -.588c.468 0 .914 .214 1.225 .588l4.361 5.248a1.844 1.844 0 0 1 0 2.328l-4.361 5.248z"
          />
          <path
            ref={frame2Ref}
            d="M17 5l4.586 5.836a1.844 1.844 0 0 1 0 2.328l-4.586 5.836"
          />
          <path
            ref={frame3Ref}
            d="M13 5l4.586 5.836a1.844 1.844 0 0 1 0 2.328l-4.586 5.836"
          />
        </svg>
      </>
    );
  },
);

KeyframesIcon.displayName = "KeyframesIcon";
export default KeyframesIcon;
