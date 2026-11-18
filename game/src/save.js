// save.js — localStorage save/load for Sunset Bay.
// Stores cash, mission progress, player position, ammo and best wanted level.
// Saves happen after every mission, on bust, and on a slow autosave timer.
const KEY = 'sunset-bay-save-v1';

export function hasSave() {
  try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      missionStep: typeof data.missionStep === 'number' ? data.missionStep : 0,
      playerX: typeof data.playerX === 'number' ? data.playerX : 0,
      playerZ: typeof data.playerZ === 'number' ? data.playerZ : 100,
      ammo: typeof data.ammo === 'number' ? data.ammo : 12,
      bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
      storyDone: !!data.storyDone,
    };
  } catch (e) { return null; }
}

export function saveGame(G) {
  try {
    const data = {
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
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage may be unavailable; the game still plays */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
