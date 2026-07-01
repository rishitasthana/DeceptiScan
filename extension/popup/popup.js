/**
 * Popup script for the Dark Pattern Detector extension (ShieldCheck).
 */

const API_BASE = "http://localhost:8000";
let currentScan = null;

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
        const label = p.label || (p.labels && p.labels[0]) || "unknown";
        const desc = p.explanation || p.description || "";
        const iconSvg = getIconForLabel(label);
        // Default to medium if not provided in pattern object
        const pLevel = p.severity || "MEDIUM"; 
        
        return `
          <div class="pattern-item">
            <div class="pattern-icon">${iconSvg}</div>
            <div class="pattern-content">
              <div class="pattern-header-row">
                <span class="pattern-title">${humanize(label)}</span>
                <span class="pattern-level" style="color: ${LEVEL_COLORS[pLevel.toLowerCase()]}; border-color: ${LEVEL_COLORS[pLevel.toLowerCase()]}">${pLevel}</span>
              </div>
              <p class="pattern-desc">${desc}</p>
            </div>
          </div>`;
      })
      .join("");
  } else {
    document.getElementById("patterns-container").classList.add("hidden");
  }

  // Report button
  document.getElementById("view-report-btn").onclick = () => {
    chrome.tabs.create({ url: `${API_BASE}/report/pdf/${scan_id}` });
  };

  showState("result-state");
}

/**
 * Fetch and render scan history
 */
async function loadHistory() {
  const loading = document.getElementById("history-loading");
  const empty = document.getElementById("history-empty");
  const list = document.getElementById("history-list");

  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  list.classList.add("hidden");

  try {
    const response = await fetch(`${API_BASE}/products/history?limit=10`);
    if (!response.ok) throw new Error("History fetch failed");
    const body = await response.json();
    const historyData = body.data || [];

    loading.classList.add("hidden");
    if (historyData.length === 0) {
      empty.classList.remove("hidden");
    } else {
      list.classList.remove("hidden");
      list.innerHTML = historyData
        .map((item) => {
          const score = item.risk_score?.score ?? "-";
          const level = item.risk_score?.level ?? "low";
          const date = new Date(item.scanned_at).toLocaleDateString();
          return `
            <div class="pattern-item" style="cursor: pointer;" id="hist-${item.scan_id}">
              <div class="pattern-content">
                <div class="pattern-header-row" style="margin-bottom: 0;">
                  <span class="pattern-title">${item.domain}</span>
                  <span class="pattern-level" style="color: ${LEVEL_COLORS[level.toLowerCase()]}; border-color: ${LEVEL_COLORS[level.toLowerCase()]}">${score}/10</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Scanned on ${date}</div>
              </div>
            </div>`;
        })
        .join("");
      
      // Bind click events
      historyData.forEach((item) => {
        const el = document.getElementById(`hist-${item.scan_id}`);
        if (el) {
          el.onclick = () => {
            chrome.tabs.create({ url: `${API_BASE}/report/pdf/${item.scan_id}` });
          };
        }
      });
    }
  } catch (err) {
    console.error(err);
    loading.classList.add("hidden");
    empty.classList.remove("hidden");
    const descEl = document.querySelector("#history-empty .state-desc");
    if (descEl) descEl.textContent = "Could not load history.";
  }
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
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Perform a scan directly from the popup context.
 * Extracts text from the page via chrome.scripting, captures a screenshot,
 * calls the backend API, and renders results — all without relying on content scripts.
 *
 * @param {chrome.tabs.Tab} tab - The active tab to scan.
 * @param {string} domain - The domain of the active tab.
 */
async function scanPage(tab, domain) {
  showState("loading-state");

  try {
    // 1. Extract text from the page
    const textResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
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
        return parts.join(" ").substring(0, 50000);
      },
    });

    const pageText = textResults?.[0]?.result || "";

    if (!pageText || pageText.length < 50) {
      showState("no-scan-state");
      showToast("Not enough text on this page to analyze");
      return;
    }

    // 2. Capture screenshot via background worker
    let screenshotB64 = null;
    try {
      const ssResponse = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
      if (ssResponse?.success && ssResponse.dataUrl) {
        screenshotB64 = ssResponse.dataUrl.replace(/^data:image\/\w+;base64,/, "");
      }
    } catch (e) {
      console.warn("Screenshot capture failed:", e);
    }

    // 3. Call backend API directly (extension popup has no CORS restrictions)
    const response = await fetch(`${API_BASE}/analyze/full`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: pageText,
        screenshot_b64: screenshotB64,
        domain: domain,
        pdf_urls: [],
        page_title: tab.title || domain,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("API error:", response.status, errText);
      showState("no-scan-state");
      showToast(`Scan failed (HTTP ${response.status})`);
      return;
    }

    const body = await response.json();
    const scanResult = body?.data;

    if (!scanResult) {
      showState("no-scan-state");
      showToast("No results returned from API");
      return;
    }

    // 4. Store result for future popup opens
    chrome.runtime.sendMessage({
      type: "STORE_SCAN_RESULT",
      domain: domain,
      result: scanResult,
    });

    // 5. Render in the popup
    renderResult(scanResult);

  } catch (err) {
    console.error("Scan failed:", err);
    showState("no-scan-state");
    showToast("Scan failed: " + (err.message || "Unknown error"));
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
  const domain = new URL(tab.url).hostname;
  document.getElementById("current-domain").textContent = domain;

  // Check for cached scan result first
  chrome.runtime.sendMessage({ type: "GET_SCAN_RESULT", domain }, (response) => {
    if (response?.success && response.result) {
      renderResult(response.result);
    } else {
      showState("no-scan-state");
    }
  });

  // Scan Now button — performs the scan directly from popup
  document.getElementById("btn-force-scan").addEventListener("click", () => {
    scanPage(tab, domain);
  });
  
  // Settings header button
  document.getElementById("btn-header-settings").addEventListener("click", () => {
    document.querySelector('.nav-item[data-target="view-settings"]').click();
  });

  // Share Analysis
  document.getElementById("btn-share-analysis").onclick = () => {
    if (!currentScan) return;
    const url = `${API_BASE}/report/pdf/${currentScan.scan_id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Copied report link!");
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
