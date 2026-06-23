/**
 * 8 Ball Pool Helper â€” inject.js
 * Vanilla Canvas2D overlay â€” no external dependencies.
 *
 * Modes:
 *  "pockets" â€” 6 pocket circles + dashed guide lines pocketâ†’mouse
 *  "cue"     â€” bidirectional laser line through mouse, clipped to table
 *  "both"    â€” both combined
 *
 * Toggle: SHIFT key (capture phase, works even when game canvas has focus)
 * Settings synced via chrome.storage.local and chrome.runtime.onMessage
 */

(function () {
  'use strict';

  // â”€â”€ Guard: don't inject twice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (window.__8ballHelperLoaded) return;
  window.__8ballHelperLoaded = true;

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let enabled     = true;
  let mode        = 'both';
  let lineOpacity = 0.75;
  let lineColor   = '#ff4f6b';

  // Table playing-surface position as fractions of the game canvas bounding rect.
  // These defaults are calibrated for 8ballpool.com at a typical 1024px-wide viewport.
  let tableBounds = { left: 0.04, top: 0.07, right: 0.92, bottom: 0.78 };

  let overlayCanvas = null;
  let ctx           = null;
  let mouseX        = 0;
  let mouseY        = 0;
  let gameRect      = null;
  let rafPending    = false;
  let destroyed     = false;
  let cueBallPos    = null;  // {x,y} screen coords of the white cue ball, or null

  // â”€â”€ Global error interceptor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Catches Chrome's "Extension context invalidated" error which is thrown
  // asynchronously from C++ and bypasses try/catch in JS.
  //
  // IMPORTANT: Use EXACT string match only.
  // WebGL games (like 8ballpool.com) throw errors containing words like
  // "context" or "invalidated" (e.g. "WebGL context lost", "context invalidated")
  // â€” a broad regex would incorrectly destroy the overlay during normal gameplay.
  window.addEventListener('error', function (evt) {
    const msg = (evt.error && evt.error.message) || evt.message || '';
    // Chrome's exact error message â€” nothing else should match
    if (msg === 'Extension context invalidated.' ||
        msg === 'Extension context invalidated') {
      evt.preventDefault();
      evt.stopImmediatePropagation();
      destroyed = true;
      try { if (overlayCanvas) { overlayCanvas.remove(); overlayCanvas = null; ctx = null; } } catch (_) {}
      try { window.__8ballHelperLoaded = false; } catch (_) {}
    }
  }, true);



  // â”€â”€ Game element detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function findGameElement() {
    const selectors = [
      '#gm-wrap', '#game-wrap', '#gameWrap',
      '#game', '#gameContainer', '#game-container', '.game-container',
      'iframe[src*="miniclip"]', 'iframe[src*="8ball"]',
      'iframe[id*="game"]', 'iframe[class*="game"]',
      'canvas[id]', 'canvas',
    ];
    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 400 && r.height > 300) return el;
        }
      } catch (_) { /* selector may be invalid in some contexts */ }
    }
    // Fallback: largest canvas or iframe
    let best = null, bestArea = 0;
    try {
      document.querySelectorAll('iframe, canvas').forEach((el) => {
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea) { bestArea = area; best = el; }
      });
    } catch (_) {}
    return best;
  }

  // â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function hexToRgba(hex, alpha) {
    if (!hex || hex.length < 7) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }

  /**
   * Intersect a ray (ox,oy) in direction (dx,dy) with the axis-aligned rect
   * (rx, ry, rw, rh). Returns the two boundary intersection points, or null.
   */
  function rayClipRect(ox, oy, dx, dy, rx, ry, rw, rh) {
    const ts = [];
    const walls = [
      dx !== 0 ? (rx - ox) / dx : null,
      dx !== 0 ? (rx + rw - ox) / dx : null,
      dy !== 0 ? (ry - oy) / dy : null,
      dy !== 0 ? (ry + rh - oy) / dy : null,
    ];
    for (const t of walls) {
      if (t === null || !isFinite(t)) continue;
      const px = ox + t * dx;
      const py = oy + t * dy;
      if (px >= rx - 0.5 && px <= rx + rw + 0.5 &&
          py >= ry - 0.5 && py <= ry + rh + 0.5) {
        ts.push({ x: px, y: py, t });
      }
    }
    if (ts.length < 2) return null;
    ts.sort((a, b) => a.t - b.t);
    // deduplicate nearly-equal t values
    const out = [ts[0]];
    for (let i = 1; i < ts.length; i++) {
      if (Math.abs(ts[i].t - out[out.length - 1].t) > 0.001) out.push(ts[i]);
    }
    return out.length >= 2 ? [out[0], out[out.length - 1]] : null;
  }

  // â”€â”€ Canvas setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function createOverlay() {
    if (overlayCanvas && overlayCanvas.isConnected) return; // already live
    // Remove stale detached canvas if any
    if (overlayCanvas && !overlayCanvas.isConnected) {
      try { overlayCanvas.remove(); } catch (_) {}
      overlayCanvas = null; ctx = null;
    }
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = '__8ball_helper_canvas__';
    overlayCanvas.style.cssText =
      'position:fixed!important;top:0!important;left:0!important;' +
      'width:100vw!important;height:100vh!important;' +
      'pointer-events:none!important;z-index:2147483647!important;' +
      'display:block!important;';
    (document.documentElement || document.body).appendChild(overlayCanvas);
    ctx = overlayCanvas.getContext('2d');
    sizeOverlay();
  }

  function sizeOverlay() {
    if (!overlayCanvas) return;
    overlayCanvas.width  = window.innerWidth;
    overlayCanvas.height = window.innerHeight;
  }

  function clearOverlay() {
    if (ctx && overlayCanvas) {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  }

  // â”€â”€ Table rect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function getTableRect() {
    try {
      const el = findGameElement();
      if (el) gameRect = el.getBoundingClientRect();
    } catch (_) {}
    if (!gameRect || gameRect.width === 0) return null;

    const gx = gameRect.left,  gy = gameRect.top;
    const gw = gameRect.width, gh = gameRect.height;
    const l = gx + gw * tableBounds.left;
    const t = gy + gh * tableBounds.top;
    const r = gx + gw * tableBounds.right;
    const b = gy + gh * tableBounds.bottom;
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }

  // â”€â”€ Drawing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function draw() {
    rafPending = false;
    if (destroyed || !enabled) return;

    // Self-heal: if our canvas was removed from the DOM (e.g. game rebuilt
    // the page during a player switch), recreate and re-attach it silently.
    if (!overlayCanvas || !overlayCanvas.isConnected) {
      try { createOverlay(); } catch (_) { return; }
    }
    if (!ctx) return;
    try {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      const tr = getTableRect();
      if (!tr || tr.width <= 0 || tr.height <= 0) return;

      const mx = mouseX;
      const my = mouseY;

      // Subtle dashed table-outline so user can verify calibration
      ctx.save();
      ctx.strokeStyle = hexToRgba(lineColor, lineOpacity * 0.15);
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(tr.left, tr.top, tr.width, tr.height);
      ctx.restore();

      // â”€â”€ Pocket mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (mode === 'pockets' || mode === 'both') {
        const pockets = [
          { x: tr.left,                   y: tr.top    },  // TL
          { x: tr.left + tr.width * 0.5,  y: tr.top    },  // TC
          { x: tr.right,                  y: tr.top    },  // TR
          { x: tr.left,                   y: tr.bottom },  // BL
          { x: tr.left + tr.width * 0.5,  y: tr.bottom },  // BC
          { x: tr.right,                  y: tr.bottom },  // BR
        ];

        const maxDist = Math.hypot(tr.width, tr.height) || 1;

        ctx.save();
        for (const p of pockets) {
          const dist = Math.hypot(p.x - mx, p.y - my);
          const fade = Math.max(0.08, 1 - dist / maxDist);

          // Pocket ring
          ctx.beginPath();
          ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
          ctx.fillStyle   = hexToRgba(lineColor, 0.12);
          ctx.strokeStyle = hexToRgba(lineColor, lineOpacity * 0.85);
          ctx.lineWidth   = 2.5;
          ctx.setLineDash([]);
          ctx.fill();
          ctx.stroke();

          // Dashed guide line pocket â†’ mouse
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = hexToRgba(lineColor, lineOpacity * fade * 0.55);
          ctx.lineWidth   = 1.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.stroke();
        }
        ctx.restore();
      }

      // â”€â”€ Cue-stick / ruler mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Draws a bidirectional line THROUGH the mouse, clipped to the table.
      // Move the mouse along your intended shot angle â€” the line acts as a ruler.
      if (mode === 'cue' || mode === 'both') {
        // Direction from table centre â†’ mouse (normalised)
        // If cue ball was detected via pixel scan, use it as line origin.
        // Otherwise fall back to table centre (no detection yet).
        let ox, oy;
        if (cueBallPos) {
          ox = cueBallPos.x; oy = cueBallPos.y;
        } else {
          ox = tr.left + tr.width * 0.5;
          oy = tr.top  + tr.height * 0.5;
        }
        let dx = mx - ox, dy = my - oy;
        const dlen = Math.hypot(dx, dy);
        if (dlen < 0.001) { dx = 1; dy = 0; } else { dx /= dlen; dy /= dlen; }

        // Ray origin = cue ball (or table center). Draw forward to far wall.
        const allPts = rayClipRect(ox, oy, dx, dy, tr.left, tr.top, tr.width, tr.height);
        // Forward = positive t (in direction mouse is pointing)
        const fwdPt = allPts ? allPts.filter(p => p.t > 0).sort((a,b)=>a.t-b.t).pop() : null;
        if (fwdPt) {
          // Gradient: bright at ball origin, fades toward far wall
          const grad = ctx.createLinearGradient(ox, oy, fwdPt.x, fwdPt.y);
          grad.addColorStop(0,    hexToRgba(lineColor, lineOpacity));
          grad.addColorStop(0.65, hexToRgba(lineColor, lineOpacity * 0.6));
          grad.addColorStop(1,    hexToRgba(lineColor, 0));
          ctx.save();
          ctx.strokeStyle = grad;
          ctx.lineWidth   = 2.5;
          ctx.setLineDash([]);
          ctx.shadowBlur  = 10;
          ctx.shadowColor = hexToRgba(lineColor, 0.5);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(fwdPt.x, fwdPt.y);
          ctx.stroke();
          ctx.restore();
        }
        // Highlight the detected cue ball with a ring
        if (cueBallPos) {
          ctx.save();
          ctx.strokeStyle = hexToRgba(lineColor, lineOpacity * 0.9);
          ctx.fillStyle   = hexToRgba(lineColor, 0.07);
          ctx.lineWidth   = 2;
          ctx.setLineDash([]);
          ctx.shadowBlur  = 8;
          ctx.shadowColor = hexToRgba(lineColor, 0.4);
          ctx.beginPath();
          ctx.arc(ox, oy, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Aim circle + crosshair at mouse
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = hexToRgba(lineColor, lineOpacity);
        ctx.fillStyle   = hexToRgba(lineColor, 0.08);
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 12;
        ctx.shadowColor = hexToRgba(lineColor, 0.55);
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const cr = 6;
        ctx.beginPath();
        ctx.moveTo(mx - cr, my); ctx.lineTo(mx + cr, my);
        ctx.moveTo(mx, my - cr); ctx.lineTo(mx, my + cr);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    } catch (err) {
      // Swallow drawing errors silently â€” never crash the game page
      console.debug('[8BallHelper] draw error:', err.message);
    }
  }

  // â”€â”€ Extension context guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // "Extension context invalidated" is thrown when Chrome reloads/disables
  // the extension while the content script is still live on the tab.
  // We detect it early and tear ourselves down cleanly.

  function isContextValid() {
    try {
      // chrome.runtime.id is undefined when context is gone
      return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function selfDestroy() {
    if (destroyed) return;
    destroyed = true;
    try {
      window.removeEventListener('mousemove',   onMouseMove, { capture: true });
      document.removeEventListener('mousemove', onMouseMove, { capture: true });
      window.removeEventListener('keydown',     onKeyDown,   { capture: true });
      document.removeEventListener('keydown',   onKeyDown,   { capture: true });
      window.removeEventListener('keyup',       onKeyUp,     { capture: true });
      document.removeEventListener('keyup',     onKeyUp,     { capture: true });
      window.removeEventListener('resize', sizeOverlay);
      if (typeof mutObs !== 'undefined') mutObs.disconnect();
      if (mutationThrottle) { clearTimeout(mutationThrottle); mutationThrottle = null; }
    } catch (_) {}
    clearOverlay();
    if (overlayCanvas) { try { overlayCanvas.remove(); } catch (_) {} overlayCanvas = null; ctx = null; }
    window.__8ballHelperLoaded = false;
    console.debug('[8BallHelper] context invalidated â€” self-destructed cleanly');
  }

  function scheduleDraw() {
    // Only stop permanently if truly destroyed (extension gone).
    // Don't call selfDestroy here â€” that was causing false positives.
    if (destroyed) return;
    if (!rafPending && enabled) {
      rafPending = true;
      requestAnimationFrame(draw);
    }
  }

  // â”€â”€ Event listeners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // ── Mouse tracking (pointer-lock aware) ─────────────────────────────────
  // 8ballpool.com uses the Pointer Lock API when aiming — once locked,
  // e.clientX/clientY FREEZE at the last pre-lock position.  We must instead
  // accumulate e.movementX / e.movementY to follow the mouse inside the game.

  function onMouseMove(e) {
    if (document.pointerLockElement) {
      // Pointer is locked to the game canvas — use relative movement deltas
      mouseX = Math.max(0, Math.min(window.innerWidth,  mouseX + (e.movementX || 0)));
      mouseY = Math.max(0, Math.min(window.innerHeight, mouseY + (e.movementY || 0)));
    } else {
      // Normal mode — absolute coordinates are reliable
      mouseX = e.clientX;
      mouseY = e.clientY;
    }
    scheduleDraw();
  }

  let shiftLatch = false;
  function onKeyDown(e) {
    if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !shiftLatch) {
      shiftLatch = true;
      enabled = !enabled;
      try { chrome.storage.local.set({ enabled }); } catch (_) {}
      if (!enabled) clearOverlay();
      else scheduleDraw();
    }
  }
  function onKeyUp(e) {
    if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      shiftLatch = false;
    }
  }

  // â”€â”€ Message listener â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Note: return true is NOT needed here because sendResponse is always
  // called synchronously within the same microtask.

  chrome.runtime.onMessage.addListener(function onMessage(request, _sender, sendResponse) {
    try {
      if (request.action === 'toggleOverlay') {
        enabled = (request.enabled !== undefined) ? Boolean(request.enabled) : !enabled;
        if (!enabled) clearOverlay(); else scheduleDraw();
        sendResponse({ ok: true, enabled });
        return;
      }
      if (request.action === 'updateSettings') {
        if (request.mode    !== undefined) mode        = request.mode;
        if (request.opacity !== undefined) lineOpacity = Number(request.opacity);
        if (request.color   !== undefined) lineColor   = request.color;
        if (enabled) scheduleDraw();
        sendResponse({ ok: true });
        return;
      }
      if (request.action === 'updateTableBounds') {
        if (request.bounds && typeof request.bounds === 'object') {
          tableBounds = Object.assign({}, tableBounds, request.bounds);
          try { chrome.storage.local.set({ tableBounds }); } catch (_) {}
        }
        if (enabled) scheduleDraw();
        sendResponse({ ok: true, tableBounds });
        return;
      }
      if (request.action === 'getStatus') {
        sendResponse({ ok: true, enabled, mode, lineOpacity, lineColor, tableBounds });
        return;
      }
      // Unknown action â€” respond so the channel doesn't hang
      sendResponse({ ok: false, error: 'unknown action' });
    } catch (err) {
      try { sendResponse({ ok: false, error: err.message }); } catch (_) {}
    }
  });

  // â”€â”€ Resize observer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  window.addEventListener('resize', () => { sizeOverlay(); scheduleDraw(); }, { passive: true });

  // When the game acquires or releases pointer lock, force a redraw so the
  // crosshair position is recalculated immediately.
  document.addEventListener('pointerlockchange', () => { scheduleDraw(); }, { capture: true, passive: true });
  document.addEventListener('pointerlockerror',  () => { scheduleDraw(); }, { capture: true, passive: true });

  // MutationObserver â€” throttled so it doesn't fire draw on every DOM change.
  // Only reschedule if the game canvas/element might have been added.
  let mutationThrottle = null;
  const mutObs = new MutationObserver(() => {
    if (mutationThrottle) return;
    mutationThrottle = setTimeout(() => {
      mutationThrottle = null;
      if (enabled) scheduleDraw();
    }, 300);
  });

  // â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // -- Cue-ball pixel detection ---
  // When the popup opens or game loads, inject a page-level script that
  // hooks requestAnimationFrame to read gl.readPixels() AFTER each game
  // frame renders (before the WebGL buffer is composited/cleared).
  // Detects the densest white-pixel cluster = cue ball position.

  window.addEventListener('message', function (evt) {
    if (!evt.data || evt.data.__8ballMsg !== 'cueball') return;
    if (destroyed) return;
    cueBallPos = { x: evt.data.x, y: evt.data.y };
  }, false);

  function injectCueBallDetector() {
    if (window.__8ballDetectorInjected) return;
    window.__8ballDetectorInjected = true;
    const code = (function() {
      if (window.__8ballDetector) return;
      window.__8ballDetector = true;
      var _buf = null, _lastSend = 0;
      var _origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = function(cb) {
        return _origRAF.call(window, function(t) {
          cb(t);
          var now = Date.now();
          if (now - _lastSend < 200) return;
          _lastSend = now;
          try {
            var gc = document.querySelector('canvas#engine') || document.querySelector('canvas.engine');
            if (!gc || gc.width < 100) return;
            var gl = gc.getContext('webgl2') || gc.getContext('webgl');
            if (!gl) return;
            var cw = gc.width, ch = gc.height;
            var needed = cw * ch * 4;
            if (!_buf || _buf.length !== needed) _buf = new Uint8Array(needed);
            gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, _buf);
            var step = 8, bs = 20;
            var buckets = {};
            var xMin = (cw*0.03)|0, xMax = (cw*0.97)|0;
            var yMin = (ch*0.05)|0, yMax = (ch*0.92)|0;
            for (var y = yMin; y < yMax; y += step) {
              var glY = ch - y - 1, rOff = glY * cw * 4;
              for (var x = xMin; x < xMax; x += step) {
                var i = rOff + x*4;
                if (_buf[i]>218 && _buf[i+1]>218 && _buf[i+2]>218 && _buf[i+3]>190) {
                  var k = ((x/bs)|0)*1000 + ((y/bs)|0);
                  buckets[k] = (buckets[k]||0) + 1;
                }
              }
            }
            var best=0, bestK=-1;
            for (var k in buckets) { if (buckets[k]>best){best=buckets[k]; bestK=+k;} }
            if (best < 3 || bestK < 0) return;
            var bestBx = (bestK/1000)|0, bestBy = bestK - bestBx*1000;
            var sx=0, sy=0, cn=0;
            for (var y2=yMin; y2<yMax; y2+=step) {
              var glY2=ch-y2-1, rOff2=glY2*cw*4;
              for (var x2=xMin; x2<xMax; x2+=step) {
                var i2=rOff2+x2*4;
                if (_buf[i2]>218&&_buf[i2+1]>218&&_buf[i2+2]>218&&_buf[i2+3]>190) {
                  if (((x2/bs)|0)===bestBx && ((y2/bs)|0)===bestBy) {
                    sx+=x2; sy+=y2; cn++;
                  }
                }
              }
            }
            if (!cn) return;
            var rect = gc.getBoundingClientRect();
            window.postMessage({
              __8ballMsg: 'cueball',
              x: rect.left + (sx/cn)*(rect.width/cw),
              y: rect.top  + (sy/cn)*(rect.height/ch)
            }, '*');
          } catch(e) {}
        });
      };
    })();;
    try {
      var s = document.createElement('script');
      s.textContent = code;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (_) {}
  }

  function init() {
    try {
      // â”€â”€ Port-based lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Connect a port to the background service worker.
      // When the extension is reloaded/disabled, Chrome disconnects this port
      // BEFORE the context is fully invalidated, giving us a clean chance to
      // tear down all event listeners and the overlay canvas.
      // Connect a port so we can detect true extension invalidation.
      // IMPORTANT: In MV3 the service worker sleeps after ~30s of inactivity
      // and Chrome disconnects all ports when it does â€” this does NOT mean
      // the extension is gone. We must distinguish the two cases:
      //   â€¢ SW sleeping  â†’ chrome.runtime.id is still defined â†’ reconnect port
      //   â€¢ Extension gone â†’ chrome.runtime.id throws          â†’ selfDestroy
      function connectLifecyclePort() {
        try {
          const port = chrome.runtime.connect({ name: '8ball-content' });
          port.onDisconnect.addListener(function () {
            try {
              // If runtime.id is still accessible, SW just went to sleep.
              // Ignore lastError (it will say "receiving end does not exist")
              // and simply reconnect after a short delay.
              if (chrome.runtime.id) {
                setTimeout(connectLifecyclePort, 200);
                return;
              }
            } catch (_) {
              // chrome.runtime.id threw â€” extension truly gone
            }
            if (!destroyed) selfDestroy();
          });
        } catch (_) { /* extension might already be in bad state */ }
      }
      connectLifecyclePort();
      injectCueBallDetector(); // start pixel-based cue ball tracking

      chrome.storage.local.get(
        ['enabled', 'mode', 'opacity', 'color', 'tableBounds'],
        function (result) {
          if (chrome.runtime.lastError) {
            // Storage unavailable â€” use defaults and continue
          } else {
            if (result.enabled     !== undefined) enabled     = Boolean(result.enabled);
            if (result.mode        !== undefined) mode        = result.mode;
            if (result.opacity     !== undefined) lineOpacity = Number(result.opacity);
            if (result.color       !== undefined) lineColor   = result.color;
            if (result.tableBounds && typeof result.tableBounds === 'object') {
              tableBounds = Object.assign({}, tableBounds, result.tableBounds);
            }
          }

          createOverlay();

          const opts    = { capture: true, passive: true };
          const keyOpts = { capture: true };
          window.addEventListener('mousemove',   onMouseMove, opts);
          document.addEventListener('mousemove', onMouseMove, opts);
          window.addEventListener('keydown',   onKeyDown, keyOpts);
          document.addEventListener('keydown', onKeyDown, keyOpts);
          window.addEventListener('keyup',     onKeyUp,   keyOpts);
          document.addEventListener('keyup',   onKeyUp,   keyOpts);

          try { mutObs.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}

          scheduleDraw();
          setTimeout(scheduleDraw, 600);
          setTimeout(scheduleDraw, 1800);
        }
      );
    } catch (err) {
      console.debug('[8BallHelper] init error:', err.message);
    }
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }

})();
