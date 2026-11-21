// city.js — Sunset Bay, built entirely in code.
// A grid of avenues and streets, a beachfront boulevard, a container port
// on the east edge and the ocean to the south. Everything is generated from
// a seeded RNG, so the city is identical on every load: same buildings in
// the same places, same palms, same lamps. Facades and the ground map are
// painted on canvases — no textures or models are fetched anywhere.

import * as THREE from 'three';

// The city plan. Streets are the grid lines; everything else (parks,
// beach, port, spawn points) is measured from them, so missions, traffic
// and screenshots all agree on where things are.
export const CITY = {
  streets: [-130, -78, -26, 26, 78, 130],
  roadHalf: 6,
  sidewalkHalf: 10,
  bounds: 205,
  beachZ: 156, // sand begins here (south edge)
  oceanZ: 196, // water begins here
  portX: 156, // container port begins here (east edge)
  gridMin: -156,
  gridMax: 156,
};

// Deterministic RNG (mulberry32). One seed drives the city, the traffic
// and the screenshots, so a staged screenshot is the same frame every time.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- canvas-painted textures ----

// A building facade: a flat base colour, a soft vertical shade, and a grid
// of windows, a share of them lit warm.
function paintFacade(baseColour, litShare, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColour;
  g.fillRect(0, 0, 128, 256);
  const shade = g.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.25)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  shade.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rng() < litShare;
      g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#2c3542' : '#1d2733');
      g.fillRect(10 + col * 19, 12 + row * 20, 13, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// The ground map: one 2048px canvas that paints the whole city at once —
// block ground, parks, port concrete, beach sand, sidewalks, asphalt,
// lane dashes and crosswalks. World coords map to pixels through px().
function paintGround(parks) {
  const SIZE = 2048;
  const WORLD = 420;
  const px = (v) => ((v + WORLD / 2) / WORLD) * SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext('2d');

  g.fillStyle = '#7e8570'; // block ground
  g.fillRect(0, 0, SIZE, SIZE);
  for (const p of parks) {
    g.fillStyle = '#5f9150';
    g.fillRect(px(p.x0), px(p.z0), px(p.x1) - px(p.x0), px(p.z1) - px(p.z0));
  }
  g.fillStyle = '#8f8f88'; // port concrete (east)
  g.fillRect(px(CITY.portX), px(CITY.gridMin), px(CITY.bounds) - px(CITY.portX), px(CITY.gridMax) - px(CITY.gridMin));
  g.fillStyle = '#e3c48d'; // beach sand (south)
  g.fillRect(px(-CITY.bounds), px(CITY.beachZ), SIZE, px(CITY.bounds) - px(CITY.beachZ));
  g.fillStyle = '#d9b878';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.arc(px(-200 + i * 10 + Math.sin(i * 2.7) * 4), px(168 + Math.sin(i * 1.3) * 6), 5 + (i % 3) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Sidewalks: a pale band around every road.
  g.fillStyle = '#b3ac9c';
  for (const s of CITY.streets) {
    g.fillRect(px(s - 10), px(CITY.gridMin), px(s + 10) - px(s - 10), px(CITY.gridMax) - px(CITY.gridMin));
    g.fillRect(px(CITY.gridMin), px(s - 10), px(CITY.gridMax) - px(CITY.gridMin), px(s + 10) - px(s - 10));
  }
  // Asphalt.
  g.fillStyle = '#35353c';
  for (const s of CITY.streets) {
    g.fillRect(px(s - 6), px(CITY.gridMin), px(s + 6) - px(s - 6), px(CITY.gridMax) - px(CITY.gridMin));
    g.fillRect(px(CITY.gridMin), px(s - 6), px(CITY.gridMax) - px(CITY.gridMin), px(s + 6) - px(s - 6));
  }
  // The beachfront boulevard gets warmer asphalt.
  g.fillStyle = '#3d3630';
  g.fillRect(px(CITY.gridMin), px(130 - 6), px(CITY.gridMax) - px(CITY.gridMin), px(130 + 6) - px(130 - 6));
  // Centre dashes.
  g.strokeStyle = '#d8b13a';
  g.lineWidth = 3;
  g.setLineDash([26, 30]);
  for (const s of CITY.streets) {
    g.beginPath(); g.moveTo(px(s), px(CITY.gridMin)); g.lineTo(px(s), px(CITY.gridMax)); g.stroke();
    g.beginPath(); g.moveTo(px(CITY.gridMin), px(s)); g.lineTo(px(CITY.gridMax), px(s)); g.stroke();
  }
  g.setLineDash([]);
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(240,240,235,0.85)';
  for (const sx of CITY.streets) {
    for (const sz of CITY.streets) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(px(sx + i * 2.2 - 0.8), px(sz - 10), 1.6 * (SIZE / WORLD), 4 * (SIZE / WORLD));
        g.fillRect(px(sx - 10), px(sz + i * 2.2 - 0.8), 4 * (SIZE / WORLD), 1.6 * (SIZE / WORLD));
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---- the build ----

export function buildCity(scene, rng) {
  const colliders = [];
  const buildings = [];
  const addBox = (x0, z0, x1, z1) => colliders.push({ x0, z0, x1, z1 });

  const parks = [
    { x0: -116, z0: -116, x1: -84, z1: -84 },
    { x0: 84, z0: 36, x1: 116, z1: 68 },
  ];

  // Ground plane with the painted map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ map: paintGround(parks) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Ocean to the south, with a foam line where it meets the sand.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 260),
    new THREE.MeshLambertMaterial({ color: 0x2b7ba6, transparent: true, opacity: 0.96 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, 196 + 130);
  scene.add(ocean);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 3),
    new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.7 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.08, 196);
  scene.add(foam);

  // Buildings: one or more boxes per block. Downtown (near the centre) gets
  // a single tall tower per block; further out, blocks split into 2 or 4
  // lower buildings. Parks stay empty.
  const facades = [
    paintFacade('#a5664f', 0.35, rng),
    paintFacade('#5d7a96', 0.45, rng),
    paintFacade('#8f8578', 0.3, rng),
    paintFacade('#b59a6a', 0.35, rng),
  ];
  const inPark = (bx, bz) => parks.some((p) => bx >= p.x0 - 16 && bx <= p.x1 + 16 && bz >= p.z0 - 16 && bz <= p.z1 + 16);
  const st = CITY.streets;
  for (let ix = 0; ix < st.length - 1; ix++) {
    for (let iz = 0; iz < st.length - 1; iz++) {
      const x0 = st[ix] + CITY.sidewalkHalf;
      const x1 = st[ix + 1] - CITY.sidewalkHalf;
      const z0 = st[iz] + CITY.sidewalkHalf;
      const z1 = st[iz + 1] - CITY.sidewalkHalf;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (inPark(cx, cz)) continue;
      const downtown = Math.abs(cx) < 65 && Math.abs(cz) < 65;
      const count = downtown ? 1 : (rng() < 0.45 ? 2 : 4);
      for (let b = 0; b < count; b++) {
        let w, d, bx, bz;
        if (count === 1) {
          w = 26; d = 26; bx = cx; bz = cz;
        } else if (count === 2) {
          w = 13; d = 26; bx = cx + (b === 0 ? -8 : 8); bz = cz;
        } else {
          w = 13; d = 13; bx = cx + (b % 2 === 0 ? -8 : 8); bz = cz + (b < 2 ? -8 : 8);
        }
        const h = downtown
          ? 22 + rng() * 48
          : (Math.abs(cx) < 110 && Math.abs(cz) < 110 ? 9 + rng() * 14 : 6 + rng() * 8);
        const tex = facades[Math.floor(rng() * facades.length)].clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 14)));
        const side = new THREE.MeshLambertMaterial({ map: tex });
        const roof = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.08, 0.25, 0.22 + rng() * 0.12),
        });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [side, side, roof, roof, side, side],
        );
        mesh.position.set(bx, h / 2, bz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        buildings.push({ x: bx, z: bz, w, d, h });
        addBox(bx - w / 2, bz - d / 2, bx + w / 2, bz + d / 2);
        // Rooftop AC box on some towers.
        if (h > 26 && rng() < 0.6) {
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(4, 2, 4),
            new THREE.MeshLambertMaterial({ color: 0x6a6a62 }),
          );
          ac.position.set(bx + w / 4, h + 1, bz);
          ac.castShadow = true;
          scene.add(ac);
        }
      }
    }
  }

  // Port: stacked containers and two gantry cranes on the east edge.
  const containerColours = [0xb8442e, 0x2e6db8, 0x3f8f4f, 0xc2a13a, 0x7a4a9e];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 168 + col * 7.5;
      const z = -120 + row * 26 + (col % 2) * 4;
      const stack = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < stack; s++) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(6, 2.6, 2.6),
          new THREE.MeshLambertMaterial({ color: containerColours[Math.floor(rng() * containerColours.length)] }),
        );
        box.position.set(x, 1.3 + s * 2.6, z);
        box.castShadow = true;
        scene.add(box);
      }
      addBox(x - 3.2, z - 1.6, x + 3.2, z + 1.6);
    }
  }
  for (const cz of [-60, 60]) {
    const crane = new THREE.Group();
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a13a });
    const legGeo = new THREE.BoxGeometry(1.2, 26, 1.2);
    for (const [lx, lz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) {
      const leg = new THREE.Mesh(legGeo, craneMat);
      leg.position.set(lx, 13, lz);
      leg.castShadow = true;
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 1.6, 2), craneMat);
    beam.position.set(0, 26, 0);
    beam.castShadow = true;
    crane.add(beam);
    crane.position.set(176, 0, cz);
    scene.add(crane);
    addBox(168, cz - 5, 184, cz + 5);
  }

  // Palms: a trunk plus six tilted cone leaves, along the beachfront and
  // scattered through the parks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const plantPalm = (x, z, scale = 1) => {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 6 * scale, 6), trunkMat);
    trunk.position.y = 3 * scale;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 3.2 * scale, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.3 * scale, 6.4 * scale, Math.sin(a) * 1.3 * scale);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      leaf.castShadow = true;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    scene.add(palm);
  };
  for (let x = -150; x <= 150; x += 18) {
    plantPalm(x + 3, 146, 1.1);
    plantPalm(x - 5, 164, 0.9);
  }
  for (const p of parks) {
    for (let i = 0; i < 6; i++) {
      plantPalm(
        p.x0 + 4 + rng() * (p.x1 - p.x0 - 8),
        p.z0 + 4 + rng() * (p.z1 - p.z0 - 8),
        0.8 + rng() * 0.4,
      );
    }
  }

  // Street lamps: a pole and a warm glowing head, at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e2e34 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  for (const s of CITY.streets) {
    for (let v = -140; v <= 140; v += 52) {
      for (const [lx, lz] of [[s + 8.5, v], [s - 8.5, v + 26]]) {
        if (Math.abs(lx) > 152 || Math.abs(lz) > 152) continue;
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), poleMat);
        pole.position.y = 3.25;
        pole.castShadow = true;
        lamp.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), headMat);
        head.position.y = 6.6;
        lamp.add(head);
        lamp.position.set(lx, 0, lz);
        scene.add(lamp);
      }
    }
  }

  // Billboards along the beachfront, painted on canvas.
  const makeBillboard = (text, sub, x, z, ry) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#160a18';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#ff8a2a';
    g.lineWidth = 8;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = '#ffd34d';
    g.font = '900 64px Arial';
    g.textAlign = 'center';
    g.fillText(text, 256, 120);
    g.fillStyle = '#ff9ecf';
    g.font = '700 34px Arial';
    g.fillText(sub, 256, 180);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    board.position.set(x, 9, z);
    board.rotation.y = ry;
    scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), poleMat);
    post.position.set(x, 2.5, z);
    scene.add(post);
    addBox(x - 0.8, z - 0.8, x + 0.8, z + 0.8);
  };
  makeBillboard('SUNSET BAY', '★ BAYFRONT BLVD ★', -40, 148, 0);
  makeBillboard('CLUB NEON', 'BEACHFRONT • ALL NIGHT', 60, 148, 0);

  // Sunset sky: a low sun disc and a few flat clouds that never fog out.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
  );
  sunDisc.position.set(-260, 52, -160);
  sunDisc.lookAt(0, 18, 0);
  scene.add(sunDisc);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffe3c8, transparent: true, opacity: 0.9, fog: false });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(14 + rng() * 16, 10, 8), cloudMat);
    cloud.scale.y = 0.32;
    cloud.position.set(-260 + rng() * 520, 78 + rng() * 42, -240 + rng() * 380);
    scene.add(cloud);
  }

  return { colliders, buildings, parks, ocean };
}

// ---- collision + spawn helpers ----

// Push a circle (pos.x/z, radius r) out of every building/port collider and
// clamp it inside the walkable world. True when anything pushed.
export function collideCircle(city, pos, r) {
  let hit = false;
  for (const c of city.colliders) {
    const cx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const cz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: leave along the shallowest side.
        const pl = pos.x - c.x0, pr = c.x1 - pos.x;
        const pt = pos.z - c.z0, pb = c.z1 - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.x0 - r;
        else if (m === pr) pos.x = c.x1 + r;
        else if (m === pt) pos.z = c.z0 - r;
        else pos.z = c.z1 + r;
      }
      hit = true;
    }
  }
  if (pos.x < -CITY.bounds) { pos.x = -CITY.bounds; hit = true; }
  if (pos.x > CITY.bounds) { pos.x = CITY.bounds; hit = true; }
  if (pos.z < -CITY.bounds) { pos.z = -CITY.bounds; hit = true; }
  if (pos.z > CITY.oceanZ - 2) { pos.z = CITY.oceanZ - 2; hit = true; }
  return hit;
}

export function isOnRoad(x, z) {
  for (const s of CITY.streets) {
    if (Math.abs(x - s) < CITY.roadHalf || Math.abs(z - s) < CITY.roadHalf) return true;
  }
  return false;
}

// A random point on a road lane, for spawning traffic and police.
export function randomRoadPoint(rng) {
  const s = CITY.streets[Math.floor(rng() * CITY.streets.length)];
  const lane = rng() < 0.5 ? -3 : 3;
  if (rng() < 0.5) return { x: -140 + rng() * 280, z: s + lane };
  return { x: s + lane, z: -140 + rng() * 280 };
}

// A random point on a sidewalk, for pedestrians.
export function randomSidewalkPoint(rng) {
  const s = CITY.streets[Math.floor(rng() * CITY.streets.length)];
  const off = rng() < 0.5 ? -8.5 : 8.5;
  if (rng() < 0.5) return { x: -140 + rng() * 280, z: s + off };
  return { x: s + off, z: -140 + rng() * 280 };
}
