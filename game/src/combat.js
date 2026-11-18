// combat.js — punch + pistol for Sunset Bay. Deliberately simple and
// readable: a short-range shove and a centre-screen pistol with limited
// ammo, refilled at glowing green crates around the city.
import * as THREE from 'three';

const PICKUP_SPOTS = [
  { x: -34, z: -26 }, { x: 86, z: -78 }, { x: -86, z: 86 }, { x: 138, z: -26 },
];

export function createCombat(G) {
  const combat = {
    pickups: [],
    punchCooldown: 0,
    shotCooldown: 0,
    lastWantedAt: -10,
    shotsFiredAt: 0,
    tracer: null,
    tracerTimer: 0,
  };
  const geo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  for (const spot of PICKUP_SPOTS) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x39ff6a }));
    mesh.position.set(spot.x, 0.9, spot.z);
    mesh.castShadow = true;
    G.scene.add(mesh);
    combat.pickups.push({ mesh, x: spot.x, z: spot.z, active: true, respawnTimer: 0 });
  }
  return combat;
}

function findTarget(G, obj) {
  // walk up the parent chain to the ped / cop group
  let o = obj;
  while (o) {
    if (o.userData && o.userData.kind) return o;
    o = o.parent;
  }
  return null;
}

export function punch(G) {
  const p = G.player;
  if (p.inCar || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  G.audio.thud();
  const px = p.group.position.x, pz = p.group.position.z;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const targets = [];
  for (const ped of G.peds) {
    if (ped.state !== 'down') targets.push({ obj: ped, pos: ped.group.position, kind: 'ped' });
  }
  for (const cop of G.police.footCops) {
    targets.push({ obj: cop, pos: cop.group.position, kind: 'cop' });
  }
  for (const t of targets) {
    const dx = t.pos.x - px, dz = t.pos.z - pz;
    const d = Math.hypot(dx, dz);
    if (d < 2.4 && (dx * fx + dz * fz) / Math.max(0.01, d) > 0.35) {
      t.obj.state = 'down';
      t.obj.downTimer = 3;
      if (t.kind === 'cop') t.obj.downTimer = 3.5;
      G.police.addWanted(1);
      G.hud.toast(t.kind === 'cop' ? 'You decked a cop! That will not help.' : 'You shoved a pedestrian aside.');
      return;
    }
  }
}

const raycaster = new THREE.Raycaster();

export function shoot(G) {
  if (G.combat.shotCooldown > 0) return;
  if (G.ammo <= 0) {
    G.hud.toast('Out of ammo — find a green ammo crate.');
    G.audio.blip(160, 0.08, 'square', 0.1);
    G.combat.shotCooldown = 0.3;
    return;
  }
  G.combat.shotCooldown = 0.28;
  G.ammo -= 1;
  G.combat.shotsFiredAt = G.time;
  G.audio.shot();
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  raycaster.set(G.camera.position, dir);
  raycaster.far = 70;
  const targets = [];
  for (const ped of G.peds) if (ped.state !== 'down') targets.push(ped.group);
  for (const cop of G.police.footCops) targets.push(cop.group);
  for (const car of G.cars) targets.push(car.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  let end = G.camera.position.clone().add(dir.clone().multiplyScalar(60));
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    const target = findTarget(G, hit.object);
    if (target) {
      const kind = target.userData.kind;
      if (kind === 'ped' || kind === 'cop') {
        const rec = kind === 'ped'
          ? G.peds.find((x) => x.group === target)
          : G.police.footCops.find((x) => x.group === target);
        if (rec) {
          rec.state = 'down';
          rec.downTimer = kind === 'cop' ? 6 : 5;
        }
        if (G.time - G.combat.lastWantedAt > 2) {
          G.combat.lastWantedAt = G.time;
          G.police.addWanted(1);
        }
        G.hud.toast(kind === 'cop' ? 'You shot a cop! The whole Bay is coming.' : 'You shot a pedestrian!');
      }
    }
  }
  // tracer line from the camera to the hit point
  if (G.combat.tracer) G.scene.remove(G.combat.tracer);
  const geo = new THREE.BufferGeometry().setFromPoints([
    G.camera.position.clone().add(dir.clone().multiplyScalar(1.2)).add(new THREE.Vector3(0, -0.25, 0)),
    end,
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe95e }));
  G.scene.add(line);
  G.combat.tracer = line;
  G.combat.tracerTimer = 0.09;
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.punchCooldown > 0) c.punchCooldown -= dt;
  if (c.shotCooldown > 0) c.shotCooldown -= dt;
  if (c.tracer) {
    c.tracerTimer -= dt;
    if (c.tracerTimer <= 0) {
      G.scene.remove(c.tracer);
      c.tracer.geometry.dispose();
      c.tracer = null;
    }
  }
  // ammo crates: spin, bob, refill on touch, respawn after 45 s
  const p = G.player;
  const px = p.inCar && p.car ? p.car.mesh.position.x : p.group.position.x;
  const pz = p.inCar && p.car ? p.car.mesh.position.z : p.group.position.z;
  for (const pk of c.pickups) {
    if (!pk.active) {
      pk.respawnTimer -= dt;
      if (pk.respawnTimer <= 0) {
        pk.active = true;
        pk.mesh.visible = true;
      }
      continue;
    }
    pk.mesh.rotation.y += dt * 1.4;
    pk.mesh.position.y = 0.9 + Math.sin(G.time * 2 + pk.x) * 0.15;
    if (Math.hypot(px - pk.x, pz - pk.z) < 2.6) {
      pk.active = false;
      pk.mesh.visible = false;
      pk.respawnTimer = 45;
      G.ammo += 12;
      G.audio.blip(990, 0.12, 'sine', 0.18);
      G.hud.toast('Ammo crate — +12 pistol rounds.');
    }
  }
}
