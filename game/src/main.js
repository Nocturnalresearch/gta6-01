// main.js — SUNSET BAY bootstrap + game loop + state machine.
// Builds the world, wires every system together, runs the frame loop and
// owns the title / play / pause / busted / complete states.
import * as THREE from 'three';
import { CITY, buildCity, mulberry32 } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { hasSave, loadSave, saveGame } from './save.js';
import { createPlayer, updatePlayer, updateCamera } from './player.js';
import { spawnParkedCars, nearestCar, enterCar, exitCar, updateDrive } from './vehicles.js';
import { initTraffic, updateTraffic, updatePeds, spawnFleeingPed } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { initMissions, updateMissions, SAFEHOUSE } from './missions.js';
import { createCombat, updateCombat, punch, shoot } from './combat.js';
import { initHUD, updateHUD } from './hud.js';
import { stageShot } from './shots.js';

// Every uncaught error is collected here so the headless verifier can see
// them — the game must ship with zero.
window.__gameErrors = [];
window.addEventListener('error', (e) => window.__gameErrors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__gameErrors.push('rejection: ' + String(e.reason)));

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfb9a5e);
scene.fog = new THREE.Fog(0xf2a06e, 150, 470);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 12, 130);

// Sunset lighting: a warm low sun plus a pinkish sky bounce.
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a4a52, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
sun.position.set(-140, 150, -80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -230;
sun.shadow.camera.right = 230;
sun.shadow.camera.top = 230;
sun.shadow.camera.bottom = -230;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0006;
scene.add(sun);

// ---- shared game state ----
const G = {
  scene, camera, renderer,
  rng: mulberry32(1337),
  state: 'title', // title | play | pause | busted | complete
  time: 0,
  cars: [],
  peds: [],
  wanted: 0,
  bestWanted: 0,
  cash: 0,
  ammo: 12,
  shotCam: null,
  autosaveTimer: 0,
  titleAngle: 0.6,
};
window.__game = G;

G.input = createInput(canvas);
G.audio = createAudio();
G.city = buildCity(scene, G.rng);
G.player = createPlayer(scene);
G.police = createPolice(G);
G.traffic = { spawnFleeingPed: (x, z) => spawnFleeingPed(G, x, z) };
G.vehicles = { nearestCar: (x, z, d) => nearestCar(G, x, z, d) };
G.combat = createCombat(G);
initMissions(G);
spawnParkedCars(G);
initTraffic(G);

// ---- the main API (called by the HUD buttons) ----
function startGame(useSave) {
  G.audio.ensure();
  if (useSave) {
    const s = loadSave();
    if (s) {
      G.cash = s.cash;
      G.ammo = s.ammo;
      G.bestWanted = s.bestWanted;
      G.player.group.position.set(s.playerX, 0, s.playerZ);
      G.player.heading = Math.PI;
      G.player.camYaw = 0;
      G.missions.start(Math.min(s.missionIndex, 2), s.missionStep);
      if (s.storyDone) G.mission.storyDone = true;
      G.hud.toast('Save loaded — welcome back to Sunset Bay.');
    }
  } else {
    G.cash = 0;
    G.ammo = 12;
    G.bestWanted = 0;
    G.wanted = 0;
    G.player.group.position.set(0, 0, 104);
    G.player.heading = Math.PI;
    G.player.camYaw = 0;
    G.player.health = 100;
    G.missions.start(0, 0);
  }
  G.state = 'play';
  G.hud.hideOverlays();
  G.hud.updateMissionText();
  G.input.lockPointer();
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  G.hud.showPause();
  if (document.pointerLockElement) document.exitPointerLock();
}

function resume() {
  if (G.state !== 'pause') return;
  G.state = 'play';
  G.hud.hidePause();
  G.input.lockPointer();
}

function clearPoliceUnits() {
  for (const car of [...G.cars]) {
    if (car.kind === 'police') {
      G.scene.remove(car.mesh);
      G.cars.splice(G.cars.indexOf(car), 1);
    }
  }
  for (const cop of G.police.footCops) G.scene.remove(cop.group);
  G.police.footCops.length = 0;
}

function busted(reason) {
  if (G.state !== 'play') return;
  G.state = 'busted';
  const lost = Math.min(G.cash, 150);
  G.cash -= lost;
  G.wanted = 0;
  G.police.bustedTimer = 0;
  G.audio.setSiren(false, 0);
  G.audio.setEngine(0, false);
  clearPoliceUnits();
  saveGame(G);
  G.hud.showBusted(`${reason} You lost $${lost} in fines and impound fees.`);
  if (document.pointerLockElement) document.exitPointerLock();
}

function retryAfterBusted() {
  const p = G.player;
  if (p.inCar) exitCar(G);
  p.group.position.set(SAFEHOUSE.x, 0, SAFEHOUSE.z);
  p.group.visible = true;
  p.inCar = false;
  p.car = null;
  p.health = 100;
  p.heading = Math.PI;
  p.camYaw = 0;
  G.state = 'play';
  G.hud.hideOverlays();
  G.hud.toast('Back on the street. Stay sharp, Rio.');
  G.input.lockPointer();
}

function storyComplete() {
  G.state = 'complete';
  saveGame(G);
  G.hud.showComplete();
  if (document.pointerLockElement) document.exitPointerLock();
}

function freeRoam() {
  G.state = 'play';
  G.hud.hideOverlays();
  G.hud.toast('Free roam — the Bay is yours.');
  G.input.lockPointer();
}

function restartMission() {
  G.missions.restart();
  saveGame(G);
}

G.main = { startGame, resume, retryAfterBusted, restartMission, storyComplete, freeRoam, busted };
G.hud = initHUD(G);
G.hud.showTitle(hasSave());
G.hud.updateMissionText();

// ---- per-frame gameplay ----
function stepGame(dt) {
  const input = G.input;
  if (input.pressed('Escape')) {
    pauseGame();
    return;
  }
  if (input.pressed('KeyM')) {
    const muted = G.audio.toggleMute();
    G.hud.toast(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (input.pressed('KeyR')) restartMission();

  if (input.pressed('KeyE')) {
    const p = G.player;
    if (p.inCar) {
      exitCar(G);
    } else {
      const car = nearestCar(G, p.group.position.x, p.group.position.z, 4);
      if (car) enterCar(G, car);
    }
  }
  if (input.pressed('KeyF')) punch(G);
  const clicks = input.consumeClicks();
  if (clicks > 0) {
    if (G.state === 'play' && !G.shotCam) input.lockPointer();
    for (let i = 0; i < clicks; i++) shoot(G);
  }

  if (G.player.inCar) {
    updateDrive(G, dt);
  } else {
    updatePlayer(G, dt);
    G.audio.setEngine(0, false);
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  updateCamera(G, dt);
  updateHUD(G, dt);

  G.autosaveTimer += dt;
  if (G.autosaveTimer > 15) {
    G.autosaveTimer = 0;
    saveGame(G);
  }
}

// Advance the world one fixed step (used by shots.js staging).
G.stepWorld = (dt) => {
  G.time += dt;
  stepGame(dt);
};

let lastT = performance.now();
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (G.state === 'play') {
    G.time += dt;
    // Screenshot staging locks the camera AND freezes the world, so the
    // staged frame is exactly what the screenshot captures. The camera
    // still needs applying every frame (updateCamera lives in stepGame,
    // which the freeze skips).
    if (!G.shotCam) {
      stepGame(dt);
    } else {
      G.camera.position.copy(G.shotCam.pos);
      G.camera.lookAt(G.shotCam.look);
    }
  } else if (G.state === 'title') {
    // Living backdrop behind the title: slow orbit, traffic keeps moving.
    G.time += dt;
    G.titleAngle += dt * 0.045;
    camera.position.set(Math.sin(G.titleAngle) * 130, 42, Math.cos(G.titleAngle) * 130);
    camera.lookAt(0, 10, 0);
    updateTraffic(G, dt);
    updatePeds(G, dt);
  } else if (G.state === 'pause' || G.state === 'busted' || G.state === 'complete') {
    // Frozen world; keep rendering the scene behind the overlay.
  }
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    window.__shotReady = true;
  }
  G.input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- screenshot staging (?shot=cover|drive|chase|mission) ----
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) {
  stageShot(shotName, G);
}

animate();
