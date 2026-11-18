// missions.js — Mara Voss's jobs for Rio: three story missions with steps,
// objective beacons, minimap targets, cash rewards and a story-complete ending.
import * as THREE from 'three';
import { saveGame } from './save.js';

export const SAFEHOUSE = { x: -104, z: -88 };
export const GARAGE = { x: 78, z: 130 };
export const PORT_PICKUP = { x: 178, z: -26 };
export const CLUB_NEON = { x: 104, z: 130 };

const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const playerPos = (G) => (G.player.inCar && G.player.car ? G.player.car.mesh.position : G.player.group.position);

export const MISSIONS = [
  {
    id: 'm1', name: 'FIRST WHEELS', reward: 500,
    intro: 'Mara Voss: "Rio. I need wheels, fast. Jack any parked car and bring it to my garage on Bayfront Blvd."',
    steps: [
      {
        text: 'Steal a car — any parked car will do (press E near one)',
        target: null,
        check: (G) => !!G.player.car,
      },
      {
        text: 'Drive the car to Mara\'s garage on Bayfront Blvd',
        target: GARAGE,
        check: (G) => {
          const p = playerPos(G);
          return !!G.player.car && dist2d(p.x, p.z, GARAGE.x, GARAGE.z) < 7;
        },
      },
    ],
  },
  {
    id: 'm2', name: 'BAYFRONT DROP', reward: 800,
    intro: 'Mara Voss: "Package is waiting at the port, east side. Grab it, drop it at Club Neon on the beachfront. Keep it quiet."',
    steps: [
      {
        text: 'Pick up the package at the port (east side)',
        target: PORT_PICKUP,
        check: (G) => {
          const p = playerPos(G);
          return dist2d(p.x, p.z, PORT_PICKUP.x, PORT_PICKUP.z) < 5;
        },
        onComplete: (G) => {
          G.police.setWanted(Math.max(G.wanted, 1));
          G.hud.toast('Package secured — but a dock worker spotted you. Heat is on!');
        },
      },
      {
        text: 'Deliver the package to Club Neon on the beachfront',
        target: CLUB_NEON,
        check: (G) => {
          const p = playerPos(G);
          return dist2d(p.x, p.z, CLUB_NEON.x, CLUB_NEON.z) < 6;
        },
      },
    ],
  },
  {
    id: 'm3', name: 'HEAT WAVE', reward: 1500,
    intro: 'Mara Voss: "The job went loud, Rio — three stars and every unit in the Bay is rolling. Lose them, then get to the safehouse. Don\'t get caught."',
    steps: [
      {
        text: 'Lose the heat — get your wanted level down to zero',
        target: null,
        onStart: (G) => G.police.setWanted(3),
        check: (G) => G.wanted === 0,
      },
      {
        text: 'Reach the safehouse in the north park',
        target: SAFEHOUSE,
        check: (G) => {
          const p = playerPos(G);
          return dist2d(p.x, p.z, SAFEHOUSE.x, SAFEHOUSE.z) < 6;
        },
      },
    ],
  },
];

export function initMissions(G) {
  // beacon: light pillar + floating marker + ground ring
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }),
  );
  marker.position.y = 7;
  beacon.add(marker);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  beacon.add(ring);
  beacon.visible = false;
  G.scene.add(beacon);

  G.mission = { index: 0, step: 0, storyDone: false, beacon, marker, started: false };
  G.missions = {
    current() {
      if (G.mission.storyDone || G.mission.index >= MISSIONS.length) return null;
      return MISSIONS[G.mission.index];
    },
    currentStep() {
      const m = G.missions.current();
      if (!m) return null;
      return m.steps[G.mission.step] || null;
    },
    target() {
      const s = G.missions.currentStep();
      return s ? s.target : null;
    },
    start(i, step = 0) {
      G.mission.index = i;
      G.mission.step = step;
      G.mission.started = true;
      const m = MISSIONS[i];
      if (!m) return;
      const s = m.steps[step];
      if (s && s.onStart) s.onStart(G);
      G.hud.toast(`${m.name} — ${m.intro}`, 6000);
      G.hud.updateMissionText();
    },
    restart() {
      const i = Math.min(G.mission.index, MISSIONS.length - 1);
      G.missions.start(i, 0);
      G.hud.toast('Mission restarted.');
    },
  };
  return G.mission;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  const mission = G.missions.current();
  const step = G.missions.currentStep();
  if (!mission || !step) {
    m.beacon.visible = false;
    return;
  }
  // beacon follows the current target
  if (step.target) {
    m.beacon.visible = true;
    m.beacon.position.set(step.target.x, 0, step.target.z);
    m.marker.position.y = 7 + Math.sin(G.time * 2.2) * 0.7;
    m.marker.rotation.y += dt * 1.5;
  } else {
    m.beacon.visible = false;
  }
  // step completion
  if (step.check(G)) {
    if (step.onComplete) step.onComplete(G);
    G.audio.jingle();
    if (G.mission.step + 1 < mission.steps.length) {
      G.mission.step += 1;
      const next = mission.steps[G.mission.step];
      if (next.onStart) next.onStart(G);
      G.hud.toast(`Objective done — ${next.text}`);
      G.hud.updateMissionText();
    } else {
      // mission complete
      G.cash += mission.reward;
      G.hud.toast(`${mission.name} COMPLETE — +$${mission.reward}`, 5000);
      saveGame(G);
      if (G.mission.index + 1 < MISSIONS.length) {
        G.missions.start(G.mission.index + 1, 0);
      } else {
        G.mission.storyDone = true;
        m.beacon.visible = false;
        G.main.storyComplete();
      }
    }
    G.hud.updateMissionText();
  }
}
