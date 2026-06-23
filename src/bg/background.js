// MV3 Service Worker — background.js
// Handles messaging from popup and content scripts.

// ── Port connections (lifecycle management) ──────────────────────────────
// Content scripts connect a port on startup. When the extension is reloaded
// or disabled, Chrome disconnects all ports BEFORE fully invalidating the
// context, giving content scripts a chance to clean up gracefully.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === '8ball-content') {
    port.onDisconnect.addListener(() => {
      // Content script has self-destructed. Nothing to do on this side.
    });
  }
});

// ── Message listener ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'getTabStatus') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]) {
        sendResponse({ isGamePage: false, tabId: null });
        return;
      }
      const url = tabs[0].url || '';
      const gameDomains = ['miniclip.com', '8ballpool.com', '8ball.io'];
      const isGamePage = gameDomains.some((d) => url.includes(d));
      sendResponse({ isGamePage, tabId: tabs[0].id });
    });
    return true;
  }

  if (request.action === 'toggleOverlay'    ||
      request.action === 'updateSettings'   ||
      request.action === 'updateTableBounds') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]?.id) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response || { ok: true });
        }
      });
    });
    return true;
  }
});