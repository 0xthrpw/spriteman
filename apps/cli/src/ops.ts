import {
  PixelBuffer,
  clearBuffer,
  drawLine,
  drawRect,
  floodFill,
  hexToRgba,
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
  | { type: 'clear'; color?: string };

export type DrawScript = {
  projectId?: string;
  frame?: string | number;
  ops: DrawOp[];
};

const asRgba = (hex: string): RGBA => hexToRgba(hex);

export const applyOp = (buf: PixelBuffer, op: DrawOp): void => {
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
  }
};

export const applyOps = (buf: PixelBuffer, ops: DrawOp[]): void => {
  for (const op of ops) applyOp(buf, op);
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
