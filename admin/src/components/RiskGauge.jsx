/**
 * RiskGauge — SVG circular gauge matching the ShieldCheck "8/10" design.
 */

import React from "react";

const LEVEL_COLOR = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#22C55E",
};

/**
 * @param {object} props
 * @param {number} props.score - 1–10 risk score.
 * @param {string} props.level - critical | high | medium | low.
 * @param {number} [props.size=80] - Diameter in px.
 */
export default function RiskGauge({ score, level, size = 80 }) {
  const color = LEVEL_COLOR[level] || "#6366F1";
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const progress = (score / 10) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="risk-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="7"
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="risk-gauge-value" style={{ color }}>
        {score}
        <span>/10</span>
      </div>
    </div>
  );
}
