/**
 * Dashboard — Detailed Analysis Report view matching the ShieldCheck Stitch design.
 * Shows: metric cards, NLP clause table, Plain English Summary, CV pattern mapping,
 * Community Awareness section, and action buttons.
 */

import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import RiskGauge from "../components/RiskGauge";
import RiskBadge from "../components/RiskBadge";
import PatternCard from "../components/PatternCard";

const API_BASE = "http://localhost:8000";

/** Derive risk level from score 1–10 */
function scoreToLevel(score) {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/** Humanize snake_case */
function humanize(s) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Mock analysis data shown when no API data is available ───────
const MOCK = {
  domain: "premiumloan.com",
  page_title: "Premium Personal Loan — Apply Now",
  risk_score: { score: 8, level: "high", nlp_score: 7.2, cv_score: 8.6 },
  nlp_result: {
    labeled_clauses: [
      { text: "The lender reserves the right to charge an additional processing fee…", labels: ["fee_burial"],        severity: 0.8, confidence: 0.91 },
      { text: "Your subscription will auto-renew unless cancelled 30 days in advance…", labels: ["auto_renewal_trap"], severity: 0.75, confidence: 0.88 },
      { text: "Apply Now! Offer expires in 24 hours — Limited slots remaining!", labels: ["urgency_language"],   severity: 0.6,  confidence: 0.82 },
      { text: "Continuing on our site means you agree to share your data with partners.", labels: ["ambiguous_opt_out"], severity: 0.65, confidence: 0.79 },
      { text: "Aggressive Recovery — Outstanding dues attract compound interest of 36% p.a.", labels: ["fee_burial"],        severity: 0.85, confidence: 0.94 },
    ],
    plain_english_summary: "This loan product uses multiple manipulative clauses. Fees are buried deep in paragraph 14. Auto-renewal is pre-selected by default. Urgency language creates artificial pressure. The 'Apply Now' button uses misleading prominence to rush the decision.",
  },
  cv_result: {
    patterns: [
      { label: "false_hierarchy",      confidence: 0.99, severity: 0.9,  description: "False Hierarchy Button — XY: [842, 120] to [820, 150]" },
      { label: "deceptive_micro_text", confidence: 0.92, severity: 0.8,  description: "Deceptive Micro-text — XY: [120, 440] to [789, 480]" },
      { label: "urgency_countdown",    confidence: 0.96, severity: 0.75, description: "Urgency Countdown — XY: [600, 20] to [720, 60]" },
    ],
  },
  scan_id: "mock-scan-001",
};

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [activeScan, setActiveScan] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error("Failed to fetch products");
      const body = await res.json();
      const list = body.data || [];
      setProducts(list);
      if (list.length > 0) {
        setSelectedDomain(list[0].domain);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!selectedDomain) return;
    const fetchScans = async () => {
      setScanLoading(true);
      try {
        const res = await fetch(`${API_BASE}/products/${encodeURIComponent(selectedDomain)}`);
        if (!res.ok) throw new Error("Failed to fetch scans");
        const body = await res.json();
        const scans = body.data || [];
        if (scans.length > 0) {
          setActiveScan(scans[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setScanLoading(false);
        setLoading(false);
      }
    };
    fetchScans();
  }, [selectedDomain]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div className="loading-spinner"><div className="spinner-ring" />Loading Dashboard…</div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="page-container" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "80vh", gap: 16 }}>
        <h2>No scans yet</h2>
        <p style={{ color: "var(--text-muted)" }}>Use the Chrome extension to scan financial pages.</p>
      </div>
    );
  }

  const scan = activeScan || MOCK;
  const risk = scan.risk_score;
  const nlp = {
    labeled_clauses: scan.nlp_results || [],
    plain_english_summary: scan.nlp_results?.map(c => c.explanation || c.description).filter(Boolean).join(" ") || "No summary available."
  };
  const cv = {
    patterns: scan.cv_results || []
  };

  const nlpCount = nlp?.labeled_clauses?.filter((c) => !c.labels?.includes("clean")).length || 0;
  const cvCount  = cv?.patterns?.filter((p) => p.label !== "clean").length || 0;
  const total    = nlpCount + cvCount;

  return (
    <div className="page-container animate-in">
      {/* ── Page header ────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Detailed Analysis Report</h1>
          <p className="page-subtitle">
            {scan.page_title} &mdash;{" "}
            <span style={{ color: "var(--indigo-dark)", fontWeight: 600 }}>{scan.domain}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={fetchProducts}>Refresh</button>
          <a
            href={`${API_BASE}/report/pdf/${scan.scan_id}`}
            target="_blank" rel="noreferrer"
            className="btn btn-primary"
          >
            Download PDF Report
          </a>
        </div>
      </div>

      {/* ── Metric cards row ───────────────────────────────────── */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {/* Risk score gauge card */}
        <div className="stat-card" style={{ gridColumn: "1", display: "flex", alignItems: "center", gap: 14 }}>
          <RiskGauge score={risk.score} level={risk.level} size={72} />
          <div>
            <div className="stat-label">Risk Score</div>
            <RiskBadge level={risk.level} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              NLP {risk.nlp_score} · CV {risk.cv_score}
            </div>
          </div>
        </div>

        {/* Total detected */}
        <div className="stat-card primary">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Patterns</div>
          <div className="stat-sublabel">Total Detected</div>
        </div>

        {/* NLP */}
        <div className="stat-card">
          <div className="stat-value">{nlpCount}</div>
          <div className="stat-label">NLP Detections</div>
          <div className="stat-sublabel">Textual Clauses</div>
        </div>

        {/* CV */}
        <div className="stat-card">
          <div className="stat-value">{cvCount}</div>
          <div className="stat-label">CV Detections</div>
          <div className="stat-sublabel">UI/UX Patterns</div>
        </div>
      </div>

      {/* ── Risk breakdown bar ─────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Severity breakdown
          </span>
          {[
            { label: "High", count: 3, cls: "badge-high" },
            { label: "Medium", count: 3, cls: "badge-medium" },
            { label: "Low", count: 2, cls: "badge-low" },
          ].map(({ label, count, cls }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`badge ${cls}`}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{count}</span>
            </div>
          ))}
          <div style={{ flex: 1, display: "flex", borderRadius: 6, overflow: "hidden", height: 8, gap: 2, minWidth: 120 }}>
            <div style={{ flex: 3, background: "var(--risk-high)",   borderRadius: "6px 0 0 6px" }} />
            <div style={{ flex: 3, background: "var(--risk-medium)" }} />
            <div style={{ flex: 2, background: "var(--risk-low)",    borderRadius: "0 6px 6px 0" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* ── Left column ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Text & Clause Analysis */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Text &amp; Clause Analysis
              </span>
              <span className="section-tag badge-indigo">
                NLP — {nlpCount} detections
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Clause Snippet</th>
                    <th>Label</th>
                    <th>Severity</th>
                    <th>Confidence</th>
                    <th style={{ width: 20 }} />
                  </tr>
                </thead>
                <tbody>
                  {(nlp?.labeled_clauses || []).map((c, i) => (
                    <PatternCard
                      key={i}
                      label={c.labels?.[0] || "unknown"}
                      text={c.text}
                      severity={c.severity}
                      confidence={c.confidence}
                      description={c.explanation}
                      variant="row"
                    />
                  ))}
                  {(!nlp?.labeled_clauses || nlp.labeled_clauses.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                        No NLP data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Computer Vision: UI Pattern Mapping */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Computer Vision: UI Pattern Mapping
              </span>
              <span className="section-tag" style={{ background: "var(--risk-critical-bg)", color: "var(--risk-critical)", fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20 }}>
                {cvCount} TRAPS DETECTED
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                {/* Screenshot placeholder */}
                <div style={{
                  background: "linear-gradient(135deg, #1E3A5F 0%, #0F2A4A 100%)",
                  borderRadius: "var(--radius-md)",
                  aspectRatio: "9/16",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 500,
                  gap: 8,
                  position: "relative",
                  overflow: "hidden",
                  maxHeight: 260,
                }}>
                  {/* Simulated bounding boxes */}
                  <div style={{ position: "absolute", top: "15%", left: "15%", right: "15%", height: "10%", border: "2px solid rgba(239,68,68,0.7)", borderRadius: 4 }} />
                  <div style={{ position: "absolute", top: "40%", left: "10%", right: "30%", height: "8%", border: "2px solid rgba(239,68,68,0.7)", borderRadius: 4 }} />
                  <div style={{ position: "absolute", bottom: "20%", left: "20%", right: "20%", height: "8%", border: "2px dashed rgba(249,115,22,0.8)", borderRadius: 4 }} />
                  <span style={{ zIndex: 1, fontSize: 11, textAlign: "center", padding: "0 16px" }}>
                    Screenshot scan
                  </span>
                  <div style={{
                    position: "absolute", bottom: 8, left: 8, right: 8,
                    background: "rgba(0,0,0,0.7)", borderRadius: 4,
                    padding: "3px 8px", fontSize: 10, color: "rgba(255,255,255,0.7)",
                    textAlign: "center",
                  }}>
                    ✗ Spatial Confidence: 88.4%
                  </div>
                </div>

                {/* Detected coordinates */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Detected Coordinate Data
                  </div>
                  {(cv?.patterns || []).map((p, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        background: "var(--bg-card-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                            {humanize(p.label)}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                            {p.description}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--risk-critical)", background: "var(--risk-critical-bg)", padding: "2px 8px", borderRadius: 10 }}>
                          {(p.confidence * 100).toFixed(0)}% Confidence
                        </span>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 8, justifyContent: "center" }}>
                    Expand Visual Analysis
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right column ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Plain English Summary */}
          <div className="info-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--indigo-dark)" }}>Plain English Summary</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>
              {nlp?.plain_english_summary ||
                "This loan product uses multiple manipulative clauses. Fees are buried deep in paragraph 14. Auto-renewal is pre-selected by default. Urgency language creates artificial pressure. The 'Apply Now' button uses misleading prominence to rush the decision."}
            </p>
          </div>

          {/* Top Patterns quick list */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Top Patterns</span>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              {[...(nlp?.labeled_clauses || []), ...(cv?.patterns || [])]
                .filter((p) => !(p.labels || [p.label])[0]?.includes("clean"))
                .slice(0, 5)
                .map((p, i) => (
                  <PatternCard
                    key={i}
                    label={(p.labels?.[0] || p.label || "unknown")}
                    description={p.explanation || p.description}
                    severity={p.severity}
                    confidence={p.confidence}
                    variant="card"
                  />
                ))}
            </div>
          </div>

          {/* Community Awareness */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Community Awareness</span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex" }}>
                  {["U1", "U2", "U3"].map((text, i) => (
                    <div
                      key={i}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "var(--bg-card-2)", border: "2px solid var(--bg-card)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600, color: "var(--text-secondary)",
                        marginLeft: i > 0 ? -8 : 0,
                        zIndex: 3 - i,
                      }}
                    >
                      {text}
                    </div>
                  ))}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "var(--indigo-light)", border: "2px solid var(--bg-card)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "var(--indigo-dark)",
                    marginLeft: -8, zIndex: 0,
                  }}>
                    +452
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--risk-critical)" }}>452 users</strong> have flagged this specific product for deceptive lending practices.
                </p>
              </div>
              <button className="btn btn-outline" style={{ width: "100%", justifyContent: "center", borderColor: "var(--risk-critical)", color: "var(--risk-critical)" }}>
                Add My Flag
              </button>
            </div>
          </div>

          {/* Scanned Products quick list */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Scans</span>
            </div>
            {loading && <div className="loading-spinner"><div className="spinner-ring" />Loading…</div>}
            {!loading && products.slice(0, 5).map((p) => (
              <div
                key={p.domain}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedDomain(p.domain)}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.domain}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.scan_count} scans</div>
                </div>
                <RiskBadge level={p.risk_level} score={p.last_risk_score?.toFixed(0)} />
              </div>
            ))}
            {!loading && products.length === 0 && (
              <div className="empty-state" style={{ padding: "20px 16px" }}>
                <p>No products scanned yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom action bar ──────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={`${API_BASE}/report/pdf/${scan.scan_id}`}
            target="_blank" rel="noreferrer"
            className="btn btn-primary"
          >
            Download PDF Report
          </a>
          <button className="btn btn-outline">
            Share Analysis
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--text-muted)", fontSize: 12 }}
        >
          Report False Positive or System Error
        </button>
      </div>
    </div>
  );
}
