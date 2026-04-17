import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import type { Project, UpdateProjectRequest } from '@spriteman/shared';
import { createClient, mutateProject } from '../api.js';
import { resolveProjectId } from '../config.js';
import { applyOps, decodeFrame, encodeFrame, resolveFrame, type DrawOp, type DrawScript } from '../ops.js';

const toUpdate = (p: Project): UpdateProjectRequest => ({
  name: p.name,
  width: p.width,
  height: p.height,
  fps: p.fps,
  frames: p.frames,
  palette: p.palette,
});

/**
 * Run a sequence of draw ops against a single frame. Shared by the `apply`
 * command (reads a JSON script from disk) and the `draw *` sugar commands
 * (wrap a single op).
 */
export const runScript = async (script: DrawScript): Promise<Project> => {
  const c = createClient();
  const pid = resolveProjectId(script.projectId);
  return mutateProject(c, pid, (p) => {
    const frameRef = script.frame ?? 0;
    const { index, frame } = resolveFrame(p, frameRef);
    const buf = decodeFrame(p, frame);
    applyOps(buf, script.ops);
    const frames = p.frames.slice();
    frames[index] = {
      ...frame,
      layers: [{ pixels: encodeFrame(buf) }],
    };
    return { ...toUpdate(p), frames };
  });
};

export const register = (program: Command): void => {
  program
    .command('apply <scriptFile>')
    .description('apply a JSON draw script (batch of ops) to a frame in one PUT')
    .action(async (scriptFile: string) => {
      const script = JSON.parse(readFileSync(scriptFile, 'utf8')) as DrawScript;
      if (!Array.isArray(script.ops)) throw new Error('script must have an `ops` array');
      const result = await runScript(script);
      process.stdout.write(`applied ${script.ops.length} op(s), version now ${result.version}\n`);
    });
};

// Sugar for single-op workflows — reused by commands/draw.ts
export const runSingleOp = async (
  frameRef: string | number | undefined,
  op: DrawOp,
  projectId?: string,
): Promise<Project> =>
  runScript({
    projectId,
    frame: frameRef,
    ops: [op],
  });
