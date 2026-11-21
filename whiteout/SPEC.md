Build first-person survival horror "WHITEOUT": a lone technician at a snowbound polar research station at dusk, in a rising
blizzard, must restart three generators to power the radio beacon while something stalks her between the buildings, then
reach the beacon tower and call for extraction. Small in scope (one 120 × 100 m ice-shelf station, a 6-8 minute loop),
but it must look like a current AAA game in every screenshot.

PRIORITIES (in this order when they conflict)
1. Visual quality at the 6 hero poses, in random-yaw views and in motion
2. Stable frame pacing at the target
3. Gameplay that is complete (win, lose, restart) and feels good
4. Bundle size

CONSTRAINTS
- three.js 0.180.0, WebGL2, named imports only. Everything procedural: no texture, model or audio files, no base64 blobs.
  Fonts: system stack (no network).
- Deliverable: one self-contained dist/index.html < 2 MB, built by esbuild from src/ modules (build.mjs).
- Module contracts in src/contracts.js; every module exports create(G, ctx) + showcase(G) and has a stub in src/modules/_stub.js.
- Cookbook first: use src/cookbook files as-is before writing new rendering code (src/cookbook/CONTRACT.md).
- Harness hooks: ?shot ?cam ?q ?dt ?seed ?show ?post=0 ?dynres=0 #bench; window.__ready __frames __errors __stats __setCam __G.
- Pointer lock with drag fallback; gamepad; zero per-frame allocations in update/render hot paths.

TARGET
- MacBook Pro M1 Max, Chrome 142, 1920×1080, display 60 Hz.
- Bench (vsync off, dynres off, q=high, 1920×1080): avg ≤ 12.5 ms, p99 ≤ 20 ms, max ≤ 33 ms.
  Defaults at 2560×1440: dynres ≥ 0.8, no tier drop. Boot to first frame ≤ 10 s. Budgets: perf-budgets.md high
  (≤ 2.5 M tris, ≤ 450 calls, ≤ 6 real lights incl. the flashlight spot, 9 k snow flakes).

LOOK (ART.md = ART_DUSK_WHITEOUT, thesis T3 "overcast snow, research station", adapted to dusk + blizzard)
- Thesis: last dusk light bleeding through a full overcast, wind-driven snow, warmth only from windows, work lights and the
  beacon. Sun elev 7 / azim 255, (1.0,0.56,0.30) ×3.0. Fog σ (0.017,0.017,0.016), gusts push it to ×2.2.
  Grade agxMix 0.65, lookPower 1.18, sat 0.92, contrast 0.24, cool split-tone shadows, vignette 0.38, grain 0.035.
- Signature surface: snow accumulation on up-facing faces + drifts against walls, frost on windows and generator panels.
  Weather: snow 0.8, wind (6,0,2), gust cycle 18-30 s.
- Hero object: the diesel generator skid (3 instances, ≥ 30 k tris, 2.6 × 1.1 × 1.5 m) + the 28 m lattice beacon tower.
- Hero poses: 1 [44,5,17 → -48,3.5,-8] east ridge into the dusk glow, tower silhouette  2 [44,1.68,12 → 0,2.6,2] spawn at
  the vehicle-shed door  3 [11,1.45,-32.6 → 8,1.0,-34.3] generator A close-up, frost + rim light  4 [5.2,1.98,-9.4 → -5,1.5,-10.8]
  inside the lab by a failing fluorescent  5 [-13,1.68,3 → -23,1.3,9.5] the stalker in the flashlight beam, generator C sparking
  6 [-42,3,-2 → 10,2,6] reverse from the tower back to the lit station, away from the sun.
  Fly path: 48 s through 1→2→3→4(door)→5→6 at 2-6 m altitude.

SCENE CHECKLIST
- 4 prefab modules (hab 16×6 m, lab 14×6 m, mess 12×6 m, store 10×5 m) on skids: bevelled panels, orange paint, frosted
  lit windows (sodium 2700 K), stencilled names; lab has a full interior (benches, shelves, failing fluorescent).
- 3 generator lean-to sheds with one hero generator each (off/cranking/running: exhaust steam, panel lamp, sparks).
- Beacon tower 28 m lattice with 4 guy wires (≥ 1 px), radio hut at its base, red beacon that lights the snow when powered.
- Props: fuel tanks ×3, crates ×12 (3 variants), drums ×16, antenna masts ×4, cable runs, flag poles, a snowcat.
- Snow terrain: low drifts and sastrugi (±0.4 m) on the play area, drifts piled against every windward wall.
- Practical lights: 4 work lights on poles + window glow; pooled point lights + light-pool decals within the 6-light budget.
- Blizzard: 9 k falling flakes, ground-hugging blowing-snow sheets, gusts that drop visibility to ~35 m.
- Far field: 3 layers of ice ridges / nunataks at 300/650/1150 m in the same fog.
- Boundary: snow berm and ice pressure ridges on all four sides, crest 4-6 m, sinking into fog beyond.
- Signage: stencilled module names (HAB-1, LAB-2, MESS, STORE, GEN A/B/C), hazard placards, wind-distressed.

GAMEPLAY
- Verbs: walk/sprint/crouch, flashlight toggle (F, battery drains, spare cells in modules), interact (hold E 3 s to crank a
  generator; noisy), hide (crouch inside a module: the stalker cannot see you), call (hold E 5 s at the beacon console).
- Actors: 1 stalker (patrol between buildings, hearing: sprint/cranking/generator start; vision cone 25 m, 45 m when the
  flashlight is on; chase; holding the beam on it 1.5 s staggers it and makes it retreat 10 s), blizzard gusts.
- Objective loop: GEN A (north) → GEN B (south) → GEN C (west, any order) → beacon powers on → radio hut console call.
- Win: extraction call sent (5 s hold completes). Lose: the stalker reaches the player (≤ 1.3 m).
- UI: title (live fly along PATH, never a black frame), settings (tier, sensitivity, FOV, volume, invert Y, brightness),
  pause, HUD (objective, generators 0/3, battery bar, hold-progress ring, prompt, fear vignette), caught / extracted screens
  with time, restart.

VERIFICATION
- Visual critic per critic-rubric.md (6 hero poses + 2 random-yaw shots + showcases; G2 thresholds from references/quality-bar.json; mean 8.0 is only the stretch target).
- Performance: bench report + GPU timestamps if available. Gate G4.
- Gameplay: bot reaches win and lose, all verbs, restart, zero errors over 5 min; audio self-test peak ≤ -1 dBFS. Gate G3.
- Boot: 6 pose PNGs, __errors empty, renderer is not SwiftShader/llvmpipe, dist builds < 2 MB. Gate G1.

DONE WHEN gates G1-G4 pass in the same build, or the quick budget (2 critic rounds) is exhausted, in which case ship the
best snapshot with its residual defect list. Never ship a blocker. Deliver dist/index.html, its size, the perf report and the
critic's final review.
