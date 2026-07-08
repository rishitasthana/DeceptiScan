/**
 * Popup script for the Dark Pattern Detector extension (ShieldCheck).
 */

const API_BASE = "http://localhost:8000";
let currentScan = null;

/** True while a scan is in-flight — prevents double-clicks launching parallel scans. */
let _isScanRunning = false;

/** Timestamp (ms) of the most recent completed scan. Used by loadHistory to delay
 *  the backend fetch so MongoDB persistence can catch up. */
let _lastScanTime = 0;


const LEVEL_COLORS = {
  critical: "var(--critical-text)",
  high: "var(--high-text)",
  medium: "var(--medium-text)",
  low: "var(--low-text)",
};

const LEVEL_BG = {
  critical: "var(--critical-bg)",
  high: "var(--high-bg)",
  medium: "var(--medium-bg)",
  low: "var(--low-bg)",
};

// Map of common dark pattern categories to SVG icons
const PATTERN_ICONS = {
  "auto_renewal": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  "hidden_fee": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
  "urgency": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  "default": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

function getIconForLabel(label) {
  const lbl = label.toLowerCase();
  if (lbl.includes("renew") || lbl.includes("subscription")) return PATTERN_ICONS.auto_renewal;
  if (lbl.includes("fee") || lbl.includes("cost") || lbl.includes("charge")) return PATTERN_ICONS.hidden_fee;
  if (lbl.includes("urgency") || lbl.includes("time") || lbl.includes("countdown")) return PATTERN_ICONS.urgency;
  return PATTERN_ICONS.default;
}

/**
 * Show a specific state section and hide all others inside Home view.
 */
function showState(stateId) {
  const states = ["loading-state", "no-scan-state", "result-state", "not-financial-state"];
  states.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === stateId) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

/**
 * Handle bottom navigation tab switching.
 */
function setupTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  const views = document.querySelectorAll(".view-section");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // Update active nav
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");

      // Show target view
      const targetId = item.getAttribute("data-target");
      if (targetId === "view-history") {
        loadHistory();
      }

      views.forEach(view => {
        if (view.id === targetId) {
          view.classList.add("active");
        } else {
          view.classList.remove("active");
        }
      });
    });
  });
}

/**
 * Show toast notification helper
 */
function showToast(message) {
  const toast = document.getElementById("toast-message");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}

/**
 * Render the scan result into the popup UI.
 */
function renderResult(scanResult) {
  currentScan = scanResult;
  const { risk_score, top_patterns = [], scan_id } = scanResult;
  const color = LEVEL_COLORS[risk_score.level] || "var(--text-secondary)";
  const bg = LEVEL_BG[risk_score.level] || "var(--border-color)";

  // Score ring
  const ring = document.getElementById("score-ring");
  ring.style.borderColor = color;
  ring.style.color = color;
  document.getElementById("score-value").textContent = risk_score.score;

  // Risk badge
  const badge = document.getElementById("risk-badge");
  const badgeText = document.getElementById("risk-badge-text");
  badgeText.textContent = `${risk_score.level} Risk Detected`.toUpperCase();
  badge.style.background = bg;
  badge.style.color = color;

  // Patterns
  if (top_patterns.length > 0) {
    const patternsContainer = document.getElementById("patterns-container");
    const patternsList = document.getElementById("patterns-list");
    patternsContainer.classList.remove("hidden");

    patternsList.innerHTML = top_patterns
      .slice(0, 3)
      .map((p) => {
        // LabeledClause has `labels` (array), UIPattern has `label` (string)
        const labelRaw = p.label ||
          (Array.isArray(p.labels) ? p.labels[0] : p.labels) ||
          "unknown";
        // labels can be enum objects with .value, or plain strings
        const label = typeof labelRaw === "object" ? (labelRaw.value || String(labelRaw)) : String(labelRaw);
        const desc = p.explanation || p.description || "";
        const iconSvg = getIconForLabel(label);

        // Derive a risk level string from severity float (0-1)
        const sev = typeof p.severity === "number" ? p.severity : 0;
        let pLevel = "low";
        if (sev >= 0.85) pLevel = "critical";
        else if (sev >= 0.65) pLevel = "high";
        else if (sev >= 0.35) pLevel = "medium";

        const pColor = LEVEL_COLORS[pLevel] || "var(--text-secondary)";

        return `
          <div class="pattern-item">
            <div class="pattern-icon">${iconSvg}</div>
            <div class="pattern-content">
              <div class="pattern-header-row">
                <span class="pattern-title">${humanize(label)}</span>
                <span class="pattern-level" style="color: ${pColor}; border-color: ${pColor}">${pLevel.toUpperCase()}</span>
              </div>
              <p class="pattern-desc">${desc}</p>
            </div>
          </div>`;
      })
      .join("");
  } else {
    document.getElementById("patterns-container").classList.add("hidden");
  }

  // Report button — opens the full HTML report in a new tab
  document.getElementById("view-report-btn").onclick = () => {
    if (!scan_id) {
      showToast("No scan ID available — please run a fresh scan");
      return;
    }
    chrome.tabs.create({ url: `${API_BASE}/report/html/${scan_id}` });
  };


  showState("result-state");
}

/**
 * Fetch and render scan history — sorted by most recent activity.
 * Waits a short delay after a fresh scan to allow MongoDB persistence.
 */
async function loadHistory() {
  const loading = document.getElementById("history-loading");
  const empty = document.getElementById("history-empty");
  const list = document.getElementById("history-list");

  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  list.classList.add("hidden");

  // If a scan just completed, wait for the backend background task to persist it
  const timeSinceScan = Date.now() - _lastScanTime;
  if (_lastScanTime > 0 && timeSinceScan < 4000) {
    await new Promise((r) => setTimeout(r, 1500 - Math.min(timeSinceScan, 1500)));
  }

  try {
    // Use /products/history which is sorted by last_scanned_at DESC (most recent first)
    const response = await fetch(`${API_BASE}/products/history?limit=20`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();

    const historyData = (body.data || []).map((s) => ({
      domain: s.domain,
      score: typeof s.last_risk_score === "number" ? s.last_risk_score.toFixed(2) : "-",
      level: (s.risk_level || "low").toLowerCase(),
      scan_count: s.scan_count || 1,
      scanned_at: s.last_scanned_at,
    }));

    // Prepend current cached scan if it's more recent than what backend returned
    if (currentScan && historyData.length > 0) {
      const latest = historyData[0];
      const cachedAt = currentScan.scanned_at ? new Date(currentScan.scanned_at).getTime() : 0;
      const latestAt = latest.scanned_at ? new Date(latest.scanned_at).getTime() : 0;
      if (cachedAt > latestAt && currentScan.domain === latest.domain) {
        historyData[0].score = currentScan.risk_score?.score?.toFixed(2) ?? latest.score;
        historyData[0].level = (currentScan.risk_score?.level || latest.level).toLowerCase();
        historyData[0].scanned_at = currentScan.scanned_at;
      }
    }

    loading.classList.add("hidden");

    if (historyData.length === 0) {
      empty.classList.remove("hidden");
      const descEl = document.querySelector("#history-empty .state-desc");
      if (descEl) descEl.textContent = "No scans yet — scan a financial page to get started.";
    } else {
      list.classList.remove("hidden");
      list.innerHTML = historyData
        .map((item) => {
          const color = LEVEL_COLORS[item.level] || "var(--text-secondary)";
          const timeAgo = getTimeAgo(item.scanned_at);
          const isRecent = _lastScanTime > 0 && (Date.now() - _lastScanTime) < 10000 && historyData.indexOf(item) === 0;
          return `
            <div class="pattern-item" style="cursor:pointer; ${isRecent ? "border-left: 3px solid var(--primary-color);" : ""}" id="hist-row-${item.domain.replace(/\W/g, "-")}">
              <div class="pattern-content">
                <div class="pattern-header-row" style="margin-bottom:2px">
                  <span class="pattern-title">${item.domain}</span>
                  <span class="pattern-level" style="color:${color}; border-color:${color}">${item.score}/10</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px">
                  <div style="font-size:11px; color:var(--text-secondary)">${timeAgo}</div>
                  ${isRecent ? '<div style="font-size:10px; background:var(--primary-color); color:#fff; border-radius:3px; padding:1px 5px">JUST SCANNED</div>' : ""}
                  <div style="font-size:10px; color:var(--text-secondary)">${item.scan_count} scan${item.scan_count !== 1 ? "s" : ""}</div>
                </div>
              </div>
            </div>`;
        })
        .join("");

      // Bind click events
      historyData.forEach((item) => {
        const el = document.getElementById(`hist-row-${item.domain.replace(/\W/g, "-")}`);
        if (el) {
          el.onclick = () => chrome.tabs.create({ url: `${API_BASE}/products/${item.domain}` });
        }
      });
    }
  } catch (err) {
    console.error("[DPD] Load history error:", err);
    loading.classList.add("hidden");
    empty.classList.remove("hidden");
    const descEl = document.querySelector("#history-empty .state-desc");
    if (descEl) descEl.textContent = "Could not load history — is the backend running?";
  }
}

/**
 * Format an ISO date string as a human-readable relative time (e.g. "2 min ago").
 * @param {string} iso - ISO 8601 date string.
 * @returns {string}
 */
function getTimeAgo(iso) {
  if (!iso) return "Unknown";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.local.get(
    {
      settingAutoScan: true,
      settingOverlayToggle: true,
      settingRiskThreshold: "3"
    },
    (items) => {
      document.getElementById("setting-auto-scan").checked = items.settingAutoScan;
      document.getElementById("setting-overlay-toggle").checked = items.settingOverlayToggle;
      document.getElementById("setting-risk-threshold").value = items.settingRiskThreshold;
    }
  );
}

/**
 * Bind settings event handlers
 */
function bindSettingsEvents() {
  document.getElementById("setting-auto-scan").onchange = (e) => {
    chrome.storage.local.set({ settingAutoScan: e.target.checked });
  };
  document.getElementById("setting-overlay-toggle").onchange = (e) => {
    chrome.storage.local.set({ settingOverlayToggle: e.target.checked });
  };
  document.getElementById("setting-risk-threshold").onchange = (e) => {
    chrome.storage.local.set({ settingRiskThreshold: e.target.value });
  };
}

/**
 * Convert snake_case to Title Case.
 */
function humanize(str) {
  const clean = String(str).split('.').pop();
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}


/**
 * Perform a scan. Tries the content script first (handles in-page overlay),
 * then always falls through to a direct executeScript + /analyze/full API call
 * so the user always sees a result regardless of content script state.
 *
 * @param {chrome.tabs.Tab} tab    The active tab.
 * @param {string}          domain Hostname of the page.
 */
async function scanPage(tab, domain) {
  if (_isScanRunning) {
    showToast("Scan already in progress\u2026");
    return;
  }
  _isScanRunning = true;
  showState("loading-state");

  const loadingDesc = document.getElementById("loading-desc");
  let scanResult = null;

  try {
    // ── Step 1: Ask content script (fast path, also handles in-page overlay) ─
    try {
      if (loadingDesc) loadingDesc.textContent = "Contacting page scanner\u2026";
      const csResp = await Promise.race([
        new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SCAN" }, (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          });
        }),
        // 30-second cap — if CS is really slow, fall through to direct scan
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Content script timeout")), 30000)
        ),
      ]);
      if (csResp && csResp.success && csResp.result) {
        scanResult = csResp.result;
      } else {
        // Content script replied but returned no data (busy / not enough text).
        // Log and fall through to the direct path — do NOT show no-scan-state here.
        console.warn("[DPD] CS returned no result:", csResp?.error);
      }
    } catch (csErr) {
      console.warn("[DPD] Content script unavailable, using direct scan:", csErr.message);
    }

    // ── Step 2: Direct scan — always runs if Step 1 didn't produce a result ──
    if (!scanResult) {
      if (loadingDesc) loadingDesc.textContent = "Extracting page content\u2026";

      let pageText = "";
      try {
        const textResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const selectors = ["p", "li", "span", "div.terms", "div.tc", "article", "section"];
            const seen = new Set();
            const parts = [];
            document.querySelectorAll(selectors.join(",")).forEach((el) => {
              const t = el.innerText?.trim();
              if (t && t.length > 30 && !seen.has(t)) {
                seen.add(t);
                parts.push(t);
              }
            });
            return parts.join(" ").substring(0, 50000);
          },
        });
        pageText = textResults?.[0]?.result || "";
      } catch (exErr) {
        console.error("[DPD] executeScript failed:", exErr.message);
      }

      if (!pageText || pageText.length < 50) {
        showState("no-scan-state");
        showToast("Not enough text found on this page to analyze");
        return;
      }

      if (loadingDesc) loadingDesc.textContent = "Analyzing with AI\u2026";

      // Screenshot (non-critical)
      let screenshotB64 = null;
      try {
        const ss = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
        if (ss?.success && ss.dataUrl) {
          screenshotB64 = ss.dataUrl.replace(/^data:image\/\w+;base64,/, "");
        }
      } catch (_) {}

      const apiResp = await fetch(`${API_BASE}/analyze/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pageText,
          screenshot_b64: screenshotB64,
          domain,
          pdf_urls: [],
          page_title: tab.title || domain,
        }),
      });

      if (!apiResp.ok) {
        const errTxt = await apiResp.text().catch(() => "");
        console.error("[DPD] API error:", apiResp.status, errTxt);
        showState("no-scan-state");
        showToast(`API error (HTTP ${apiResp.status}) \u2014 is the backend running?`);
        return;
      }

      const apiBody = await apiResp.json();
      scanResult = apiBody?.data || null;

      if (!scanResult) {
        showState("no-scan-state");
        showToast("Scan returned no results \u2014 please try again");
        return;
      }

      // Ask content script to inject the overlay with the fresh result (non-blocking)
      chrome.tabs.sendMessage(
        tab.id,
        { type: "INJECT_OVERLAY", result: scanResult },
        () => void chrome.runtime.lastError // suppress unchecked error
      );
    }

    // ── Step 3: Render & persist ──────────────────────────────────────────────
    chrome.runtime.sendMessage({ type: "STORE_SCAN_RESULT", domain, result: scanResult });
    _lastScanTime = Date.now();
    renderResult(scanResult);

  } catch (err) {
    console.error("[DPD] scanPage unexpected error:", err.message);
    showState("no-scan-state");
    showToast("Scan failed: " + (err.message || "Unknown error"));
  } finally {
    _isScanRunning = false;
  }
}

/**
 * Main popup initialization.
 */
async function init() {
  setupTabs();
  loadSettings();
  bindSettingsEvents();
  showState("loading-state");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Guard: if no tab or tab.url is a restricted page (chrome://, about:, etc.)
  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    showState("no-scan-state");
    const descEl = document.querySelector("#no-scan-state .state-desc");
    if (descEl) descEl.textContent = "Navigate to a webpage to scan it.";
    // Still bind settings button
    document.getElementById("btn-header-settings").addEventListener("click", () => {
      document.querySelector('.nav-item[data-target="view-settings"]').click();
    });
    // Bind scan button but show toast explaining the restriction
    document.getElementById("btn-force-scan").addEventListener("click", () => {
      showToast("Navigate to a webpage to scan it.");
    });
    return;
  }

  let domain;
  try {
    domain = new URL(tab.url).hostname;
  } catch (e) {
    console.error("[DPD] Could not parse tab URL:", e);
    showState("no-scan-state");
    return;
  }

  document.getElementById("current-domain").textContent = domain;

  // Bind Scan Now button early so it always works regardless of initial state
  document.getElementById("btn-force-scan").addEventListener("click", () => {
    scanPage(tab, domain);
  });

  // Settings header button
  document.getElementById("btn-header-settings").addEventListener("click", () => {
    document.querySelector('.nav-item[data-target="view-settings"]').click();
  });

  // Cancel button in loading state — resets the guard and returns to no-scan-state
  document.getElementById("btn-cancel-scan").addEventListener("click", () => {
    _isScanRunning = false;
    showState("no-scan-state");
  });

  // Check for cached scan result first
  chrome.runtime.sendMessage({ type: "GET_SCAN_RESULT", domain }, (response) => {
    if (response?.success && response.result) {
      renderResult(response.result);
    } else {
      showState("no-scan-state");
    }
  });

  // Re-scan button (in result state)
  document.getElementById("btn-rescan").addEventListener("click", () => {
    scanPage(tab, domain);
  });

  // Share Analysis
  document.getElementById("btn-share-analysis").onclick = () => {
    if (!currentScan) return;
    const url = `${API_BASE}/report/pdf/${currentScan.scan_id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Copied report link!");
      window.open(url, "_blank");
    }).catch(err => {
      console.error("Clipboard copy failed:", err);
      showToast("Failed to copy link");
    });
  };

  // Report False Positive
  document.getElementById("btn-report-false-positive").onclick = async () => {
    if (!currentScan) return;
    try {
      const response = await fetch(`${API_BASE}/community/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: currentScan.domain,
          pattern_type: "false_positive",
          description: "User reported false positive",
        }),
      });
      if (response.ok) {
        showToast("False positive reported!");
      } else {
        showToast("Failed to report false positive");
      }
    } catch (err) {
      console.error(err);
      showToast("Error reporting false positive");
    }
  };

  // Add My Flag Button and Submit
  document.getElementById("btn-add-my-flag").onclick = () => {
    const formContainer = document.getElementById("add-flag-form-container");
    formContainer.classList.toggle("hidden");
  };

  document.getElementById("form-add-flag").onsubmit = async (e) => {
    e.preventDefault();
    if (!currentScan) return;
    const patternType = document.getElementById("flag-pattern-type").value;
    const description = document.getElementById("flag-description").value;
    try {
      const response = await fetch(`${API_BASE}/community/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: currentScan.domain,
          pattern_type: patternType,
          description: description,
        }),
      });
      if (response.ok) {
        showToast("Flag submitted successfully!");
        document.getElementById("flag-description").value = "";
        document.getElementById("add-flag-form-container").classList.add("hidden");
      } else {
        showToast("Failed to submit flag");
      }
    } catch (err) {
      console.error(err);
      showToast("Error submitting flag");
    }
  };

  // Expand Visual Analysis
  document.getElementById("btn-expand-visual").onclick = () => {
    const section = document.getElementById("visual-analysis-section");
    const isHidden = section.classList.contains("hidden");
    if (isHidden) {
      section.classList.remove("hidden");
      section.style.maxHeight = "200px";
      
      // Update visual regions if CV results exist
      const list = document.getElementById("visual-regions-list");
      if (currentScan && currentScan.cv_results && currentScan.cv_results.length > 0) {
        list.innerHTML = currentScan.cv_results
          .map((r) => {
            return `<div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color)">
              <strong>${humanize(r.label)}</strong>: ${r.description} (${Math.round(r.confidence * 100)}% conf)
            </div>`;
          })
          .join("");
      } else {
        list.textContent = "No visual dark patterns detected on this page.";
      }
    } else {
      section.style.maxHeight = "0";
      setTimeout(() => section.classList.add("hidden"), 300);
    }
  };
}

document.addEventListener("DOMContentLoaded", init);
