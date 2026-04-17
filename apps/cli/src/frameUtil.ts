import { randomUUID } from 'node:crypto';
import { PixelBuffer } from '@spriteman/pixel';
import type { Frame, Project, UpdateProjectRequest } from '@spriteman/shared';

export const blankFrame = (w: number, h: number, durationMs: number | null = null): Frame => ({
  id: randomUUID(),
  durationMs,
  layers: [{ pixels: new PixelBuffer(w, h).encode() }],
});

export const projectToUpdate = (p: Project): UpdateProjectRequest => ({
  name: p.name,
  width: p.width,
  height: p.height,
  fps: p.fps,
  frames: p.frames,
  palette: p.palette,
});
