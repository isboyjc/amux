import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const ChatIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const chatRef = useRef<SVGGElement>(null);

    const start = useCallback(() => {
      if (chatRef.current) {
        chatRef.current.style.animation = "chat-bounce-anim 0.6s ease-in-out";
      }
    }, []);

    const stop = useCallback(() => {
      if (chatRef.current) {
        chatRef.current.style.animation = "";
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
            @keyframes chat-bounce-anim {
              0%, 100% { transform: translateY(0); }
              25% { transform: translateY(-2px); }
              50% { transform: translateY(0); }
              75% { transform: translateY(-1px); }
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
          style={{ overflow: "visible" }}
        >
          <g
            ref={chatRef}
            style={{ transformOrigin: "12px 12px" }}
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01" />
            <path d="M12 10h.01" />
            <path d="M16 10h.01" />
          </g>
        </svg>
      </>
    );
  },
);

ChatIcon.displayName = "ChatIcon";
export default ChatIcon;
