/**
 * Content script for the Dark Pattern Detector extension.
 *
 * Responsibilities:
 * 1. Extract visible T&C text and linked PDF URLs from the DOM
 * 2. Request a screenshot capture from the background worker
 * 3. POST both to the FastAPI backend at /analyze/full
 * 4. Inject a Shadow DOM floating overlay with the risk score and top patterns
 */

(async function () {
  "use strict";

  const API_BASE = "http://localhost:8000";
  const OVERLAY_HOST_ID = "__dpd_overlay_host__";

  // ── Guard: don't run twice ──────────────────────────────────────────────────
  if (document.getElementById(OVERLAY_HOST_ID)) return;

  /**
   * Load local html2canvas library from extension context
   */
  function loadHtml2Canvas() {
    return new Promise((resolve) => {
      if (window.html2canvas) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("lib/html2canvas.min.js");
      script.onload = () => resolve();
      script.onerror = () => {
        console.warn("[DPD] Failed to load local html2canvas");
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  // ── 1. Extract text content ─────────────────────────────────────────────────

  /**
   * Extract all visible paragraph/list/span text from the page.
   * @returns {string} Concatenated visible text content.
   */
  function extractText() {
    const selectors = ["p", "li", "span", "div.terms", "div.tc", "article", "section"];
    const seen = new Set();
    const parts = [];

    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      const text = el.innerText?.trim();
      if (text && text.length > 30 && !seen.has(text)) {
        seen.add(text);
        parts.push(text);
      }
    });

    return parts.join(" ").substring(0, 50000); // Cap at 50k chars
  }

  /**
   * Extract all PDF links from the page.
   * @returns {string[]} Array of absolute PDF URLs.
   */
  function extractPdfUrls() {
    const links = [...document.querySelectorAll("a[href]")];
    return links
      .map((a) => a.href)
      .filter((href) => href.toLowerCase().includes(".pdf"))
      .slice(0, 10);
  }

  // ── 2. Capture screenshot ───────────────────────────────────────────────────

  /**
   * Request a screenshot from the background service worker.
   * @returns {Promise<string|null>} Base64 data URL or null on failure.
   */
  async function captureScreenshot() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
      if (response?.success && response.dataUrl) {
        // Strip the data URL prefix to get raw base64
        return response.dataUrl.replace(/^data:image\/\w+;base64,/, "");
      }
    } catch (e) {
      console.warn("[DPD] Screenshot capture failed:", e.message);
    }
    return null;
  }

  // ── 3. Call the API ─────────────────────────────────────────────────────────

  /**
   * POST extracted data to the FastAPI backend for full analysis.
   * @param {string} text - Extracted T&C text.
   * @param {string|null} screenshotB64 - Base64 screenshot.
   * @param {string[]} pdfUrls - Linked PDF URLs.
   * @returns {Promise<object|null>} ScanResult or null on error.
   */
  async function analyzeFullPage(text, screenshotB64, pdfUrls) {
    try {
      const domain = window.location.hostname;
      const response = await fetch(`${API_BASE}/analyze/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          screenshot_b64: screenshotB64,
          domain,
          pdf_urls: pdfUrls,
          page_title: document.title,
        }),
      });

      if (!response.ok) {
        console.warn("[DPD] API error:", response.status);
        return null;
      }

      const body = await response.json();
      return body?.data || null;
    } catch (e) {
      console.warn("[DPD] API call failed:", e.message);
      return null;
    }
  }

  // ── 4. Shadow DOM overlay ───────────────────────────────────────────────────

  function injectOverlay(scanResult) {
    const host = document.createElement("div");
    host.id = OVERLAY_HOST_ID;
    host.style.cssText = "position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const { risk_score, top_patterns, scan_id } = scanResult;
    const isHighRisk = risk_score.score >= 7;
    
    // Determine level colors based on css variables later, or inline
    const levelColor = {
      critical: "#DC2626",
      high: "#EA580C",
      medium: "#CA8A04",
      low: "#16A34A",
    }[risk_score.level] || "#64748B";

    const patternHTML = (top_patterns || [])
      .slice(0, 3)
      .map((p) => {
        const label = p.label || (p.labels && p.labels[0]) || "unknown";
        const explanation = p.explanation || p.description || "";
        return `<div class="pattern-item">
          <svg class="pattern-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div class="pattern-content">
            <span class="pattern-label">${_humanize(label)}</span>
            <p class="pattern-desc">${explanation}</p>
          </div>
        </div>`;
      })
      .join("");

    shadow.innerHTML = `
      <style>
        :host {
          --primary: #4F46E5;
          --primary-hover: #4338CA;
          --bg-color: #FFFFFF;
          --surface-color: #F8FAFC;
          --text-primary: #0F172A;
          --text-secondary: #64748B;
          --border-color: #E2E8F0;
          --danger: #DC2626;
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --primary: #6366F1;
            --primary-hover: #4F46E5;
            --bg-color: #0F172A;
            --surface-color: #1E293B;
            --text-primary: #F8FAFC;
            --text-secondary: #94A3B8;
            --border-color: #334155;
            --danger: #F87171;
          }
        }

        .dpd-card {
          position: fixed;
          top: 24px;
          right: 24px;
          width: 320px;
          background: var(--bg-color);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--text-primary);
          pointer-events: all;
          animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        @media (max-width: 600px) {
          .dpd-card {
            top: auto;
            bottom: 0;
            right: 0;
            left: 0;
            width: 100%;
            border-radius: 20px 20px 0 0;
            animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        }

        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }

        .dpd-header {
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dpd-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dpd-close {
          cursor: pointer;
          color: var(--text-secondary);
          background: none;
          border: none;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dpd-close:hover { background: var(--surface-color); }

        .dpd-score-section {
          padding: 0 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .dpd-score-ring {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
          border: 4px solid ${levelColor};
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .dpd-risk-text {
          font-size: 14px;
          font-weight: 600;
          color: ${isHighRisk ? 'var(--danger)' : 'var(--text-primary)'};
          margin-bottom: 4px;
        }
        
        .dpd-scan-text {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .dpd-patterns {
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pattern-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: var(--surface-color);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }
        
        .pattern-icon {
          width: 20px;
          height: 20px;
          color: var(--danger);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .pattern-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          display: block;
          margin-bottom: 2px;
        }

        .pattern-desc {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        .dpd-footer {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }

        .dpd-btn-primary {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: var(--primary);
          color: white;
          transition: background 0.2s;
        }
        .dpd-btn-primary:hover { background: var(--primary-hover); }

        .dpd-dismiss-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
        }
        .dpd-dismiss-btn:hover { color: var(--text-primary); }
        
        .dpd-branding {
          font-size: 10px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
      </style>

      <div class="dpd-card" id="dpd-main">
        <div class="dpd-header">
          <div class="dpd-title">ShieldCheck</div>
          <button class="dpd-close" id="dpd-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="dpd-score-section">
          <div class="dpd-score-ring">${risk_score.score}/10</div>
          <div class="dpd-risk-text">${isHighRisk ? 'High Risk Detected' : 'Moderate Risk Detected'}</div>
          <div class="dpd-scan-text">Scanning financial integrity of this page...</div>
        </div>

        ${top_patterns && top_patterns.length > 0 ? `
        <div class="dpd-patterns">
          ${patternHTML}
        </div>` : ""}

        <div class="dpd-footer">
          <button class="dpd-btn-primary" id="dpd-report-btn">See Full Report →</button>
          <button class="dpd-dismiss-btn" id="dpd-dismiss-btn">Dismiss</button>
          <div class="dpd-branding">Secured by ShieldCheck AI • v2.4.0</div>
        </div>
      </div>
    `;

    // ── Event listeners ─────────────────────────────────────────────────────
    shadow.getElementById("dpd-close").addEventListener("click", () => host.remove());
    shadow.getElementById("dpd-dismiss-btn").addEventListener("click", () => host.remove());
    shadow.getElementById("dpd-report-btn").addEventListener("click", () => {
      window.open(`${API_BASE}/report/pdf/${scan_id}`, "_blank");
    });
  }

  function injectLoadingOverlay() {
    const host = document.createElement("div");
    host.id = OVERLAY_HOST_ID;
    host.style.cssText = "position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          --primary: #4F46E5;
          --bg-color: #FFFFFF;
          --text-primary: #0F172A;
          --text-secondary: #64748B;
          --border-color: #E2E8F0;
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --primary: #6366F1;
            --bg-color: #0F172A;
            --text-primary: #F8FAFC;
            --text-secondary: #94A3B8;
            --border-color: #334155;
          }
        }

        .dpd-card {
          position: fixed; top: 24px; right: 24px; width: 280px;
          background: var(--bg-color);
          border-radius: 16px; border: 1px solid var(--border-color);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--text-primary); pointer-events: all;
          animation: slideIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        
        @media (max-width: 600px) {
          .dpd-card {
            top: auto; bottom: 0; right: 0; left: 0; width: 100%;
            border-radius: 20px 20px 0 0;
            animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        }

        @keyframes slideIn { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        
        .dpd-scanning { padding: 24px 20px; text-align: center; color: var(--text-secondary); font-size: 13px; font-weight: 500;}
        .dpd-spinner {
          width: 32px; height: 32px;
          border: 3px solid var(--border-color); border-top-color: var(--primary);
          border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <div class="dpd-card">
        <div class="dpd-scanning">
          <div class="dpd-spinner"></div>
          Analyzing financial integrity...
        </div>
      </div>
    `;
    return host;
  }

  /**
   * Convert a snake_case label to human-readable title case.
   * @param {string} label - Snake-case label string.
   * @returns {string} Human-readable string.
   */
  function _humanize(label) {
    return label
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Clear overlay on navigation ─────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "CLEAR_OVERLAY") {
      document.getElementById(OVERLAY_HOST_ID)?.remove();
    }
  });

  // ── Main execution ──────────────────────────────────────────────────────────

  // Only run on pages that look like financial product pages
  const FINANCIAL_KEYWORDS = [
    "credit", "card", "loan", "mortgage", "insurance", "invest",
    "bank", "finance", "terms", "conditions", "agreement",
  ];

  const pageText = document.body.innerText.toLowerCase();
  const isFinancialPage = FINANCIAL_KEYWORDS.some((kw) => pageText.includes(kw));

  // Retrieve forceScan flag
  const forceScan = await new Promise((resolve) => {
    chrome.storage.local.get("forceScan", (data) => {
      resolve(data.forceScan || false);
    });
  });

  if (forceScan) {
    chrome.storage.local.remove("forceScan");
  }

  if (!isFinancialPage && !forceScan) return;

  // Show loading indicator
  const loadingHost = injectLoadingOverlay();

  try {
    await loadHtml2Canvas();
    const text = extractText();
    const pdfUrls = extractPdfUrls();
    const screenshotB64 = await captureScreenshot();

    if (!text || text.length < 50) {
      loadingHost.remove();
      return;
    }

    const scanResult = await analyzeFullPage(text, screenshotB64, pdfUrls);
    loadingHost.remove();

    if (scanResult) {
      // Store for popup
      chrome.runtime.sendMessage({
        type: "STORE_SCAN_RESULT",
        domain: window.location.hostname,
        result: scanResult,
      });

      // Only show overlay if risk is meaningful
      if (scanResult.risk_score?.score > 2) {
        injectOverlay(scanResult);
      }
    }
  } catch (err) {
    loadingHost.remove();
    console.error("[DPD] Content script error:", err);
  }
})();
