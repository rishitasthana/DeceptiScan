import React from "react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";



const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "10px 14px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
        {label.replace(/_/g, " ")}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.name}: <strong>{(entry.value * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
};

function avgF1(metricsObj) {
  const vals = Object.values(metricsObj).map((m) => m.f1 || 0);
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

function MetricsSection({ title, tag, metrics }) {
  const data = Object.entries(metrics).map(([label, m]) => ({
    label: label.replace(/_/g, " "),
    precision: m.precision,
    recall: m.recall,
    f1: m.f1,
  }));

  return (
    <div className="bento-card" style={{ marginBottom: 24, padding: "24px" }}>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <span className="card-title" style={{ margin: 0 }}>
          {title}
        </span>
        <span className="badge badge-outline" style={{ background: "var(--bg-input)" }}>{tag}</span>
      </div>
      
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-hover)" }} />
            <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12, paddingTop: 10 }} />
            <Bar dataKey="precision" name="Precision" fill="#6366F1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recall"    name="Recall"    fill="#F97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="f1"        name="F1 Score"  fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Data table */}
        <div style={{ marginTop: 24, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11 }}>
                <th style={{ padding: "12px", fontWeight: 600 }}>Label</th>
                <th style={{ padding: "12px", fontWeight: 600 }}>Precision</th>
                <th style={{ padding: "12px", fontWeight: 600 }}>Recall</th>
                <th style={{ padding: "12px", fontWeight: 600 }}>F1 Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics).map(([label, m]) => (
                <tr key={label} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{label.replace(/_/g, " ")}</td>
                  <td style={{ padding: "12px", color: "#6366F1", fontWeight: 600 }}>{(m.precision * 100).toFixed(1)}%</td>
                  <td style={{ padding: "12px", color: "#F97316", fontWeight: 600 }}>{(m.recall * 100).toFixed(1)}%</td>
                  <td style={{ padding: "12px", color: "var(--accent)", fontWeight: 600 }}>{(m.f1 * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ModelMetrics() {
  const { data, loading, error, refetch } = useApi(() => api.getMetrics());

  const nlpMetrics = data?.data?.nlp_metrics || {};
  const cvMetrics  = data?.data?.cv_metrics  || {};
  const nlpF1 = avgF1(nlpMetrics);
  const cvF1  = avgF1(cvMetrics);

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Model Metrics</h1>
          <p className="text-muted" style={{ fontSize: 14 }}>Per-label precision, recall, and F1 for NLP and CV classifiers</p>
        </div>
        <button style={{ 
          background: "var(--bg-card)", color: "var(--text-primary)", 
          padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
          fontWeight: 500, cursor: "pointer", transition: "all 0.2s"
        }} 
        onMouseOver={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "var(--bg-card)"; }}
        onClick={refetch}>
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>{(nlpF1 * 100).toFixed(1)}%</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>NLP Avg. F1</div>
        </div>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>{(cvF1 * 100).toFixed(1)}%</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>CV Avg. F1</div>
        </div>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>{Object.keys(nlpMetrics).length}</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>NLP Labels</div>
        </div>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>{Object.keys(cvMetrics).length}</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>CV Labels</div>
        </div>
      </div>

      {loading && (
        <div className="flex-center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && (
        <>
          <MetricsSection
            title="NLP Model — Legal-BERT"
            tag="Multi-label classifier"
            metrics={nlpMetrics}
          />
          <MetricsSection
            title="CV Model — ResNet-50"
            tag="Screenshot classifier"
            metrics={cvMetrics}
          />

          {/* Training tip */}
          <div className="bento-card" style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start", background: "var(--bg-input)" }}>
            <span style={{ color: "var(--accent)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </span>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text-primary)" }}>Tip:</strong> To update metrics, run 
              <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4, margin: "0 4px", border: "1px solid var(--border)" }}>python ml/nlp/evaluate.py</code> and 
              <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4, margin: "0 4px", border: "1px solid var(--border)" }}>python ml/cv/evaluate.py</code> 
              after training, then restart the backend.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
