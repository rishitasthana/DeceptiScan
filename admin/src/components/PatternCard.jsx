/**
 * PatternCard — clause/pattern item matching the Stitch "Text & Clause Analysis" row style.
 */
import React, { useState } from "react";

const TYPE_COLORS = {
  fee_burial:           "#F97316",
  auto_renewal_trap:    "#EF4444",
  urgency_language:     "#EAB308",
  ambiguous_opt_out:    "#A855F7",
  misleading_free:      "#06B6D4",
  pre_checked_consent:  "#EF4444",
  hidden_unsubscribe:   "#F97316",
  misleading_cta_color: "#6366F1",
  small_print_placement:"#64748B",
  false_hierarchy:      "#EC4899",
  deceptive_micro_text: "#EF4444",
  urgency_countdown:    "#EAB308",
  clean:                "#22C55E",
};

const SEVERITY_LABELS = { 1: "Low", 2: "Low", 3: "Medium", 4: "Medium", 5: "High", 6: "High", 7: "High", 8: "Critical", 9: "Critical", 10: "Critical" };

/**
 * @param {object} props
 * @param {string} props.label - Pattern type key.
 * @param {string} [props.description] - Plain-English explanation.
 * @param {number} [props.severity] - 0–1 severity.
 * @param {number} [props.confidence] - 0–1 confidence.
 * @param {string} [props.text] - Source clause text.
 * @param {"row"|"card"} [props.variant] - Display style.
 */
export default function PatternCard({ label, description, severity, confidence, text, variant = "row" }) {
  const [expanded, setExpanded] = useState(false);
  const color = TYPE_COLORS[label] || "#6366F1";
  const humanLabel = label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const sevScore = severity ? Math.round(severity * 10) : null;
  const sevLabel = sevScore ? SEVERITY_LABELS[sevScore] || "Medium" : null;

  if (variant === "row") {
    return (
      <>
        <tr
          style={{ cursor: text ? "pointer" : "default" }}
          onClick={() => text && setExpanded((v) => !v)}
        >
          <td>
            <span
              style={{
                display: "inline-block",
                maxWidth: 320,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            >
              {text || "—"}
            </span>
          </td>
          <td>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: `${color}18`,
                color,
                textTransform: "uppercase",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              {humanLabel}
            </span>
          </td>
          <td>
            {sevLabel && (
              <span className={`badge badge-${sevLabel.toLowerCase()}`}>
                {sevLabel}
              </span>
            )}
          </td>
          <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            {confidence != null ? `${(confidence * 100).toFixed(0)}%` : "—"}
          </td>
          {text && (
            <td style={{ color: "var(--text-muted)", fontSize: 11 }}>
              {expanded ? "▲" : "▼"}
            </td>
          )}
        </tr>
        {expanded && text && (
          <tr>
            <td colSpan={5} style={{ background: "var(--bg-card-2)", padding: "10px 14px" }}>
              <blockquote
                style={{
                  borderLeft: `3px solid ${color}`,
                  paddingLeft: 10,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                "{text}"
              </blockquote>
              {description && (
                <p style={{ fontSize: 12, color: color, marginTop: 6, fontWeight: 500 }}>
                  Warning: {description}
                </p>
              )}
            </td>
          </tr>
        )}
      </>
    );
  }

  // Card variant (used in risk overlay / popup)
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--bg-card-2)",
        borderRadius: "var(--radius-md)",
        borderLeft: `3px solid ${color}`,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.3px" }}>
          {humanLabel}
        </span>
        {sevLabel && (
          <span className={`badge badge-${sevLabel.toLowerCase()}`} style={{ fontSize: 10 }}>
            {sevLabel}
          </span>
        )}
      </div>
      {description && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {description}
        </p>
      )}
    </div>
  );
}
