import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

// 收起左侧边栏图标（箭头向左）
export const SidebarCollapseIcon = forwardRef<
  AnimatedIconHandle,
  AnimatedIconProps
>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const chevronRef = useRef<SVGPathElement>(null);
    const sidebarRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (chevronRef.current) {
        chevronRef.current.style.animation = "sidebar-collapse-chevron 0.5s ease-in-out";
      }
      if (sidebarRef.current) {
        sidebarRef.current.style.animation = "sidebar-collapse-line 0.6s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (chevronRef.current) {
        chevronRef.current.style.animation = "";
      }
      if (sidebarRef.current) {
        sidebarRef.current.style.animation = "";
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
            @keyframes sidebar-collapse-chevron {
              0% { transform: translateX(0); opacity: 1; }
              50% { transform: translateX(-2px); opacity: 0.7; }
              100% { transform: translateX(0); opacity: 1; }
            }
            @keyframes sidebar-collapse-line {
              0% { transform: translateX(0); }
              50% { transform: translateX(-2px); }
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
          <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
          <path ref={sidebarRef} d="M9 4v16" />
          <path ref={chevronRef} d="M15 10l-2 2l2 2" />
        </svg>
      </>
    );
  },
);

SidebarCollapseIcon.displayName = "SidebarCollapseIcon";

// 展开左侧边栏图标（箭头向右）
export const SidebarExpandIcon = forwardRef<
  AnimatedIconHandle,
  AnimatedIconProps
>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const chevronRef = useRef<SVGPathElement>(null);
    const sidebarRef = useRef<SVGPathElement>(null);

    const start = useCallback(() => {
      if (chevronRef.current) {
        chevronRef.current.style.animation = "sidebar-expand-chevron 0.5s ease-in-out";
      }
      if (sidebarRef.current) {
        sidebarRef.current.style.animation = "sidebar-expand-line 0.6s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (chevronRef.current) {
        chevronRef.current.style.animation = "";
      }
      if (sidebarRef.current) {
        sidebarRef.current.style.animation = "";
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
            @keyframes sidebar-expand-chevron {
              0% { transform: translateX(0); opacity: 1; }
              50% { transform: translateX(2px); opacity: 0.7; }
              100% { transform: translateX(0); opacity: 1; }
            }
            @keyframes sidebar-expand-line {
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
          <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
          <path ref={sidebarRef} d="M9 4v16" />
          <path ref={chevronRef} d="M13 10l2 2l-2 2" />
        </svg>
      </>
    );
  },
);

SidebarExpandIcon.displayName = "SidebarExpandIcon";

export default SidebarCollapseIcon;
