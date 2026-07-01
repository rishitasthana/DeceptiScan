/**
 * ScanHistory — searchable list of all scanned domains with risk scores.
 * Matches the ShieldCheck "Scan History" screen design.
 */

import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import RiskGauge from "../components/RiskGauge";
import RiskBadge from "../components/RiskBadge";

function scoreToLevel(score) {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

// Mock data for local dev without backend
const MOCK_HISTORY = [
  { domain: "bankofamerica.com", last_risk_score: 3, risk_level: "low",      scan_count: 4,  last_scanned_at: "2024-06-01T10:22:00Z" },
  { domain: "amex.com",          last_risk_score: 5, risk_level: "medium",   scan_count: 2,  last_scanned_at: "2024-06-03T14:05:00Z" },
  { domain: "chasing.com",       last_risk_score: 9, risk_level: "critical", scan_count: 7,  last_scanned_at: "2024-06-05T09:11:00Z" },
  { domain: "hdfcbank.com",      last_risk_score: 8, risk_level: "high",     scan_count: 5,  last_scanned_at: "2024-06-06T16:30:00Z" },
  { domain: "axisbank.com",      last_risk_score: 4, risk_level: "medium",   scan_count: 3,  last_scanned_at: "2024-06-07T11:00:00Z" },
  { domain: "loandepot.com",     last_risk_score: 7, risk_level: "high",     scan_count: 1,  last_scanned_at: "2024-06-08T08:44:00Z" },
  { domain: "citibank.com",      last_risk_score: 2, risk_level: "low",      scan_count: 6,  last_scanned_at: "2024-06-08T17:20:00Z" },
];

export default function ScanHistory() {
  const [search, setSearch] = useState("");
  const { data, loading, error, refetch } = useApi(() => api.getProducts(1, 50));

  const raw = data?.data?.length ? data.data : MOCK_HISTORY;
  const products = raw.filter((p) =>
    p.domain.toLowerCase().includes(search.toLowerCase())
  );

  const total     = raw.length;
  const critCount = raw.filter((p) => p.risk_level === "critical" || p.last_risk_score >= 8).length;
  const safeCount = raw.filter((p) => p.risk_level === "low"      || p.last_risk_score <= 3).length;

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scan History</h1>
          <p className="page-subtitle">All previously analyzed domains and their risk scores</p>
        </div>
        <button className="btn btn-outline" onClick={refetch}>Refresh</button>
      </div>

      {/* Stats row */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 20 }}>
        <div className="stat-card primary">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Domains Scanned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--risk-critical)" }}>{critCount}</div>
          <div className="stat-label">High-Risk Sites</div>
          <div className="stat-sublabel">Score ≥ 8</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--risk-low)" }}>{safeCount}</div>
          <div className="stat-label">Safe Sites</div>
          <div className="stat-sublabel">Score ≤ 3</div>
        </div>
      </div>

      <div className="card">
        {/* Search + header */}
        <div className="card-header" style={{ gap: 16, flexWrap: "wrap" }}>
          <span className="card-title">All Scanned Domains</span>
          <div className="search-input-wrap" style={{ width: 260 }}>
            <input
              className="search-input"
              placeholder="Filter by domain…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 12 }}
            />
          </div>
        </div>

        {loading && (
          <div className="loading-spinner">
            <div className="spinner-ring" />Loading history…
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="empty-state">
            <p>No domains match "{search}". Try a different search term.</p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Risk</th>
                  <th>Scans</th>
                  <th>Last Scanned</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const level = p.risk_level || scoreToLevel(p.last_risk_score);
                  const score = typeof p.last_risk_score === "number" ? Math.round(p.last_risk_score) : "—";
                  return (
                    <tr key={p.domain}>
                      <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.domain}</div>
                        </div>
                      </div>
                    </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <RiskGauge score={score} level={level} size={42} />
                          <RiskBadge level={level} />
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                        {p.scan_count}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {p.last_scanned_at
                          ? new Date(p.last_scanned_at).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <a
                          href={`http://localhost:8000/products/${encodeURIComponent(p.domain)}`}
                          target="_blank" rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          View Report →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>{products.length} domain{products.length !== 1 ? "s" : ""} shown</span>
        </div>
      </div>
    </div>
  );
}
