// traffic.js — Sunset Bay traffic and pedestrians.
// Traffic cars cruise the street grid, turn at intersections and brake for
// the car ahead. Pedestrians stroll the sidewalks and flee from fast cars,
// gunfire and police heat.
import * as THREE from 'three';
import { CITY, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { createCar, CAR_TYPES } from './vehicles.js';

const PED_SHIRTS = [0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x95a5a6, 0x34495e];
const PED_SKINS = [0xd9a066, 0x8a5a33, 0xe8b88a, 0x6b4423];

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

export function initTraffic(G) {
  const rng = G.rng;
  // --- traffic cars ---
  for (let i = 0; i < 12; i++) {
    const p = randomRoadPoint(rng);
    const type = pick(['sedan', 'sedan', 'taxi', 'van', 'sports'], rng);
    const color = pick(CAR_TYPES[type].colors, rng);
    const onX = Math.abs(p.z - Math.round(p.z)) < 1 && CITY.streets.some((s) => Math.abs(p.z - s) < 4);
    const axis = CITY.streets.some((s) => Math.abs(p.z - s) < 4) ? 'x' : 'z';
    const dir = rng() < 0.5 ? 1 : -1;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(G.scene, type, color, p.x, p.z, heading, 'traffic');
    car.axis = axis;
    car.dir = dir;
    car.cruise = 7 + rng() * 6;
    car.speed = car.cruise;
    car.waitTimer = 0;
    G.cars.push(car);
  }
  // --- pedestrians ---
  for (let i = 0; i < 18; i++) {
    const p = randomSidewalkPoint(rng);
    G.peds.push(makePed(G, p.x, p.z));
  }
}

function makePed(G, x, z) {
  const rng = G.rng;
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(PED_SHIRTS, rng) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(PED_SKINS, rng) });
  const pants = new THREE.MeshLambertMaterial({ color: pick([0x2c2f38, 0x5a4632, 0x3a3f4a], rng) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirt);
  torso.position.y = 1.06; torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62; head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), pants);
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  group.add(legL); group.add(legR);
  group.position.set(x, 0, z);
  group.userData.kind = 'ped';
  G.scene.add(group);
  const axis = CITY.streets.some((s) => Math.abs(z - s) < 10) ? 'x' : 'z';
  return {
    group, legL, legR,
    heading: rng() * Math.PI * 2,
    speed: 1.2 + rng() * 1.1,
    state: 'walk', // walk | flee | down
    downTimer: 0,
    fleeTimer: 0,
    walkPhase: rng() * 6,
    turnTimer: 2 + rng() * 5,
    axis,
  };
}

export function spawnFleeingPed(G, x, z) {
  const ped = makePed(G, x, z);
  ped.state = 'flee';
  ped.fleeTimer = 4;
  G.peds.push(ped);
}

function nearestStreet(v) {
  let best = CITY.streets[0], bd = Infinity;
  for (const s of CITY.streets) {
    const d = Math.abs(v - s);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  const playerCar = G.player.car;
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const pos = car.mesh.position;
    // car ahead on the same lane?
    let blocked = false;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.mesh.position.x - pos.x;
      const dz = other.mesh.position.z - pos.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 10 && side < 2.4) { blocked = true; break; }
    }
    if (!blocked && playerCar) {
      const dx = playerCar.mesh.position.x - pos.x;
      const dz = playerCar.mesh.position.z - pos.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.4) blocked = true;
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 14 * dt);
      car.waitTimer += dt;
      if (car.waitTimer > 7) {
        // give up on this lane: turn around at the next intersection
        car.dir *= -1;
        car.heading += Math.PI;
        car.waitTimer = 0;
      }
    } else {
      car.waitTimer = 0;
      car.speed += (car.cruise - car.speed) * Math.min(1, dt * 1.5);
    }
    pos.x += Math.sin(car.heading) * car.speed * dt;
    pos.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;

    // at an intersection, sometimes turn onto the cross street
    const onXStreet = CITY.streets.some((s) => Math.abs(pos.z - s) < 1.2);
    const onZStreet = CITY.streets.some((s) => Math.abs(pos.x - s) < 1.2);
    if (onXStreet && onZStreet && rng() < dt * 0.35) {
      if (car.axis === 'x') {
        car.axis = 'z';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.heading = car.dir > 0 ? 0 : Math.PI;
        pos.x = nearestStreet(pos.x);
      } else {
        car.axis = 'x';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        pos.z = nearestStreet(pos.z);
      }
    }
    // keep inside the grid; loop back at the edges
    if (pos.x > 152 || pos.x < -152 || pos.z > 152 || pos.z < -152) {
      const p = randomRoadPoint(rng);
      pos.x = p.x; pos.z = p.z;
      car.axis = CITY.streets.some((s) => Math.abs(p.z - s) < 4) ? 'x' : 'z';
      car.dir = rng() < 0.5 ? 1 : -1;
      car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    }
  }
}

export function updatePeds(G, dt) {
  const player = G.player;
  const px = player.inCar && player.car ? player.car.mesh.position.x : player.group.position.x;
  const pz = player.inCar && player.car ? player.car.mesh.position.z : player.group.position.z;
  const playerFast = player.inCar && player.car && Math.abs(player.car.speed) > 9;
  for (const ped of G.peds) {
    const pos = ped.group.position;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      ped.group.rotation.x = -Math.PI / 2 + 0.15; // lying on the ground
      ped.group.position.y = 0.25;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3.5;
        ped.group.rotation.x = 0;
        ped.group.position.y = 0;
      }
      continue;
    }
    const dx = pos.x - px, dz = pos.z - pz;
    const dist = Math.hypot(dx, dz);
    if (ped.state === 'walk') {
      const scared = (playerFast && dist < 13) || (G.wanted > 0 && dist < 16) || (G.combat.shotsFiredAt && dist < 20 && G.time - G.combat.shotsFiredAt < 2);
      if (scared) { ped.state = 'flee'; ped.fleeTimer = 3; }
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const len = Math.max(0.01, dist);
      const runHeading = Math.atan2(dx / len, dz / len);
      let dh = runHeading - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += dh * Math.min(1, dt * 8);
      pos.x += Math.sin(ped.heading) * 5.2 * dt;
      pos.z += Math.cos(ped.heading) * 5.2 * dt;
      ped.walkPhase += dt * 11;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      // stroll the sidewalk; turn at intersections
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.turnTimer = 3 + G.rng() * 6;
        if (G.rng() < 0.4) ped.heading += (G.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      pos.x += Math.sin(ped.heading) * ped.speed * dt;
      pos.z += Math.cos(ped.heading) * ped.speed * dt;
      ped.walkPhase += dt * ped.speed * 4;
      // stay inside the city and off the roads
      if (pos.x > 152 || pos.x < -152 || pos.z > 152 || pos.z < -152) ped.heading += Math.PI;
      if (Math.abs(pos.x) > 148 && ped.axis === 'x') ped.heading = Math.PI / 2;
    }
    // keep off building footprints
    const before = { x: pos.x, z: pos.z };
    for (const c of G.city.colliders) {
      if (pos.x > c.x0 - 0.5 && pos.x < c.x1 + 0.5 && pos.z > c.z0 - 0.5 && pos.z < c.z1 + 0.5) {
        pos.x = before.x; pos.z = before.z;
        ped.heading += Math.PI / 2;
        break;
      }
    }
    ped.group.rotation.y = ped.heading;
    const s = Math.sin(ped.walkPhase) * 0.55;
    ped.legL.rotation.x = s; ped.legR.rotation.x = -s;
  }
}
