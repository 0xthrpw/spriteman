import type { Command } from 'commander';
import {
  createClient,
  createProject,
  deleteProject,
  getProject,
  listProjects,
} from '../api.js';
import { readActive, resolveProjectId, writeActive } from '../config.js';
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
    .description('create a new project with a single blank frame')
    .requiredOption('--width <n>', 'canvas width (1..256)')
    .requiredOption('--height <n>', 'canvas height (1..256)')
    .option('--fps <n>', 'animation fps (1..60)', '12')
    .option('--json', 'emit JSON')
    .action(
      async (
        name: string,
        opts: { width: string; height: string; fps: string; json?: boolean },
      ) => {
        const c = createClient();
        const project = await createProject(c, {
          name,
          width: parseIntArg(opts.width, '--width'),
          height: parseIntArg(opts.height, '--height'),
          fps: parseIntArg(opts.fps, '--fps'),
        });
        writeActive({ projectId: project.id });
        if (opts.json) output(true, '', project);
        else
          process.stdout.write(
            `created ${project.id}  ${project.width}x${project.height}  ${project.name}\n(set as active project)\n`,
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
};
