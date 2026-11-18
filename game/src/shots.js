// shots.js — screenshot staging for Sunset Bay (?shot=cover|drive|chase|mission).
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by scripted input, so every screenshot is a real
// render of the game's own code and the same seed always gives the same frame.
import * as THREE from 'three';
import { mulberry32 } from './city.js';
import { createCar } from './vehicles.js';

function resetForShot(G) {
  G.rng = mulberry32(1337);
  G.wanted = 0;
  G.bestWanted = 0;
  G.cash = 1250;
  G.ammo = 12;
  G.time = 0;
  G.shotCam = null;
  // clear police units
  for (const car of [...G.cars]) {
    if (car.kind === 'police') {
      G.scene.remove(car.mesh);
      G.cars.splice(G.cars.indexOf(car), 1);
    }
  }
  for (const cop of G.police.footCops) G.scene.remove(cop.group);
  G.police.footCops.length = 0;
  G.police.bustedTimer = 0;
  G.police.escapeTimer = 0;
  // player back on foot at the beachfront spawn
  const p = G.player;
  if (p.inCar && p.car) { p.car.kind = 'parked'; p.car.speed = 0; }
  p.inCar = false;
  p.car = null;
  p.group.visible = true;
  p.health = 100;
  p.group.position.set(0, 0, 104);
  p.heading = Math.PI;
  p.camYaw = 0;
  p.speed = 0;
  // fresh story state
  G.mission.index = 0;
  G.mission.step = 0;
  G.mission.storyDone = false;
  G.mission.beacon.visible = false;
  G.state = 'play';
  G.hud.hideOverlays();
  G.hud.updateMissionText();
}

// Run the real game loop forward for `seconds` with `keys` held down.
function simulate(G, seconds, keys = {}) {
  const input = G.input;
  const origDown = input.down.bind(input);
  input.down = (code) => !!keys[code] || origDown(code);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) G.stepWorld(1 / 60);
  input.down = origDown;
}

// Move traffic cars out of a corridor so a staged drive has a clear lane.
function clearCorridor(G, x0, x1, z0, z1) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const pos = car.mesh.position;
    if (pos.x > x0 && pos.x < x1 && pos.z > z0 && pos.z < z1) {
      pos.x = -130 + G.rng() * 60;
      pos.z = -130 + G.rng() * 60;
      car.speed = 0;
    }
  }
}

// Put the player in a car without the steal penalty (staging, not play).
function stageEnterCar(G, car) {
  const p = G.player;
  car.kind = 'player';
  p.car = car;
  p.inCar = true;
  p.group.visible = false;
  p.camYaw = car.heading + Math.PI;
}

function findSportsCar(G) {
  return G.cars.find((c) => c.type === 'sports' && c.kind === 'parked');
}

// Lock the camera in a chase framing behind the player's car.
// `side` shifts the camera to the flank so a chase also shows the police
// units tailing the player.
function lockChaseCam(G, side = 0, back = 10, height = 4.4, lookAhead = 7) {
  const car = G.player.car;
  const pos = car.mesh.position;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
  G.shotCam = {
    pos: new THREE.Vector3(pos.x - fx * back + rx * side, height, pos.z - fz * back + rz * side),
    look: new THREE.Vector3(pos.x + fx * lookAhead, 1.6, pos.z + fz * lookAhead),
  };
}

export function stageShot(name, G) {
  resetForShot(G);
  const p = G.player;

  if (name === 'drive' || name === 'chase') {
    const car = findSportsCar(G);
    car.mesh.position.set(name === 'drive' ? -60 : -70, 0, 130);
    car.heading = Math.PI / 2; // east, down Bayfront Blvd
    car.mesh.rotation.y = car.heading;
    car.speed = 0;
    clearCorridor(G, -70, 90, 124, 136);
    stageEnterCar(G, car);
    if (name === 'chase') {
      G.police.setWanted(3);
      // two units right on the player's tail; the third spawns via the AI
      for (const bx of [-86, -98]) {
        const pc = createCar(G.scene, 'police', 0x14161c, bx, 130, Math.PI / 2, 'police');
        pc.cruise = 30;
        G.cars.push(pc);
      }
      simulate(G, 2.5, { KeyW: true });
      // pull the pursuit into the frame: two units tucked in behind the
      // player's car on the far side of the lane, lights flashing
      const pcars = G.cars.filter((c) => c.kind === 'police');
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
      pcars.forEach((pc, i) => {
        const back = 7 + i * 5;
        pc.mesh.position.set(
          car.mesh.position.x - fx * back - rx * 1.5,
          0,
          car.mesh.position.z - fz * back - rz * 1.5,
        );
        pc.heading = car.heading;
        pc.mesh.rotation.y = pc.heading;
        pc.speed = car.speed;
      });
      // high rear camera: both police units stack up behind the player car
      lockChaseCam(G, 0, 14, 6, 5);
    } else {
      simulate(G, 3, { KeyW: true });
      lockChaseCam(G);
    }
    return;
  }

  if (name === 'mission') {
    G.missions.start(1, 0); // Bayfront Drop: pick up at the port
    p.group.position.set(160, 0, -8);
    p.heading = (Math.PI * 3) / 4; // facing the port pickup
    p.camYaw = p.heading + Math.PI;
    p.group.rotation.y = p.heading;
    simulate(G, 1.2);
    // frame the player with the beacon, the container stacks and the crane
    G.shotCam = {
      pos: new THREE.Vector3(152, 3.6, 2),
      look: new THREE.Vector3(174, 2.5, -24),
    };
    return;
  }

  // cover (default): Rio on foot on Bayfront Blvd, looking east down the
  // boulevard — palms, beach and ocean on the right, downtown on the left,
  // a parked sports car just ahead of him.
  const sports = findSportsCar(G);
  if (sports) {
    sports.mesh.position.set(-24, 0, 138.2);
    sports.heading = Math.PI / 2;
    sports.mesh.rotation.y = sports.heading;
  }
  p.group.position.set(-40, 0, 130);
  p.heading = Math.PI / 2; // facing east, down the boulevard
  p.camYaw = p.heading + Math.PI;
  p.group.rotation.y = p.heading;
  simulate(G, 1.5);
  G.shotCam = {
    pos: new THREE.Vector3(-49, 3.8, 130),
    look: new THREE.Vector3(0, 2.5, 130),
  };
}
