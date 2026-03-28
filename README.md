# Tracer

A daily browser-based maze speed challenge. Complete six mazes back-to-back as fast as possible, leaving a colored trail through each one.

## How to play

Open `index.html` in a browser (served locally or via any static host — no build step required).

Each day generates a new set of six mazes seeded from the current date. Everyone gets the same mazes.

**Controls:** Arrow keys, WASD, or click and drag on the maze.

## Rules

- Complete all six mazes in sequence
- Timer runs continuously across all mazes
- Reach the goal node (large circle, bottom-right) to finish each maze
- Your path trail is recorded and shown in the recap at the end

## Stack

Vanilla HTML + CSS + JavaScript. Canvas API for rendering. No dependencies.

```
index.html      — markup and screens
styles.css      — dark neon aesthetic
app.js          — entry point, game loop, screens
maze.js         — deterministic maze generation (Wilson's algorithm)
render.js       — canvas rendering
input.js        — keyboard input handling
game.js         — game state, timer, progression
storage.js      — localStorage helpers (reserved for future use)
```

## Development

No build step. Edit files and refresh the browser. Because modules are used (`type="module"`), the page must be served over HTTP — not opened as a `file://` URL.

A simple way to serve locally:

```bash
npx serve .
# or
python -m http.server
```

Bump `REVISION` in `app.js` and add a row to the Dev Revisions table in `ref/maze_daily_game_spec.md` when shipping a change.
