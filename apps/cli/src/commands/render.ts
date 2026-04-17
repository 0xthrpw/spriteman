import { writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import type { PixelBuffer } from '@spriteman/pixel';
import { createClient, getProject } from '../api.js';
import { decodeFrame } from '../ops.js';
import { composeSheet, encodePng, scaleBuffer } from '../render/png.js';
import { encodeGif, type GifFrame } from '../render/gif.js';
import { parseFrameSpec, parseIntArg } from '../util.js';

type RenderOpts = {
  frame?: string;
  frames?: string;
  sheet?: boolean;
  cols?: string;
  gif?: boolean;
  scale?: string;
  out?: string;
  stdout?: boolean;
};

const selectIndices = (total: number, opts: RenderOpts): number[] => {
  if (opts.frames) return parseFrameSpec(opts.frames, total);
  return Array.from({ length: total }, (_, i) => i);
};

const writeOut = (bytes: Buffer, opts: RenderOpts, humanSummary: string): void => {
  if (opts.stdout) {
    process.stdout.write(bytes);
    process.stderr.write(`${humanSummary}\n`);
    return;
  }
  if (!opts.out) throw new Error('--out is required (or pass --stdout to pipe bytes)');
  writeFileSync(opts.out, bytes);
  process.stdout.write(`wrote ${opts.out} (${humanSummary})\n`);
};

export const register = (program: Command): void => {
  program
    .command('render <projectId>')
    .description('render a project frame (PNG), spritesheet, or GIF')
    .option('--frame <n>', 'single-frame mode: frame index (default 0)')
    .option('--frames <spec>', 'frame range for --sheet/--gif (e.g. "0..3", "0,2,5", "0..15:4")')
    .option('--sheet', 'render frames as a spritesheet')
    .option('--cols <n>', 'spritesheet columns (default = frame count)')
    .option('--gif', 'render an animated GIF')
    .option('--scale <n>', 'integer nearest-neighbor upscale factor (default 1)')
    .option('--out <path>', 'output path (omit if --stdout)')
    .option('--stdout', 'write encoded bytes to stdout instead of a file')
    .action(async (projectId: string, opts: RenderOpts) => {
      const c = createClient();
      const p = await getProject(c, projectId);
      const scale = opts.scale != null ? parseIntArg(opts.scale, '--scale') : 1;
      const up = (b: PixelBuffer) => scaleBuffer(b, scale);

      if (opts.gif) {
        const idxs = selectIndices(p.frames.length, opts);
        const gifFrames: GifFrame[] = idxs.map((i) => {
          const f = p.frames[i]!;
          return {
            buf: up(decodeFrame(p, f)),
            durationMs: f.durationMs ?? Math.round(1000 / p.fps),
          };
        });
        const bytes = encodeGif(gifFrames);
        writeOut(bytes, opts, `${gifFrames.length} frame(s) GIF @ x${scale}`);
        return;
      }

      if (opts.sheet) {
        const idxs = selectIndices(p.frames.length, opts);
        const bufs = idxs.map((i) => decodeFrame(p, p.frames[i]!));
        const cols = opts.cols ? parseIntArg(opts.cols, '--cols') : bufs.length;
        const sheet = up(composeSheet(bufs, cols));
        const bytes = encodePng(sheet);
        writeOut(
          bytes,
          opts,
          `sheet ${bufs.length} frame(s), ${cols} cols @ x${scale}`,
        );
        return;
      }

      const idx = opts.frame != null ? parseIntArg(opts.frame, '--frame') : 0;
      const f = p.frames[idx];
      if (!f) throw new Error(`frame ${idx} out of range (0..${p.frames.length - 1})`);
      const buf = up(decodeFrame(p, f));
      const bytes = encodePng(buf);
      writeOut(bytes, opts, `${buf.width}x${buf.height}`);
    });

  program
    .command('export <projectId>')
    .description('dump the project as JSON (pixel data remains base64-deflated)')
    .requiredOption('--out <path>')
    .action(async (projectId: string, opts: { out: string }) => {
      const c = createClient();
      const p = await getProject(c, projectId);
      writeFileSync(opts.out, JSON.stringify(p, null, 2));
      process.stdout.write(`wrote ${opts.out}\n`);
    });
};
