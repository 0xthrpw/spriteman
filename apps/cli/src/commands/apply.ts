import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import type { Project } from '@spriteman/shared';
import { createClient, mutateProject } from '../api.js';
import { resolveProjectId } from '../config.js';
import { projectToUpdate as toUpdate } from '../frameUtil.js';
import {
  applyOps,
  decodeFrame,
  encodeFrame,
  normalizeScript,
  resolveFrame,
  type DrawOp,
  type DrawScript,
} from '../ops.js';

/**
 * Run a draw script — either the legacy single-frame shape or the new
 * multi-frame shape — as a single GET + PUT round-trip against the project.
 */
export const runScript = async (script: DrawScript): Promise<Project> => {
  const c = createClient();
  const pid = resolveProjectId(script.projectId);
  const entries = normalizeScript(script);
  return mutateProject(c, pid, (p) => {
    const frames = p.frames.slice();
    // Track indices already mutated so we pull the latest mutated buffer if
    // two entries target the same frame within one script.
    const mutated = new Map<number, ReturnType<typeof decodeFrame>>();
    for (const entry of entries) {
      const { index, frame } = resolveFrame({ ...p, frames }, entry.index);
      const buf = mutated.get(index) ?? decodeFrame(p, frame);
      applyOps(buf, entry.ops, { defs: script.defs });
      mutated.set(index, buf);
      frames[index] = { ...frame, layers: [{ pixels: encodeFrame(buf) }] };
    }
    return { ...toUpdate(p), frames };
  });
};

export const register = (program: Command): void => {
  program
    .command('apply <scriptFile>')
    .description('apply a JSON draw script (single frame or multi-frame) in one PUT')
    .action(async (scriptFile: string) => {
      const script = JSON.parse(readFileSync(scriptFile, 'utf8')) as DrawScript;
      const entries = normalizeScript(script);
      const totalOps = entries.reduce((n, e) => n + e.ops.length, 0);
      const result = await runScript(script);
      process.stdout.write(
        `applied ${totalOps} op(s) across ${entries.length} frame(s), version now ${result.version}\n`,
      );
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
