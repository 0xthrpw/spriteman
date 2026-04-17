import {
  PixelBuffer,
  clearBuffer,
  drawLine,
  drawRect,
  floodFill,
  hexToRgba,
  mirrorBuffer,
  rotateBuffer,
  setPixel,
  type RGBA,
} from '@spriteman/pixel';
import type { Frame, Project } from '@spriteman/shared';

export type DrawOp =
  | { type: 'pixel'; x: number; y: number; color: string }
  | { type: 'line'; from: [number, number]; to: [number, number]; color: string; thickness?: number }
  | {
      type: 'rect';
      at: [number, number];
      size: [number, number];
      color: string;
      fill?: boolean;
    }
  | { type: 'bucket'; x: number; y: number; color: string }
  | { type: 'clear'; color?: string }
  | { type: 'mirror'; axis: 'x' | 'y' }
  | { type: 'rotate'; turns: 1 | 2 | 3 }
  | { type: 'apply'; ref: string };

export type FrameScript = {
  index: string | number;
  ops: DrawOp[];
};

export type DrawScript = {
  projectId?: string;
  // Named op groups, referenced via { type: 'apply', ref: <name> }.
  defs?: Record<string, DrawOp[]>;
  // Legacy single-frame shape.
  frame?: string | number;
  ops?: DrawOp[];
  // Multi-frame shape — each entry hits one frame in the project.
  frames?: FrameScript[];
};

const asRgba = (hex: string): RGBA => hexToRgba(hex);

export type ApplyContext = {
  defs?: Record<string, DrawOp[]>;
  depth?: number;
};

const MAX_APPLY_DEPTH = 16;

export const applyOp = (buf: PixelBuffer, op: DrawOp, ctx: ApplyContext = {}): void => {
  switch (op.type) {
    case 'pixel':
      setPixel(buf, op.x, op.y, asRgba(op.color));
      return;
    case 'line':
      drawLine(buf, op.from[0], op.from[1], op.to[0], op.to[1], asRgba(op.color), {
        thickness: op.thickness,
      });
      return;
    case 'rect':
      drawRect(buf, op.at[0], op.at[1], op.size[0], op.size[1], asRgba(op.color), {
        fill: op.fill,
      });
      return;
    case 'bucket':
      floodFill(buf, op.x, op.y, asRgba(op.color));
      return;
    case 'clear':
      clearBuffer(buf, op.color ? asRgba(op.color) : [0, 0, 0, 0]);
      return;
    case 'mirror':
      mirrorBuffer(buf, op.axis);
      return;
    case 'rotate':
      rotateBuffer(buf, op.turns);
      return;
    case 'apply': {
      const depth = ctx.depth ?? 0;
      if (depth >= MAX_APPLY_DEPTH) {
        throw new Error(`apply chain too deep (possible cycle at "${op.ref}")`);
      }
      const group = ctx.defs?.[op.ref];
      if (!group) throw new Error(`apply: no def named "${op.ref}"`);
      for (const inner of group) applyOp(buf, inner, { defs: ctx.defs, depth: depth + 1 });
      return;
    }
  }
};

export const applyOps = (buf: PixelBuffer, ops: DrawOp[], ctx: ApplyContext = {}): void => {
  for (const op of ops) applyOp(buf, op, ctx);
};

/**
 * Locate a frame by UUID or by numeric index.
 */
export const resolveFrame = (project: Project, ref: string | number): { index: number; frame: Frame } => {
  if (typeof ref === 'number' || /^\d+$/.test(String(ref))) {
    const idx = typeof ref === 'number' ? ref : Number(ref);
    const frame = project.frames[idx];
    if (!frame) throw new Error(`frame index ${idx} out of range (0..${project.frames.length - 1})`);
    return { index: idx, frame };
  }
  const idx = project.frames.findIndex((f) => f.id === ref);
  if (idx < 0) throw new Error(`frame id ${ref} not found`);
  return { index: idx, frame: project.frames[idx]! };
};

export const decodeFrame = (project: Project, frame: Frame): PixelBuffer => {
  const pixels = frame.layers[0]?.pixels;
  if (!pixels) throw new Error('frame has no pixel data');
  return PixelBuffer.decode(project.width, project.height, pixels);
};

export const encodeFrame = (buf: PixelBuffer): string => buf.encode();

// Normalize a DrawScript into a list of { index, ops } entries. Accepts both
// the legacy { frame, ops } shape and the new { frames: [...] } shape.
export const normalizeScript = (script: DrawScript): FrameScript[] => {
  if (script.frames && script.frames.length > 0) {
    if (script.ops && script.ops.length > 0) {
      throw new Error('script: use either `frames` OR top-level `ops`, not both');
    }
    return script.frames;
  }
  if (script.ops) {
    return [{ index: script.frame ?? 0, ops: script.ops }];
  }
  throw new Error('script must define `ops` (single-frame) or `frames` (multi-frame)');
};
