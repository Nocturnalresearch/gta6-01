// save.js — Sunset Bay persistence: one localStorage slot holding cash,
// mission progress, the player's spot on the map, ammo and the best wanted
// level reached. Everything is validated on load so a corrupt or hand-edited
// save can never crash the game; a bad save just behaves like no save.

const SLOT = 'sunset-bay-save-v1';

// A tiny field table: every saved value is checked against its type and a
// sane fallback before the game trusts it.
const FIELDS = {
  cash: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 0 },
  missionIndex: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 0 },
  missionStep: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 0 },
  playerX: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 0 },
  playerZ: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 100 },
  ammo: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 12 },
  bestWanted: { test: (v) => typeof v === 'number' && Number.isFinite(v), fallback: 0 },
};

export function hasSave() {
  try {
    return window.localStorage.getItem(SLOT) !== null;
  } catch (e) {
    return false; // private mode / storage off: just play without saving
  }
}

export function loadSave() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SLOT);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;

  const clean = { storyDone: data.storyDone === true };
  for (const [key, rule] of Object.entries(FIELDS)) {
    clean[key] = rule.test(data[key]) ? data[key] : rule.fallback;
  }
  // Clamp the numbers into the ranges the game actually uses.
  clean.cash = Math.max(0, Math.floor(clean.cash));
  clean.missionIndex = Math.max(0, Math.min(2, Math.floor(clean.missionIndex)));
  clean.missionStep = Math.max(0, Math.floor(clean.missionStep));
  clean.ammo = Math.max(0, Math.floor(clean.ammo));
  clean.bestWanted = Math.max(0, Math.min(5, Math.floor(clean.bestWanted)));
  clean.playerX = Math.max(-205, Math.min(205, clean.playerX));
  clean.playerZ = Math.max(-205, Math.min(195, clean.playerZ));
  return clean;
}

export function saveGame(G) {
  const snapshot = {
    cash: G.cash,
    missionIndex: G.mission.index,
    missionStep: G.mission.step,
    playerX: G.player.group.position.x,
    playerZ: G.player.group.position.z,
    ammo: G.ammo,
    bestWanted: G.bestWanted,
    storyDone: G.mission.storyDone,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SLOT, JSON.stringify(snapshot));
  } catch (e) {
    // Storage full or blocked: the game keeps playing, it just won't resume.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SLOT);
  } catch (e) {
    /* nothing to clear */
  }
}
