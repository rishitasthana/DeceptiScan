/**
 * Background service worker for the Dark Pattern Detector extension.
 * Handles tab screenshot capture and message routing.
 */

const API_BASE = "http://localhost:8000";

/**
 * Listen for messages from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    captureTab(sender.tab.id)
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.type === "GET_SCAN_RESULT") {
    getScanResult(message.domain)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "STORE_SCAN_RESULT") {
    chrome.storage.local.set({ [`scan:${message.domain}`]: message.result });
    sendResponse({ success: true });
  }
});

/**
 * Capture a screenshot of the active tab.
 * @param {number} tabId - The tab ID to capture.
 * @returns {Promise<string>} Base64 data URL of the screenshot.
 */
async function captureTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: "png", quality: 90 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

/**
 * Fetch the latest scan result for a domain from local storage.
 * @param {string} domain - The domain to look up.
 * @returns {Promise<object|null>} The stored scan result or null.
 */
async function getScanResult(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get(`scan:${domain}`, (data) => {
      resolve(data[`scan:${domain}`] || null);
    });
  });
}

/**
 * Listen for tab updates to clear stale overlays on navigation.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.tabs.sendMessage(tabId, { type: "CLEAR_OVERLAY" }).catch(() => {});
  }
});
