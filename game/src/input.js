// input.js — keyboard + mouse input for Sunset Bay.
// Tracks held keys, edge-triggered presses, mouse-look deltas and clicks.
// Pointer lock is requested on canvas click while playing; drag-look works
// without lock too, so the game stays playable in any browser.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    clicks: 0,
    locked: false,
    dragging: false,

    down(code) { return this.keys.has(code); },
    pressed(code) { return this.justPressed.has(code); },
    consumeMouse() {
      const d = { dx: this.mouseDX, dy: this.mouseDY };
      this.mouseDX = 0; this.mouseDY = 0;
      return d;
    },
    consumeClicks() { const c = this.clicks; this.clicks = 0; return c; },
    endFrame() { this.justPressed.clear(); },
    lockPointer() {
      try {
        const r = canvas.requestPointerLock();
        // newer Chrome returns a promise that rejects without a user gesture
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch (e) { /* pointer lock is optional */ }
    },
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.justPressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(e.code); });
  window.addEventListener('blur', () => { input.keys.clear(); });

  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.clicks += 1; input.dragging = true; }
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    } else if (input.dragging) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
