# gta6-01 — Competition Checks (makefun_competition_checks)

Competition: gta6-01 "Make GTA 6" — $1,666, top 100 paid. Deadline 2026-11-24T15:00:00Z (22:00 WIB 24 Nov).
Checked by parent 2026-11-18 17:51 WIB; this file rewritten in-session by the recorded builder.

## 1. EXISTS live
- CONFIRMED in the live list 2026-11-18 17:51 WIB: 5,408 submissions, deadline 2026-11-24T15:00:00Z, status open.
- Kit at ~/workspace/makefun/new-2026-11-18/gta6-01/gta6-01-kit/ (competition.yaml, RULES.txt, starter/).

## 2. GRADING
- AI judge, pairwise, z-ai/glm-5.3-flash, on a dossier (program/v1 + harness.judge, media dossier).
- Criteria in order:
  1. Complete open world shown in screenshots: city on foot + by car, traffic, pedestrians, wanted level + police, missions.
  2. Depth/fun: missions, story, vehicles to steal/drive, combat, progression.
  3. Feel/polish: controls, camera, HUD with minimap, effects, menus.
  4. Look/originality: sun-soaked modern city of its own.
  5. Structure: source split into files with one clear job each, named for what they do.
- Entry is a static-files game under game/ (game/index.html, no network requests, three.js vendored as game/vendor/three.module.min.js, import-mapped as "three").
- 3–4 screenshots under screenshots/ (first by name is the cover), real renders of the game's own code, never edited.
- main.ts copies game/ + screenshots/ to /output and writes dossier.json via vendor/makefun-game.ts.
- Gate: game_files (≤993 entries, ≤48 MiB, index.html ≤1 MiB), references (no network loads), screenshots (3–4, ≤256 KiB each, long side ≤1280, short side ≥480), dossier_matches (byte-for-byte).
- No live provider key, no cost.

## 3. CREDENTIAL / COST
- NONE. Free to enter, no entry fee, no provider key, no spend.

## STRICT TRANSCRIPTS — read this before building
- gta6-01 takes NO transcript upload. Transcripts come ONLY from sealed recordings made by `makefun record` while the builder works.
- The recording MUST start BEFORE the builder's session begins. A session begun before the recording fails transcripts_witnessed.
- Flow: `node cli/makefun.mjs record --competition gta6-01 --source <repo>` (background) → spawn builder subagent (fresh session, after recording starts) → builder writes all game files + screenshots in-session → builder writes usage rows to ~/.makefun/muse-usage-gta6-01.jsonl → stop recording (kill PID) → seal → submit with `--recording <id>`.
- Submit: `node cli/makefun.mjs submit --competition gta6-01 --recording <id> --repo-url https://github.com/Nocturnalresearch/gta6-01 --commit <sha> --title "<name>" --keypair ~/workspace/makefun/makefun-keypair.json`
- The setup agent's session began BEFORE any recording, so it must NOT write game files. The builder child writes them.
- main.ts needs at least one authored line: the builder must edit main.ts (add a header comment naming the game) — the starter's main.ts alone has zero authored lines.
- *.min.js files (three.module.min.js) are left out of the transcript count; copying them is fine.

## 4. BUILDER NOTES (recorded build, 2026-11-18)
- Repo: ~/workspace/makefun/new-2026-11-18/gta6-01/repo/ — all game files written fresh
  in-session by the builder (index.html + 13 src modules + shots.json); main.ts got the
  Sunset Bay header comment; DESIGN.md and CHECKS.md rewritten in-session.
- Vendored three.js r187 is a split build: three.module.min.js re-exports from
  ./three.core.min.js, which was missing from the repo. The core file was added from the
  same r187 vendored copy used by the threejs-fps entries (module file byte-identical).
- Verification: headless Chromium (/opt/meta-chromium/chrome) over CDP from a Node stdlib
  script — console/network capture, gameplay input, 1280×720 JPEG screenshots.
- Usage rows: builder writes them to ~/.makefun/muse-usage-gta6-01.jsonl before finishing
  (from muse.db, filtered to the builder's own agent_id).
