import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

export interface TrashIconProps extends AnimatedIconProps {
  dangerHover?: boolean;
}

const TrashIcon = forwardRef<AnimatedIconHandle, TrashIconProps>(
  (
    {
      dangerHover = false,
      size = 24,
      color = "currentColor",
      strokeWidth = 2,
      className = "",
    },
    ref,
  ) => {
    const lidGroupRef = useRef<SVGGElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const start = useCallback(() => {
      // Open lid animation - animate the whole lid group
      if (lidGroupRef.current) {
        lidGroupRef.current.style.animation = "trash-lid-open 0.25s ease-out forwards";
      }
      // Danger color on hover
      if (dangerHover && svgRef.current) {
        svgRef.current.style.animation = "trash-danger-color 0.2s ease-in-out 0.1s forwards";
      }
    }, [dangerHover]);

    const stop = useCallback(() => {
      // Close lid animation
      if (lidGroupRef.current) {
        lidGroupRef.current.style.animation = "trash-lid-close 0.2s ease-in-out forwards";
      }
      // Reset color
      if (dangerHover && svgRef.current) {
        svgRef.current.style.animation = "trash-reset-color 0.2s ease-in-out forwards";
      }
    }, [dangerHover]);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <>
        <style>
          {`
            @keyframes trash-lid-open {
              from { transform: rotate(0deg) translateY(0); }
              to { transform: rotate(-15deg) translateY(-2px); }
            }
            @keyframes trash-lid-close {
              from { transform: rotate(-15deg) translateY(-2px); }
              to { transform: rotate(0deg) translateY(0); }
            }
            @keyframes trash-danger-color {
              from { stroke: currentColor; }
              to { stroke: #ef4444; }
            }
            @keyframes trash-reset-color {
              from { stroke: #ef4444; }
              to { stroke: currentColor; }
            }
          `}
        </style>
        <svg
          ref={svgRef}
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
          style={{ overflow: "visible" }}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />

          {/* Lid group - rotates together */}
          <g
            ref={lidGroupRef}
            style={{ transformOrigin: "4px 7px" }}
          >
            {/* Lid horizontal line */}
            <path d="M4 7l16 0" />
            {/* Lid handle */}
            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
          </g>

          {/* Body */}
          <path d="M10 11l0 6" />
          <path d="M14 11l0 6" />
          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
        </svg>
      </>
    );
  },
);

TrashIcon.displayName = "TrashIcon";
export default TrashIcon;
