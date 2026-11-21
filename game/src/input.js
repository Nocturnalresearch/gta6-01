// input.js — keyboard + mouse input for Sunset Bay.
// One object tracks held keys, edge-triggered presses (cleared each frame),
// mouse-look deltas and click counts. Pointer lock is requested on demand
// while playing; dragging with the mouse also steers the camera, so the game
// stays playable in any browser, locked or not.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    clicks: 0,
    locked: false,
    dragging: false,

    down(code) {
      return this.keys.has(code);
    },
    pressed(code) {
      return this.justPressed.has(code);
    },
    consumeMouse() {
      const delta = { dx: this.mouseDX, dy: this.mouseDY };
      this.mouseDX = 0;
      this.mouseDY = 0;
      return delta;
    },
    consumeClicks() {
      const count = this.clicks;
      this.clicks = 0;
      return count;
    },
    endFrame() {
      this.justPressed.clear();
    },
    lockPointer() {
      try {
        const result = canvas.requestPointerLock();
        // Chrome returns a promise that rejects without a user gesture.
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (e) {
        // Pointer lock is a nicety, never a requirement.
      }
    },
  };

  // Keys that scroll the page get swallowed so the game owns them.
  const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    input.justPressed.add(event.code);
    if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  // Losing the window must never leave a key stuck down.
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.clicks += 1;
      input.dragging = true;
    }
  });
  window.addEventListener('mouseup', () => {
    input.dragging = false;
  });
  window.addEventListener('mousemove', (event) => {
    // Locked: raw movement. Dragging: same deltas without the lock.
    if (input.locked || input.dragging) {
      input.mouseDX += event.movementX;
      input.mouseDY += event.movementY;
    }
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}
