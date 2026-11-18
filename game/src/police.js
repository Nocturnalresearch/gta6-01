// police.js — the Bay PD: wanted level, police car + foot-cop pursuit,
// escape/heat decay, and getting BUSTED.
import * as THREE from 'three';
import { CITY, randomRoadPoint, collideCircle } from './city.js';
import { createCar, CAR_TYPES } from './vehicles.js';

export function createPolice(G) {
  return {
    addWanted(n) {
      if (G.state !== 'play') return;
      G.wanted = Math.max(0, Math.min(5, G.wanted + n));
      if (G.wanted > G.bestWanted) G.bestWanted = G.wanted;
      G.police.heatTimer = 0;
      G.police.escapeTimer = 0;
    },
    setWanted(n) {
      G.wanted = Math.max(0, Math.min(5, n));
      if (G.wanted > G.bestWanted) G.bestWanted = G.wanted;
      G.police.heatTimer = 0;
      G.police.escapeTimer = 0;
    },
    heatTimer: 0,      // time since police last saw the player
    escapeTimer: 0,    // time with no police near (drives decay)
    bustedTimer: 0,    // time police have held the player still
    flashTimer: 0,
    footCops: [],
  };
}

function playerPos(G) {
  const p = G.player;
  if (p.inCar && p.car) return p.car.mesh.position;
  return p.group.position;
}

function spawnPoliceCar(G) {
  const rng = G.rng;
  // spawn on a road 60–90 units from the player
  let x = 0, z = 0;
  for (let tries = 0; tries < 12; tries++) {
    const p = randomRoadPoint(rng);
    const pp = playerPos(G);
    if (Math.hypot(p.x - pp.x, p.z - pp.z) > 55) { x = p.x; z = p.z; break; }
    x = p.x; z = p.z;
  }
  const car = createCar(G.scene, 'police', 0x14161c, x, z, rng() * Math.PI * 2, 'police');
  car.cruise = 30;
  G.cars.push(car);
  return car;
}

function makeFootCop(G, x, z) {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f57 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), navy);
  torso.position.y = 1.1; torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.7;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x101828 }));
  hat.position.y = 1.9;
  group.add(hat);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), navy);
  legL.position.set(-0.15, 0.36, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  group.add(legL); group.add(legR);
  group.position.set(x, 0, z);
  group.userData.kind = 'cop';
  G.scene.add(group);
  return { group, legL, legR, heading: 0, speed: 5.6, walkPhase: 0, state: 'walk', downTimer: 0 };
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const pp = playerPos(G);

  // --- how many police should exist ---
  const wantCars = G.wanted === 0 ? 0 : Math.min(3, G.wanted);
  const wantCops = G.wanted >= 3 ? 2 : G.wanted >= 2 ? 1 : 0;
  const policeCars = G.cars.filter((c) => c.kind === 'police');
  if (policeCars.length < wantCars && G.wanted > 0) spawnPoliceCar(G);
  if (policeCars.length > wantCars) {
    // extra units stand down
    const extra = policeCars[policeCars.length - 1];
    G.scene.remove(extra.mesh);
    G.cars.splice(G.cars.indexOf(extra), 1);
  }
  while (pol.footCops.length < wantCops) {
    const p = randomRoadPoint(G.rng);
    pol.footCops.push(makeFootCop(G, p.x, p.z));
  }
  while (pol.footCops.length > wantCops) {
    const cop = pol.footCops.pop();
    G.scene.remove(cop.group);
  }

  // --- nearest police distance (drives heat decay + busted) ---
  let nearest = Infinity;
  for (const car of policeCars) {
    nearest = Math.min(nearest, Math.hypot(car.mesh.position.x - pp.x, car.mesh.position.z - pp.z));
  }
  for (const cop of pol.footCops) {
    nearest = Math.min(nearest, Math.hypot(cop.group.position.x - pp.x, cop.group.position.z - pp.z));
  }

  // heat decay: no police in sight for a while → lose a star
  if (G.wanted > 0) {
    if (nearest > 48) {
      pol.escapeTimer += dt;
      if (pol.escapeTimer > 9) {
        pol.escapeTimer = 0;
        G.wanted -= 1;
        G.hud.toast(G.wanted > 0 ? `Heat dropping — ${G.wanted} star${G.wanted > 1 ? 's' : ''} left.` : 'You lost the Bay PD. Heat is off.');
        G.audio.blip(660, 0.12, 'sine', 0.14);
      }
    } else {
      pol.escapeTimer = 0;
    }
  }

  // --- police car pursuit ---
  for (const car of policeCars) {
    const pos = car.mesh.position;
    const dx = pp.x - pos.x, dz = pp.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    // steer toward the player, faster turn when close
    car.heading += Math.max(-1, Math.min(1, dh * 2.2)) * Math.min(1.9, 0.9 + 14 / Math.max(8, dist)) * dt;
    const targetSpeed = dist > 26 ? 31 : 26;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    pos.x += Math.sin(car.heading) * car.speed * dt;
    pos.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
    collideCircle(G.city, pos, 1.7);
    // ram the player's car
    if (G.player.inCar && G.player.car && dist < 3.4) {
      const pc = G.player.car;
      pc.speed *= 0.985;
      const push = 3.4 - dist;
      pc.mesh.position.x -= (dx / Math.max(0.01, dist)) * push * 0.4;
      pc.mesh.position.z -= (dz / Math.max(0.01, dist)) * push * 0.4;
    }
    // stuck? respawn on a road near the player
    if (Math.hypot(pos.x - car.lastX, pos.z - car.lastZ) < 0.4) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 4) {
        const p = randomRoadPoint(G.rng);
        pos.x = p.x; pos.z = p.z;
        car.stuckTimer = 0;
      }
    } else car.stuckTimer = 0;
    car.lastX = pos.x; car.lastZ = pos.z;
  }

  // --- flashing light bars ---
  pol.flashTimer += dt;
  const flashOn = Math.floor(pol.flashTimer * 4) % 2 === 0;
  for (const car of policeCars) {
    if (!car.lightBar) continue;
    car.lightBar.red.material.color.setHex(flashOn ? 0xff2020 : 0x550000);
    car.lightBar.blue.material.color.setHex(flashOn ? 0x101050 : 0x2040ff);
  }

  // --- foot cops chase on foot ---
  for (const cop of pol.footCops) {
    const pos = cop.group.position;
    if (cop.state === 'down') {
      cop.downTimer -= dt;
      cop.group.rotation.x = -Math.PI / 2 + 0.15;
      cop.group.position.y = 0.25;
      if (cop.downTimer <= 0) {
        cop.state = 'walk';
        cop.group.rotation.x = 0;
        cop.group.position.y = 0;
      }
      continue;
    }
    const dx = pp.x - pos.x, dz = pp.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    cop.heading += dh * Math.min(1, dt * 10);
    pos.x += Math.sin(cop.heading) * cop.speed * dt;
    pos.z += Math.cos(cop.heading) * cop.speed * dt;
    cop.group.rotation.y = cop.heading;
    cop.walkPhase += dt * 10;
    const s = Math.sin(cop.walkPhase) * 0.6;
    cop.legL.rotation.x = s; cop.legR.rotation.x = -s;
    collideCircle(G.city, pos, 0.5);
    // caught on foot
    if (!G.player.inCar && dist < 1.7) {
      G.main.busted('A Bay PD officer caught you on foot.');
      return;
    }
  }

  // --- busted: boxed in while driving ---
  if (G.wanted > 0 && G.player.inCar && G.player.car) {
    const playerSpeed = Math.abs(G.player.car.speed);
    if (nearest < 4.5 && playerSpeed < 2.5) {
      pol.bustedTimer += dt;
      if (pol.bustedTimer > 2.5) {
        pol.bustedTimer = 0;
        G.main.busted('The Bay PD boxed your car in and dragged you out.');
        return;
      }
    } else pol.bustedTimer = 0;
  } else pol.bustedTimer = 0;

  // siren while any police unit is active
  G.audio.setSiren(G.wanted > 0 && policeCars.length > 0, dt);
}
