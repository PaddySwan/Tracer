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

Bump `REVISION` in `app.js` and add a row to the changelog below when shipping a change.

## Changelog

| Rev | What's new |
|-----|------------|
| 1 | Launch: six mazes, keyboard + touch controls, timer, trail recording, recap screen |
| 6 | Improved maze generation (Wilson's algorithm), trail heatmap fade, tap-to-move |
| 9 | Six mazes in a 3×2 recap grid; click any panel to expand it |
| 11 | Keyboard feel: first tap moves one cell, hold starts fast repeat |
| 16 | Title font changed to Pacifico |
| 20 | Smooth animated movement (tween queue, easeInOut) |
| 23 | Goal node displayed as a star |
| 24 | Start and end corners vary per maze |
| 25 | Better maze quality — minimum path length enforced |
| 26 | One run per day; result saved so you can return to view it |
| 27 | Practice mode: endless random mazes, no timer pressure |
| 30 | Self-hosted fonts and favicon |
| 33 | Emoji trail colors in results and copy text |
| 34 | Daily number shown on home and results screens |
| 35 | Copy Image: copies a 1080×1080 PNG to the clipboard — paste directly into any app to share |
| 36 | Holiday theming: trail colors and emojis change on 8 major holidays |
