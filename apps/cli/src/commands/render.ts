import { writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import { createClient, getProject } from '../api.js';
import { decodeFrame } from '../ops.js';
import { composeSheet, renderPng } from '../render/png.js';
import { renderGif, type GifFrame } from '../render/gif.js';
import { parseIntArg } from '../util.js';

export const register = (program: Command): void => {
  program
    .command('render <projectId>')
    .description('render a project frame (PNG), spritesheet, or GIF to disk')
    .option('--frame <n>', 'frame index (default 0)')
    .option('--sheet', 'render all frames as a spritesheet')
    .option('--cols <n>', 'spritesheet columns (default = frame count)', undefined)
    .option('--gif', 'render an animated GIF')
    .requiredOption('--out <path>')
    .action(
      async (
        projectId: string,
        opts: { frame?: string; sheet?: boolean; cols?: string; gif?: boolean; out: string },
      ) => {
        const c = createClient();
        const p = await getProject(c, projectId);

        if (opts.gif) {
          const gifFrames: GifFrame[] = p.frames.map((f) => ({
            buf: decodeFrame(p, f),
            durationMs: f.durationMs ?? Math.round(1000 / p.fps),
          }));
          renderGif(gifFrames, opts.out);
          process.stdout.write(`wrote ${opts.out} (${gifFrames.length} frames)\n`);
          return;
        }

        if (opts.sheet) {
          const bufs = p.frames.map((f) => decodeFrame(p, f));
          const cols = opts.cols ? parseIntArg(opts.cols, '--cols') : bufs.length;
          const sheet = composeSheet(bufs, cols);
          renderPng(sheet, opts.out);
          process.stdout.write(`wrote ${opts.out} (${bufs.length} frames, ${cols} cols)\n`);
          return;
        }

        const idx = opts.frame != null ? parseIntArg(opts.frame, '--frame') : 0;
        const f = p.frames[idx];
        if (!f) throw new Error(`frame ${idx} out of range (0..${p.frames.length - 1})`);
        const buf = decodeFrame(p, f);
        renderPng(buf, opts.out);
        process.stdout.write(`wrote ${opts.out} (${buf.width}x${buf.height})\n`);
      },
    );

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
