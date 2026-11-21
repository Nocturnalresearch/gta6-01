// vehicles.js — the cars of Sunset Bay.
// Five body styles with their own size, speed and colours; one mesh builder
// shared by parked cars, traffic, police and the player's ride; arcade
// driving physics (accelerate, brake, reverse, handbrake, steering that
// scales with speed); and stealing — entering a parked car or yanking a
// driver out of a traffic car, both of which the witnesses report.
import * as THREE from 'three';
import { CITY, collideCircle, randomRoadPoint } from './city.js';

export const CAR_TYPES = {
  sedan:  { length: 4.4, width: 1.9, height: 0.62, cabinH: 0.55, maxSpeed: 27, accel: 15, colors: [0xc0392b, 0x2e5fa3, 0xc0c0c8, 0x222226, 0x7a4a9e] },
  taxi:   { length: 4.4, width: 1.9, height: 0.62, cabinH: 0.55, maxSpeed: 29, accel: 16, colors: [0xf7c600] },
  van:    { length: 5.4, width: 2.1, height: 0.95, cabinH: 0.8,  maxSpeed: 21, accel: 11, colors: [0xd8d8d0, 0x4a6a8a, 0x8a4a3a] },
  sports: { length: 4.3, width: 2.0, height: 0.5,  cabinH: 0.42, maxSpeed: 39, accel: 21, colors: [0xff5a1f, 0xffd21f, 0x19c2ff, 0xe83e8c] },
  police: { length: 4.5, width: 1.95, height: 0.62, cabinH: 0.55, maxSpeed: 34, accel: 19, colors: [0x14161c] },
};

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Build a car mesh from its type + paint colour. Body, glass cabin, four
// wheels, headlights and taillights; taxis get a roof sign, sports cars a
// spoiler, police cars a red/blue light bar and white doors.
export function buildCarMesh(type, color) {
  const def = CAR_TYPES[type];
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });

  const bodyY = 0.55 + def.height / 2 - 0.3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(def.width, def.height, def.length), paint);
  body.position.y = bodyY;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(def.width * 0.86, def.cabinH, def.length * 0.48), glass,
  );
  cabin.position.set(0, bodyY + def.height / 2 + def.cabinH / 2 - 0.08, -def.length * 0.06);
  cabin.castShadow = true;
  g.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheels = [];
  const wheelSpots = [
    [-def.width / 2, def.length / 2 - 0.85],
    [def.width / 2, def.length / 2 - 0.85],
    [-def.width / 2, -def.length / 2 + 0.85],
    [def.width / 2, -def.length / 2 + 0.85],
  ];
  for (const [wx, wz] of wheelSpots) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-def.width / 2 + 0.3, def.width / 2 - 0.3]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(hx, 0.72, def.length / 2 + 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tail.position.set(hx, 0.72, -def.length / 2 - 0.02);
    g.add(tail);
  }

  let lightBar = null;
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe95e }),
    );
    sign.position.set(0, bodyY + def.height / 2 + def.cabinH + 0.05, 0);
    g.add(sign);
  }
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.9, 0.08, 0.5), dark);
    spoiler.position.set(0, 1.05, -def.length / 2 + 0.2);
    g.add(spoiler);
  }
  if (type === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    red.position.x = -0.3;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }),
    );
    blue.position.x = 0.3;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, bodyY + def.height / 2 + def.cabinH + 0.12, 0);
    g.add(bar);
    lightBar = { red, blue };
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(def.width + 0.02, 0.4, def.length * 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf0f0ea }),
    );
    door.position.y = 0.62;
    g.add(door);
  }
  return { group: g, wheels, lightBar };
}

export function createCar(scene, type, color, x, z, heading, kind = 'parked') {
  const def = CAR_TYPES[type];
  const { group, wheels, lightBar } = buildCarMesh(type, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group, wheels, lightBar,
    type, kind, def,
    heading, speed: 0, steer: 0,
    radius: Math.max(def.length, def.width) / 2,
    stuckTimer: 0,
    lastX: x, lastZ: z,
    driver: null,
  };
}

// Parked cars along the curbs, plus one sports car on the beachfront
// boulevard — the drive shot's car, and a tempting first steal.
export function spawnParkedCars(G) {
  const rng = G.rng;
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const s = CITY.streets[Math.floor(rng() * CITY.streets.length)];
    const along = -130 + rng() * 260;
    const side = rng() < 0.5 ? -8.2 : 8.2;
    if (rng() < 0.5) {
      spots.push({ x: along, z: s + side, heading: rng() < 0.5 ? 0 : Math.PI });
    } else {
      spots.push({ x: s + side, z: along, heading: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  spots.push({ x: 30, z: 130 + 8.2, heading: Math.PI / 2, type: 'sports' });
  for (const sp of spots) {
    const type = sp.type || pick(['sedan', 'sedan', 'taxi', 'van', 'sports'], rng);
    const color = pick(CAR_TYPES[type].colors, rng);
    const car = createCar(G.scene, type, color, sp.x, sp.z, sp.heading, 'parked');
    G.cars.push(car);
  }
}

export function nearestCar(G, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.kind === 'police') continue; // police cars are never stealable
    const dx = car.mesh.position.x - x;
    const dz = car.mesh.position.z - z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.kind === 'parked') {
    // Stealing a parked car: +1 star, the owner calls it in.
    G.police.addWanted(1);
    G.hud.toast('You jacked a parked car — the owner called the Bay PD!');
    G.audio.blip(320, 0.15, 'square', 0.14);
  } else if (car.kind === 'traffic') {
    // Yank the driver out; they run off on foot.
    G.traffic.spawnFleeingPed(car.mesh.position.x + 2, car.mesh.position.z + 2);
    G.police.addWanted(1);
    G.hud.toast('You pulled the driver out — witnesses called it in!');
    G.audio.blip(320, 0.15, 'square', 0.14);
  }
  car.kind = 'player';
  p.car = car;
  p.inCar = true;
  p.group.visible = false;
  p.camYaw = car.heading + Math.PI;
  G.audio.blip(520, 0.1, 'sine', 0.12);
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.speed = 0;
  car.kind = 'parked';
  // Step out on the driver's side, clear of any building.
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  p.group.position.set(
    car.mesh.position.x + side.x * 2.2,
    0,
    car.mesh.position.z + side.z * 2.2,
  );
  collideCircle(G.city, p.group.position, 0.55);
  p.group.visible = true;
  p.inCar = false;
  p.car = null;
  p.camYaw = car.heading + Math.PI;
  p.heading = car.heading;
}

// Arcade driving: W/S accelerate and brake/reverse, A/D steer (steering
// bites harder the faster the car goes), Space is the handbrake. Buildings
// stop the car hard; other cars get bumped aside; pedestrians get run over
// (and the police hear about it).
export function updateDrive(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const input = G.input;
  const def = car.def;
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const handbrake = input.down('Space');

  if (fwd) {
    car.speed += def.accel * dt;
  } else if (back) {
    car.speed -= (car.speed > 0.5 ? def.accel * 1.4 : def.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = Math.max(-11, Math.min(def.maxSpeed, car.speed));

  const steerTarget = (left ? 1 : 0) + (right ? -1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 10);
  const turnRate = (handbrake ? 1.9 : 1.25) * speedFactor * Math.sign(car.speed || 1);
  car.heading += car.steer * turnRate * dt;

  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.mesh.position.x += fx * car.speed * dt;
  car.mesh.position.z += fz * car.speed * dt;
  car.mesh.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;

  // Buildings and the world edge stop the car hard.
  if (collideCircle(G.city, car.mesh.position, 1.7)) {
    if (Math.abs(car.speed) > 6) {
      car.speed *= 0.35;
      G.audio.thud();
      G.hud.flashDamage();
    } else {
      car.speed *= 0.5;
    }
  }

  // Bump other cars: shove them aside, slow both cars down.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.mesh.position.x - car.mesh.position.x;
    const dz = other.mesh.position.z - car.mesh.position.z;
    const d = Math.hypot(dx, dz);
    const min = 2.6;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      car.mesh.position.x -= nx * push;
      car.mesh.position.z -= nz * push;
      if (other.kind !== 'player') {
        other.mesh.position.x += nx * push;
        other.mesh.position.z += nz * push;
        if (other.kind === 'traffic') other.speed = Math.max(0, other.speed - 2);
      }
      if (Math.abs(car.speed) > 8) {
        car.speed *= 0.7;
        G.audio.thud();
      }
    }
  }

  // Running over a pedestrian knocks them down and adds a star.
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.group.position.x - car.mesh.position.x;
    const dz = ped.group.position.z - car.mesh.position.z;
    if (Math.hypot(dx, dz) < 2.1 && Math.abs(car.speed) > 3) {
      ped.state = 'down';
      ped.downTimer = 4;
      G.police.addWanted(1);
      G.hud.toast('You hit a pedestrian! The Bay PD is on its way.');
      G.audio.thud();
    }
  }
  G.audio.setEngine(car.speed, true);
}
