/**
 * RiskBadge — colored pill badge for risk levels.
 */
import React from "react";

const LEVEL_CLASS = {
  critical: "badge-critical",
  high:     "badge-high",
  medium:   "badge-medium",
  low:      "badge-low",
};

/**
 * @param {object} props
 * @param {string} props.level - critical | high | medium | low.
 * @param {number} [props.score] - Optional numeric score to show.
 */
export default function RiskBadge({ level = "low", score }) {
  const cls = LEVEL_CLASS[level] || "badge-low";
  return (
    <span className={`badge ${cls}`}>
      {score != null && <strong style={{ fontSize: 12 }}>{score}</strong>}
      {level}
    </span>
  );
}
