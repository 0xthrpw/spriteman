import type { Command } from 'commander';
import {
  createClient,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  mutateProject,
} from '../api.js';
import { readActive, resolveProjectId, writeActive } from '../config.js';
import { blankFrame, projectToUpdate } from '../frameUtil.js';
import { parseColorMap, recolorFrames } from '../recolor.js';
import { die, output, parseIntArg } from '../util.js';

export const register = (program: Command): void => {
  const project = program.command('project').description('manage projects');

  project
    .command('list')
    .description('list all your projects')
    .option('--json', 'emit JSON')
    .action(async (opts: { json?: boolean }) => {
      const c = createClient();
      const rows = await listProjects(c);
      if (opts.json) {
        output(true, '', rows);
        return;
      }
      if (rows.length === 0) {
        process.stdout.write('(no projects)\n');
        return;
      }
      for (const r of rows) {
        process.stdout.write(
          `${r.id}  ${r.width}x${r.height}  ${r.frameCount} frame(s)  v${r.version}  ${r.name}\n`,
        );
      }
    });

  project
    .command('create <name>')
    .description('create a new project, optionally with N blank frames at a given per-frame duration')
    .requiredOption('--width <n>', 'canvas width (1..256)')
    .requiredOption('--height <n>', 'canvas height (1..256)')
    .option('--fps <n>', 'animation fps (1..60)', '12')
    .option('--frames <n>', 'create N blank frames (default 1)')
    .option('--duration <ms>', 'per-frame duration in ms (applied to every frame)')
    .option('--json', 'emit JSON')
    .action(
      async (
        name: string,
        opts: {
          width: string;
          height: string;
          fps: string;
          frames?: string;
          duration?: string;
          json?: boolean;
        },
      ) => {
        const c = createClient();
        const frameCount = opts.frames != null ? parseIntArg(opts.frames, '--frames') : 1;
        if (frameCount < 1) die('--frames must be >= 1');
        const duration =
          opts.duration != null ? parseIntArg(opts.duration, '--duration') : null;
        let project = await createProject(c, {
          name,
          width: parseIntArg(opts.width, '--width'),
          height: parseIntArg(opts.height, '--height'),
          fps: parseIntArg(opts.fps, '--fps'),
        });
        // Server always creates exactly one frame. Top up to frameCount and
        // normalize durations in a single PUT.
        if (frameCount > 1 || duration != null) {
          project = await mutateProject(c, project.id, (p) => {
            const frames = p.frames.slice();
            // Ensure existing frames carry the requested duration.
            if (duration != null) {
              for (let i = 0; i < frames.length; i++) {
                frames[i] = { ...frames[i]!, durationMs: duration };
              }
            }
            while (frames.length < frameCount) {
              frames.push(blankFrame(p.width, p.height, duration));
            }
            return { ...projectToUpdate(p), frames };
          });
        }
        writeActive({ projectId: project.id });
        if (opts.json) output(true, '', project);
        else
          process.stdout.write(
            `created ${project.id}  ${project.width}x${project.height}  ${project.frames.length} frame(s)  ${project.name}\n(set as active project)\n`,
          );
      },
    );

  project
    .command('get [id]')
    .description('fetch a project (defaults to active project)')
    .option('--json', 'emit JSON')
    .action(async (id: string | undefined, opts: { json?: boolean }) => {
      const c = createClient();
      const pid = resolveProjectId(id);
      const p = await getProject(c, pid);
      if (opts.json) output(true, '', p);
      else {
        process.stdout.write(
          `${p.id}\n  name:    ${p.name}\n  size:    ${p.width}x${p.height}\n  fps:     ${p.fps}\n  frames:  ${p.frames.length}\n  version: ${p.version}\n`,
        );
      }
    });

  project
    .command('delete <id>')
    .description('delete a project')
    .action(async (id: string) => {
      const c = createClient();
      await deleteProject(c, id);
      const active = readActive();
      if (active?.projectId === id) writeActive({ projectId: '' });
      process.stdout.write(`deleted ${id}\n`);
    });

  project
    .command('use <id>')
    .description('set the active project (used when --project is omitted)')
    .action((id: string) => {
      if (!id) die('project id required');
      writeActive({ projectId: id });
      process.stdout.write(`active project: ${id}\n`);
    });

  project
    .command('recolor <sourceId> <newName>')
    .description('clone a project into a new one, remapping pixels per --map')
    .requiredOption(
      '--map <pairs>',
      'comma-separated hex:hex pairs, e.g. "#2e3436:#a40000,#555753:#cc0000"',
    )
    .option('--json', 'emit JSON')
    .action(
      async (
        sourceId: string,
        newName: string,
        opts: { map: string; json?: boolean },
      ) => {
        const map = parseColorMap(opts.map);
        if (map.size === 0) die('--map must contain at least one pair');
        const c = createClient();
        const src = await getProject(c, sourceId);
        const newFrames = recolorFrames(src, map);
        const created = await createProject(c, {
          name: newName,
          width: src.width,
          height: src.height,
          fps: src.fps,
        });
        const final = await mutateProject(c, created.id, (p) => ({
          ...projectToUpdate(p),
          frames: newFrames,
          palette: src.palette,
        }));
        if (opts.json) output(true, '', final);
        else
          process.stdout.write(
            `recolored ${src.id} -> ${final.id}  ${final.width}x${final.height}  ${final.frames.length} frame(s)  ${final.name}\n`,
          );
      },
    );
};
