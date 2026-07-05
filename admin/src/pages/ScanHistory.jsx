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
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Scan History</h1>
          <p className="text-muted" style={{ fontSize: 14 }}>All previously analyzed domains and their risk scores</p>
        </div>
        <button style={{ 
          background: "var(--bg-card)", color: "var(--text-primary)", 
          padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
          fontWeight: 500 
        }} onClick={refetch}>
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>{total}</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>Domains Scanned</div>
        </div>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--critical)" }}>{critCount}</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>High-Risk Sites</div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>Score ≥ 8</div>
        </div>
        <div className="bento-card">
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--low)" }}>{safeCount}</div>
          <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>Safe Sites</div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>Score ≤ 3</div>
        </div>
      </div>

      <div className="bento-card" style={{ flex: 1, padding: 0, overflow: "hidden" }}>
        {/* Search + header */}
        <div className="flex-between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <span className="card-title" style={{ marginBottom: 0 }}>All Scanned Domains</span>
          <div style={{ background: "var(--bg-input)", borderRadius: "var(--radius-md)", padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              placeholder="Filter by domain…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--text-primary)", outline: "none", fontSize: 13 }}
            />
          </div>
        </div>

        {loading && (
          <div className="flex-center" style={{ padding: 40 }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="flex-center text-muted" style={{ padding: 40 }}>
            <p>No domains match "{search}". Try a different search term.</p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Domain</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Risk</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Scans</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Last Scanned</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const level = p.risk_level || scoreToLevel(p.last_risk_score);
                  const score = typeof p.last_risk_score === "number" ? Math.round(p.last_risk_score) : "—";
                  return (
                    <tr key={p.domain} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {p.domain}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <RiskGauge score={score} level={level} size={36} />
                          <RiskBadge level={level} />
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px", color: "var(--text-secondary)", fontWeight: 500 }}>
                        {p.scan_count}
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: 13, color: "var(--text-secondary)" }}>
                        {p.last_scanned_at
                          ? new Date(p.last_scanned_at).toLocaleString()
                          : "—"}
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <a
                          href={`http://localhost:8000/products/${encodeURIComponent(p.domain)}`}
                          target="_blank" rel="noreferrer"
                          style={{ 
                            padding: "8px 12px", background: "var(--bg-input)", color: "var(--text-primary)", 
                            borderRadius: "var(--radius-md)", fontSize: 12, fontWeight: 500 
                          }}
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

        <div style={{ padding: "16px 24px", fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
          <span>{products.length} domain{products.length !== 1 ? "s" : ""} shown</span>
        </div>
      </div>
    </div>
  );
}
