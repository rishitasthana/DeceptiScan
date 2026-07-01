/**
 * ModelMetrics — precision, recall, F1 charts for NLP and CV models.
 * Updated to ShieldCheck light theme with Recharts bar charts.
 */

import React from "react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// Mock metrics for local dev
const MOCK_NLP = {
  fee_burial:          { precision: 0.91, recall: 0.87, f1: 0.89 },
  auto_renewal_trap:   { precision: 0.86, recall: 0.82, f1: 0.84 },
  urgency_language:    { precision: 0.79, recall: 0.75, f1: 0.77 },
  ambiguous_opt_out:   { precision: 0.72, recall: 0.68, f1: 0.70 },
  misleading_free:     { precision: 0.83, recall: 0.80, f1: 0.81 },
  clean:               { precision: 0.95, recall: 0.93, f1: 0.94 },
};

const MOCK_CV = {
  pre_checked_consent:  { precision: 0.88, recall: 0.85, f1: 0.86 },
  hidden_unsubscribe:   { precision: 0.76, recall: 0.72, f1: 0.74 },
  misleading_cta_color: { precision: 0.82, recall: 0.79, f1: 0.80 },
  small_print_placement:{ precision: 0.70, recall: 0.66, f1: 0.68 },
  clean:                { precision: 0.93, recall: 0.91, f1: 0.92 },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "10px 14px",
      boxShadow: "var(--shadow-md)",
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
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">
          {title}
        </span>
        <span className="badge badge-indigo">{tag}</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 56, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              angle={-32}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="precision" name="Precision" fill="#6366F1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recall"    name="Recall"    fill="#F97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="f1"        name="F1 Score"  fill="#22C55E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Data table */}
        <div style={{ marginTop: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1 Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics).map(([label, m]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 600 }}>{label.replace(/_/g, " ")}</td>
                  <td style={{ color: "#6366F1", fontWeight: 600 }}>{(m.precision * 100).toFixed(1)}%</td>
                  <td style={{ color: "#F97316", fontWeight: 600 }}>{(m.recall * 100).toFixed(1)}%</td>
                  <td style={{ color: "#22C55E", fontWeight: 600 }}>{(m.f1 * 100).toFixed(1)}%</td>
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

  const nlpMetrics = data?.data?.nlp_metrics || MOCK_NLP;
  const cvMetrics  = data?.data?.cv_metrics  || MOCK_CV;
  const nlpF1 = avgF1(nlpMetrics);
  const cvF1  = avgF1(cvMetrics);

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Model Metrics</h1>
          <p className="page-subtitle">Per-label precision, recall, and F1 for NLP and CV classifiers</p>
        </div>
        <button className="btn btn-outline" onClick={refetch}>Refresh</button>
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="stat-card primary">
          <div className="stat-value">{(nlpF1 * 100).toFixed(1)}%</div>
          <div className="stat-label">NLP Avg. F1</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-value">{(cvF1 * 100).toFixed(1)}%</div>
          <div className="stat-label">CV Avg. F1</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Object.keys(nlpMetrics).length}</div>
          <div className="stat-label">NLP Labels</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Object.keys(cvMetrics).length}</div>
          <div className="stat-label">CV Labels</div>
        </div>
      </div>

      {loading && (
        <div className="loading-spinner">
          <div className="spinner-ring" />Loading metrics…
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
          <div
            style={{
              padding: "13px 18px",
              background: "var(--indigo-light)",
              border: "1px solid #C7D2FE",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              color: "var(--indigo-dark)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontWeight: 700 }}>Tip:</span>
            <span>
              <strong>To update metrics:</strong> Run{" "}
              <code style={{ background: "rgba(99,102,241,0.12)", padding: "1px 5px", borderRadius: 4 }}>
                python ml/nlp/evaluate.py
              </code>{" "}
              and{" "}
              <code style={{ background: "rgba(99,102,241,0.12)", padding: "1px 5px", borderRadius: 4 }}>
                python ml/cv/evaluate.py
              </code>{" "}
              after training, then restart the backend.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
