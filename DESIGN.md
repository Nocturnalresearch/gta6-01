# SUNSET BAY — Open-World Crime Game (gta6-01)

An original open-world crime game in the spirit of GTA 6. Everything is our own: city, characters,
vehicles, names, story, art, sound. NO Rockstar/GTA names, logos, characters, maps or assets.

## Setting & story
- **City:** Sunset Bay — a fictional sun-soaked coastal city (grid of avenues + streets, beachfront
  boulevard, downtown towers, residential blocks, a port district, parks).
- **Player:** "Rio" — a newcomer driver trying to make a name in Sunset Bay.
- **Fixer:** "Mara Voss" — a crew fixer who calls Rio with jobs by phone/message.
- **Story arc (3 missions):**
  1. "First Wheels" — Mara needs a car. Steal any parked car and drive it to the marked garage.
  2. "Bayfront Drop" — pick up a package at the port, deliver it to the beachfront club while
     avoiding (or outrunning) police attention.
  3. "Heat Wave" — a job goes loud; lose a 3-star wanted level by escaping police, then reach the
     safehouse to finish. Completing all three = "Sunset Bay Legend" (story complete).

## Core systems (all must work and be visible in screenshots)
1. **On foot:** third-person character (simple stylized figure), WASD move, mouse orbit camera,
   Shift run, Space jump. Walks on sidewalks/roads, collides with buildings.
2. **Cars (steal + drive):** parked cars + traffic cars. Press E near a car to enter (stealing a
   parked car raises wanted by 1 star briefly; taking a traffic car also alerts its driver).
   Driving: W/S accelerate/brake/reverse, A/D steer, Space handbrake, camera follows behind car.
   E exits the car. Cars have distinct colors/models (sedan, taxi, van, sports).
3. **Traffic:** AI cars drive along roads, stop at intersections, avoid collisions simply.
   Keep ~10-14 traffic cars circulating.
4. **Pedestrians:** ~20 walkers on sidewalks, wandering, simple avoidance. They flee when the
   player drives fast nearby or when shots/police are near (simple: they run away from the player
   when the player is in a car moving fast or wanted > 0).
5. **Wanted level (0–5 stars):** rises when the player steals a car, hits pedestrians/cars,
   or attacks. Decays over time when the player stays out of police sight. At 1–2 stars, 1–2
   police cars chase; at 3+ stars, more police cars + foot police. Police ram/chase the player;
   getting caught (police touch the player while on foot, or box the car in) = "Busted" (lose
   some cash, wanted resets, respawn at safehouse). Escaping police sight for a while lowers stars.
6. **Missions:** mission list + active objective marker (3D beacon + minimap blip + HUD text).
   Missions advance by reaching markers / collecting pickups / escaping. Completing a mission
   pays cash and unlocks the next. Mission state saved.
7. **Combat:** simple melee (F to punch/shove) and a basic pistol (mouse click to shoot when
   armed; limited ammo, pickups give ammo). Shooting raises wanted. Keep combat simple and
   readable — it is a secondary system, not the focus. Police can be evaded, not necessarily
   fought.
8. **HUD + minimap:** top-left wanted stars; top-right cash + mission objective; bottom-left
   minimap (canvas, ~180px) showing roads, player arrow, cars (dots), police (flashing dots),
   mission marker (star). Bottom-center context prompt ("Press E to enter car"). Health bar.
   Start screen (title, story intro, controls, Start button) and pause (Esc). Game-over /
   Busted screen with retry.
9. **Save:** localStorage — cash, missions completed, current mission, player position, best
   wanted level. "Continue" on the start screen when a save exists.
10. **Sound:** WebAudio synthesized only (no audio files): engine hum (pitch with speed),
    siren (two-tone when police chase), pickup blip, mission-complete jingle, punch thud.
    Mute toggle (M).

## Controls (show on start screen + HUD help)
- WASD move / drive, Mouse orbit camera, Shift run, Space jump / handbrake (in car),
  E enter/exit car, F punch, Left-click shoot (when armed), M mute, Esc pause, R restart mission.

## Tech & file layout (one clear job per file; names are what the judge's outline shows)
- `game/index.html` — page, import map ("three" → ./vendor/three.module.min.js), HUD DOM, canvas.
- `game/vendor/three.module.min.js` — vendored three.js (already in place, do NOT rewrite).
- `game/src/main.js` — bootstrap + game loop + state machine (title/play/pause/busted).
- `game/src/city.js` — procedural city: roads, sidewalks, buildings, beach, port, props.
- `game/src/player.js` — on-foot character, movement, camera.
- `game/src/vehicles.js` — car definitions, driving physics, enter/exit/steal.
- `game/src/traffic.js` — traffic AI + pedestrians.
- `game/src/police.js` — wanted level + police AI + busted/escape.
- `game/src/missions.js` — mission definitions, story, objectives, rewards.
- `game/src/combat.js` — punch + pistol + ammo pickups.
- `game/src/hud.js` — HUD DOM + minimap canvas + prompts + menus.
- `game/src/audio.js` — WebAudio synth (engine, siren, blips, jingle).
- `game/src/save.js` — localStorage save/load.
- `game/src/input.js` — keyboard + mouse input.
- `game/src/shots.js` — screenshot staging: `?shot=cover|drive|chase|mission` sets up the world
  (player position, car, wanted level, police, mission) deterministically with a fixed seed so
  each screenshot is a real render of the game's own code. Read the starter kit's
  game/src/shots.js for the pattern (it plays the real rules forward from a fresh world).
- `main.ts` — the starter's plumbing (already in place). EDIT it to add at least one authored
  line (a header comment naming Sunset Bay) — the starter alone has zero authored lines and
  the transcript gate requires ≥1 authored line in main.ts.
- `shots.json` — list the 4 screenshots with their `?shot=` queries.

## Screenshots (4, 1280×720 JPEG, each ≤256 KiB, first by name is the cover)
1. `1-cover.jpg` (`?shot=cover`) — player on foot in the city, HUD + minimap + mission text visible.
2. `2-driving.jpg` (`?shot=drive`) — driving a car down a boulevard, traffic + city visible.
3. `3-chase.jpg` (`?shot=chase`) — police chase: wanted stars (3), police cars behind, minimap + mission HUD.
4. `4-mission.jpg` (`?shot=mission`) — mission in progress: objective beacon + marker, package pickup.

## Verification (must all pass before you finish)
- Serve game/ with `node serve.ts` (port 8080) and open in headless Chrome (CDP).
- 0 console errors, 0 failed network requests. Game loads, reaches title, starts, plays.
- Take the 4 screenshots via the `?shot=` URLs at 1280×720; confirm each ≤256 KiB.
- Run `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`, then the kit check:
  `node cli/makefun.mjs check --kit . --repo <repo> --transcripts <bundle> --worktree`
  (Note: for this strict-transcripts competition the check's transcript input is the sealed
  recording, not a bundle — run the check after the recording is sealed, or use --worktree
  and confirm the game/dossier gates pass; the transcript gate is checked at submission.)
- Keep game/ under 48 MiB and index.html under 1 MiB. No network requests anywhere.

## Priorities (a complete, working game beats an ambitious broken one)
1. City + on-foot + car driving + HUD/minimap working with 0 errors.
2. Traffic + pedestrians + wanted/police working.
3. 3 missions with story + combat + save + sound.
4. Screenshots staged and polished.
Cut scope (not quality) if time is short: reduce mission count to 2, reduce pedestrian count,
simplify combat to punch-only. Never ship a broken build.
