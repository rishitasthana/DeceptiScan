import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

export default function Dashboard() {
  const [stats, setStats] = useState({ totalScans: 0, avgRisk: 0, recentScans: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from an aggregate endpoint.
    // For now, we'll fetch /products and calculate manually.
    fetch(`${API_BASE}/products?page=1&page_size=50`)
      .then((res) => res.json())
      .then((body) => {
        const data = body.data || [];
        const total = data.length;
        const avg = total > 0 ? (data.reduce((acc, curr) => acc + curr.last_risk_score, 0) / total).toFixed(1) : 0;
        
        setStats({
          totalScans: total,
          avgRisk: avg,
          recentScans: data.slice(0, 5) // top 5
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="page-container flex-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridAutoRows: "minmax(280px, auto)", gap: 16 }}>
      
      {/* ── Overview Card ── */}
      <div className="bento-card">
        <div className="card-title">
          <span>Overview</span>
          <select style={{ background: "transparent", color: "var(--text-secondary)", border: "none", outline: "none", fontSize: 13, cursor: "pointer" }}>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          {/* Total Scans */}
          <div style={{ background: "var(--bg-input)", borderRadius: "var(--radius-md)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", color: "var(--accent)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span> 
              Total Scans
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)" }}>{stats.totalScans}</span>
              <span className="badge badge-green">↑ 12.5%</span>
            </div>
          </div>
          
          {/* Average Risk */}
          <div style={{ background: "var(--bg-input)", borderRadius: "var(--radius-md)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", color: "var(--critical)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </span> 
              Average Risk
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)" }}>{stats.avgRisk}</span>
              <span className="badge badge-red">↑ 2.1%</span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Recent Domains Analyzed</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>Showing latest activity from the extension.</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {stats.recentScans.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ 
                  width: 48, height: 48, borderRadius: "50%", background: "var(--bg-input)", 
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)",
                  border: "2px solid var(--border)"
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.domain}
                </span>
              </div>
            ))}
            {stats.recentScans.length > 0 && (
              <button style={{ 
                width: 48, height: 48, borderRadius: "50%", border: "1px dashed var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)"
              }}>
                →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Risk Distribution (Donut Chart placeholder) ── */}
      <div className="bento-card">
        <div className="card-title">Risk Distribution</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {/* SVG Donut */}
          <div style={{ position: "relative", width: 160, height: 160, marginBottom: 24 }}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="60" fill="none" stroke="var(--bg-input)" strokeWidth="20" />
              <circle cx="80" cy="80" r="60" fill="none" stroke="var(--accent)" strokeWidth="20" strokeDasharray="377" strokeDashoffset="260" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
              <circle cx="80" cy="80" r="60" fill="none" stroke="var(--critical)" strokeWidth="20" strokeDasharray="377" strokeDashoffset="310" style={{ transform: "rotate(20deg)", transformOrigin: "center" }} />
            </svg>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>68%</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Safe</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, width: "100%", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><span style={{width: 8, height: 8, background: "var(--accent)", borderRadius: 2}}></span> Low</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>68%</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><span style={{width: 8, height: 8, background: "var(--critical)", borderRadius: 2}}></span> High</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>32%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scan Volume (Bar Chart placeholder) ── */}
      <div className="bento-card">
        <div className="card-title">
          <span>Scan Volume</span>
          <select style={{ background: "transparent", color: "var(--text-secondary)", border: "none", outline: "none", fontSize: 13, cursor: "pointer" }}>
            <option>Last 7 days</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 32, fontWeight: 700 }}>142</span>
          <span className="badge badge-green">↑ 36.8%</span>
        </div>
        
        {/* CSS Bar Chart */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
          {[30, 45, 20, 60, 85, 40, 50].map((h, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {h === 85 && (
                <div style={{ background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 10, padding: "2px 6px", borderRadius: 4, position: "relative" }}>
                  Peak
                  <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid var(--bg-input)" }}></div>
                </div>
              )}
              <div style={{ 
                width: "100%", 
                height: `${h}%`, 
                background: h === 85 ? "var(--accent)" : "var(--bg-input)", 
                borderRadius: "4px 4px 0 0",
                transition: "height 0.3s"
              }}></div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Scans List ── */}
      <div className="bento-card">
        <div className="card-title">Recent Scans</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1 }}>
          {stats.recentScans.map((scan, i) => {
            const isHigh = scan.last_risk_score >= 6;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i === stats.recentScans.length - 1 ? "none" : "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
                    background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center" 
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{scan.domain}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{scan.scan_count} scans</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{scan.last_risk_score}/10</div>
                  <div style={{ fontSize: 10, color: isHigh ? "var(--critical)" : "var(--accent)", textTransform: "uppercase", fontWeight: 700 }}>
                    {isHigh ? "High Risk" : "Safe"}
                  </div>
                </div>
              </div>
            );
          })}
          {stats.recentScans.length === 0 && (
            <div className="text-muted" style={{ textAlign: "center", marginTop: 20 }}>No scans recorded yet.</div>
          )}
        </div>
        <button style={{ 
          width: "100%", padding: 12, background: "transparent", border: "1px solid var(--border)", 
          borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontWeight: 500, marginTop: 16 
        }}>
          All Scans
        </button>
      </div>

    </div>
  );
}
