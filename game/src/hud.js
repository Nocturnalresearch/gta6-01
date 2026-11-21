// hud.js — the Sunset Bay HUD and menus.
// Wanted stars, health, cash, mission text, context prompts, ammo,
// speedometer, toasts, a canvas minimap, and the title / pause / busted /
// complete overlays. The HUD object owns the DOM; updateHUD refreshes it
// every frame from the game state.
import { CITY } from './city.js';
import { MISSIONS, SAFEHOUSE } from './missions.js';

export function initHUD(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'),
    stars: $('stars'),
    healthFill: $('healthFill'),
    cash: $('cash'),
    missionName: $('missionName'),
    missionText: $('missionText'),
    prompt: $('prompt'),
    ammo: $('ammo'),
    speedo: $('speedo'),
    speed: $('speed'),
    toastEl: $('toast'),
    crosshair: $('crosshair'),
    minimap: $('minimap'),
    mapCtx: $('minimap').getContext('2d'),
    toastTimer: null,
    damageEl: null,

    toast(msg, ms = 3500) {
      this.toastEl.textContent = msg;
      this.toastEl.style.display = 'block';
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastEl.style.display = 'none';
      }, ms);
    },
    flashDamage() {
      if (!this.damageEl) {
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center, transparent 55%, rgba(255,30,30,0.45) 100%);opacity:0;transition:opacity 0.12s;z-index:5;';
        this.root.appendChild(d);
        this.damageEl = d;
      }
      this.damageEl.style.opacity = '1';
      setTimeout(() => {
        this.damageEl.style.opacity = '0';
      }, 160);
    },
    updateMissionText() {
      const m = G.missions.current();
      const step = G.missions.currentStep();
      if (!m || !step) {
        this.missionName.textContent = G.mission.storyDone ? 'SUNSET BAY LEGEND' : 'SUNSET BAY';
        this.missionText.textContent = G.mission.storyDone ? 'Story complete — free roam.' : '';
        return;
      }
      this.missionName.textContent = `${m.name}  •  $${m.reward}`;
      this.missionText.textContent = step.text;
    },
    showTitle(hasSave) {
      this.root.classList.remove('on');
      $('titleOverlay').classList.remove('hidden');
      $('pauseOverlay').classList.add('hidden');
      $('bustedOverlay').classList.add('hidden');
      $('completeOverlay').classList.add('hidden');
      $('btnContinue').style.display = hasSave ? '' : 'none';
    },
    hideOverlays() {
      this.root.classList.add('on');
      $('titleOverlay').classList.add('hidden');
      $('pauseOverlay').classList.add('hidden');
      $('bustedOverlay').classList.add('hidden');
      $('completeOverlay').classList.add('hidden');
    },
    showPause() {
      $('pauseOverlay').classList.remove('hidden');
    },
    hidePause() {
      $('pauseOverlay').classList.add('hidden');
    },
    showBusted(text) {
      this.root.classList.remove('on');
      $('bustedText').textContent = text;
      $('bustedOverlay').classList.remove('hidden');
    },
    showComplete() {
      this.root.classList.remove('on');
      $('completeOverlay').classList.remove('hidden');
    },
  };

  // Menu buttons call back into the main API.
  $('btnStart').addEventListener('click', () => G.main.startGame(false));
  $('btnContinue').addEventListener('click', () => G.main.startGame(true));
  $('btnResume').addEventListener('click', () => G.main.resume());
  $('btnRestartMission').addEventListener('click', () => {
    G.main.resume();
    G.main.restartMission();
  });
  $('btnRetry').addEventListener('click', () => G.main.retryAfterBusted());
  $('btnFreeRoam').addEventListener('click', () => G.main.freeRoam());
  return hud;
}

// A five-pointed star on a canvas context.
function drawStar(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

export function updateHUD(G, dt) {
  const hud = G.hud;
  // Wanted stars: filled gold up to the current level, dim beyond it.
  let starsHtml = '';
  for (let i = 0; i < 5; i++) {
    starsHtml += `<span class="${i < G.wanted ? '' : 'off'}">★</span>`;
  }
  hud.stars.innerHTML = starsHtml;
  hud.healthFill.style.width = `${Math.max(0, G.player.health)}%`;
  hud.healthFill.style.background = G.player.health > 50
    ? 'linear-gradient(90deg,#37d67a,#a5e34d)'
    : 'linear-gradient(90deg,#e74c3c,#f39c12)';
  hud.cash.textContent = `$${G.cash.toLocaleString('en-US')}`;
  hud.ammo.textContent = G.ammo;
  hud.crosshair.style.display = G.state === 'play' ? 'block' : 'none';

  // Speedometer only while driving.
  if (G.player.inCar && G.player.car) {
    hud.speedo.style.display = 'block';
    hud.speed.textContent = Math.round(Math.abs(G.player.car.speed) * 2.2);
  } else {
    hud.speedo.style.display = 'none';
  }

  // Context prompt: enter the nearest car, or exit the one you're in.
  const p = G.player;
  let prompt = '';
  if (G.state === 'play' && !p.inCar) {
    const near = G.vehicles.nearestCar(p.group.position.x, p.group.position.z, 4);
    if (near) prompt = `<b>[E]</b> Enter ${near.type === 'police' ? 'police car' : near.type} — steal it`;
  } else if (G.state === 'play' && p.inCar) {
    prompt = '<b>[E]</b> Exit car';
  }
  if (prompt) {
    hud.prompt.innerHTML = prompt;
    hud.prompt.style.display = 'block';
  } else {
    hud.prompt.style.display = 'none';
  }

  drawMinimap(G);
}

const MAP_W = 180;
const toMap = (v) => ((v + 210) / 420) * MAP_W;

export function drawMinimap(G) {
  const g = G.hud.mapCtx;
  if (!g) return;
  g.clearRect(0, 0, MAP_W, MAP_W);
  // Land.
  g.fillStyle = '#20242e';
  g.fillRect(0, 0, MAP_W, MAP_W);
  // Beach and ocean to the south.
  g.fillStyle = '#c9a86a';
  g.fillRect(0, toMap(CITY.beachZ), MAP_W, MAP_W - toMap(CITY.beachZ));
  g.fillStyle = '#2b7ba6';
  g.fillRect(0, toMap(CITY.oceanZ), MAP_W, MAP_W - toMap(CITY.oceanZ));
  // Port to the east.
  g.fillStyle = '#5a5a55';
  g.fillRect(toMap(CITY.portX), 0, MAP_W - toMap(CITY.portX), MAP_W);
  // Parks.
  g.fillStyle = '#3f6b34';
  for (const pk of G.city.parks) {
    g.fillRect(toMap(pk.x0), toMap(pk.z0), toMap(pk.x1) - toMap(pk.x0), toMap(pk.z1) - toMap(pk.z0));
  }
  // Buildings.
  g.fillStyle = '#3a3f4d';
  for (const b of G.city.buildings) {
    g.fillRect(toMap(b.x - b.w / 2), toMap(b.z - b.d / 2), (b.w / 420) * MAP_W, (b.d / 420) * MAP_W);
  }
  // Roads.
  g.strokeStyle = '#8f8f96';
  g.lineWidth = 3;
  for (const s of CITY.streets) {
    g.beginPath();
    g.moveTo(toMap(s), toMap(-156));
    g.lineTo(toMap(s), toMap(156));
    g.stroke();
    g.beginPath();
    g.moveTo(toMap(-156), toMap(s));
    g.lineTo(toMap(156), toMap(s));
    g.stroke();
  }
  // Safehouse marker.
  g.fillStyle = '#39ff6a';
  g.fillRect(toMap(SAFEHOUSE.x) - 2, toMap(SAFEHOUSE.z) - 2, 4, 4);
  // Mission target: a pulsing gold star.
  const target = G.missions.target();
  if (target) {
    const pulse = 5 + Math.sin(G.time * 4) * 1.5;
    drawStar(g, toMap(target.x), toMap(target.z), pulse, '#ffd34d');
  }
  // Traffic as white dots.
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const car of G.cars) {
    if (car.kind === 'traffic') {
      g.fillRect(toMap(car.mesh.position.x) - 1, toMap(car.mesh.position.z) - 1, 2, 2);
    }
  }
  // Police as flashing red dots.
  g.fillStyle = Math.floor(G.time * 3) % 2 === 0 ? '#ff2a2a' : '#ff8080';
  for (const car of G.cars) {
    if (car.kind === 'police') {
      g.beginPath();
      g.arc(toMap(car.mesh.position.x), toMap(car.mesh.position.z), 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Player arrow, rotated to the heading.
  const p = G.player;
  const px = p.inCar && p.car ? p.car.mesh.position.x : p.group.position.x;
  const pz = p.inCar && p.car ? p.car.mesh.position.z : p.group.position.z;
  const heading = p.inCar && p.car ? p.car.heading : p.heading;
  g.save();
  g.translate(toMap(px), toMap(pz));
  g.rotate(-heading + Math.PI);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.restore();
}
