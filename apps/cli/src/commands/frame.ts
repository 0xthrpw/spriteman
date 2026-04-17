import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import { PixelBuffer } from '@spriteman/pixel';
import type { Frame, UpdateProjectRequest, Project } from '@spriteman/shared';
import { createClient, mutateProject } from '../api.js';
import { resolveProjectId } from '../config.js';
import { resolveFrame } from '../ops.js';
import { output, parseIntArg } from '../util.js';

const blankFrame = (w: number, h: number): Frame => ({
  id: randomUUID(),
  durationMs: null,
  layers: [{ pixels: new PixelBuffer(w, h).encode() }],
});

const toUpdate = (p: Project): UpdateProjectRequest => ({
  name: p.name,
  width: p.width,
  height: p.height,
  fps: p.fps,
  frames: p.frames,
  palette: p.palette,
});

export const register = (program: Command): void => {
  const frame = program.command('frame').description('manage frames within a project');

  frame
    .command('list')
    .description('list frames in the active (or --project) project')
    .option('--project <id>')
    .option('--json', 'emit JSON')
    .action(async (opts: { project?: string; json?: boolean }) => {
      const c = createClient();
      const pid = resolveProjectId(opts.project);
      const p = (await c.get<Project>(`/projects/${pid}`)).data;
      const items = p.frames.map((f, i) => ({ index: i, id: f.id, durationMs: f.durationMs }));
      if (opts.json) output(true, '', items);
      else {
        for (const row of items) process.stdout.write(`${row.index}  ${row.id}  ${row.durationMs ?? '—'}ms\n`);
      }
    });

  frame
    .command('add')
    .description('add a blank frame')
    .option('--project <id>')
    .option('--at <index>', 'insert at index (default: end)')
    .option('--duration <ms>', 'per-frame duration in ms')
    .option('--json', 'emit JSON')
    .action(
      async (opts: { project?: string; at?: string; duration?: string; json?: boolean }) => {
        const c = createClient();
        const pid = resolveProjectId(opts.project);
        const result = await mutateProject(c, pid, (p) => {
          const nf = blankFrame(p.width, p.height);
          if (opts.duration) nf.durationMs = parseIntArg(opts.duration, '--duration');
          const frames = p.frames.slice();
          const at = opts.at != null ? parseIntArg(opts.at, '--at') : frames.length;
          frames.splice(at, 0, nf);
          return { ...toUpdate(p), frames };
        });
        const addedFrame = result.frames.find((f) => !opts.at || true);
        if (opts.json) output(true, '', result);
        else process.stdout.write(`added frame ${addedFrame?.id}\n`);
      },
    );

  frame
    .command('duplicate <frameRef>')
    .description('duplicate a frame (by id or index)')
    .option('--project <id>')
    .action(async (ref: string, opts: { project?: string }) => {
      const c = createClient();
      const pid = resolveProjectId(opts.project);
      const result = await mutateProject(c, pid, (p) => {
        const { index, frame: f } = resolveFrame(p, ref);
        const dup: Frame = { ...f, id: randomUUID(), layers: f.layers.map((l) => ({ ...l })) };
        const frames = p.frames.slice();
        frames.splice(index + 1, 0, dup);
        return { ...toUpdate(p), frames };
      });
      process.stdout.write(`duplicated; now ${result.frames.length} frame(s)\n`);
    });

  frame
    .command('delete <frameRef>')
    .description('delete a frame (refuses to delete the last one)')
    .option('--project <id>')
    .action(async (ref: string, opts: { project?: string }) => {
      const c = createClient();
      const pid = resolveProjectId(opts.project);
      const result = await mutateProject(c, pid, (p) => {
        if (p.frames.length <= 1) throw new Error('cannot delete the last remaining frame');
        const { index } = resolveFrame(p, ref);
        const frames = p.frames.slice();
        frames.splice(index, 1);
        return { ...toUpdate(p), frames };
      });
      process.stdout.write(`deleted; now ${result.frames.length} frame(s)\n`);
    });

  frame
    .command('move <frameRef>')
    .description('move a frame to a new index')
    .option('--project <id>')
    .requiredOption('--to <index>')
    .action(async (ref: string, opts: { project?: string; to: string }) => {
      const c = createClient();
      const pid = resolveProjectId(opts.project);
      const to = parseIntArg(opts.to, '--to');
      await mutateProject(c, pid, (p) => {
        const { index, frame: f } = resolveFrame(p, ref);
        const frames = p.frames.slice();
        frames.splice(index, 1);
        frames.splice(Math.max(0, Math.min(to, frames.length)), 0, f);
        return { ...toUpdate(p), frames };
      });
      process.stdout.write(`moved frame to index ${to}\n`);
    });

  frame
    .command('duration <frameRef> <ms>')
    .description('set per-frame duration in milliseconds')
    .option('--project <id>')
    .action(async (ref: string, ms: string, opts: { project?: string }) => {
      const c = createClient();
      const pid = resolveProjectId(opts.project);
      const duration = parseIntArg(ms, 'duration');
      await mutateProject(c, pid, (p) => {
        const { index, frame: f } = resolveFrame(p, ref);
        const frames = p.frames.slice();
        frames[index] = { ...f, durationMs: duration };
        return { ...toUpdate(p), frames };
      });
      process.stdout.write(`set duration to ${duration}ms\n`);
    });
};
