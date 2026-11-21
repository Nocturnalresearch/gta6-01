// player.js — Rio, the on-foot character.
// A stylized block figure (blue shirt, orange cap) with WASD movement,
// sprint, jump, a walk-cycle animation, and the third-person orbit camera
// that follows on foot and chases behind the car while driving.
import * as THREE from 'three';
import { collideCircle } from './city.js';

const SKIN = 0xd9a066;
const SHIRT = 0x2e86c1;
const PANTS = 0x2c2f38;
const SHOES = 0xf0f0ea;
const CAP = 0xff7a3c;

export function createPlayer(scene) {
  const group = new THREE.Group();
  const mat = (colour) => new THREE.MeshLambertMaterial({ color: colour });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(SHIRT));
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat(SKIN));
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.1, 12), mat(CAP));
  cap.position.y = 1.92;
  group.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.26), mat(CAP));
  brim.position.set(0, 1.88, 0.26);
  group.add(brim);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), mat(PANTS));
  legL.position.set(-0.16, 0.38, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legL);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), mat(SHIRT));
  armL.position.set(-0.44, 1.12, 0);
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 0.44;
  group.add(armL);
  group.add(armR);

  scene.add(group);
  return {
    group, legL, legR, armL, armR,
    heading: Math.PI, // facing north (-z) at spawn
    speed: 0,
    vy: 0,
    grounded: true,
    walkPhase: 0,
    camYaw: 0, // camera starts looking north with the player
    camPitch: 0.32,
    camDist: 7.5,
    inCar: false,
    car: null,
    health: 100,
    punchCooldown: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.inCar || !p.group.visible) return;

  // Movement is camera-relative: W always walks away from the camera.
  const fwd = { x: -Math.sin(p.camYaw), z: -Math.cos(p.camYaw) };
  const right = { x: Math.cos(p.camYaw), z: -Math.sin(p.camYaw) };
  let mx = 0, mz = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) { mx += fwd.x; mz += fwd.z; }
  if (input.down('KeyS') || input.down('ArrowDown')) { mx -= fwd.x; mz -= fwd.z; }
  if (input.down('KeyA') || input.down('ArrowLeft')) { mx -= right.x; mz -= right.z; }
  if (input.down('KeyD') || input.down('ArrowRight')) { mx += right.x; mz += right.z; }
  const moving = mx !== 0 || mz !== 0;
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const targetSpeed = moving ? (sprint ? 8.5 : 4.6) : 0;
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 10);

  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    const targetHeading = Math.atan2(mx, mz);
    let dh = targetHeading - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += dh * Math.min(1, dt * 12);
    p.group.position.x += mx * p.speed * dt;
    p.group.position.z += mz * p.speed * dt;
  }

  // Jump + gravity: a short hop, then fall back to the ground plane.
  if (input.pressed('Space') && p.grounded) {
    p.vy = 7.5;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= 22 * dt;
    p.group.position.y += p.vy * dt;
    if (p.group.position.y <= 0) {
      p.group.position.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }

  collideCircle(G.city, p.group.position, 0.55);
  p.group.rotation.y = p.heading;

  // Walk cycle: legs and arms swing opposite, scaled by speed.
  if (p.speed > 0.3 && p.grounded) {
    p.walkPhase += dt * p.speed * 1.9;
    const swing = Math.sin(p.walkPhase) * Math.min(1, p.speed / 6) * 0.7;
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.8;
    p.armR.rotation.x = swing * 0.8;
  } else {
    p.legL.rotation.x *= 0.8;
    p.legR.rotation.x *= 0.8;
    p.armL.rotation.x *= 0.8;
    p.armR.rotation.x *= 0.8;
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
}

// Third-person orbit camera. On foot it orbits the player; in a car it
// chases behind the car, with a mouse-adjustable offset that eases back to
// centre. Screenshot staging locks the camera outright (see shots.js).
export function updateCamera(G, dt) {
  const p = G.player;
  const input = G.input;
  const mouse = input.consumeMouse();
  if (G.shotCam) {
    G.camera.position.copy(G.shotCam.pos);
    G.camera.lookAt(G.shotCam.look);
    return;
  }
  p.camYaw -= mouse.dx * 0.0032;
  p.camPitch = Math.max(0.05, Math.min(1.1, p.camPitch + mouse.dy * 0.0022));

  let target, dist, height, lookY;
  if (p.inCar && p.car) {
    const car = p.car;
    // Ease the orbit yaw back to directly behind the car's heading.
    let dy = (car.heading + Math.PI) - p.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.camYaw += dy * Math.min(1, dt * 1.6);
    target = car.mesh.position;
    dist = 10.5;
    height = 4.2;
    lookY = 1.6;
  } else {
    target = p.group.position;
    dist = p.camDist;
    height = 2.6;
    lookY = 1.5;
  }
  const cx = target.x + Math.sin(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cz = target.z + Math.cos(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cy = target.y + height + Math.sin(p.camPitch) * dist * 0.7;
  // Smooth the camera so it never snaps between frames.
  const k = Math.min(1, dt * 8);
  G.camera.position.x += (cx - G.camera.position.x) * k;
  G.camera.position.y += (cy - G.camera.position.y) * k;
  G.camera.position.z += (cz - G.camera.position.z) * k;
  G.camera.lookAt(target.x, target.y + lookY, target.z);
}
