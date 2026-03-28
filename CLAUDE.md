# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

No build step. Serve the project over HTTP (ES modules require it — `file://` won't work):

```bash
python -m http.server 3000
```

Then open http://localhost:3000.

## Revision tracking

Every change that affects the shipped app requires two things:
1. Bump `REVISION` in `app.js`
2. Add a row to the Dev Revisions table in `ref/maze_daily_game_spec.md`

Also update the `?v=N` cache-busting query strings in:
- `index.html` — the `<link rel="stylesheet">` and `<script>` tags
- `app.js` — all four `import` statements at the top

All version numbers must stay in sync with `REVISION`.

## Architecture

Single-page app with no framework or build tooling. Five ES modules loaded via `app.js`.

**Data flow:** `maze.js` generates mazes → `game.js` owns all state and movement validation → `app.js` drives the game loop and calls `render.js` each frame → `input.js` fires move callbacks into `game.js`.

**`maze.js`** — Deterministic maze generation. Daily seed is `YYYY-MM-DD` → hashed to a number → mulberry32 PRNG. Generates 6 mazes using Wilson's algorithm (uniform spanning tree). Each maze runs a BFS quality filter (shortest path ≥ 2× grid size) and retries up to 10× with an offset seed. Start/end are chosen from one of 4 diagonal corner pairs via RNG.

**`game.js`** — All mutable game state lives here (`playerPos`, `trail`, `mazeIndex`, timer). Exposes `tryMove(dir)` and `tryMoveToCell(x, y)`. Fires callbacks: `onStateChange`, `onMazeComplete`, `onRunComplete`.

**`render.js`** — Stateless canvas drawing functions. Called every rAF frame by `app.js`. Trail uses a heatmap fade (old = dim, recent = bright). End node is a 5-pointed star.

**`app.js`** — Orchestrates everything. Runs a `requestAnimationFrame` game loop. Smooth movement uses a tween queue (`tweenFrom`, `tweenTo`, `tweenElapsed`) with easeInOut at 65ms/cell — this matches the hold-repeat interval in `input.js` so held keys produce a continuous glide.

**`input.js`** — First keypress moves one cell; holding for 120ms starts repeating every 65ms.

**`storage.js`** — Saves the completed run (splits, totalMs, trails) to localStorage keyed by daily seed. Used to enforce one run per day and power the "View Results" button on return visits.

## Key constraints

- One run per day. After completing, the run is saved to localStorage and the Start button becomes "View Results".
- No server — everything is client-side. The daily seed comes from `new Date()`, so players can technically change their clock. Server-side canonical date is a noted future improvement.
- The `ref/maze_daily_game_spec.md` is the design reference. Consult it before adding features.
