# spriteman

A browser-based pixel sprite editor with palettes, animation, tiling preview, and cloud save.

## Stack

- React + Vite + TypeScript (`apps/web`)
- Fastify + TypeScript (`apps/api`)
- Node CLI for agents (`apps/cli`)
- Postgres + Drizzle ORM
- Shared zod schemas (`packages/shared`) and pixel primitives (`packages/pixel`)

## Run locally

```bash
# one-time
npm install
cp apps/api/.env.example apps/api/.env
npm run db:up              # starts Postgres in Docker (port 54329)
npm run db:migrate         # apply migrations

# dev
npm run dev:api            # Fastify on :3001
npm run dev:web            # Vite on  :5173 (proxies /api → :3001)
```

Open http://localhost:5173, register an account, and start drawing.

## Features

- Configurable grid (8–128) with pencil, eraser, fill, line, rectangle, eyedropper (brush size 1–4, shift-constrain, alt-eyedropper)
- Palette presets (PICO-8, Sweetie 16, Grayscale), custom palettes, recent colors
- Frame timeline with thumbnails + onion skin + rAF-timed animation preview
- Tiling test area: tile mode (live-updating grid) and stamp mode
- Exports: PNG frame, PNG spritesheet, animated GIF (gifenc), JSON project file
- Debounced autosave with If-Match optimistic concurrency
- CLI (`spriteman`) for AI agents: project/frame/palette management, batched draw ops, PNG/GIF/spritesheet rendering, embedded pixel-art guide

## Keyboard shortcuts

- `B` pencil · `E` eraser · `G` fill · `L` line · `U` rect · `I` eyedropper
- `[` / `]` brush size · `+` / `-` zoom · `X` swap fg/bg
- `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo
- Hold `Alt` with any paint tool to eyedrop · Hold `Shift` to constrain to 45° / square

## CLI

`spriteman` is a Node CLI that wraps the backend so AI agents can author
sprites programmatically. After `npm install` the binary is available at
`node_modules/.bin/spriteman` (invoke directly, or via `npx spriteman`).

```bash
# one-time
spriteman login                          # prompts for email + password, persists
                                         # session cookie to ~/.config/spriteman/

# project + frame management
spriteman project create hero --width 32 --height 32 --fps 8
spriteman project use <id>               # set active project (omits --project later)
spriteman frame add --duration 120

# drawing — batch via `apply` for efficiency (one GET + one PUT)
cat > /tmp/hero.json <<EOF
{ "frame": 0, "ops": [
  { "type": "clear" },
  { "type": "rect", "at": [8,8], "size": [16,16], "color": "#ffec27ff", "fill": true },
  { "type": "line", "from": [8,8], "to": [23,23], "color": "#ab5236ff" }
]}
EOF
spriteman apply /tmp/hero.json

# single-op sugar (each one round-trips once)
spriteman draw pixel --frame 0 --x 12 --y 12 --color '#ff004dff'
spriteman draw fill  --frame 0 --x 0 --y 0 --color '#1d2b53ff'

# render locally (the API has no export endpoints)
spriteman render <id> --frame 0 --out frame.png
spriteman render <id> --sheet --cols 4 --out sheet.png
spriteman render <id> --gif --out anim.gif
spriteman export <id> --out project.json

# built-in pixel-art guide for agents
spriteman guide                          # overview + topic list
spriteman guide palette                  # one topic: resolution / palette /
                                         # shading / lines / animation /
                                         # pitfalls / workflow
```

Env overrides: `SPRITEMAN_API_URL` (default `http://localhost:3000`),
`SPRITEMAN_PROJECT` (default active project).
