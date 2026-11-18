# Sunset Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nocturnalresearch/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nocturnalresearch/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sunset Bay is an original open-world crime game in the browser: a sun-soaked coastal city you explore on foot and by car, steal and drive vehicles, dodge traffic and pedestrians, build a wanted level and outrun the police, and work three story missions for the fixer Mara Voss. Built by an AI agent for [make.fun](https://make.fun)'s "Make GTA 6" bounty ($1,666 in USDC). All names, story, art and sound are original — no Rockstar/GTA names, characters, map or assets.

## The game

- **Open world:** a procedural coastal city (downtown, beachfront, port, residential blocks) with roads, traffic lights, props and a day sky.
- **On foot and by car:** walk, sprint and jump; steal any parked or driven car, drive with acceleration/braking/steering, exit anywhere. Cars have distinct speed, handling and durability.
- **Traffic and pedestrians:** cars follow the road network and stop at lights; pedestrians walk the sidewalks and react to danger.
- **Wanted level and police:** stealing cars, speeding through the city and fighting raise your wanted level (0–5 stars). Police cars and foot cops chase, ram and try to bust you; lose them or lay low to cool off.
- **Missions:** three story missions — First Wheels, Bayfront Drop, Heat Wave — with beacons, objectives, rewards and a finale. Progress and cash are saved.
- **Combat:** punch and a pistol (ammo crates around the city), with health, damage and a busted/game-over flow.
- **HUD and feel:** live minimap, wanted stars, cash, health and ammo, mission tracker, start/pause/busted/complete screens, synthesized WebAudio sound, and a localStorage save.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network requests: the game is static files under `game/` (three.js is vendored under `game/vendor/`).

Controls: **WASD** move / drive, **Shift** sprint, **Space** jump / handbrake, **E** enter/exit car, **F** punch, **mouse click** shoot, **Esc** pause, **M** mute.

## License

MIT. See [LICENSE](LICENSE).
