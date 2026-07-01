/**
 * MetricsChart — Recharts BarChart wrapper for per-label model metrics.
 */

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";

const COLORS = {
  precision: "#4f46e5",
  recall: "#e94560",
  f1: "#4caf50",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#12131f", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "10px 14px",
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#e8e8f4", marginBottom: 6 }}>
        {label.replace(/_/g, " ")}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ fontSize: 12, color: entry.color, marginBottom: 2 }}>
          {entry.name}: <strong>{(entry.value * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
};

/**
 * @param {object} props
 * @param {object} props.metrics - Dict of { label: { precision, recall, f1 } }.
 * @param {string} props.title - Chart title.
 */
export default function MetricsChart({ metrics, title }) {
  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)", fontSize: 13 }}>
        No metrics available yet. Run model evaluation first.
      </div>
    );
  }

  const data = Object.entries(metrics).map(([label, m]) => ({
    label,
    precision: m.precision,
    recall: m.recall,
    f1: m.f1,
  }));

  return (
    <div>
      {title && (
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6060a0", fontSize: 11 }}
            tickFormatter={(v) => v.replace(/_/g, " ")}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#6060a0", fontSize: 11 }}
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: "#a0a0c0", fontSize: 12, paddingTop: 12 }}
          />
          <Bar dataKey="precision" name="Precision" fill={COLORS.precision} radius={[4, 4, 0, 0]} />
          <Bar dataKey="recall"    name="Recall"    fill={COLORS.recall}    radius={[4, 4, 0, 0]} />
          <Bar dataKey="f1"        name="F1 Score"  fill={COLORS.f1}        radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
