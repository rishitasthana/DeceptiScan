/**
 * FlagQueue — review and approve/reject community dark pattern reports.
 * Updated to ShieldCheck light theme.
 */

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
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Flag Queue</h1>
          <p className="page-subtitle">Review and moderate community-submitted dark pattern reports</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingCount > 0 && (
            <span className="badge badge-high">{pendingCount} pending</span>
          )}
          <button className="btn btn-outline" onClick={refetch}>Refresh</button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="tab-pills" style={{ marginBottom: 20 }}>
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            className={`tab-pill${status === s ? " active" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Community Reports</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{reports.length} reports</span>
        </div>

        {loading && (
          <div className="loading-spinner">
            <div className="spinner-ring" />Loading reports…
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="empty-state">
            <p>No {status === "all" ? "" : status} reports.</p>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Pattern Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{report.domain}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 9px", borderRadius: 20, fontSize: 11,
                        fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px",
                        background: "var(--indigo-light)", color: "var(--indigo-dark)",
                      }}>
                        {report.pattern_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ maxWidth: 260, color: "var(--text-secondary)", fontSize: 12 }}>
                      {report.description}
                    </td>
                    <td>
                      <span className={`badge badge-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {report.created_at ? new Date(report.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      {report.status === "pending" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-success btn-sm"
                            disabled={!!actionLoading}
                            onClick={() => handleAction(report.id, "approve")}
                          >
                            {actionLoading === report.id + "approve" ? "…" : "✓ Approve"}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={!!actionLoading}
                            onClick={() => handleAction(report.id, "reject")}
                          >
                            {actionLoading === report.id + "reject" ? "…" : "✗ Reject"}
                          </button>
                        </div>
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
