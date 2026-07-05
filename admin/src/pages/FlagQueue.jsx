import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";

const STATUS_TABS = ["pending", "approved", "rejected", "all"];

// Mock data for local dev
const MOCK_REPORTS = [
  { id: "r1", domain: "quickloan.com",  pattern_type: "fee_burial",           description: "Hidden processing fee in clause 14 of T&C.", status: "pending",  created_at: "2024-06-05T09:00:00Z" },
  { id: "r2", domain: "hdfcbank.com",   pattern_type: "auto_renewal_trap",    description: "Auto-debit checkbox is pre-checked by default.", status: "pending", created_at: "2024-06-06T11:30:00Z" },
  { id: "r3", domain: "amex.com",       pattern_type: "urgency_language",     description: "'Last 2 slots available!' shown permanently.", status: "approved", created_at: "2024-06-04T14:00:00Z" },
  { id: "r4", domain: "citibank.com",   pattern_type: "misleading_cta_color", description: "Decline button is grey, accept button is oversized blue.", status: "rejected", created_at: "2024-06-03T10:00:00Z" },
  { id: "r5", domain: "loandepot.com",  pattern_type: "ambiguous_opt_out",    description: "Newsletter opt-out requires triple confirmation steps.", status: "pending", created_at: "2024-06-07T08:00:00Z" },
];

export default function FlagQueue() {
  const [status, setStatus] = useState("pending");
  const [actionLoading, setActionLoading] = useState(null);
  const [localReports, setLocalReports] = useState(MOCK_REPORTS);

  const { data, loading, error, refetch } = useApi(
    () => api.getCommunityReports(status),
    [status]
  );

  const apiReports = data?.data || [];
  const reports = apiReports.length
    ? apiReports
    : localReports.filter((r) => status === "all" || r.status === status);

  async function handleAction(id, action) {
    setActionLoading(id + action);
    try {
      if (apiReports.length) {
        if (action === "approve") await api.approveReport(id);
        else await api.rejectReport(id);
        refetch();
      } else {
        setLocalReports((prev) =>
          prev.map((r) => r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r)
        );
      }
    } catch (e) {
      console.warn("Action failed:", e.message);
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCount = localReports.filter((r) => r.status === "pending").length;

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Flag Queue</h1>
          <p className="text-muted" style={{ fontSize: 14 }}>Review and moderate community-submitted dark pattern reports</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {pendingCount > 0 && (
            <span className="badge badge-red">{pendingCount} pending</span>
          )}
          <button style={{ 
            background: "var(--bg-card)", color: "var(--text-primary)", 
            padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
            fontWeight: 500 
          }} onClick={refetch}>
            Refresh
          </button>
        </div>
      </div>

      <div className="bento-card" style={{ flex: 1, padding: 0, overflow: "hidden" }}>
        
        {/* Header and Tabs */}
        <div className="flex-between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: "capitalize",
                  background: status === s ? "var(--text-primary)" : "transparent",
                  color: status === s ? "var(--bg-card)" : "var(--text-secondary)",
                  transition: "all 0.2s"
                }}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            {reports.length} reports
          </span>
        </div>

        {loading && (
          <div className="flex-center" style={{ padding: 40 }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="flex-center text-muted" style={{ padding: 40 }}>
            <p>No {status === "all" ? "" : status} reports.</p>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Domain</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Pattern Type</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Description</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600 }}>Submitted</th>
                  <th style={{ padding: "16px 24px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {report.domain}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className="badge badge-outline" style={{ background: "var(--bg-input)" }}>
                        {report.pattern_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", maxWidth: 260, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.4 }}>
                      {report.description}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className={`badge ${report.status === 'approved' ? 'badge-green' : report.status === 'rejected' ? 'badge-red' : 'badge-outline'}`} style={{ textTransform: "capitalize" }}>
                        {report.status}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {report.created_at ? new Date(report.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      {report.status === "pending" ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => handleAction(report.id, "approve")}
                            style={{ 
                              padding: "6px 12px", background: "var(--accent-transparent)", color: "var(--accent)", 
                              borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, border: "none"
                            }}
                          >
                            {actionLoading === report.id + "approve" ? "…" : "Approve"}
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => handleAction(report.id, "reject")}
                            style={{ 
                              padding: "6px 12px", background: "rgba(239, 68, 68, 0.15)", color: "var(--critical)", 
                              borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, border: "none"
                            }}
                          >
                            {actionLoading === report.id + "reject" ? "…" : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
