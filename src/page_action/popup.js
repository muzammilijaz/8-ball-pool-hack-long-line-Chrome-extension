/**
 * 8 Ball Pool Helper — popup.js
 */

(function () {
  'use strict';

  const defaults = {
    enabled: true,
    mode: 'both',
    opacity: 0.75,
    color: '#ff4f6b',
    tableBounds: { left: 4, top: 7, right: 92, bottom: 78 }, // stored as 0-100 integers
  };

  let settings = JSON.parse(JSON.stringify(defaults));
  let isGamePage = false;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const masterToggle  = document.getElementById('masterToggle');
  const statusDot     = document.getElementById('statusDot');
  const statusLabel   = document.getElementById('statusLabel');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue  = document.getElementById('opacityValue');
  const colorSwatches = document.getElementById('colorSwatches');
  const customColor   = document.getElementById('customColor');
  const modeGrid      = document.getElementById('modeGrid');

  // Calibration
  const calibToggleBtn = document.getElementById('calibToggleBtn');
  const calibBody      = document.getElementById('calibBody');
  const calibArrow     = document.getElementById('calibArrow');
  const resetCalib     = document.getElementById('resetCalib');
  const tbTop          = document.getElementById('tbTop');
  const tbBot          = document.getElementById('tbBot');
  const tbLeft         = document.getElementById('tbLeft');
  const tbRight        = document.getElementById('tbRight');
  const tbTopVal       = document.getElementById('tbTopVal');
  const tbBotVal       = document.getElementById('tbBotVal');
  const tbLeftVal      = document.getElementById('tbLeftVal');
  const tbRightVal     = document.getElementById('tbRightVal');

  const body = document.body;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setStatus(active, label) {
    statusDot.className = 'status-dot' + (active === true ? ' active' : active === false ? ' error' : '');
    statusLabel.innerHTML = label;
  }

  function applyOverlayClass() {
    body.classList.toggle('overlay-off', !settings.enabled);
  }

  function updateModeButtons() {
    modeGrid.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === settings.mode);
    });
  }

  function updateSwatches() {
    colorSwatches.querySelectorAll('.swatch').forEach((sw) => {
      sw.classList.toggle('active', sw.dataset.color === settings.color);
    });
  }

  function updateCalibUI() {
    const b = settings.tableBounds;
    tbTop.value  = b.top;    tbTopVal.textContent  = b.top + '%';
    tbBot.value  = b.bottom; tbBotVal.textContent  = b.bottom + '%';
    tbLeft.value = b.left;   tbLeftVal.textContent = b.left + '%';
    tbRight.value= b.right;  tbRightVal.textContent= b.right + '%';
  }

  // ── Persist & send ────────────────────────────────────────────────────────

  function saveSettings() {
    chrome.storage.local.set({
      enabled:     settings.enabled,
      mode:        settings.mode,
      opacity:     settings.opacity,
      color:       settings.color,
      tableBounds: {
        left:   settings.tableBounds.left   / 100,
        top:    settings.tableBounds.top    / 100,
        right:  settings.tableBounds.right  / 100,
        bottom: settings.tableBounds.bottom / 100,
      },
    });
  }

  function sendToggle() {
    chrome.runtime.sendMessage(
      { action: 'toggleOverlay', enabled: settings.enabled },
      () => { chrome.runtime.lastError; }
    );
  }

  function sendSettings() {
    chrome.runtime.sendMessage(
      { action: 'updateSettings', mode: settings.mode, opacity: settings.opacity, color: settings.color },
      () => { chrome.runtime.lastError; }
    );
  }

  function sendTableBounds() {
    chrome.runtime.sendMessage(
      {
        action: 'updateTableBounds',
        bounds: {
          left:   settings.tableBounds.left   / 100,
          top:    settings.tableBounds.top    / 100,
          right:  settings.tableBounds.right  / 100,
          bottom: settings.tableBounds.bottom / 100,
        },
      },
      () => { chrome.runtime.lastError; }
    );
  }

  // ── Load initial state ────────────────────────────────────────────────────

  function init() {
    // Check game page
    chrome.runtime.sendMessage({ action: 'getTabStatus' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setStatus(null, 'Cannot connect to extension');
        return;
      }
      isGamePage = res.isGamePage;
      if (isGamePage) {
        setStatus(true, '<span>Game detected</span> — overlay active');
      } else {
        setStatus(false, 'Visit <span>8ballpool.com</span> or <span>miniclip.com</span>');
      }
    });

    // Load stored settings
    chrome.storage.local.get(['enabled', 'mode', 'opacity', 'color', 'tableBounds'], (result) => {
      if (result.enabled !== undefined) settings.enabled = result.enabled;
      if (result.mode    !== undefined) settings.mode    = result.mode;
      if (result.opacity !== undefined) settings.opacity = result.opacity;
      if (result.color   !== undefined) settings.color   = result.color;
      if (result.tableBounds !== undefined) {
        // stored as 0-1 fractions; convert to 0-100 for UI
        const b = result.tableBounds;
        settings.tableBounds = {
          left:   Math.round((b.left   || defaults.tableBounds.left   / 100) * 100),
          top:    Math.round((b.top    || defaults.tableBounds.top    / 100) * 100),
          right:  Math.round((b.right  || defaults.tableBounds.right  / 100) * 100),
          bottom: Math.round((b.bottom || defaults.tableBounds.bottom / 100) * 100),
        };
      }

      masterToggle.checked     = settings.enabled;
      opacitySlider.value      = Math.round(settings.opacity * 100);
      opacityValue.textContent = Math.round(settings.opacity * 100) + '%';
      customColor.value        = settings.color;
      applyOverlayClass();
      updateModeButtons();
      updateSwatches();
      updateCalibUI();
    });
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  masterToggle.addEventListener('change', () => {
    settings.enabled = masterToggle.checked;
    applyOverlayClass();
    saveSettings();
    sendToggle();
  });

  opacitySlider.addEventListener('input', () => {
    const pct = parseInt(opacitySlider.value, 10);
    settings.opacity = pct / 100;
    opacityValue.textContent = pct + '%';
    saveSettings();
    sendSettings();
  });

  modeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    settings.mode = btn.dataset.mode;
    updateModeButtons();
    saveSettings();
    sendSettings();
  });

  colorSwatches.addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    settings.color = sw.dataset.color;
    customColor.value = settings.color;
    updateSwatches();
    saveSettings();
    sendSettings();
  });

  customColor.addEventListener('input', () => {
    settings.color = customColor.value;
    colorSwatches.querySelectorAll('.swatch').forEach(sw => sw.classList.remove('active'));
    saveSettings();
    sendSettings();
  });

  // Calibration accordion toggle
  calibToggleBtn.addEventListener('click', () => {
    const open = calibBody.style.display !== 'none';
    calibBody.style.display = open ? 'none' : 'flex';
    calibArrow.textContent  = open ? 'expand' : 'collapse';
    // Show table outline in overlay when calibrating
    if (!open) {
      chrome.runtime.sendMessage({ action: 'updateTableBounds', bounds: {
        left:   settings.tableBounds.left   / 100,
        top:    settings.tableBounds.top    / 100,
        right:  settings.tableBounds.right  / 100,
        bottom: settings.tableBounds.bottom / 100,
      }}, () => { chrome.runtime.lastError; });
    }
  });

  function onCalibChange(key, el, valEl) {
    el.addEventListener('input', () => {
      const v = parseInt(el.value, 10);
      settings.tableBounds[key] = v;
      valEl.textContent = v + '%';
      saveSettings();
      sendTableBounds();
    });
  }

  onCalibChange('top',    tbTop,   tbTopVal);
  onCalibChange('bottom', tbBot,   tbBotVal);
  onCalibChange('left',   tbLeft,  tbLeftVal);
  onCalibChange('right',  tbRight, tbRightVal);

  resetCalib.addEventListener('click', () => {
    settings.tableBounds = { ...defaults.tableBounds };
    updateCalibUI();
    saveSettings();
    sendTableBounds();
  });

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  init();
})();
