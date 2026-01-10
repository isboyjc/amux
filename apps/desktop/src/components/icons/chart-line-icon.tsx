import { motion, useAnimation } from "motion/react";
import { forwardRef, useImperativeHandle } from "react";

import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

const ChartLineIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const controlsChart = useAnimation();
    const controlsBase = useAnimation();

    const start = async () => {
      controlsChart.start({
        pathLength: [0, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      });

      controlsBase.start({
        scaleX: [0, 1],
        transition: { duration: 0.4, ease: "easeOut" },
      });
    };

    const stop = () => {
      controlsChart.start({
        pathLength: 1,
        transition: { duration: 0.2, ease: "easeInOut" },
      });

      controlsBase.start({
        scaleX: 1,
        transition: { duration: 0.2, ease: "easeInOut" },
      });
    };

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
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

        {/* Base line */}
        <motion.path
          animate={controlsBase}
          d="M4 19l16 0"
          style={{ transformOrigin: "4px 19px" }}
        />

        {/* Chart line */}
        <motion.path
          animate={controlsChart}
          d="M4 15l4 -6l4 2l4 -5l4 4"
          initial={{ pathLength: 1 }}
        />
      </svg>
    );
  },
);

ChartLineIcon.displayName = "ChartLineIcon";

export default ChartLineIcon;
