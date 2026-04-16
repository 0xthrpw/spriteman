# spriteman

A browser-based pixel sprite editor with palettes, animation, tiling preview, and cloud save.

## Stack

- React + Vite + TypeScript (`apps/web`)
- Fastify + TypeScript (`apps/api`)
- Postgres + Drizzle ORM
- Shared zod schemas (`packages/shared`)

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

## Keyboard shortcuts

- `B` pencil · `E` eraser · `G` fill · `L` line · `U` rect · `I` eyedropper
- `[` / `]` brush size · `+` / `-` zoom · `X` swap fg/bg
- `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo
- Hold `Alt` with any paint tool to eyedrop · Hold `Shift` to constrain to 45° / square
